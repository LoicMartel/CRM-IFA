import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseSignedWebhook, type FirmaSignedEvent } from "@/lib/firma-client";
import { resolveRecipientEmail } from "@/lib/adv-quote";
import { sendSessionEmail } from "@/lib/send-email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NAZNINE_EMAIL = "naznine@ifagroupe.com";

/**
 * Webhook Firma — signature de devis complétée (port WF-002b, branche signed).
 *
 * Endpoint public (cf middleware publicPrefixes "/api/webhooks"). HMAC V2 skip
 * en V1 POC (origine protégée par l'URL n8n-style secrète, cf firma-api.md).
 *
 * Sur `signing_request.completed` : passe le deal en `quote_signed` et notifie
 * Naznine de démarrer la facturation. Les autres events (declined/expired/...)
 * partagent l'endpoint mais sont ignorés (guard type).
 */
export async function POST(req: NextRequest) {
  let body: FirmaSignedEvent;
  try {
    body = (await req.json()) as FirmaSignedEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Guard : seul l'event "completed" déclenche l'update business
  if (body.type !== "signing_request.completed") {
    return NextResponse.json({ ok: true, skipped: `event ${body.type}` });
  }

  const parsed = parseSignedWebhook(body);
  let dealId = parsed.dealId;
  let docType = parsed.docType;
  const { signerName, signingRequestId } = parsed;

  // Primary: resolve by stored Firma signing id (clean names carry no tag).
  // Deux lookups .eq() séparés : la valeur vient d'un endpoint PUBLIC (body webhook),
  // .eq() encode la valeur côté supabase-js → pas de filter-injection PostgREST
  // (contrairement à .or() interpolé).
  if (parsed.signingRequestId) {
    const { data: byDevis } = await supabase
      .from("deals")
      .select("id")
      .eq("firma_devis_signing_id", parsed.signingRequestId)
      .maybeSingle();
    if (byDevis) {
      dealId = byDevis.id as string;
      docType = "devis";
    } else {
      const { data: byConv } = await supabase
        .from("deals")
        .select("id")
        .eq("firma_convention_signing_id", parsed.signingRequestId)
        .maybeSingle();
      if (byConv) {
        dealId = byConv.id as string;
        docType = "convention";
      }
    }
  }

  if (!dealId) {
    return NextResponse.json({
      ok: true,
      skipped: "signing request not mapped to any deal",
      signing_request_id: signingRequestId,
    });
  }

  // Branche convention : set convention_signed_at (débloque le gate OPCO du planificateur).
  if (docType === "convention") {
    const { data: cDeal } = await supabase
      .from("deals")
      .select("id, convention_signed_at, contact_id, company_id, name")
      .eq("id", dealId)
      .maybeSingle();
    if (!cDeal) {
      return NextResponse.json({ ok: true, skipped: `deal ${dealId} not found` });
    }
    if (cDeal.convention_signed_at) {
      return NextResponse.json({ ok: true, skipped: "convention already signed", deal_id: dealId });
    }
    const { error: cErr } = await supabase
      .from("deals")
      .update({ convention_signed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", dealId);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    await supabase.from("activities").insert({
      type: "note",
      title: "[ADV] Convention signée",
      description: `Convention de formation signée via Firma${signerName ? ` par ${signerName}` : ""}. La facturation OPCO est débloquée.`,
      contact_id: cDeal.contact_id,
      company_id: cDeal.company_id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, deal_id: dealId, convention_signed: true });
  }

  // Idempotency : ne ré-update que si pas déjà signé
  const { data: deal } = await supabase
    .from("deals")
    .select("id, stage, contact_id, company_id, name")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ ok: true, skipped: `deal ${dealId} not found` });
  }
  if (deal.stage === "quote_signed") {
    return NextResponse.json({ ok: true, skipped: "already quote_signed", deal_id: dealId });
  }

  const { error: updateErr } = await supabase
    .from("deals")
    .update({ stage: "quote_signed", updated_at: new Date().toISOString() })
    .eq("id", dealId);

  if (updateErr) {
    // 500 → laisse Firma retry
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Activity log
  await supabase.from("activities").insert({
    type: "note",
    title: "[ADV] Devis signé",
    description: `Devis signé via Firma${signerName ? ` par ${signerName}` : ""}. Deal passé en quote_signed. Facturation à démarrer.`,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    created_at: new Date().toISOString(),
  });

  // Notif Naznine : démarrer la facturation (best-effort, ne bloque pas la 200)
  try {
    const { data: naznine } = await supabase
      .from("team_members")
      .select("id")
      .eq("email", NAZNINE_EMAIL)
      .maybeSingle();

    if (naznine) {
      await supabase.from("notifications").insert({
        recipient_id: naznine.id,
        type: "quote_signed",
        title: "Devis signé — démarrer la facturation",
        body: `Le devis du deal "${deal.name ?? dealId}" vient d'être signé.`,
        link_url: `/deals/${dealId}`,
        related_entity_type: "deal",
        related_entity_id: dealId,
      });
    }
    await sendSessionEmail({
      // mode test : redirige la notif vers l'adresse de test
      to: resolveRecipientEmail(NAZNINE_EMAIL),
      subject: "Devis signé — démarrer la facturation",
      body: `Bonjour,\n\nLe devis du deal "${deal.name ?? dealId}" vient d'être signé par le client${signerName ? ` (${signerName})` : ""}.\n\nLa facturation peut être démarrée.\n\nCRM : https://crm-lca.vercel.app/deals/${dealId}`,
    });
  } catch (notifErr) {
    console.error("Firma webhook: notif Naznine failed:", notifErr);
  }

  return NextResponse.json({ ok: true, deal_id: dealId, stage: "quote_signed" });
}
