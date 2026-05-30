import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { finalizeAndSendBillingMonthInvoice, AdvInvoiceError } from "@/lib/adv-invoice";

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
    .select("id, status, month, pennylane_invoice_id, deal_id, billing_entry_id")
    .eq("id", bmId)
    .maybeSingle();
  if (!bm) return NextResponse.json({ error: `Échéance ${bmId} introuvable` }, { status: 404 });
  if (bm.status !== "a_valider") {
    return NextResponse.json(
      { error: `Échéance pas en attente (status=${bm.status})` },
      { status: 409 },
    );
  }
  if (!bm.pennylane_invoice_id) {
    return NextResponse.json(
      { error: "Draft Pennylane absent — régénérer d'abord" },
      { status: 422 },
    );
  }

  // Email destinataire (deal -> contact)
  let dealId = bm.deal_id as string | null;
  if (!dealId) {
    const { data: entry } = await serviceClient
      .from("billing_entries")
      .select("deal_id")
      .eq("id", bm.billing_entry_id)
      .maybeSingle();
    dealId = entry?.deal_id ?? null;
  }
  const { data: deal } = dealId
    ? await serviceClient
        .from("deals")
        .select("contact_id, company_id, name")
        .eq("id", dealId)
        .maybeSingle()
    : { data: null };
  const { data: contact } = deal?.contact_id
    ? await serviceClient
        .from("contacts")
        .select("email")
        .eq("id", deal.contact_id)
        .maybeSingle()
    : { data: null };
  const email = contact?.email;
  if (!email)
    return NextResponse.json({ error: "Email du contact introuvable" }, { status: 422 });

  try {
    const r = await finalizeAndSendBillingMonthInvoice({
      pennylaneInvoiceId: Number(bm.pennylane_invoice_id),
      recipientEmail: email,
    });
    await serviceClient
      .from("billing_months")
      .update({
        status: "facture",
        invoice_email_sent: r.emailSent,
        deal_id: dealId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bmId);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Facture validée et émise",
      description: `Échéance validée par la Finance : facture ${r.invoiceNumber ?? bm.pennylane_invoice_id} finalisée${r.emailSent ? " + email envoyé" : " (email en attente, cron retry)"}.`,
      contact_id: deal?.contact_id ?? null,
      company_id: deal?.company_id ?? null,
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
