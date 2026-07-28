/**
 * Orchestration convention de formation (sous-projet 2).
 * Mappe deal/company/contact + saisie modal -> data Carbone, rend le PDF, l'envoie en
 * signature Firma. Pur (pas d'accès Supabase) : l'endpoint fournit les entités + gère
 * le stockage. Réutilise Firma (createAndSendSigningRequest) et l'override email test.
 */

import { renderConventionPdf } from "@/lib/carbone-client";
import { createAndSendSigningRequest, buildConventionName } from "@/lib/firma-client";
import { resolveRecipientEmail } from "@/lib/adv-quote";

const ANCHOR_CONVENTION = "Pour le bénéficiaire";

export interface ConventionDeal {
  id: string;
  name: string | null;
  amount: number | string | null;
}
/** Bénéficiaire de la convention : entité (raison sociale) choisie, ou entreprise par défaut. */
export interface ConventionCompany {
  name: string | null;
  address: string | null;
  city: string | null;
  siret: string | null;
}
export interface ConventionContact {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}
/** Champs saisis/édités dans la modal. */
export interface ConventionFormInput {
  intitule: string;
  dureeHeures: string;
  lieu: string;
  effectifs: string;
  horaires: string;
  dateSession: string;
  formateur: string;
  programme: string;
  stagiaires: string[];
  dateSignature: string;
  lieuSignature: string;
}

export class AdvConventionError extends Error {
  constructor(message: string) { super(message); this.name = "AdvConventionError"; }
}

/** Construit le JSON data attendu par le template Carbone. */
export function buildConventionData(
  deal: ConventionDeal,
  company: ConventionCompany,
  contact: ConventionContact,
  form: ConventionFormInput,
): Record<string, unknown> {
  const ht = Number(deal.amount ?? 0);
  const tva = ht * 0.2;
  const ttc = ht * 1.2;
  const decisionnaire = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
  const companyAddress = [company.address, company.city].filter(Boolean).join(", ") || "—";
  return {
    companyName: company.name ?? "—",
    companyAddress,
    companySiret: company.siret ?? "—",
    decisionnaire,
    intitule: form.intitule,
    dureeHeures: form.dureeHeures,
    lieu: form.lieu,
    effectifs: form.effectifs,
    horaires: form.horaires,
    dateSession: form.dateSession,
    formateur: form.formateur,
    programme: form.programme,
    stagiaires: form.stagiaires.filter((s) => s.trim()).map((nom) => ({ nom })),
    coutHT: ht.toFixed(2),
    tva: tva.toFixed(2),
    ttc: ttc.toFixed(2),
    dateSignature: form.dateSignature,
    lieuSignature: form.lieuSignature,
  };
}

/** Rend le PDF de convention (Carbone). Pas d'envoi. */
export async function prepareConvention(args: {
  deal: ConventionDeal;
  company: ConventionCompany;
  contact: ConventionContact;
  form: ConventionFormInput;
}): Promise<{ pdf: Buffer }> {
  const { deal, company, contact, form } = args;
  const data = buildConventionData(deal, company, contact, form);
  const pdf = await renderConventionPdf(data);
  return { pdf };
}

/** Envoie un PDF de convention déjà rendu en signature Firma (1 signataire = bénéficiaire). */
export async function sendConventionSignature(args: {
  companyName: string | null;
  contact: ConventionContact;
  pdfBase64: string;
}): Promise<{ signingRequestId: string; signingLink: string | null }> {
  const { companyName, contact, pdfBase64 } = args;
  const email = contact.email?.trim();
  if (!email) throw new AdvConventionError("Contact email manquant — impossible d'envoyer la convention.");

  const sr = await createAndSendSigningRequest({
    name: buildConventionName(companyName ?? "Client"),
    description: "Convention de formation professionnelle — La Closing Académie.",
    documentBase64: pdfBase64,
    recipient: {
      firstName: contact.first_name ?? "Client",
      lastName: contact.last_name ?? "",
      email: resolveRecipientEmail(email),
    },
    anchorString: ANCHOR_CONVENTION,
  });
  return { signingRequestId: sr.id, signingLink: sr.first_signer?.signing_link ?? null };
}
