import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { prepareBillingMonthInvoiceDraft, AdvInvoiceError } from "@/lib/adv-invoice";
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
    .select("id, month, amount, status, billing_entry_id, pennylane_invoice_id")
    .eq("id", bmId)
    .maybeSingle();
  if (!bm) return NextResponse.json({ error: `Échéance ${bmId} introuvable` }, { status: 404 });
  if (bm.status !== "a_valider" && bm.status !== "planifie") {
    return NextResponse.json(
      { error: `Échéance non régénérable (status=${bm.status})` },
      { status: 409 },
    );
  }

  const { data: entry } = await serviceClient
    .from("billing_entries")
    .select("deal_id")
    .eq("id", bm.billing_entry_id)
    .maybeSingle();
  if (!entry?.deal_id)
    return NextResponse.json({ error: "billing_entry sans deal_id" }, { status: 422 });
  const { data: deal } = await serviceClient
    .from("deals")
    .select("id, name, contact_id, company_id")
    .eq("id", entry.deal_id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal introuvable" }, { status: 404 });
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
    return NextResponse.json({ error: "Contact/company manquant" }, { status: 422 });

  // Supprime le draft précédent (draft supprimable) pour repartir propre.
  if (bm.pennylane_invoice_id) {
    try {
      await deleteInvoice(Number(bm.pennylane_invoice_id));
    } catch (e) {
      if (!(e instanceof PennylaneError && e.status === 422))
        console.error("prepare bm: delete old draft failed", e);
    }
  }

  try {
    const draft = await prepareBillingMonthInvoiceDraft({
      deal: { id: deal.id, name: deal.name, amount: bm.amount, training_days: null, notes: null },
      contact,
      company,
      billingMonth: { id: bm.id, month: bm.month, amount: bm.amount },
    });
    await serviceClient
      .from("billing_months")
      .update({
        status: "a_valider",
        pennylane_invoice_id: String(draft.pennylaneInvoiceId),
        deal_id: deal.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bmId);
    return NextResponse.json({
      ok: true,
      billing_month_id: bmId,
      pennylane_invoice_id: draft.pennylaneInvoiceId,
    });
  } catch (err) {
    const message = err instanceof AdvInvoiceError || err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Préparation facture échouée : ${message}` }, { status: 502 });
  }
}
