"use client";

import { ExternalLink } from "lucide-react";

interface ResourceLink {
  id: string;
  category: string;
  name: string;
  description: string | null;
  url: string;
  display_order: number;
}

const CARD_COLORS = [
  { bg: "linear-gradient(135deg, #1e8449 0%, #27ae60 100%)", border: "#27ae60", shadow: "rgba(39,174,96,0.12)" },
  { bg: "linear-gradient(135deg, #1a5276 0%, #2980b9 100%)", border: "#2980b9", shadow: "rgba(41,128,185,0.12)" },
  { bg: "linear-gradient(135deg, #6c3483 0%, #8e44ad 100%)", border: "#8e44ad", shadow: "rgba(142,68,173,0.12)" },
  { bg: "linear-gradient(135deg, #e65100 0%, #E8732A 100%)", border: "#E8732A", shadow: "rgba(255,107,53,0.12)" },
  { bg: "linear-gradient(135deg, #7b341e 0%, #c0392b 100%)", border: "#c0392b", shadow: "rgba(192,57,43,0.12)" },
  { bg: "linear-gradient(135deg, #1a6b9c 0%, #2196f3 100%)", border: "#2196f3", shadow: "rgba(33,150,243,0.12)" },
];

export function ResourceLinksPage({ resourceLinks }: { resourceLinks: ResourceLink[] }) {
  if (resourceLinks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#8399a9" }}>
        <ExternalLink style={{ width: 40, height: 40, margin: "0 auto 16px", opacity: 0.4 }} />
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Aucune ressource configurée</p>
        <p style={{ fontSize: 13 }}>Ajoutez des ressources depuis Paramètres &gt; Ressources (catégorie &quot;Production&quot;).</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {resourceLinks.map((link, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length];
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "28px 24px", borderRadius: 14, cursor: "pointer",
              border: "1px solid #dce8f0", background: "white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", gap: 16,
              transition: "all 0.15s ease", width: 320, textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = color.border; e.currentTarget.style.boxShadow = `0 4px 16px ${color.shadow}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: color.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ExternalLink style={{ width: 24, height: 24, color: "white" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{link.name}</div>
              {link.description && <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>{link.description}</div>}
            </div>
          </a>
        );
      })}
    </div>
  );
}
