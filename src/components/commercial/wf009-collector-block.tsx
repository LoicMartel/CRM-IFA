"use client";
import { useEffect, useState } from "react";

type Trainer = { id: string; first_name: string | null; last_name: string | null };

// Bloc collector WF-009 sur la fiche deal : capture la suggestion formateur (IA) + si elle
// était correcte + une note, pour réentraîner le matching. Self-contained (fetch/save via
// /api/deals/[id]/wf009-feedback) → aucun couplage avec la requête du board.
export function WF009CollectorBlock({ dealId }: { dealId: string }) {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [suggested, setSuggested] = useState<string>("");
  const [correct, setCorrect] = useState<"yes" | "no" | "">("");
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/deals/${dealId}/wf009-feedback`);
        if (!r.ok) return;
        const j = await r.json();
        if (!active) return;
        setTrainers(j.trainers ?? []);
        setSuggested(j.current?.suggestedTrainerId ?? "");
        setCorrect(j.current?.correct === true ? "yes" : j.current?.correct === false ? "no" : "");
        setFeedback(j.current?.feedback ?? "");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [dealId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch(`/api/deals/${dealId}/wf009-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedTrainerId: suggested || null,
          correct: correct === "yes" ? true : correct === "no" ? false : null,
          feedback: feedback.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Enregistrement impossible : " + (j.error ?? r.status));
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#8399a9" };
  const inputStyle = { width: "100%", border: "1px solid #dde3e8", borderRadius: 6, padding: "6px 8px", fontSize: 13, marginTop: 4 };

  return (
    <div style={{ marginTop: 20, padding: 14, border: "1px solid #e6ebf0", borderRadius: 10, background: "#fafbfc" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a2a3a", marginBottom: 10 }}>
        🤖 Suggestion formateur (WF-009)
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={labelStyle}>Formateur suggéré par l&apos;IA</span>
        <select value={suggested} onChange={(e) => { setSuggested(e.target.value); setSaved(false); }} style={inputStyle}>
          <option value="">— Non renseigné —</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>{`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || t.id}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={labelStyle}>La suggestion était-elle correcte ?</span>
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 13 }}>
          {([["yes", "✅ Oui"], ["no", "❌ Non"], ["", "—"]] as const).map(([v, lbl]) => (
            <label key={v || "na"} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="radio" name={`wf009-correct-${dealId}`} checked={correct === v} onChange={() => { setCorrect(v); setSaved(false); }} />
              {lbl}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={labelStyle}>Note (paramètre manquant, raison de l&apos;écart…)</span>
        <textarea value={feedback} onChange={(e) => { setFeedback(e.target.value); setSaved(false); }} rows={2} style={inputStyle} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} disabled={saving} style={{ background: "#e8632b", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "#0a7d3c" }}>Enregistré ✓</span>}
      </div>
    </div>
  );
}
