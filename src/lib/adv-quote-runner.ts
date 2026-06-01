/**
 * Génération + effets de bord d'un devis pour un deal (intra-CRM).
 * Partagé entre l'endpoint create-from-deal (prepare) et le cron
 * pennylane-sync (prepare planifié). Service-role client fourni par l'appelant.
 *
 * prepareDealQuote : fetch contact/company → prepareOfficialQuote (Pennylane) →
 * update deal (pennylane_quote_id, stage quote_to_validate) →
 * stocke le PDF dans deal_documents (best-effort) → log activité → notif Naznine.
 *
 * sendValidatedQuote : charge le PDF depuis deal_documents → sendQuoteSignature (Firma) →
 * update deal (stage quote_sent) → log activité.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareOfficialQuote, sendQuoteSignature, AdvQuoteError } from "@/lib/adv-quote";
import { notifyPieceToValidate } from "@/lib/adv-notify";

export interface RunDealQuoteDeal {
  id: string;
  name: string | null;
  amount: number | string | null;
  training_days: number | string | null;
  notes: string | null;
  quote_lines: import("@/lib/adv-quote").QuoteLineDraft[] | null;
  quote_subject: string | null;
  quote_pdf_description: string | null;
  contact_id: string | null;
  company_id: string | null;
}

export type RunDealQuoteResult =
  | {
      ok: true;
      pennylaneQuoteId: number | string;
      invoiceNumber: string | null;
      signingLink: string | null;
      warning: string | null;
    }
  | { ok: false; status: number; error: string };

/**
 * Prépare un devis pour validation (PAS d'envoi client). Partagé entre
 * create-from-deal (now) et le cron 0bis (planifié).
 * Crée le quote Pennylane, stocke le PDF dans deal_documents, passe le deal
 * en quote_to_validate, notifie Naznine. L'envoi Firma est fait par la validation.
 */
export async function prepareDealQuote(opts: {
  serviceClient: SupabaseClient;
  deal: RunDealQuoteDeal;
  teamMemberId: string | null;
  via?: string;
}): Promise<RunDealQuoteResult> {
  const { serviceClient, deal, teamMemberId, via } = opts;

  const nomenclatureWarning =
    !deal.amount || Number(deal.amount) <= 0
      ? "Montant manquant sur le deal."
      : null;

  const { data: contact } = await serviceClient
    .from("contacts").select("first_name, last_name, email, phone")
    .eq("id", deal.contact_id).maybeSingle();
  const { data: company } = await serviceClient
    .from("companies").select("id, name, siret, address, city, country")
    .eq("id", deal.company_id).maybeSingle();
  if (!contact || !company) {
    return { ok: false, status: 422, error: "Contact ou entreprise introuvable sur le deal" };
  }

  try {
    const q = await prepareOfficialQuote({
      deal: { id: deal.id, name: deal.name, amount: deal.amount, training_days: deal.training_days, notes: deal.notes },
      contact,
      company,
      lines: deal.quote_lines,
      subject: deal.quote_subject,
      description: deal.quote_pdf_description,
    });

    await serviceClient.from("deals").update({
      pennylane_quote_id: String(q.pennylaneQuoteId),
      stage: "quote_to_validate",
      quote_scheduled_send_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", deal.id);

    // PDF -> deal_documents (best-effort)
    try {
      if (q.publicFileUrl) {
        const pdfRes = await fetch(q.publicFileUrl);
        if (pdfRes.ok) {
          const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
          const filename = `Devis_${q.invoiceNumber ?? q.pennylaneQuoteId}.pdf`;
          const storagePath = `${deal.id}/${filename}`;
          await serviceClient.storage.from("deal-documents")
            .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
          await serviceClient.from("deal_documents").insert({
            deal_id: deal.id, name: filename, file_path: storagePath,
            file_size: pdfBuffer.length, file_type: "application/pdf", document_type: "devis",
          });
        }
      }
    } catch (docErr) {
      console.error("Devis PDF -> deal_documents failed:", docErr);
    }

    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Devis préparé — à valider",
      description: `Devis ${q.invoiceNumber ?? q.pennylaneQuoteId} créé (Pennylane) et en attente de validation${via ? ` — ${via}` : ""}.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
      contact_id: deal.contact_id, company_id: deal.company_id,
      team_member_id: teamMemberId, created_at: new Date().toISOString(),
    });

    await notifyPieceToValidate(serviceClient, {
      type: "devis", label: deal.name ?? deal.id, dealId: deal.id,
    });

    return { ok: true, pennylaneQuoteId: q.pennylaneQuoteId, invoiceNumber: q.invoiceNumber, signingLink: null, warning: nomenclatureWarning };
  } catch (err) {
    const message = err instanceof AdvQuoteError || err instanceof Error ? err.message : String(err);
    await serviceClient.from("activities").insert({
      type: "note", title: "[ADV] Échec préparation devis",
      description: `Erreur lors de la préparation du devis${via ? ` (${via})` : ""} : ${message}`,
      contact_id: deal.contact_id, company_id: deal.company_id,
      team_member_id: teamMemberId, created_at: new Date().toISOString(),
    });
    return { ok: false, status: 502, error: `Préparation devis échouée : ${message}` };
  }
}

/**
 * Envoie un devis déjà préparé (quote_to_validate) en signature Firma.
 * Appelée par l'endpoint de validation. Passe le deal en quote_sent.
 */
export async function sendValidatedQuote(opts: {
  serviceClient: SupabaseClient;
  dealId: string;
  teamMemberId: string | null;
}): Promise<RunDealQuoteResult> {
  const { serviceClient, dealId, teamMemberId } = opts;

  const { data: deal } = await serviceClient
    .from("deals")
    .select("id, name, stage, pennylane_quote_id, contact_id, company_id")
    .eq("id", dealId).maybeSingle();
  if (!deal) return { ok: false, status: 404, error: `Deal ${dealId} introuvable` };
  if (deal.stage !== "quote_to_validate") {
    return { ok: false, status: 409, error: `Deal pas en attente de validation (stage=${deal.stage})` };
  }
  if (!deal.pennylane_quote_id) {
    return { ok: false, status: 422, error: "pennylane_quote_id absent — devis non préparé" };
  }

  const { data: contact } = await serviceClient
    .from("contacts").select("first_name, last_name, email, phone")
    .eq("id", deal.contact_id).maybeSingle();
  const { data: company } = await serviceClient
    .from("companies").select("name").eq("id", deal.company_id).maybeSingle();
  if (!contact) return { ok: false, status: 422, error: "Contact introuvable" };

  try {
    // Le PDF du devis a été stocké dans deal_documents au moment du prepare :
    // on le relit via une signed URL (évite un appel Pennylane supplémentaire).
    const { data: doc } = await serviceClient
      .from("deal_documents")
      .select("file_path")
      .eq("deal_id", dealId).eq("document_type", "devis")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    let publicFileUrl: string;
    if (doc?.file_path) {
      const { data: signed } = await serviceClient.storage
        .from("deal-documents").createSignedUrl(doc.file_path, 600);
      publicFileUrl = signed?.signedUrl ?? "";
    } else {
      publicFileUrl = "";
    }
    if (!publicFileUrl) {
      return { ok: false, status: 422, error: "PDF du devis introuvable dans deal_documents" };
    }

    const r = await sendQuoteSignature({
      publicFileUrl,
      invoiceNumber: null,
      companyName: company?.name ?? null,
      contact,
    });

    await serviceClient.from("deals").update({
      stage: "quote_sent",
      firma_devis_signing_id: r.firmaSigningId,
      updated_at: new Date().toISOString(),
    }).eq("id", dealId);

    await serviceClient.from("activities").insert({
      type: "note", title: "[ADV] Devis validé et envoyé",
      description: `Devis validé par la Finance et envoyé en signature (Firma). Deal passé en quote_sent.`,
      contact_id: deal.contact_id, company_id: deal.company_id,
      team_member_id: teamMemberId, created_at: new Date().toISOString(),
    });

    return { ok: true, pennylaneQuoteId: Number(deal.pennylane_quote_id), invoiceNumber: null, signingLink: r.signingLink, warning: null };
  } catch (err) {
    const message = err instanceof AdvQuoteError || err instanceof Error ? err.message : String(err);
    return { ok: false, status: 502, error: `Envoi devis échoué : ${message}` };
  }
}
