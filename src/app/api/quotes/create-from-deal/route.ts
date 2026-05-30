import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";
import { triggerN8nWebhook } from "@/lib/n8n-client";
import { runDealQuote } from "@/lib/adv-quote-runner";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STAGES = ["opportunities", "quote_to_send"] as const;

// Kill switch : true => ancien proxy n8n (rollback instant), false => intra-CRM.
const USE_N8N_FALLBACK = process.env.USE_N8N_FALLBACK === "true";

export async function POST(req: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { deal_id?: string; scheduled_send_at?: string };
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
    .select("id, name, stage, amount, owner_id, contact_id, company_id, training_days, notes, pennylane_quote_id")
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
    !deal.amount || Number(deal.amount) <= 0 || !deal.training_days
      ? "Montant ou jours de formation manquant sur le deal."
      : null;

  // --- Planification : enregistre la date, le cron pennylane-sync génère + envoie le jour venu ---
  const scheduledRaw = body.scheduled_send_at?.trim();
  if (scheduledRaw) {
    const when = new Date(scheduledRaw);
    if (isNaN(when.getTime())) {
      return NextResponse.json({ error: "scheduled_send_at invalide (date attendue)" }, { status: 400 });
    }
    await serviceClient
      .from("deals")
      .update({ quote_scheduled_send_at: when.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", deal.id);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Envoi du devis planifié",
      description: `Envoi du devis planifié pour le ${when.toLocaleDateString("fr-FR")} (deal "${deal.name ?? deal.id}"). Le devis sera généré et envoyé automatiquement ce jour-là.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      deal_id: deal.id,
      scheduled: true,
      scheduled_send_at: when.toISOString(),
      message: `Envoi du devis planifié pour le ${when.toLocaleDateString("fr-FR")}.`,
      warning: nomenclatureWarning ?? undefined,
    });
  }

  // --- Chemin legacy : proxy n8n (kill switch) ---
  if (USE_N8N_FALLBACK) {
    const result = await triggerN8nWebhook("lca-devis-a-envoyer", { dealId: deal.id });
    if (!result.ok) {
      return NextResponse.json(
        { error: `n8n trigger failed: ${result.error}`, status: result.status },
        { status: 502 },
      );
    }
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Devis Pennylane déclenché (n8n)",
      description: `Devis demandé via le bouton CRM (deal "${deal.name ?? deal.id}"). Workflow n8n WF-002b-firma déclenché.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      deal_id: deal.id,
      message: "Devis Pennylane en cours via n8n (génération PDF 3-5 min, puis email signature Firma).",
      warning: nomenclatureWarning ?? undefined,
    });
  }

  // --- Chemin intra-CRM : Pennylane + Firma direct (runner partagé avec le cron) ---
  const result = await runDealQuote({
    serviceClient,
    deal: {
      id: deal.id,
      name: deal.name,
      amount: deal.amount,
      training_days: deal.training_days,
      notes: deal.notes,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
    },
    teamMemberId: member.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    deal_id: deal.id,
    pennylane_quote_id: result.pennylaneQuoteId,
    invoice_number: result.invoiceNumber,
    signing_link: result.signingLink,
    message: "Devis créé et email de signature envoyé au client.",
    warning: result.warning ?? undefined,
  });
}
