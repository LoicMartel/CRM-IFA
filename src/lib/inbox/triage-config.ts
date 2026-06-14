// SOURCE UNIQUE du tri courrier (chantier C) — V1 = rangement thématique seul. La taxonomie (les
// 10 dossiers du doc de Rafi, Architecture_Emails_Rafi_Mouhamad.docx) vit ICI : classifyMailbox, le
// filtre amont et le move IMAP importent tous de ce fichier, AUCUNE liste de dossiers en dur ailleurs.
//
// NB : le tri agit DIRECTEMENT dans la boîte de Rafi (move IMAP via Unipile), pas dans une page CRM
// (décision 14/06 : Rafi traite son courrier dans sa boîte, pas dans le CRM). Le DISPATCH « envoie à
// la bonne personne » (axe 2 : assignee + notification) est RETIRÉ de la V1 — à cadrer avec Rafi
// (mécanique de transfert ?) avant de le rebrancher. Cf docs/WF-001/trame-visio-cadrage-tri-dispatch.

// 9 dossiers thématiques (niveau 1 du doc). "00 À traiter" n'est PAS un dossier ici — c'est le flag
// orthogonal `triage_action_required`.
export const TRIAGE_FOLDER_SLUGS = [
  "clients", "prospects_leads", "commercial", "partenariats", "admin_finance",
  "reseau_institutionnel", "outils_abonnements", "veille_newsletters", "personnel",
] as const;
export type TriageFolderSlug = (typeof TRIAGE_FOLDER_SLUGS)[number];

export function isValidFolder(v: unknown): v is TriageFolderSlug {
  return typeof v === "string" && (TRIAGE_FOLDER_SLUGS as readonly string[]).includes(v);
}

// La grille type d'email → dossier (section 5 du doc Rafi), rendue dans le prompt classify.
export const FOLDER_GRID = `Dossiers (choisis UN slug exact) :
- "clients" (01) : email d'un client en cours de formation/accompagnement, compte-rendu Fathom de réunion client.
- "prospects_leads" (02) : pas encore client — lead entrant marketing, prospection sortante, invitation/RDV de découverte, relance.
- "commercial" (03) : cycle de vente — devis émis (D-2026-xxx), convention/contrat signé, facture envoyée, relance de paiement.
- "partenariats" (04) : apporteur/prescripteur, organisme/réseau de formation, co-animation/sous-traitance (ni client ni fournisseur).
- "admin_finance" (05) : facture fournisseur, expert-comptable, banque/financement (CIR, Leyton), juridique/société, patrimoine, social/paie.
- "reseau_institutionnel" (06) : MEDEF, financeurs/OPCO (Agefice, France Travail), Business France, Carif-Oref, officiel.
- "outils_abonnements" (07) : notification d'un logiciel/abonnement (systeme.io, Docusign, alerte CRM) — PAS les factures SaaS (→ 05).
- "veille_newsletters" (08) : lecture non urgente — newsletter, veille métier, inspiration/concurrent.
- "personnel" (09) : non professionnel — voyage/déplacement, achat/reçu, réseaux sociaux, divers perso.`;

// Expéditeurs SaaS routés déterministiquement vers "07 outils_abonnements" (sans LLM). Match substring lowercase.
export const KNOWN_SAAS_SENDERS = [
  "systeme.io", "docusign", "calendly", "notion.so", "slack.com", "zoom.us",
  "stripe.com", "hubspot", "mailchimp", "pennylane", "firma.dev",
];

// Auto-classement IMAP via Unipile — slug → NOM EXACT du dossier IMAP côté boîte de Rafi.
// ⚠️ PENDING_VALIDATION : ces noms DOIVENT correspondre exactement (casse, accents, espaces) aux
// dossiers que Rafi crée dans Ionos (doc Architecture_Emails_Rafi, section 4). Si Unipile ne trouve
// pas le dossier, il le CRÉE — donc un nom erroné créerait un doublon de dossier. À vérifier via
// GET /api/v1/folders?account_id=… au moment de l'activation. "00 À traiter" n'est PAS ici (= flag,
// pas un dossier de classement thématique).
export const FOLDER_IMAP_NAME: Record<TriageFolderSlug, string> = {
  clients: "01 · CLIENTS",
  prospects_leads: "02 · PROSPECTS & LEADS",
  commercial: "03 · COMMERCIAL",
  partenariats: "04 · PARTENARIATS",
  admin_finance: "05 · ADMIN & FINANCE",
  reseau_institutionnel: "06 · RÉSEAU & INSTITUTIONNEL",
  outils_abonnements: "07 · OUTILS & ABONNEMENTS",
  veille_newsletters: "08 · VEILLE & NEWSLETTERS",
  personnel: "09 · PERSONNEL",
};
