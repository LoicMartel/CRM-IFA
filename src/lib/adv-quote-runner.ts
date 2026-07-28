/**
 * Génération + effets de bord d'un devis pour un deal (intra-CRM, V2 Carbone).
 * Partagé entre l'endpoint create-from-deal (prepare) et le cron
 * pennylane-sync (prepare planifié). Service-role client fourni par l'appelant.
 *
 * prepareDealQuote : fetch contact/company → assignQuoteNumber → prepareQuoteDoc (.docx Carbone) →
 * update deal (stage quote_to_validate) → remplace le .docx devis dans deal_documents →
 * log activité → notif Naznine.
 *
 * sendValidatedQuote : relit le .docx depuis deal_documents → convertDocxToPdf →
 * sendQuoteSignature (Firma) → update deal (stage quote_sent) → log activité.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareQuoteDoc, sendQuoteSignature } from "@/lib/adv-quote-doc";
import { convertDocxToPdf } from "@/lib/carbone-client";
import { assignQuoteNumber } from "@/lib/quote-number";
import { notifyPieceToValidate } from "@/lib/adv-notify";
import { resolveBeneficiary } from "@/lib/adv-raison-sociale";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fmtFR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

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
  /** Entité (raison sociale) facturée, ou null pour les infos de l'entreprise. */
  raison_sociale_id: string | null;
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
 * Assigne le numéro CRM, rend le .docx Carbone, le stocke dans deal_documents
 * (en remplaçant l'éventuel devis précédent), passe le deal en quote_to_validate,
 * notifie Naznine. L'envoi Firma est fait par la validation.
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
  // Entité choisie sur le deal (SIRET / adresse / raison sociale du devis), sinon l'entreprise.
  const beneficiary = await resolveBeneficiary(serviceClient, deal.company_id, deal.raison_sociale_id);
  if (!contact || !beneficiary) {
    return { ok: false, status: 422, error: "Contact ou entreprise introuvable sur le deal" };
  }

  try {
    const quoteNumber = await assignQuoteNumber(serviceClient, deal.id);
    const now = new Date();
    const { docx } = await prepareQuoteDoc({
      deal: { id: deal.id, name: deal.name },
      company: { name: beneficiary.name, address: beneficiary.address, city: beneficiary.city, siret: beneficiary.siret },
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      lines: deal.quote_lines ?? [],
      header: {
        quoteNumber,
        subject: deal.quote_subject,
        description: deal.quote_pdf_description,
        date: fmtFR(now),
        validUntil: fmtFR(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
      },
    });

    // Remplace l'ancien .docx devis (un seul devis courant dans les pièces).
    const { data: oldDocs } = await serviceClient.from("deal_documents")
      .select("id, file_path").eq("deal_id", deal.id).eq("document_type", "devis");
    if (oldDocs?.length) {
      await serviceClient.storage.from("deal-documents").remove(oldDocs.map((d) => d.file_path));
      await serviceClient.from("deal_documents").delete().in("id", oldDocs.map((d) => d.id));
    }
    const filename = `Devis_${quoteNumber}.docx`;
    const storagePath = `${deal.id}/${filename}`;
    await serviceClient.storage.from("deal-documents").upload(storagePath, docx, {
      contentType: DOCX_MIME, upsert: true,
    });
    await serviceClient.from("deal_documents").insert({
      deal_id: deal.id, name: filename, file_path: storagePath,
      file_size: docx.length, file_type: DOCX_MIME, document_type: "devis",
    });

    await serviceClient.from("deals").update({
      stage: "quote_to_validate",
      quote_scheduled_send_at: null,
      updated_at: now.toISOString(),
    }).eq("id", deal.id);

    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Devis préparé — à valider",
      description: `Devis ${quoteNumber} généré (.docx) et en attente de validation${via ? ` — ${via}` : ""}.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
      contact_id: deal.contact_id, company_id: deal.company_id,
      team_member_id: teamMemberId, created_at: new Date().toISOString(),
    });

    await notifyPieceToValidate(serviceClient, {
      type: "devis", label: deal.name ?? deal.id, dealId: deal.id,
    });

    return { ok: true, pennylaneQuoteId: quoteNumber, invoiceNumber: quoteNumber, signingLink: null, warning: nomenclatureWarning };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
 * Relit le dernier .docx devis, le convertit en PDF (Carbone) et l'envoie.
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
    .select("id, name, stage, contact_id, company_id, quote_number, raison_sociale_id")
    .eq("id", dealId).maybeSingle();
  if (!deal) return { ok: false, status: 404, error: `Deal ${dealId} introuvable` };
  if (deal.stage !== "quote_to_validate") {
    return { ok: false, status: 409, error: `Deal pas en attente de validation (stage=${deal.stage})` };
  }

  const { data: contact } = await serviceClient
    .from("contacts").select("first_name, last_name, email, phone")
    .eq("id", deal.contact_id).maybeSingle();
  // Le document de signature porte le nom de l'entité retenue à la préparation.
  const beneficiary = await resolveBeneficiary(serviceClient, deal.company_id, deal.raison_sociale_id);
  if (!contact) return { ok: false, status: 422, error: "Contact introuvable" };

  try {
    const { data: doc } = await serviceClient
      .from("deal_documents").select("file_path")
      .eq("deal_id", dealId).eq("document_type", "devis")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!doc?.file_path) return { ok: false, status: 422, error: "Document devis (.docx) introuvable" };

    const { data: dl } = await serviceClient.storage.from("deal-documents").download(doc.file_path);
    if (!dl) return { ok: false, status: 422, error: "Téléchargement du .docx devis échoué" };
    const docxBuffer = Buffer.from(await dl.arrayBuffer());
    const pdf = await convertDocxToPdf(docxBuffer);

    const r = await sendQuoteSignature({
      companyName: beneficiary?.name ?? null,
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      pdfBase64: pdf.toString("base64"),
      quoteNumber: (deal.quote_number as string) ?? dealId,
    });

    await serviceClient.from("deals").update({
      stage: "quote_sent",
      firma_devis_signing_id: r.signingRequestId,
      updated_at: new Date().toISOString(),
    }).eq("id", dealId);

    await serviceClient.from("activities").insert({
      type: "note", title: "[ADV] Devis validé et envoyé",
      description: `Devis validé par la Finance et envoyé en signature (Firma). Deal passé en quote_sent.`,
      contact_id: deal.contact_id, company_id: deal.company_id,
      team_member_id: teamMemberId, created_at: new Date().toISOString(),
    });

    return { ok: true, pennylaneQuoteId: (deal.quote_number as string) ?? dealId, invoiceNumber: (deal.quote_number as string) ?? null, signingLink: r.signingLink, warning: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 502, error: `Envoi devis échoué : ${message}` };
  }
}
