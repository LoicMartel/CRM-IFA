"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Line { month: string; amount: string; }

export function BillingPlanModal({
  dealId, dealName, dealAmount, defaultClientName, onClose, onDone,
}: {
  dealId: string;
  dealName: string;
  dealAmount: number | null;
  defaultClientName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const thisMonth = new Date().toISOString().slice(0, 7) + "-01";
  const [fundingType, setFundingType] = useState("Direct");
  const [clientName, setClientName] = useState(defaultClientName);
  const [lines, setLines] = useState<Line[]>([
    { month: thisMonth, amount: dealAmount ? String(dealAmount) : "" },
  ]);
  const [saving, setSaving] = useState(false);

  const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const mismatch = dealAmount != null && Math.abs(sum - dealAmount) > 0.01;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/billing-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundingType,
          clientName,
          lines: lines
            .filter((l) => l.month && Number(l.amount) > 0)
            .map((l) => ({ month: l.month, amount: Number(l.amount) })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(`Échec : ${json.error ?? "erreur"}`); return; }
      alert(`Plan de facturation programmé : ${json.scheduled} échéance(s).`);
      onDone();
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 8, padding: 24, width: 520, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Programmer la facturation</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{dealName}</p>

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Raison sociale</label>
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, marginBottom: 12 }} />

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Type de financement</label>
        <select value={fundingType} onChange={(e) => setFundingType(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, marginBottom: 16 }}>
          <option value="Direct">Direct / UP FRONT</option>
          <option value="UP FRONT">UP FRONT</option>
          <option value="OPCO">OPCO</option>
        </select>

        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Échéances</label>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="month" value={l.month.slice(0, 7)} onChange={(e) => setLine(i, { month: e.target.value + "-01" })} style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
            <input type="number" placeholder="Montant HT" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} style={{ width: 140, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
            <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 style={{ width: 16, height: 16, color: "#ef4444" }} /></button>
          </div>
        ))}
        <button onClick={() => setLines((p) => [...p, { month: thisMonth, amount: "" }])} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
          <Plus style={{ width: 14, height: 14 }} /> échéance
        </button>

        {mismatch && (
          <p style={{ fontSize: 12, color: "#b45309", marginBottom: 12 }}>
            ⚠️ Somme des échéances ({sum.toLocaleString("fr-FR")} €) ≠ montant du deal ({dealAmount?.toLocaleString("fr-FR")} €).
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white", cursor: "pointer" }}>Annuler</button>
          <button onClick={() => submit()} disabled={saving} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#e8632b", color: "white", cursor: "pointer" }}>
            {saving ? "..." : "Programmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
