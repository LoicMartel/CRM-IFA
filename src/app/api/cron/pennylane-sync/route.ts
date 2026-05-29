import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  pollRecentInvoices,
  sendInvoiceByEmail,
  PennylaneError,
} from "@/lib/pennylane-client";
import { resolveRecipientEmail } from "@/lib/adv-quote";
import { billingAutoMode, isOpcoConventionSatisfied } from "@/lib/adv-billing-schedule";
import { generateBillingMonthInvoice, AdvInvoiceError } from "@/lib/adv-invoice";

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
  const summary = {
    paidBillingMonths: 0,
    paidDeals: 0,
    emailsRetried: 0,
    scheduledInvoiced: 0,
    scheduledFlagged: 0,
    scheduledSkippedOpco: 0,
    errors: [] as string[],
  };

  // ─── 0. Scan des échéances planifiées dues ────────────────────────────────
  const mode = billingAutoMode();
  const today = isoDate(new Date()); // borne "mois <= aujourd'hui"
  const { data: duePlanned } = await supabase
    .from("billing_months")
    .select("id, month, amount, billing_entry_id")
    .eq("status", "planifie")
    .is("pennylane_invoice_id", null)
    .lte("month", today);

  // Awaits séquentiels par ligne VOLONTAIRES : la création d'invoice s'appuie sur la
  // récupération idempotente Pennylane (422 external_reference) + politesse rate-limit.
  // NE PAS paralléliser (Promise.all casserait l'idempotency et déclencherait du 429).
  for (const bm of duePlanned ?? []) {
    try {
      const { data: entry } = await supabase
        .from("billing_entries")
        .select("deal_id, funding_type, client_name")
        .eq("id", bm.billing_entry_id)
        .maybeSingle();
      if (!entry?.deal_id) {
        summary.errors.push(
          `scan bm ${bm.id} (${entry?.client_name ?? "client inconnu"}): billing_entry sans deal_id`,
        );
        continue;
      }

      if (mode === "validate") {
        await supabase
          .from("billing_months")
          .update({ status: "a_valider", updated_at: nowIso })
          .eq("id", bm.id);
        summary.scheduledFlagged++;
        continue;
      }

      const { data: deal } = await supabase
        .from("deals")
        .select("id, name, contact_id, company_id, convention_signed_at")
        .eq("id", entry.deal_id)
        .maybeSingle();
      if (!deal) {
        summary.errors.push(`scan bm ${bm.id} (${entry.client_name ?? "?"}): deal ${entry.deal_id} introuvable`);
        continue;
      }

      if (!isOpcoConventionSatisfied(entry.funding_type, deal.convention_signed_at)) {
        summary.scheduledSkippedOpco++;
        continue;
      }

      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name, email, phone")
        .eq("id", deal.contact_id)
        .maybeSingle();
      const { data: company } = await supabase
        .from("companies")
        .select("id, name, siret, address, city, country")
        .eq("id", deal.company_id)
        .maybeSingle();
      if (!contact || !company) {
        summary.errors.push(
          `scan bm ${bm.id} (${entry.client_name ?? deal.name ?? "?"}): contact/company manquant`,
        );
        continue;
      }

      const result = await generateBillingMonthInvoice({
        // L'invoice line est dérivée de billingMonth.amount ; deal.amount n'est pas lu
        // par generateBillingMonthInvoice mais QuoteDealInput l'exige → on y met bm.amount.
        deal: { id: deal.id, name: deal.name, amount: bm.amount, training_days: null, notes: null },
        contact,
        company,
        billingMonth: { id: bm.id, month: bm.month, amount: bm.amount },
      });
      await supabase
        .from("billing_months")
        .update({
          status: "facture",
          pennylane_invoice_id: String(result.pennylaneInvoiceId),
          deal_id: deal.id,
          invoice_email_sent: result.emailSent,
          updated_at: nowIso,
        })
        .eq("id", bm.id);
      summary.scheduledInvoiced++;

      // Audit trail (cron context : pas de membre connecté → team_member_id null).
      // Un échec de log ne doit JAMAIS annuler une facture déjà créée → catch isolé.
      try {
        const monthLabel = bm.month
          ? new Date(bm.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          : "échéance";
        await supabase.from("activities").insert({
          type: "note",
          title: "[ADV cron] Échéance facturée automatiquement",
          description: `Facture ${result.invoiceNumber ?? result.pennylaneInvoiceId} créée automatiquement (cron ADV) pour l'échéance ${monthLabel} du deal "${deal.name ?? deal.id}" (${Number(bm.amount ?? 0).toFixed(2)} €).${result.emailSent ? " Email envoyé au client." : " ⚠️ Email pas encore envoyé (PDF en génération) — le cron réessaiera."}`,
          contact_id: deal.contact_id,
          company_id: company.id,
          team_member_id: null,
          created_at: nowIso,
        });
      } catch (logErr) {
        summary.errors.push(
          `scan bm ${bm.id} (${entry.client_name ?? deal.name ?? "?"}): facture OK mais log activity échoué — ${logErr instanceof Error ? logErr.message : String(logErr)}`,
        );
      }
    } catch (e) {
      const msg = e instanceof AdvInvoiceError || e instanceof Error ? e.message : String(e);
      summary.errors.push(`scan bm ${bm.id}: ${msg}`);
    }
  }

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
