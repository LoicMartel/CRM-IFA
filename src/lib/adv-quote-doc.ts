/**
 * Orchestration "devis CRM-native" (V2, remplace la génération Pennylane).
 * Mappe deal/company/contact + lignes éditées -> data Carbone, rend le .docx,
 * et (à la validation) convertit en PDF + envoie en signature Firma.
 * Pur (pas d'accès Supabase) : l'appelant (runner) fournit les entités + gère le stockage.
 */
import type { QuoteLineDraft } from "@/lib/adv-quote";
import { renderDevisDocx } from "@/lib/carbone-client";
import { createAndSendSigningRequest, buildDevisName } from "@/lib/firma-client";
import { resolveRecipientEmail } from "@/lib/adv-quote";

const ANCHOR_DEVIS = "Bon pour accord";

export interface QuoteDocDeal { id: string; name: string | null; }
export interface QuoteDocCompany { name: string | null; address: string | null; city: string | null; siret: string | null; }
export interface QuoteDocContact { first_name: string | null; last_name: string | null; email: string | null; }
export interface QuoteDocHeader {
  quoteNumber: string; subject: string | null; description: string | null;
  /** Date d'émission FR (JJ/MM/AAAA), calculée par le runner. */
  date: string;
  /** Date de validité FR (émission + 30 j), calculée par le runner. */
  validUntil: string;
}

export class AdvQuoteDocError extends Error {
  constructor(message: string) { super(message); this.name = "AdvQuoteDocError"; }
}

const VAT_FACTOR: Record<string, number> = { FR_200: 0.2, FR_100: 0.1, FR_055: 0.055, exempt: 0 };

/** Montant en format français : "15 000,00" (séparateur de milliers + virgule décimale). Le template ajoute " €". */
function fmtEUR(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Construit le JSON data attendu par le template Carbone devis (tags confirmés render E2E). */
export function buildQuoteData(
  deal: QuoteDocDeal,
  company: QuoteDocCompany,
  contact: QuoteDocContact,
  lines: QuoteLineDraft[],
  header: QuoteDocHeader,
): Record<string, unknown> {
  const rows = lines.map((l) => {
    const pu = parseFloat(l.unit_price) || 0;
    const ht = pu * (l.quantity || 0);
    return {
      label: l.label,
      description: l.description ?? "",
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: fmtEUR(pu),
      totalHT: fmtEUR(ht),
    };
  });
  const totalHT = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (l.quantity || 0), 0);
  const totalTVA = lines.reduce((s, l) => {
    const ht = (parseFloat(l.unit_price) || 0) * (l.quantity || 0);
    return s + ht * (VAT_FACTOR[l.vat_rate] ?? 0);
  }, 0);
  const decisionnaire = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
  const companyAddress = [company.address, company.city].filter(Boolean).join(", ") || "—";
  return {
    quoteNumber: header.quoteNumber,
    date: header.date,
    validUntil: header.validUntil,
    subject: header.subject ?? deal.name ?? "Devis",
    description: header.description ?? "",
    companyName: company.name ?? "—",
    siret: company.siret ?? "—",
    companyAddress,
    decisionnaire,
    lines: rows,
    totalHT: fmtEUR(totalHT),
    totalTVA: fmtEUR(totalTVA),
    totalTTC: fmtEUR(totalHT + totalTVA),
  };
}

/** Rend le .docx de devis (Carbone). Pas d'envoi. */
export async function prepareQuoteDoc(args: {
  deal: QuoteDocDeal; company: QuoteDocCompany; contact: QuoteDocContact;
  lines: QuoteLineDraft[]; header: QuoteDocHeader;
}): Promise<{ docx: Buffer }> {
  const data = buildQuoteData(args.deal, args.company, args.contact, args.lines, args.header);
  const docx = await renderDevisDocx(data);
  return { docx };
}

/** Envoie un PDF de devis déjà converti en signature Firma (1 signataire). */
export async function sendQuoteSignature(args: {
  companyName: string | null; contact: QuoteDocContact; pdfBase64: string; quoteNumber: string;
}): Promise<{ signingRequestId: string; signingLink: string | null }> {
  const email = args.contact.email?.trim();
  if (!email) throw new AdvQuoteDocError("Contact email manquant — impossible d'envoyer le devis.");
  const sr = await createAndSendSigningRequest({
    name: buildDevisName(args.quoteNumber, args.companyName ?? "Client"),
    description: "Devis — La Closing Académie. Bon pour accord.",
    documentBase64: args.pdfBase64,
    recipient: {
      firstName: args.contact.first_name ?? "Client",
      lastName: args.contact.last_name ?? "",
      email: resolveRecipientEmail(email),
    },
    anchorString: ANCHOR_DEVIS,
  });
  return { signingRequestId: sr.id, signingLink: sr.first_signer?.signing_link ?? null };
}
