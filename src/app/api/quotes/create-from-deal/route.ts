import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";
import { triggerN8nWebhook } from "@/lib/n8n-client";
import { generateOfficialQuote, AdvQuoteError } from "@/lib/adv-quote";

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

  // --- Chemin intra-CRM : Pennylane + Firma direct ---
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

  if (!contact || !company) {
    return NextResponse.json(
      { error: "Contact ou entreprise introuvable sur le deal" },
      { status: 422 },
    );
  }

  try {
    const quoteResult = await generateOfficialQuote({
      deal: {
        id: deal.id,
        name: deal.name,
        amount: deal.amount,
        training_days: deal.training_days,
        notes: deal.notes,
      },
      contact,
      company,
    });

    // Lock + passage en "Devis envoyé". Les stages éligibles (opportunities /
    // quote_to_send) ont déjà été vérifiés plus haut → on passe à quote_sent.
    await serviceClient
      .from("deals")
      .update({
        pennylane_quote_id: String(quoteResult.pennylaneQuoteId),
        stage: "quote_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    // Enregistrer le PDF du devis dans les documents du deal (best-effort)
    try {
      if (quoteResult.publicFileUrl) {
        const pdfRes = await fetch(quoteResult.publicFileUrl);
        if (pdfRes.ok) {
          const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
          const filename = `Devis_${quoteResult.invoiceNumber ?? quoteResult.pennylaneQuoteId}.pdf`;
          const storagePath = `${deal.id}/${filename}`;
          await serviceClient.storage
            .from("deal-documents")
            .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
          await serviceClient.from("deal_documents").insert({
            deal_id: deal.id,
            name: filename,
            file_path: storagePath,
            file_size: pdfBuffer.length,
            file_type: "application/pdf",
            document_type: "devis",
          });
        }
      }
    } catch (docErr) {
      console.error("Devis PDF -> deal_documents failed:", docErr);
    }

    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Devis envoyé pour signature",
      description: `Devis ${quoteResult.invoiceNumber ?? quoteResult.pennylaneQuoteId} créé (Pennylane) et envoyé pour signature (Firma) au contact.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      deal_id: deal.id,
      pennylane_quote_id: quoteResult.pennylaneQuoteId,
      invoice_number: quoteResult.invoiceNumber,
      signing_link: quoteResult.signingLink,
      message: "Devis créé et email de signature envoyé au client.",
      warning: nomenclatureWarning ?? undefined,
    });
  } catch (err) {
    const message = err instanceof AdvQuoteError || err instanceof Error ? err.message : String(err);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Échec génération devis",
      description: `Erreur lors de la génération du devis intra-CRM : ${message}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: `Génération devis échouée : ${message}` }, { status: 502 });
  }
}
