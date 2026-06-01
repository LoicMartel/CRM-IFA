"use client";

import { useEffect, useState } from "react";
import type { QuoteLineDraft } from "@/lib/adv-quote";

function tomorrowISODate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type CatalogItem = { ref: string; label: string; id: number };

export function QuoteSendModal({
  dealId,
  dealName,
  onClose,
  onDone,
  fromQuotation,
}: {
  dealId: string;
  dealName: string;
  onClose: () => void;
  onDone: () => void;
  fromQuotation?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<QuoteLineDraft[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [date, setDate] = useState(tomorrowISODate());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const url = fromQuotation
          ? `/api/quotes/draft/${dealId}?fromQuotation=${fromQuotation}`
          : `/api/quotes/draft/${dealId}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!active) return;
        if (res.ok) {
          setLines(json.lines ?? []);
          setSubject(json.subject ?? "");
          setDescription(json.description ?? "");
          setCatalog(json.catalog ?? []);
        } else {
          alert(`Erreur chargement devis : ${json.error ?? "inconnue"}`);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dealId, fromQuotation]);

  function updateLine(i: number, patch: Partial<QuoteLineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addCatalogLine(ref: string) {
    const item = catalog.find((c) => c.ref === ref);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      { kind: "custom", product_ref: item.ref, label: item.label, quantity: 1, unit: "unité", unit_price: "0.00", vat_rate: "FR_200", description: null },
    ]);
  }
  function addFreeLine() {
    setLines((prev) => [
      ...prev,
      { kind: "custom", product_ref: null, label: "", quantity: 1, unit: "unité", unit_price: "0.00", vat_rate: "FR_200", description: null },
    ]);
  }

  async function submit() {
    if (lines.length === 0) {
      alert("Au moins une ligne est requise.");
      return;
    }
    if (lines.some((l) => !l.label?.trim())) {
      alert("Chaque ligne doit avoir un libellé.");
      return;
    }
    if (mode === "scheduled" && !date) {
      alert("Choisis une date d'envoi.");
      return;
    }
    setSaving(true);
    try {
      const body: {
        deal_id: string;
        lines: QuoteLineDraft[];
        subject: string;
        description: string;
        scheduled_send_at?: string;
      } = { deal_id: dealId, lines, subject, description };
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
      alert(json.message ?? (mode === "scheduled" ? "Envoi planifié." : "Devis préparé."));
      onDone();
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const cell = { padding: "4px 6px", border: "1px solid #e2e8f0", fontSize: 12 } as const;
  const input = { width: "100%", border: "none", outline: "none", fontSize: 12 } as const;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 8, padding: 24, width: 760, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Préparer le devis</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{dealName}</p>

        {loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Chargement…</p>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Titre du devis (PDF)</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, marginBottom: 10 }} />
            <label style={{ fontSize: 12, fontWeight: 600 }}>Description (PDF)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, marginBottom: 12 }} />

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
              <thead>
                <tr style={{ fontSize: 11, color: "#64748b" }}>
                  <th style={cell}>Libellé</th>
                  <th style={{ ...cell, width: 50 }}>Qté</th>
                  <th style={{ ...cell, width: 90 }}>PU €</th>
                  <th style={{ ...cell, width: 80 }}>TVA</th>
                  <th style={cell}>Description</th>
                  <th style={{ ...cell, width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.kind}-${l.product_ref ?? "free"}-${i}`}>
                    <td style={cell}><input style={input} value={l.label} onChange={(e) => updateLine(i, { label: e.target.value })} /></td>
                    <td style={cell}><input style={input} type="number" min={0} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} /></td>
                    <td style={cell}><input style={input} type="number" step="0.01" min="0" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} /></td>
                    <td style={cell}>
                      <select style={input} value={l.vat_rate} onChange={(e) => updateLine(i, { vat_rate: e.target.value as QuoteLineDraft["vat_rate"] })}>
                        <option value="FR_200">20%</option>
                        <option value="FR_100">10%</option>
                        <option value="FR_055">5,5%</option>
                        <option value="exempt">Exonéré</option>
                      </select>
                    </td>
                    <td style={cell}><input style={input} value={l.description ?? ""} onChange={(e) => updateLine(i, { description: e.target.value || null })} /></td>
                    <td style={{ ...cell, textAlign: "center" }}><button onClick={() => removeLine(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <select onChange={(e) => { if (e.target.value) { addCatalogLine(e.target.value); e.target.value = ""; } }} defaultValue="" style={{ padding: 6, border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }}>
                <option value="">+ Ligne catalogue…</option>
                {catalog.map((c) => <option key={c.ref} value={c.ref}>{c.label}</option>)}
              </select>
              <button onClick={addFreeLine} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12 }}>+ Ligne libre</button>
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, border: `1px solid ${mode === "now" ? "#e8632b" : "#cbd5e1"}`, borderRadius: 8, marginBottom: 10, cursor: "pointer" }}>
              <input type="radio" name="mode" checked={mode === "now"} onChange={() => setMode("now")} style={{ marginTop: 3 }} />
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>Préparer maintenant</div><div style={{ fontSize: 12, color: "#64748b" }}>Génère le devis et le place dans « Pièces à valider ».</div></div>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, border: `1px solid ${mode === "scheduled" ? "#e8632b" : "#cbd5e1"}`, borderRadius: 8, marginBottom: 10, cursor: "pointer" }}>
              <input type="radio" name="mode" checked={mode === "scheduled"} onChange={() => setMode("scheduled")} style={{ marginTop: 3 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Planifier l&apos;envoi</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: mode === "scheduled" ? 8 : 0 }}>Généré et placé en validation le matin de la date choisie.</div>
                {mode === "scheduled" && (
                  <input type="date" value={date} min={tomorrowISODate()} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                )}
              </div>
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white", cursor: "pointer" }}>Annuler</button>
              <button onClick={submit} disabled={saving} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#e8632b", color: "white", cursor: "pointer" }}>
                {saving ? "..." : mode === "scheduled" ? "Planifier" : "Préparer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
