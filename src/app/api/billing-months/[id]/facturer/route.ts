import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canInvoice, getCurrentMember } from "@/lib/adv-permissions";
import { triggerN8nWebhook } from "@/lib/n8n-client";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ELIGIBLE_STATUSES = ["non_fait", "en_cours", null] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canInvoice(member)) {
    return NextResponse.json(
      { error: "Forbidden — seuls Admin ou Finance peuvent facturer une échéance" },
      { status: 403 },
    );
  }

  const { id: billingMonthId } = await ctx.params;
  if (!billingMonthId) {
    return NextResponse.json({ error: "billing_month id manquant dans l'URL" }, { status: 400 });
  }

  let body: { dealId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.dealId?.trim();
  if (!dealId) {
    return NextResponse.json(
      { error: "dealId requis dans le body (le billing_entry doit être lié à un deal)" },
      { status: 400 },
    );
  }

  const { data: bm, error: bmErr } = await serviceClient
    .from("billing_months")
    .select("id, month, amount, status, pennylane_invoice_id, billing_entry_id")
    .eq("id", billingMonthId)
    .maybeSingle();
  if (bmErr) {
    return NextResponse.json({ error: bmErr.message }, { status: 500 });
  }
  if (!bm) {
    return NextResponse.json({ error: `Billing month ${billingMonthId} introuvable` }, { status: 404 });
  }

  if (bm.pennylane_invoice_id) {
    return NextResponse.json(
      {
        error: "Une facture Pennylane existe déjà pour cette échéance",
        pennylane_invoice_id: bm.pennylane_invoice_id,
      },
      { status: 409 },
    );
  }

  if (!ELIGIBLE_STATUSES.includes(bm.status as typeof ELIGIBLE_STATUSES[number])) {
    return NextResponse.json(
      {
        error: `Statut "${bm.status}" non éligible (attendu: non_fait, en_cours, ou vide)`,
        current_status: bm.status,
      },
      { status: 409 },
    );
  }

  if (!bm.amount || Number(bm.amount) <= 0) {
    return NextResponse.json(
      { error: `Montant de l'échéance invalide (${bm.amount}) — renseigner un montant > 0 avant de facturer` },
      { status: 400 },
    );
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select("id, name, owner_id, contact_id, company_id")
    .eq("id", dealId)
    .maybeSingle();
  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  }

  const result = await triggerN8nWebhook("invoice-from-deal", {
    dealId: deal.id,
    billing_month_id: bm.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: `n8n trigger failed: ${result.error}`, status: result.status },
      { status: 502 },
    );
  }

  const monthLabel = bm.month
    ? new Date(bm.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : "échéance";

  await serviceClient.from("activities").insert({
    type: "note",
    title: `[ADV] Facturation échéance ${monthLabel} déclenchée`,
    description: `Facture demandée via le bouton "Facturer cette échéance" (deal "${deal.name ?? deal.id}", montant ${bm.amount} €, échéance ${monthLabel}). Workflow n8n WF-005 branche A déclenché avec billing_month_id=${bm.id}.`,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    team_member_id: member.id,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    billing_month_id: bm.id,
    deal_id: deal.id,
    month: bm.month,
    amount: bm.amount,
    message:
      "Facture Pennylane en cours de génération. Le statut passera en \"facture\" automatiquement après création (sous ~10s).",
  });
}
