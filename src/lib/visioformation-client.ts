// VisioFormation — transport CRM → VF (créer la formation + ses apprenants côté VisioFormation).
//
// Sens du flux : le CRM est l'ÉMETTEUR, VisioFormation reçoit + traite NOTRE format (VF adapte son
// API à ce format — dev côté VF acté). L'import inverse (VF → CRM) reste ailleurs (upload Excel/PDF
// + futur webhook de statut /api/webhooks/visioformation).
//
// GATED / INERT : sans VF_API_URL + VF_API_KEY, visioformationConfigured() === false et aucun envoi
// n'est tenté (même pattern que unipile/client.ts et twilio-whatsapp-client.ts).
//
// Unité poussée = une FORMATION = un `service_plan` (entreprise + programme + formateur + créneaux
// + apprenants). Dans le CRM, `training_sessions` = les créneaux (VT/journée) d'un service_plan ;
// les apprenants sont liés aux créneaux (dédupliqués ici au niveau formation).
const VF_API_URL = process.env.VF_API_URL ?? "";
const VF_API_KEY = process.env.VF_API_KEY ?? "";

export function visioformationConfigured(): boolean {
  return Boolean(VF_API_URL && VF_API_KEY);
}

export interface VisioformationPayload {
  meta: { source: string; event: string; environment: string; sent_at: string; external_reference: string };
  formation: { titre: string | null; mode: string | null; lieu: string | null; vt_prevues: number | null; journees_prevues: number | null; duree_totale_heures: number | null; date_debut: string | null; date_fin: string | null };
  entreprise: { raison_sociale: string | null; siret: string | null; adresse: string | null; ville: string | null };
  formateur: { nom: string | null; prenom: string | null; email: string | null } | null;
  sessions: Array<{ date: string | null; type: string | null; heures: number | null; statut: string | null }>;
  apprenants: Array<{ nom: string | null; prenom: string | null; email: string | null; telephone: string | null; fonction: string | null }>;
}

export interface VisioformationResult { ok: boolean; status: number; vfId: string | null; body: unknown }

// Rows shape is loose on purpose: the formation tables aren't in the generated Supabase types
// (the codebase reads them via `as any`). This builder maps the raw query result to OUR format.
interface FormationRows {
  id: string;
  mode?: string | null;
  format?: string | null;
  vt_planned?: number | null;
  days_planned?: number | null;
  companies?: { name?: string | null; siret?: string | null; address?: string | null; city?: string | null } | null;
  training_programs?: { name?: string | null } | null;
  training_sessions?: Array<{
    session_date?: string | null; session_type?: string | null; duration_hours?: number | null; status?: string | null; session_location?: string | null;
    training_session_learners?: Array<{ learners?: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null; position?: string | null } | null }> | null;
  }> | null;
}

interface TrainerRow { first_name?: string | null; last_name?: string | null; email?: string | null }

export function buildFormationPayload(plan: FormationRows, trainer: TrainerRow | null, nowIso: string, environment: string): VisioformationPayload {
  const sessions = (plan.training_sessions ?? []).map((s) => ({
    date: s.session_date ?? null,
    type: s.session_type ?? null,
    heures: s.duration_hours ?? null,
    statut: s.status ?? null,
  }));

  // Apprenants dédupliqués (un learner peut être lié à plusieurs créneaux) par email, sinon nom complet.
  const seen = new Set<string>();
  const apprenants: VisioformationPayload["apprenants"] = [];
  for (const s of plan.training_sessions ?? []) {
    for (const link of s.training_session_learners ?? []) {
      const l = link.learners;
      if (!l) continue;
      const key = (l.email || `${l.first_name ?? ""} ${l.last_name ?? ""}`).toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      apprenants.push({ nom: l.last_name ?? null, prenom: l.first_name ?? null, email: l.email ?? null, telephone: l.phone ?? null, fonction: l.position ?? null });
    }
  }

  // Dates de FORMATION = 1re/dernière journée effective (min/max des créneaux), PAS la période de la
  // convention (demande Loïc 08/07). session_date au format ISO YYYY-MM-DD → tri lexical valide.
  const sessionDates = (plan.training_sessions ?? []).map((s) => s.session_date).filter((d): d is string => Boolean(d)).sort();
  const dateDebut = sessionDates[0] ?? null;
  const dateFin = sessionDates[sessionDates.length - 1] ?? null;

  // Durée totale = somme des heures des créneaux (null si aucune heure renseignée, pas 0 trompeur).
  const heures = sessions.map((s) => s.heures).filter((h): h is number => typeof h === "number");
  const dureeTotale = heures.length ? heures.reduce((a, b) => a + b, 0) : null;

  // Lieu : le CRM stocke le lieu PAR créneau (training_sessions.session_location). On remonte le 1er
  // lieu renseigné au niveau formation (Loïc demande un lieu de formation). Fallback visio si distanciel
  // sans lieu saisi. ⚠️ La Route A (push-formation/[id]) doit SELECT session_location sur les créneaux.
  const c = plan.companies ?? null;
  const modeStr = plan.mode ?? plan.format ?? null;
  const sessionLocation = (plan.training_sessions ?? []).map((s) => s.session_location).find((v) => Boolean(v && v.trim())) ?? null;
  const isDistanciel = /distanc|visio|remote|à distance/i.test(modeStr ?? "");
  const lieu = sessionLocation ?? (isDistanciel ? "Distanciel (visioconférence)" : null);

  return {
    meta: { source: "CRM-LCA", event: "adf.formation.push", environment, sent_at: nowIso, external_reference: `LCA-PLAN-${plan.id}` },
    formation: { titre: plan.training_programs?.name ?? null, mode: modeStr, lieu, vt_prevues: plan.vt_planned ?? null, journees_prevues: plan.days_planned ?? null, duree_totale_heures: dureeTotale, date_debut: dateDebut, date_fin: dateFin },
    entreprise: { raison_sociale: c?.name ?? null, siret: c?.siret ?? null, adresse: c?.address ?? null, ville: c?.city ?? null },
    formateur: trainer ? { nom: trainer.last_name ?? null, prenom: trainer.first_name ?? null, email: trainer.email ?? null } : null,
    sessions,
    apprenants,
  };
}

export async function pushToVisioformation(payload: VisioformationPayload): Promise<VisioformationResult> {
  const res = await fetch(VF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VF_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  const vfId = body && typeof body === "object" && "id" in (body as Record<string, unknown>) ? String((body as Record<string, unknown>).id) : null;
  if (!res.ok) console.error(`[visioformation] push → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return { ok: res.ok, status: res.status, vfId, body };
}
