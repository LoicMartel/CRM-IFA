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
  lookupQuoteByExternalRef,
  listProducts,
  downloadPdfAsBase64,
  type QuoteLine,
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
  postal_code: string | null;
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
          postal_code: company.postal_code ?? "",
          city: company.city ?? "",
          country_alpha2: (company.country ?? "FR").toUpperCase(),
        }
      : undefined,
  });
}

/**
 * Génère le devis officiel : customer Pennylane → quote → PDF → signing Firma.
 * Idempotent côté customer (external_reference). À appeler APRÈS les checks
 * RBAC/stage/idempotency de l'endpoint, et entourer de l'early-lock du quote_id.
 */
export async function generateOfficialQuote(input: {
  deal: QuoteDealInput;
  contact: QuoteContactInput;
  company: QuoteCompanyInput;
}): Promise<GenerateQuoteResult> {
  const { deal, contact, company } = input;

  const email = contact.email?.trim();
  if (!email) {
    throw new AdvQuoteError(
      "Contact email manquant — impossible de créer le devis signable.",
    );
  }

  const amount = parseFloat(String(deal.amount ?? "")) || 0;
  const trainingDays = parseFloat(String(deal.training_days ?? "")) || 1;

  // 1. Customer B2B (idempotent sur LCA-COMPANY-{companyId})
  const customer = await resolveCompanyCustomer(company, contact, email);

  // 2. Résolution des produits par reference
  const products = await listProducts();
  const mainProduct =
    products.find((p) => p.reference === PRODUCT_REF_MAIN) ??
    products.find((p) => (p.reference ?? "").startsWith("LCA_PERFORMANCE")) ??
    products[0];
  const thrProduct = products.find((p) => p.reference === PRODUCT_REF_THR);
  const fournituresProduct = products.find(
    (p) => p.reference === PRODUCT_REF_FOURNITURES,
  );

  const formationType = mainProduct?.label ?? "Formation Closing";
  const description = deal.notes ?? `Formation ${formationType}`;

  const invoiceLines: QuoteLine[] = [
    {
      productId: mainProduct?.id,
      label: formationType,
      quantity: trainingDays,
      unit: "unité",
      rawCurrencyUnitPrice: amount.toFixed(2),
      vatRate: "FR_200",
      description,
    },
  ];
  if (thrProduct) {
    invoiceLines.push({
      productId: thrProduct.id,
      label: "Frais THR",
      quantity: 1,
      unit: "unité",
      rawCurrencyUnitPrice: "0.00",
      vatRate: "FR_200",
      description: THR_DESCRIPTION,
    });
  }
  if (fournituresProduct) {
    invoiceLines.push({
      productId: fournituresProduct.id,
      label: "Fournitures",
      quantity: 1,
      unit: "unité",
      rawCurrencyUnitPrice: "0.00",
      vatRate: "FR_200",
      description: FOURNITURES_DESCRIPTION,
    });
  }

  // 3. Création du devis (idempotent : réutilise si LCA-DEAL-{id} existe déjà)
  const externalRef = `LCA-DEAL-${deal.id}`;
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const quote =
    (await lookupQuoteByExternalRef(externalRef)) ??
    (await createQuote({
      date: isoDate(now),
      deadline: isoDate(deadline),
      customerId: customer.id,
      externalReference: externalRef,
      pdfInvoiceSubject: formationType,
      pdfDescription: description,
      invoiceLines,
    }));

  if (!quote.public_file_url) {
    throw new AdvQuoteError(
      `Quote ${quote.id} créé mais public_file_url absent — impossible de générer le PDF à signer.`,
    );
  }

  // 4. Téléchargement du PDF + garde magic %PDF (anti-buffer corrompu)
  const pdfBase64 = await downloadPdfAsBase64(quote.public_file_url);
  const magic = Buffer.from(pdfBase64.slice(0, 16), "base64")
    .slice(0, 5)
    .toString("ascii");
  if (!magic.startsWith("%PDF-")) {
    throw new AdvQuoteError(
      `PDF Pennylane invalide (magic="${magic}") — public_file_url a probablement renvoyé une erreur HTML/JSON.`,
    );
  }

  // 5. Signing request Firma (atomic create-and-send)
  const invoiceNumber = quote.invoice_number ?? null;
  const signing = await createAndSendSigningRequest({
    name: buildDevisName(invoiceNumber ?? `DEV-${quote.id}`, company.name ?? "Client", deal.id),
    description: `Devis ${invoiceNumber ?? quote.id} à signer — La Closing Académie®`,
    documentBase64: pdfBase64,
    recipient: {
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      // mode test : redirige l'email de signature vers l'adresse de test
      email: resolveRecipientEmail(email),
    },
  });

  return {
    customerId: customer.id,
    pennylaneQuoteId: quote.id,
    invoiceNumber,
    publicFileUrl: quote.public_file_url,
    firmaSigningId: signing.id,
    signingLink: signing.first_signer?.signing_link ?? null,
  };
}
