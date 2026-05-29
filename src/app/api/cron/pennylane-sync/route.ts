import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  pollRecentInvoices,
  sendInvoiceByEmail,
  PennylaneError,
} from "@/lib/pennylane-client";
import { resolveRecipientEmail } from "@/lib/adv-quote";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Fenêtre de polling : le filtre Pennylane porte sur la date d'ÉMISSION (pas le
// paiement), donc on regarde ~35j en arrière pour capter les invoices récentes
// payées entre-temps. Volume LCA faible (~6 invoices/30j).
const POLL_WINDOW_DAYS = 35;
const RETRY_EMAIL_BATCH = 50;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Cron pennylane-sync (T8) :
 *  1. Paiements : invoices Pennylane `paid` (amount>0) → billing_months `encaisse` + deals `is_paid`
 *  2. Retry email : factures dont l'email a échoué en T5 (PDF pas prêt) → renvoi
 *
 * ⚠️ Vercel Hobby limite les crons à 1×/jour (vercel.json: "0 8 * * *"). Pour un
 * sync/retry plus fréquent (utile pour que la facture parte le jour même), pinguer
 * cet endpoint via un cron externe (cron-job.org / GitHub Actions) avec le header
 * `Authorization: Bearer ${CRON_SECRET}`, ou passer Vercel Pro.
 */
export async function GET(req: NextRequest) {
  // Auth via header Vercel cron (automatique) ou Bearer CRON_SECRET (manuel)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (!isVercelCron && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const summary = { paidBillingMonths: 0, paidDeals: 0, emailsRetried: 0, errors: [] as string[] };

  // ─── 1. Sync des paiements ────────────────────────────────────────────────
  const since = new Date();
  since.setDate(since.getDate() - POLL_WINDOW_DAYS);
  let invoices: Awaited<ReturnType<typeof pollRecentInvoices>> = [];
  try {
    invoices = await pollRecentInvoices(isoDate(since));
  } catch (e) {
    summary.errors.push(`poll: ${e instanceof Error ? e.message : String(e)}`);
  }

  for (const inv of invoices) {
    const isPaid = inv.paid === true || inv.status === "paid";
    const amount = Number(inv.currency_amount ?? 0);
    // amount>0 exclut les credit notes (paid avec amount<0) — cf rule pennylane caveat 2
    if (!isPaid || amount <= 0) continue;

    const invId = String(inv.id);
    const { data: bms } = await supabase
      .from("billing_months")
      .update({ status: "encaisse", updated_at: nowIso })
      .eq("pennylane_invoice_id", invId)
      .neq("status", "encaisse")
      .select("id");
    if (bms?.length) summary.paidBillingMonths += bms.length;

    const { data: deals } = await supabase
      .from("deals")
      .update({ is_paid: true, updated_at: nowIso })
      .eq("pennylane_invoice_id", invId)
      .eq("is_paid", false)
      .select("id");
    if (deals?.length) summary.paidDeals += deals.length;
  }

  // ─── 2. Retry des emails de facture non envoyés ───────────────────────────
  const { data: pending } = await supabase
    .from("billing_months")
    .select("id, pennylane_invoice_id, deal_id")
    .not("pennylane_invoice_id", "is", null)
    .eq("invoice_email_sent", false)
    .eq("status", "facture")
    .limit(RETRY_EMAIL_BATCH);

  for (const bm of pending ?? []) {
    try {
      const { data: deal } = await supabase
        .from("deals")
        .select("contact_id")
        .eq("id", bm.deal_id)
        .maybeSingle();
      if (!deal?.contact_id) continue;

      const { data: contact } = await supabase
        .from("contacts")
        .select("email")
        .eq("id", deal.contact_id)
        .maybeSingle();
      const email = contact?.email;
      if (!email) continue;

      await sendInvoiceByEmail(Number(bm.pennylane_invoice_id), [resolveRecipientEmail(email)], {
        maxAttempts: 1,
      });
      await supabase
        .from("billing_months")
        .update({ invoice_email_sent: true, updated_at: nowIso })
        .eq("id", bm.id);
      summary.emailsRetried++;
    } catch (e) {
      // 409 = PDF pas encore prêt → on réessaiera au prochain run (silencieux).
      if (!(e instanceof PennylaneError && e.status === 409)) {
        summary.errors.push(`retry bm ${bm.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
