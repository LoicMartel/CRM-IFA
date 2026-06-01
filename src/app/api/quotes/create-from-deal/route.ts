import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";
import { prepareDealQuote } from "@/lib/adv-quote-runner";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STAGES = ["opportunities", "quote_to_send", "quote_to_validate"] as const;

export async function POST(req: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    deal_id?: string;
    scheduled_send_at?: string;
    lines?: import("@/lib/adv-quote").QuoteLineDraft[];
    subject?: string;
    description?: string;
  };
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
    .select("id, name, stage, amount, owner_id, contact_id, company_id, training_days, notes, pennylane_quote_id, quote_lines, quote_subject, quote_pdf_description")
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

  if (deal.pennylane_quote_id && deal.stage !== "quote_to_validate") {
    return NextResponse.json(
      {
        error: "Un devis Pennylane existe déjà pour ce deal",
        pennylane_quote_id: deal.pennylane_quote_id,
      },
      { status: 409 },
    );
  }

  // Persiste les lignes éditées (source de vérité CRM). Si le client n'envoie rien,
  // on garde l'existant (deal.quote_lines) — pas d'écrasement.
  if (Array.isArray(body.lines)) {
    if (body.lines.length === 0) {
      return NextResponse.json({ error: "Au moins une ligne est requise" }, { status: 400 });
    }
    const VALID_VAT = ["FR_200", "FR_100", "FR_055", "exempt"];
    for (const l of body.lines) {
      if (!l.label?.trim()) return NextResponse.json({ error: "Chaque ligne doit avoir un libellé" }, { status: 400 });
      if (typeof l.quantity !== "number" || l.quantity <= 0) return NextResponse.json({ error: "Quantité invalide (> 0 requis)" }, { status: 400 });
      const price = parseFloat(l.unit_price);
      if (isNaN(price) || price < 0) return NextResponse.json({ error: `Prix invalide : "${l.unit_price}"` }, { status: 400 });
      if (!VALID_VAT.includes(l.vat_rate)) return NextResponse.json({ error: `Taux TVA invalide : "${l.vat_rate}"` }, { status: 400 });
    }
    await serviceClient
      .from("deals")
      .update({
        quote_lines: body.lines,
        quote_subject: body.subject ?? null,
        quote_pdf_description: body.description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);
    deal.quote_lines = body.lines;
    deal.quote_subject = body.subject ?? null;
    deal.quote_pdf_description = body.description ?? null;
  }

  const nomenclatureWarning =
    !deal.amount || Number(deal.amount) <= 0
      ? "Montant manquant sur le deal."
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
      description: `Envoi du devis planifié pour le ${when.toLocaleDateString("fr-FR")} (deal "${deal.name ?? deal.id}"). Le devis sera généré et placé en validation ce jour-là.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
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

  // --- Chemin intra-CRM : Pennylane direct (runner partagé avec le cron) ---
  const result = await prepareDealQuote({
    serviceClient,
    deal: {
      id: deal.id,
      name: deal.name,
      amount: deal.amount,
      training_days: deal.training_days,
      notes: deal.notes,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      quote_lines: deal.quote_lines,
      quote_subject: deal.quote_subject,
      quote_pdf_description: deal.quote_pdf_description,
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
    quote_number: result.pennylaneQuoteId,
    invoice_number: result.invoiceNumber,
    message: "Devis préparé — à valider dans « Pièces à valider » avant envoi.",
    warning: result.warning ?? undefined,
  });
}
