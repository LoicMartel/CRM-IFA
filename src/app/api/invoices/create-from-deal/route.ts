import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canInvoice, getCurrentMember } from "@/lib/adv-permissions";
import { triggerN8nWebhook } from "@/lib/n8n-client";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STAGES = ["quote_signed", "opco_deposit", "closed_won"] as const;

export async function POST(req: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canInvoice(member)) {
    return NextResponse.json(
      { error: "Forbidden — seul un Admin ou un membre Finance peut déclencher une facturation" },
      { status: 403 },
    );
  }

  let body: { deal_id?: string; invoice_amount?: number; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.deal_id?.trim();
  if (!dealId) {
    return NextResponse.json({ error: "deal_id manquant" }, { status: 400 });
  }

  if (body.invoice_amount !== undefined && (typeof body.invoice_amount !== "number" || body.invoice_amount <= 0)) {
    return NextResponse.json(
      { error: "invoice_amount doit être un nombre positif si fourni" },
      { status: 400 },
    );
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select("id, name, stage, amount, owner_id, contact_id, company_id, pennylane_quote_id, pennylane_invoice_id, is_invoiced")
    .eq("id", dealId)
    .maybeSingle();

  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  }

  if (!ALLOWED_STAGES.includes(deal.stage as typeof ALLOWED_STAGES[number])) {
    return NextResponse.json(
      {
        error: `Stage "${deal.stage}" non éligible (attendu: ${ALLOWED_STAGES.join(", ")})`,
        deal_stage: deal.stage,
      },
      { status: 409 },
    );
  }

  if (deal.is_invoiced && deal.pennylane_invoice_id) {
    return NextResponse.json(
      {
        error: "Ce deal a déjà une invoice Pennylane émise. Pour une nouvelle invoice (échéance OPCO), passer par la V2 convention.",
        pennylane_invoice_id: deal.pennylane_invoice_id,
      },
      { status: 409 },
    );
  }

  const payload: Record<string, unknown> = { deal_id: deal.id };
  if (body.invoice_amount !== undefined) payload.invoice_amount = body.invoice_amount;
  if (body.label) payload.label = body.label;

  const result = await triggerN8nWebhook("invoice-from-deal", payload);

  if (!result.ok) {
    return NextResponse.json(
      { error: `n8n trigger failed: ${result.error}`, status: result.status },
      { status: 502 },
    );
  }

  const amountStr = body.invoice_amount !== undefined ? `${body.invoice_amount} €` : `${deal.amount ?? "?"} € (montant total deal)`;
  await serviceClient.from("activities").insert({
    type: "note",
    title: "[ADV] Facturation Pennylane déclenchée",
    description: `Facturation demandée via le bouton CRM (deal "${deal.name ?? deal.id}", montant ${amountStr}${body.label ? `, label "${body.label}"` : ""}). Workflow n8n WF-005 branche A déclenché.`,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    team_member_id: member.id,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    deal_id: deal.id,
    message: "Facturation Pennylane en cours (invoice créée + envoi email automatique au client).",
  });
}
