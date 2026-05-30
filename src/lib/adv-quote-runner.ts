/**
 * Génération + effets de bord d'un devis pour un deal (intra-CRM).
 * Partagé entre l'endpoint create-from-deal (envoi immédiat) et le cron
 * pennylane-sync (envoi planifié). Service-role client fourni par l'appelant.
 *
 * Fait : fetch contact/company → generateOfficialQuote (Pennylane + Firma) →
 * update deal (pennylane_quote_id, stage quote_sent, clear quote_scheduled_send_at) →
 * stocke le PDF dans deal_documents (best-effort) → log activité (succès/échec).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOfficialQuote, AdvQuoteError } from "@/lib/adv-quote";

export interface RunDealQuoteDeal {
  id: string;
  name: string | null;
  amount: number | string | null;
  training_days: number | string | null;
  notes: string | null;
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

export async function runDealQuote(opts: {
  serviceClient: SupabaseClient;
  deal: RunDealQuoteDeal;
  teamMemberId: string | null;
  /** Label de provenance pour l'activité (ex: "planifié"). */
  via?: string;
}): Promise<RunDealQuoteResult> {
  const { serviceClient, deal, teamMemberId, via } = opts;

  const nomenclatureWarning =
    !deal.amount || Number(deal.amount) <= 0 || !deal.training_days
      ? "Montant ou jours de formation manquant sur le deal."
      : null;

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
    return { ok: false, status: 422, error: "Contact ou entreprise introuvable sur le deal" };
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

    await serviceClient
      .from("deals")
      .update({
        pennylane_quote_id: String(quoteResult.pennylaneQuoteId),
        stage: "quote_sent",
        quote_scheduled_send_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    // PDF -> deal_documents (best-effort)
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
      description: `Devis ${quoteResult.invoiceNumber ?? quoteResult.pennylaneQuoteId} créé (Pennylane) et envoyé pour signature (Firma)${via ? ` — ${via}` : ""}.${nomenclatureWarning ? `\n\n⚠️ ${nomenclatureWarning}` : ""}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: teamMemberId,
      created_at: new Date().toISOString(),
    });

    return {
      ok: true,
      pennylaneQuoteId: quoteResult.pennylaneQuoteId,
      invoiceNumber: quoteResult.invoiceNumber,
      signingLink: quoteResult.signingLink,
      warning: nomenclatureWarning,
    };
  } catch (err) {
    const message = err instanceof AdvQuoteError || err instanceof Error ? err.message : String(err);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Échec génération devis",
      description: `Erreur lors de la génération du devis intra-CRM${via ? ` (${via})` : ""} : ${message}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: teamMemberId,
      created_at: new Date().toISOString(),
    });
    return { ok: false, status: 502, error: `Génération devis échouée : ${message}` };
  }
}
