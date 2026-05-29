import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";
import { triggerN8nWebhook } from "@/lib/n8n-client";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STAGES = ["opportunities", "quote_to_send"] as const;

export async function POST(req: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { deal_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.deal_id?.trim();
  if (!dealId) {
    return NextResponse.json({ error: "deal_id manquant" }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select("id, name, stage, amount, owner_id, contact_id, company_id, program_id, training_type_id, pennylane_quote_id")
    .eq("id", dealId)
    .maybeSingle();

  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  }

  if (!canCreateQuote(member, deal)) {
    return NextResponse.json(
      { error: "Forbidden — seul l'owner du deal ou un Admin peut créer un devis" },
      { status: 403 },
    );
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

  if (deal.pennylane_quote_id) {
    return NextResponse.json(
      {
        error: "Un devis Pennylane existe déjà pour ce deal",
        pennylane_quote_id: deal.pennylane_quote_id,
      },
      { status: 409 },
    );
  }

  const nomenclatureWarning =
    !deal.program_id || !deal.training_type_id
      ? "Nomenclature incomplète (program_id ou training_type_id NULL) — le workflow va probablement skip via le node Notify Skip côté n8n."
      : null;

  const result = await triggerN8nWebhook("lca-devis-a-envoyer", { dealId: deal.id });

  if (!result.ok) {
    return NextResponse.json(
      { error: `n8n trigger failed: ${result.error}`, status: result.status },
      { status: 502 },
    );
  }

  await serviceClient.from("activities").insert({
    type: "note",
    title: "[ADV] Devis Pennylane déclenché",
    description: `Devis demandé via le bouton CRM (deal "${deal.name ?? deal.id}", montant ${deal.amount ?? "?"} €). Workflow n8n WF-002b-firma déclenché.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    team_member_id: member.id,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    deal_id: deal.id,
    message: "Devis Pennylane en cours (génération PDF 3-5 min, puis email signature Firma au client).",
    warning: nomenclatureWarning ?? undefined,
  });
}
