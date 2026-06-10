import {
  activityTypeBadge,
  formatActivityTitle,
  extractEmailHtml,
  stripEmailHtml,
} from "@/lib/activity-display";

export interface ActivityItem {
  id?: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
  team_members?: { first_name?: string | null; last_name?: string | null } | null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Timeline d'activités en LECTURE SEULE (fiche entreprise = vue 360).
 * L'édition/ajout reste sur la fiche contact. Affiche les libellés lisibles
 * (sans préfixe `[ADV]`) et un aperçu déroulant des emails journalisés.
 */
export function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const items = [...activities].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  if (items.length === 0) {
    return (
      <p style={{ color: "#888", fontSize: 14, padding: "16px 0" }}>
        Aucune activité pour le moment.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((a, i) => {
        const badge = activityTypeBadge(a.type);
        const emailHtml = extractEmailHtml(a.description);
        const preview = stripEmailHtml(a.description);
        const author = a.team_members
          ? `${a.team_members.first_name ?? ""} ${a.team_members.last_name ?? ""}`.trim()
          : "";
        return (
          <div
            key={a.id ?? i}
            style={{
              borderLeft: `3px solid ${badge.text}`,
              background: "#fafafa",
              borderRadius: 6,
              padding: "10px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: badge.bg,
                  color: badge.text,
                }}
              >
                {badge.label}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#1a2a3a" }}>
                {formatActivityTitle(a.title)}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>
                {formatDate(a.created_at)}
                {author ? ` · ${author}` : ""}
              </span>
            </div>
            {preview && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>
                {preview.length > 240 ? `${preview.slice(0, 240)}…` : preview}
              </p>
            )}
            {emailHtml && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#1a6b9c" }}>
                  Voir l&apos;email
                </summary>
                <div
                  style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 6, padding: 12, background: "#fff" }}
                  dangerouslySetInnerHTML={{ __html: emailHtml }}
                />
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
