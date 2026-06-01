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
  type VatRate,
  type PennylaneProduct,
} from "@/lib/pennylane-client";

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

