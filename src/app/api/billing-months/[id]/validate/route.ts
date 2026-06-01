import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { generateBillingMonthInvoice, AdvInvoiceError } from "@/lib/adv-invoice";
import { deleteInvoice, PennylaneError } from "@/lib/pennylane-client";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canValidateAdv(member))
    return NextResponse.json({ error: "Forbidden — Admin ou Finance requis" }, { status: 403 });
  const { id: bmId } = await ctx.params;

  const { data: bm } = await serviceClient
    .from("billing_months")
    .select("id, status, month, amount, pennylane_invoice_id, deal_id, billing_entry_id")
    .eq("id", bmId)
    .maybeSingle();
  if (!bm) return NextResponse.json({ error: `Échéance ${bmId} introuvable` }, { status: 404 });
  if (bm.status !== "a_valider") {
    return NextResponse.json(
      { error: `Échéance pas en attente (status=${bm.status})` },
      { status: 409 },
    );
  }

  // Résolution deal -> contact/company (pour recréer la facture finalisée).
  let dealId = bm.deal_id as string | null;
  if (!dealId) {
    const { data: entry } = await serviceClient
      .from("billing_entries")
      .select("deal_id")
      .eq("id", bm.billing_entry_id)
      .maybeSingle();
    dealId = entry?.deal_id ?? null;
  }
  if (!dealId) return NextResponse.json({ error: "Deal introuvable pour l'échéance" }, { status: 422 });

  const { data: deal } = await serviceClient
    .from("deals")
    .select("id, name, contact_id, company_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  const { data: contact } = await serviceClient
    .from("contacts")
    .select("first_name, last_name, email, phone")
    .eq("id", deal.contact_id)
    .maybeSingle();
  const { data: company } = await serviceClient
    .from("companies")
    .select("id, name, siret, address, city, country")
    .eq("id", deal.company_id)
    .maybeSingle();
  if (!contact || !company)
    return NextResponse.json({ error: "Contact ou entreprise introuvable" }, { status: 422 });

  // Pennylane n'autorise pas PUT draft:false (400 NotExistPropertyDefinition). On supprime
  // donc le draft d'aperçu (draft = supprimable) puis on crée la facture FINALISÉE
  // directement (createInvoice draft:false, chemin éprouvé E2E) + send_by_email.
  if (bm.pennylane_invoice_id) {
    try {
      await deleteInvoice(Number(bm.pennylane_invoice_id));
    } catch (e) {
      // 422/404 = déjà supprimé / non draft → on continue (l'idempotency external_reference
      // de generateBillingMonthInvoice récupèrera une éventuelle facture existante).
      if (!(e instanceof PennylaneError && (e.status === 422 || e.status === 404))) {
        return NextResponse.json(
          { error: `Suppression du draft échouée : ${e instanceof Error ? e.message : String(e)}` },
          { status: 502 },
        );
      }
    }
  }

  try {
    const r = await generateBillingMonthInvoice({
      deal: { id: deal.id, name: deal.name, amount: bm.amount, training_days: null, notes: null },
      contact,
      company,
      billingMonth: { id: bm.id, month: bm.month, amount: bm.amount },
    });
    await serviceClient
      .from("billing_months")
      .update({
        status: "facture",
        pennylane_invoice_id: String(r.pennylaneInvoiceId),
        invoice_email_sent: r.emailSent,
        deal_id: deal.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bmId);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Facture validée et émise",
      description: `Échéance validée par la Finance : facture ${r.invoiceNumber ?? r.pennylaneInvoiceId} émise${r.emailSent ? " + email envoyé" : " (email en attente, cron retry)"}.`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      billing_month_id: bmId,
      invoice_number: r.invoiceNumber,
      email_sent: r.emailSent,
    });
  } catch (err) {
    const message = err instanceof AdvInvoiceError || err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Validation facture échouée : ${message}` }, { status: 502 });
  }
}
