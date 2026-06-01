/**
 * Orchestration "devis officiel" intra-CRM (port WF-002b-supabase-firma).
 *
 * Remplace le proxy n8n `lca-devis-a-envoyer` : enchaîne directement
 * Pennylane (customer + quote + PDF) puis Firma (signing request atomic).
 *
 * Volontairement SANS accès Supabase : l'appelant (l'endpoint route) fournit
 * deal/contact/company déjà fetchés et gère l'early-lock + l'update stage.
 * Cette pureté rend la fonction testable et la chaîne tient < 10s (Vercel Hobby) :
 * sur les quotes, le PDF est dispo immédiatement via public_file_url
 * (cf .claude/rules/pennylane-api-v2.md caveat 9 — le wait 3 min ne concerne
 * que les invoices).
 */

import {
  findOrCreateCompanyCustomer,
  createQuote,
  listProducts,
  downloadPdfAsBase64,
  type QuoteLine,
  type VatRate,
  type PennylaneProduct,
} from "@/lib/pennylane-client";
import {
  createAndSendSigningRequest,
  buildDevisName,
} from "@/lib/firma-client";

// Références catalogue Pennylane LCA (résolues dynamiquement par `reference`).
const PRODUCT_REF_MAIN = "LCA_PERFORMANCE_B2B";
const PRODUCT_REF_THR = "LCA_THR";
const PRODUCT_REF_FOURNITURES = "LCA_FOURNITURES";

const THR_DESCRIPTION =
  "L'organisation, la réservation et l'ensemble des coûts liés au frais de transports, d'hébergement, de restauration des intervenants et des coûts liés aux salles de formations sont à la charge du client.";
const FOURNITURES_DESCRIPTION =
  "L'organisation et la commande des fournitures et des impressions si besoin sont à la charge du client suite à la transmission des documents en version numérique.";

/** Ligne de devis éditable, persistée dans deals.quote_lines (source de vérité CRM). */
export interface QuoteLineDraft {
  kind: "main" | "thr" | "fournitures" | "custom";
  product_ref: string | null; // référence Pennylane stable, résolue en product_id à la génération
  label: string;
  quantity: number;
  unit: string;
  unit_price: string; // string format Pennylane, ex "15000.00"
  vat_rate: VatRate;
  description: string | null;
}

export interface QuoteDealInput {
  id: string;
  name: string | null;
  amount: number | string | null;
  training_days: number | string | null;
  notes: string | null;
}

export interface QuoteContactInput {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface QuoteCompanyInput {
  id: string;
  name: string | null;
  siret: string | null;
  address: string | null;
  // `companies` n'a pas cette colonne — extraite de `address` (cf resolveCompanyCustomer)
  postal_code?: string | null;
  city: string | null;
  country: string | null;
}

export interface GenerateQuoteResult {
  customerId: number;
  pennylaneQuoteId: number;
  invoiceNumber: string | null;
  publicFileUrl: string | null;
  firmaSigningId: string;
  signingLink: string | null;
}

export class AdvQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdvQuoteError";
  }
}

export function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Mode test : si ADV_TEST_EMAIL_OVERRIDE est défini, redirige TOUS les envois
 * (signature Firma, facture Pennylane, notifs) vers cette adresse — quel que soit
 * le contact réel du deal. Garde-fou pour tester sur des deals sans spammer de
 * vrais clients. Vide en prod => l'email réel du contact est utilisé.
 */
export function resolveRecipientEmail(realEmail: string): string {
  return process.env.ADV_TEST_EMAIL_OVERRIDE?.trim() || realEmail;
}

/** True si le mode test email override est actif. */
export function isTestEmailMode(): boolean {
  return !!process.env.ADV_TEST_EMAIL_OVERRIDE?.trim();
}

/** Résout le produit principal (formation) du catalogue Pennylane (3 paliers de fallback). */
function resolveMainProduct(products: PennylaneProduct[]): PennylaneProduct | undefined {
  return (
    products.find((p) => p.reference === PRODUCT_REF_MAIN) ??
    products.find((p) => (p.reference ?? "").startsWith("LCA_PERFORMANCE")) ??
    products[0]
  );
}

/**
 * Lignes par défaut d'un devis (prérempli de l'éditeur, ou fallback 1er prepare).
 * Main : quantité 1 × montant TOTAL (corrige l'ancien bug quantity=training_days).
 * THR + Fournitures à 0 € avec leur mention (éditables ensuite).
 */
export function defaultQuoteLines(
  deal: QuoteDealInput,
  products: PennylaneProduct[],
): QuoteLineDraft[] {
  const amount = parseFloat(String(deal.amount ?? "")) || 0;
  const mainProduct = resolveMainProduct(products);
  const formationType = mainProduct?.label ?? "Formation Closing";
  const description = deal.notes ?? `Formation ${formationType}`;

  const lines: QuoteLineDraft[] = [
    {
      kind: "main",
      product_ref: mainProduct?.reference ?? PRODUCT_REF_MAIN,
      label: formationType,
      quantity: 1,
      unit: "unité",
      unit_price: amount.toFixed(2),
      vat_rate: "FR_200",
      description,
    },
    {
      kind: "thr",
      product_ref: PRODUCT_REF_THR,
      label: "Frais THR",
      quantity: 1,
      unit: "unité",
      unit_price: "0.00",
      vat_rate: "FR_200",
      description: THR_DESCRIPTION,
    },
    {
      kind: "fournitures",
      product_ref: PRODUCT_REF_FOURNITURES,
      label: "Fournitures",
      quantity: 1,
      unit: "unité",
      unit_price: "0.00",
      vat_rate: "FR_200",
      description: FOURNITURES_DESCRIPTION,
    },
  ];
  return lines;
}

/** Convertit une ligne éditable en ligne Pennylane. Erreur dure si le ref est inconnu. */
function toPennylaneLine(line: QuoteLineDraft, products: PennylaneProduct[]): QuoteLine {
  let productId: number | undefined;
  if (line.product_ref) {
    const found = products.find((p) => p.reference === line.product_ref);
    if (!found) {
      throw new AdvQuoteError(
        `Produit Pennylane introuvable pour la référence "${line.product_ref}" (ligne "${line.label}").`,
      );
    }
    productId = found.id;
  }
  return {
    productId,
    label: line.label,
    quantity: line.quantity,
    unit: line.unit,
    rawCurrencyUnitPrice: line.unit_price,
    vatRate: line.vat_rate,
    description: line.description ?? undefined,
  };
}

/**
 * Résout (idempotent) le customer B2B Pennylane depuis company/contact.
 * external_reference = LCA-COMPANY-{company.id}. Partagé devis + facturation.
 */
export async function resolveCompanyCustomer(
  company: QuoteCompanyInput,
  contact: QuoteContactInput,
  email: string,
) {
  const recipient = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  // `companies` n'a pas de colonne postal_code → l'extraire de l'adresse libre
  // (code postal FR = 5 chiffres), comme le faisait WF-005.
  const postalCode =
    company.postal_code ?? (company.address ?? "").match(/\b(\d{5})\b/)?.[1] ?? "";
  return findOrCreateCompanyCustomer({
    name: company.name ?? "Client",
    emails: [email],
    phone: contact.phone ?? undefined,
    recipient: recipient || undefined,
    regNo: company.siret ?? undefined,
    externalReference: `LCA-COMPANY-${company.id}`,
    billingLanguage: "fr_FR",
    billingAddress: company.address
      ? {
          address: company.address,
          postal_code: postalCode,
          city: company.city ?? "",
          country_alpha2: (company.country ?? "FR").toUpperCase(),
        }
      : undefined,
  });
}

/**
 * Prépare le devis officiel SANS envoi : customer Pennylane → quote → public_file_url.
 * Pas de Firma (le gate de validation s'en charge). Idempotent côté customer.
 * Accepte des lignes explicites (éditeur CRM) ou génère les lignes par défaut.
 */
export async function prepareOfficialQuote(input: {
  deal: QuoteDealInput;
  contact: QuoteContactInput;
  company: QuoteCompanyInput;
  lines?: QuoteLineDraft[] | null;
  subject?: string | null;
  description?: string | null;
}): Promise<Omit<GenerateQuoteResult, "firmaSigningId" | "signingLink">> {
  const { deal, contact, company } = input;

  const email = contact.email?.trim();
  if (!email) {
    throw new AdvQuoteError("Contact email manquant — impossible de créer le devis signable.");
  }

  const customer = await resolveCompanyCustomer(company, contact, email);
  const products = await listProducts();

  const draftLines =
    input.lines && input.lines.length > 0 ? input.lines : defaultQuoteLines(deal, products);
  const invoiceLines: QuoteLine[] = draftLines.map((l) => toPennylaneLine(l, products));

  const mainProduct = resolveMainProduct(products);
  const formationType = mainProduct?.label ?? "Formation Closing";
  const subject = input.subject?.trim() || formationType;
  const description = input.description?.trim() || deal.notes || `Formation ${formationType}`;

  // external_reference UNIQUE par préparation (token base36). Raison : un quote
  // Pennylane n'est PAS supprimable (DELETE /quotes = 404). Si on gardait un ref
  // stable LCA-DEAL-{id}, régénérer après un rejet retomberait sur le 422 → reuse
  // de l'ancien quote (données périmées). Un ref unique → toujours un quote frais.
  // Le webhook Firma lit le NAME (buildDevisName, id propre) → non impacté.
  // L'idempotency normale reste assurée côté CRM par deal.pennylane_quote_id
  // (l'endpoint 409 si déjà set ; le cron filtre .is("pennylane_quote_id", null)).
  const externalRef = `LCA-DEAL-${deal.id}-${Date.now().toString(36)}`;
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const quote = await createQuote({
    date: isoDate(now),
    deadline: isoDate(deadline),
    customerId: customer.id,
    externalReference: externalRef,
    pdfInvoiceSubject: subject,
    pdfDescription: description,
    invoiceLines,
  });

  if (!quote.public_file_url) {
    throw new AdvQuoteError(
      `Quote ${quote.id} créé mais public_file_url absent — impossible de générer le PDF.`,
    );
  }

  return {
    customerId: customer.id,
    pennylaneQuoteId: quote.id,
    invoiceNumber: quote.invoice_number ?? null,
    publicFileUrl: quote.public_file_url,
  };
}

/**
 * Envoie un devis déjà créé en signature Firma. Télécharge le PDF depuis
 * public_file_url, vérifie le magic %PDF, crée la signing request atomic.
 */
export async function sendQuoteSignature(input: {
  publicFileUrl: string;
  invoiceNumber: string | null;
  companyName: string | null;
  contact: QuoteContactInput;
}): Promise<{ firmaSigningId: string; signingLink: string | null }> {
  const { publicFileUrl, invoiceNumber, companyName, contact } = input;
  const email = contact.email?.trim();
  if (!email) throw new AdvQuoteError("Contact email manquant — impossible d'envoyer la signature.");

  const pdfBase64 = await downloadPdfAsBase64(publicFileUrl);
  const magic = Buffer.from(pdfBase64.slice(0, 16), "base64").slice(0, 5).toString("ascii");
  if (!magic.startsWith("%PDF-")) {
    throw new AdvQuoteError(
      `PDF Pennylane invalide (magic="${magic}") — public_file_url a renvoyé une erreur.`,
    );
  }

  const signing = await createAndSendSigningRequest({
    name: buildDevisName(invoiceNumber, companyName ?? "Client"),
    description: `Devis${invoiceNumber ? ` ${invoiceNumber}` : ""} à signer — La Closing Académie®`,
    documentBase64: pdfBase64,
    recipient: {
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      email: resolveRecipientEmail(email),
    },
  });

  return { firmaSigningId: signing.id, signingLink: signing.first_signer?.signing_link ?? null };
}
