/**
 * Orchestration "facturation" intra-CRM (port WF-005 branche A).
 *
 * Remplace le proxy n8n `invoice-from-deal`. Deux entrées :
 *  - generateBillingMonthInvoice : facture UNE échéance (billing_month) — bouton BillingGrid
 *  - generateDealInvoice         : facture le deal ENTIER — bouton deals-board
 *
 * Pur (pas d'accès Supabase) : l'endpoint fournit deal/contact/company et gère
 * les updates. Réutilise resolveCompanyCustomer (idempotency customer partagée).
 *
 * ⚠️ Vercel Hobby (timeout 10s) : le PDF d'une invoice prend 1-5 min côté Pennylane,
 * donc send_by_email peut renvoyer 409. On tente **1 seule fois** (best-effort) et on
 * remonte `emailSent`. Le retry est délégué au cron T8 (pennylane-sync).
 */

import {
  createInvoice,
  findInvoiceByCustomerAndRef,
  sendInvoiceByEmail,
  finalizeInvoice,
  getInvoice,
  listProducts,
  PennylaneError,
  type QuoteLine,
} from "@/lib/pennylane-client";
import {
  resolveCompanyCustomer,
  resolveRecipientEmail,
  isoDate,
  type QuoteDealInput,
  type QuoteContactInput,
  type QuoteCompanyInput,
} from "@/lib/adv-quote";

// OF émetteur (repris du WF-005 special_mention).
const SPECIAL_MENTION = "OF : NMF CONSULTING SARL\nNDA : 76341132134";

export interface BillingMonthInput {
  id: string;
  month: string | null;
  amount: number | string | null;
}

export interface GenerateInvoiceResult {
  customerId: number;
  pennylaneInvoiceId: number;
  invoiceNumber: string | null;
  emailSent: boolean;
}

export class AdvInvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdvInvoiceError";
  }
}

export function monthLabelFr(month: string | null): string {
  if (!month) return "échéance";
  return new Date(month).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Cœur partagé : customer → invoice (idempotent sur externalRef) → send_by_email (1 essai).
 */
async function createAndSendInvoice(args: {
  deal: QuoteDealInput;
  contact: QuoteContactInput;
  company: QuoteCompanyInput;
  email: string;
  externalRef: string;
  invoiceLines: QuoteLine[];
  pdfInvoiceSubject: string;
  pdfDescription: string;
}): Promise<GenerateInvoiceResult> {
  const { contact, company, email, externalRef, invoiceLines, pdfInvoiceSubject, pdfDescription } = args;

  const customer = await resolveCompanyCustomer(company, contact, email);

  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // /customer_invoices ne filtre que sur id/date/customer_id/invoice_number/draft/
  // credit_note (pas external_reference). Sur 422 (external_reference déjà pris),
  // on récupère l'invoice existante via customer_id.
  let invoice;
  try {
    invoice = await createInvoice({
      date: isoDate(now),
      deadline: isoDate(deadline),
      customerId: customer.id,
      externalReference: externalRef,
      pdfInvoiceSubject,
      pdfDescription,
      specialMention: SPECIAL_MENTION,
      invoiceLines,
      draft: false,
    });
  } catch (e) {
    if (e instanceof PennylaneError && e.status === 422) {
      const existing = await findInvoiceByCustomerAndRef(customer.id, externalRef);
      if (!existing) throw e;
      invoice = existing;
    } else {
      throw e;
    }
  }

  let emailSent = false;
  try {
    // mode test : redirige l'email de facture vers l'adresse de test
    await sendInvoiceByEmail(invoice.id, [resolveRecipientEmail(email)], { maxAttempts: 1 });
    emailSent = true;
  } catch (e) {
    // 409 = PDF pas encore généré → le cron T8 réessaiera. Autre erreur → remonte.
    if (!(e instanceof PennylaneError)) throw e;
  }

  return {
    customerId: customer.id,
    pennylaneInvoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number ?? null,
    emailSent,
  };
}

function requireEmail(contact: QuoteContactInput): string {
  const email = contact.email?.trim();
  if (!email) {
    throw new AdvInvoiceError("Contact email manquant — impossible de créer/envoyer la facture.");
  }
  return email;
}

async function resolveFormationProduct() {
  const products = await listProducts();
  return (
    products.find((p) =>
      /performance|formation/i.test(`${p.label ?? ""} ${p.reference ?? ""}`),
    ) ?? products[0]
  );
}

/**
 * Facture UNE échéance. Idempotent via LCA-INV-{dealId}-BM-{billingMonthId}.
 */
export async function generateBillingMonthInvoice(input: {
  deal: QuoteDealInput;
  contact: QuoteContactInput;
  company: QuoteCompanyInput;
  billingMonth: BillingMonthInput;
}): Promise<GenerateInvoiceResult> {
  const { deal, contact, company, billingMonth } = input;
  const email = requireEmail(contact);

  const amount = Number(billingMonth.amount ?? 0);
  if (!amount || amount <= 0) {
    throw new AdvInvoiceError(`Montant d'échéance invalide (${billingMonth.amount}).`);
  }

  const product = await resolveFormationProduct();
  const label = monthLabelFr(billingMonth.month);

  return createAndSendInvoice({
    deal,
    contact,
    company,
    email,
    externalRef: `LCA-INV-${deal.id}-BM-${billingMonth.id}`,
    invoiceLines: [
      {
        productId: product?.id,
        label: `Échéance ${label} — ${deal.name ?? "Formation"}`,
        quantity: 1,
        unit: "forfait",
        rawCurrencyUnitPrice: amount.toFixed(2),
        vatRate: "FR_200",
      },
    ],
    pdfInvoiceSubject: `Facture échéance ${label} — ${company.name ?? "Client"}`,
    pdfDescription: `Échéance: ${label}\nDeal LCA: ${deal.name ?? deal.id}\nMontant échéance HT: ${amount.toFixed(2)} EUR`,
  });
}

/**
 * Facture le deal ENTIER. Idempotent via LCA-INV-{dealId}.
 */
export async function generateDealInvoice(input: {
  deal: QuoteDealInput;
  contact: QuoteContactInput;
  company: QuoteCompanyInput;
}): Promise<GenerateInvoiceResult> {
  const { deal, contact, company } = input;
  const email = requireEmail(contact);

  const amount = Number(deal.amount ?? 0);
  if (!amount || amount <= 0) {
    throw new AdvInvoiceError(`Montant du deal invalide (${deal.amount}).`);
  }
  const trainingDays = parseFloat(String(deal.training_days ?? "")) || 1;

  const product = await resolveFormationProduct();

  return createAndSendInvoice({
    deal,
    contact,
    company,
    email,
    externalRef: `LCA-INV-${deal.id}`,
    invoiceLines: [
      {
        productId: product?.id,
        label: product?.label ?? "Formation Closing",
        quantity: trainingDays,
        unit: "jour",
        rawCurrencyUnitPrice: (amount / trainingDays).toFixed(2),
        vatRate: "FR_200",
      },
    ],
    pdfInvoiceSubject: `Facture — Formation Closing — ${company.name ?? "Client"}`,
    pdfDescription: `Deal LCA: ${deal.name ?? deal.id}\nFormation: ${trainingDays} jour(s)\nMontant total HT: ${amount.toFixed(2)} EUR`,
  });
}

/**
 * Construit les invoice_lines d'une échéance (factorisé depuis generateBillingMonthInvoice).
 */
async function billingMonthLines(
  deal: QuoteDealInput,
  billingMonth: BillingMonthInput,
): Promise<{
  lines: QuoteLine[];
  pdfInvoiceSubject: string;
  pdfDescription: string;
  externalRef: string;
  label: string;
}> {
  const amount = Number(billingMonth.amount ?? 0);
  if (!amount || amount <= 0)
    throw new AdvInvoiceError(`Montant d'échéance invalide (${billingMonth.amount}).`);
  const product = await resolveFormationProduct();
  const label = monthLabelFr(billingMonth.month);
  return {
    label,
    externalRef: `LCA-INV-${deal.id}-BM-${billingMonth.id}`,
    lines: [
      {
        productId: product?.id,
        label: `Échéance ${label} — ${deal.name ?? "Formation"}`,
        quantity: 1,
        unit: "forfait",
        rawCurrencyUnitPrice: amount.toFixed(2),
        vatRate: "FR_200",
      },
    ],
    pdfInvoiceSubject: `Facture échéance ${label}`,
    pdfDescription: `Échéance: ${label}\nMontant échéance HT: ${amount.toFixed(2)} EUR`,
  };
}

/**
 * Crée un DRAFT d'invoice pour l'échéance (aperçu avant validation). Idempotent
 * sur LCA-INV-{dealId}-BM-{bmId}. Ne fait PAS d'envoi.
 */
export async function prepareBillingMonthInvoiceDraft(input: {
  deal: QuoteDealInput;
  contact: QuoteContactInput;
  company: QuoteCompanyInput;
  billingMonth: BillingMonthInput;
}): Promise<{ pennylaneInvoiceId: number; invoiceNumber: string | null }> {
  const { deal, contact, company, billingMonth } = input;
  const email = requireEmail(contact);
  const customer = await resolveCompanyCustomer(company, contact, email);
  const built = await billingMonthLines(deal, billingMonth);

  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let invoice;
  try {
    invoice = await createInvoice({
      date: isoDate(now),
      deadline: isoDate(deadline),
      customerId: customer.id,
      externalReference: built.externalRef,
      pdfInvoiceSubject: built.pdfInvoiceSubject,
      pdfDescription: built.pdfDescription,
      specialMention: SPECIAL_MENTION,
      invoiceLines: built.lines,
      draft: true,
    });
  } catch (e) {
    if (e instanceof PennylaneError && e.status === 422) {
      const existing = await findInvoiceByCustomerAndRef(customer.id, built.externalRef);
      if (!existing) throw e;
      invoice = existing;
    } else {
      throw e;
    }
  }
  return { pennylaneInvoiceId: invoice.id, invoiceNumber: invoice.invoice_number ?? null };
}

/**
 * Finalise un draft + envoie l'email. Validation Naznine.
 * Transition draft→finalized via PUT draft:false (à confirmer live-test).
 */
export async function finalizeAndSendBillingMonthInvoice(input: {
  pennylaneInvoiceId: number;
  recipientEmail: string;
}): Promise<{ invoiceNumber: string | null; emailSent: boolean }> {
  const finalized = await finalizeInvoice(input.pennylaneInvoiceId);
  if (finalized.draft !== false) {
    throw new AdvInvoiceError(
      `Facture ${input.pennylaneInvoiceId} toujours en draft après finalize (PUT draft:false non honoré par Pennylane) — fallback delete+recreate à implémenter (cf live-test).`,
    );
  }
  let emailSent = false;
  try {
    await sendInvoiceByEmail(input.pennylaneInvoiceId, [resolveRecipientEmail(input.recipientEmail)], {
      maxAttempts: 1,
    });
    emailSent = true;
  } catch (e) {
    if (!(e instanceof PennylaneError)) throw e; // 409 PDF pas prêt → cron retry
  }
  return { invoiceNumber: finalized.invoice_number ?? null, emailSent };
}

/** Récupère le public_file_url du PDF d'un draft (pour l'aperçu inbox). null si pas prêt. */
export async function getInvoicePdfUrl(invoiceId: number): Promise<string | null> {
  const inv = await getInvoice(invoiceId);
  return inv.public_file_url ?? null;
}
