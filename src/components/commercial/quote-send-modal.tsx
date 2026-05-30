"use client";

import { useState } from "react";

/** Demain au format yyyy-mm-dd (défaut planification). */
function tomorrowISODate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuoteSendModal({
  dealId,
  dealName,
  onClose,
  onDone,
}: {
  dealId: string;
  dealName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [date, setDate] = useState(tomorrowISODate());
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (mode === "scheduled" && !date) {
      alert("Choisis une date d'envoi.");
      return;
    }
    setSaving(true);
    try {
      const body: { deal_id: string; scheduled_send_at?: string } = { deal_id: dealId };
      if (mode === "scheduled") body.scheduled_send_at = date;
      const res = await fetch("/api/quotes/create-from-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Échec : ${json.error ?? "erreur"}`);
        return;
      }
      alert(json.message ?? (mode === "scheduled" ? "Envoi planifié." : "Devis envoyé."));
      onDone();
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const radioRow = { display: "flex", alignItems: "flex-start", gap: 10, padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 10, cursor: "pointer" } as const;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 8, padding: 24, width: 460, maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Créer le devis</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{dealName}</p>

        <label style={{ ...radioRow, borderColor: mode === "now" ? "#e8632b" : "#cbd5e1" }}>
          <input type="radio" name="mode" checked={mode === "now"} onChange={() => setMode("now")} style={{ marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Envoyer maintenant</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Génère le devis Pennylane et envoie l’email de signature immédiatement.</div>
          </div>
        </label>

        <label style={{ ...radioRow, borderColor: mode === "scheduled" ? "#e8632b" : "#cbd5e1" }}>
          <input type="radio" name="mode" checked={mode === "scheduled"} onChange={() => setMode("scheduled")} style={{ marginTop: 3 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Planifier l’envoi</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: mode === "scheduled" ? 8 : 0 }}>
              Le devis sera généré et envoyé automatiquement le matin de la date choisie.
            </div>
            {mode === "scheduled" && (
              <input
                type="date"
                value={date}
                min={tomorrowISODate()}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
              />
            )}
          </div>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white", cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#e8632b", color: "white", cursor: "pointer" }}>
            {saving ? "..." : mode === "scheduled" ? "Planifier" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
