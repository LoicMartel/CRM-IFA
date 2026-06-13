// SOURCE UNIQUE du tri courrier (chantier C). La taxonomie (les 10 dossiers de Rafi) ET le mapping
// thème→destinataire vivent ICI — classifyMailbox, la vue /tri-courrier et le filtre amont importent
// tous de ce fichier, AUCUNE liste de labels/destinataires en dur ailleurs. La visio Loïc+Rafi édite
// CE module (pas de migration : la DB n'a aucun CHECK sur triage_folder / triage_assignee).
//
// ⚠️ Le mapping thème→destinataire ci-dessous est l'HYPOTHÈSE DE DÉPART issue de la prép visio
// (docs/WF-001/trame-visio-cadrage-tri-dispatch-20260612.md). Les points PENDING_VALIDATION sont à
// confirmer par Rafi+Loïc (notamment le routage Imen/ADF et l'existence réelle d'un flux marketing→Pauline).

/** Passe à false une fois le mapping verrouillé en visio. */
export const PENDING_VALIDATION = true;

// 9 dossiers thématiques (niveau 1 du doc). "00 À traiter" n'est PAS ici — c'est le flag orthogonal
// `triage_action_required`. `llmSplit` = le destinataire dépend du sous-cas → tranché par le LLM.
export const TRIAGE_FOLDERS = [
  { slug: "clients", label: "01 · Clients", emoji: "📁", defaultAssignee: "rafi", llmSplit: true },
  { slug: "prospects_leads", label: "02 · Prospects & Leads", emoji: "🎯", defaultAssignee: null, llmSplit: false },
  { slug: "commercial", label: "03 · Commercial", emoji: "💼", defaultAssignee: "rafi", llmSplit: true },
  { slug: "partenariats", label: "04 · Partenariats", emoji: "🤝", defaultAssignee: "rafi", llmSplit: false },
  { slug: "admin_finance", label: "05 · Admin & Finance", emoji: "🧾", defaultAssignee: "naznine", llmSplit: false },
  { slug: "reseau_institutionnel", label: "06 · Réseau & Institutionnel", emoji: "🏛", defaultAssignee: "rafi", llmSplit: true },
  { slug: "outils_abonnements", label: "07 · Outils & Abonnements", emoji: "🔧", defaultAssignee: "loic", llmSplit: false },
  { slug: "veille_newsletters", label: "08 · Veille & Newsletters", emoji: "📰", defaultAssignee: null, llmSplit: false },
  { slug: "personnel", label: "09 · Personnel", emoji: "🔒", defaultAssignee: null, llmSplit: false },
] as const;

export type TriageFolderSlug = (typeof TRIAGE_FOLDERS)[number]["slug"];
export const TRIAGE_FOLDER_SLUGS = TRIAGE_FOLDERS.map((f) => f.slug) as TriageFolderSlug[];

export const ASSIGNEES = ["rafi", "naznine", "loic", "imen", "pauline", "alexandre"] as const;
export type AssigneeSlug = (typeof ASSIGNEES)[number];

// slug → team_members.email, pour résoudre le destinataire de la notification de dispatch.
// rafi/naznine confirmés ; le reste = best-guess <prenom>@closing-academie.com → PENDING_VALIDATION
// (un email faux/absent saute juste la notification, best-effort — le label triage_assignee reste posé).
export const ASSIGNEE_EMAILS: Record<AssigneeSlug, string> = {
  rafi: "rafi@closing-academie.com",
  naznine: "naznine@closing-academie.com",
  loic: "loic@closing-academie.com", // PENDING_VALIDATION
  imen: "imen@closing-academie.com", // PENDING_VALIDATION
  pauline: "pauline@closing-academie.com", // PENDING_VALIDATION
  alexandre: "alexandre@closing-academie.com", // PENDING_VALIDATION
};

// Badge par dossier (libellé + emoji), consommé par la vue /tri-courrier.
export const FOLDER_BADGE: Record<TriageFolderSlug, { label: string; emoji: string }> = Object.fromEntries(
  TRIAGE_FOLDERS.map((f) => [f.slug, { label: f.label, emoji: f.emoji }])
) as Record<TriageFolderSlug, { label: string; emoji: string }>;

export function isValidFolder(v: unknown): v is TriageFolderSlug {
  return typeof v === "string" && (TRIAGE_FOLDER_SLUGS as string[]).includes(v);
}
export function isValidAssignee(v: unknown): v is AssigneeSlug {
  return typeof v === "string" && (ASSIGNEES as readonly string[]).includes(v);
}

export function folderMeta(folder: TriageFolderSlug) {
  return TRIAGE_FOLDERS.find((x) => x.slug === folder)!;
}

// Dossiers à propriétaire 1:1 → destinataire déterministe (sans LLM). Les dossiers à sous-règle
// (01/03/06) renvoient null ici → le LLM choisit le destinataire du sous-cas (validé via isValidAssignee).
export function deterministicAssignee(folder: TriageFolderSlug): AssigneeSlug | null {
  const f = TRIAGE_FOLDERS.find((x) => x.slug === folder);
  if (!f || f.llmSplit) return null;
  return f.defaultAssignee;
}

// Règles de sous-cas pour les dossiers à split, injectées dans le prompt classify.
export const SPLIT_RULES = {
  clients: "01 Clients : pédago / contenu de formation → alexandre ; facture / admin client → naznine ; sinon (relation, commercial) → rafi.",
  commercial: "03 Commercial : facturation / relance de paiement → naznine ; devis / contrat / proposition → rafi.",
  reseau_institutionnel: "06 Réseau : financeurs / OPCO (Agefice, France Travail, Carif-Oref) → imen ; MEDEF / Business France / institutionnel → rafi.",
} as const;

// La grille type d'email → dossier (section 5 du doc Rafi), rendue dans le prompt.
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

// P2 (auto-classement IMAP via Unipile) — slug → NOM EXACT du dossier IMAP côté boîte de Rafi.
// ⚠️ PENDING_VALIDATION : ces noms DOIVENT correspondre exactement (casse, accents, espaces) aux
// dossiers que Rafi crée dans Ionos (doc Architecture_Emails_Rafi, section 4). Si Unipile ne trouve
// pas le dossier, il le CRÉE — donc un nom erroné créerait un doublon de dossier. À vérifier via
// GET /api/v1/folders?account_id=… au moment de l'activation P2. "00 À traiter" n'est PAS ici (= flag,
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
