/**
 * Affichage partagé des activités (timeline) — fiche contact ET fiche entreprise.
 * Centralise libellés, couleurs et le formatage des titres pour éviter toute
 * divergence entre les deux fiches.
 */

export const activityTypeLabels: Record<string, string> = {
  appel: "Appel",
  email: "Email",
  "réunion": "Réunion",
  note: "Note",
  "tâche": "Tâche",
  relance: "Relance",
  message: "Message",
};

export const activityTypeColors: Record<string, { bg: string; text: string }> = {
  appel: { bg: "#e3f2fd", text: "#1565c0" },
  email: { bg: "#fff3e0", text: "#e65100" },
  "réunion": { bg: "#f3e5f5", text: "#6a1b9a" },
  note: { bg: "#e8f5e9", text: "#2e7d32" },
  "tâche": { bg: "#fce4ec", text: "#c62828" },
  relance: { bg: "#fff8e1", text: "#f57c00" },
  message: { bg: "#e8eaf6", text: "#3949ab" },
};

export function activityTypeBadge(type: string | null | undefined): { label: string; bg: string; text: string } {
  const t = type ?? "note";
  return {
    label: activityTypeLabels[t] ?? t,
    ...(activityTypeColors[t] ?? { bg: "#f0f0f0", text: "#666" }),
  };
}

/**
 * Rend un titre d'activité lisible : retire les préfixes techniques `[ADV]` /
 * `[ADV cron]` posés par le pipeline ADV (« [ADV] Devis signé » → « Devis signé »).
 */
export function formatActivityTitle(title: string | null | undefined): string {
  if (!title) return "Activité";
  return title.replace(/^\[ADV(?:\s+cron)?\]\s*/i, "").trim() || title;
}

const EMAIL_HTML_RE = /__EMAIL_HTML__([\s\S]*?)__END_HTML__/;

/** Extrait le HTML d'un email journalisé (description encapsulée), ou null. */
export function extractEmailHtml(description: string | null | undefined): string | null {
  return description?.match(EMAIL_HTML_RE)?.[1] ?? null;
}

/** Retire le bloc HTML email d'une description pour un aperçu texte propre. */
export function stripEmailHtml(description: string | null | undefined): string {
  return (description ?? "").replace(/__EMAIL_HTML__[\s\S]*?__END_HTML__\n*/, "").trim();
}
