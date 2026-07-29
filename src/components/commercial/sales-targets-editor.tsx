"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SalesTarget {
  id: string;
  month: string;
  target_amount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

export function SalesTargetsEditor({ targets, annualTarget }: { targets: SalesTarget[]; annualTarget: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openEditor() {
    const v: Record<string, string> = {};
    targets.forEach(t => { v[t.id] = String(t.target_amount); });
    setValues(v);
    setOpen(true);
  }

  function updateValue(id: string, val: string) {
    setValues(prev => ({ ...prev, [id]: val }));
  }

  const currentTotal = Object.values(values).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    for (const t of targets) {
      const newAmount = parseFloat(values[t.id] ?? "0") || 0;
      if (newAmount !== t.target_amount) {
        await supabase.from("sales_targets").update({ target_amount: newAmount }).eq("id", t.id);
      }
    }
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {/* Clickable KPI card */}
      <div
        className="lca-card"
        onClick={openEditor}
        style={{ padding: "10px 14px", cursor: "pointer" }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Objectif annuel</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmt(annualTarget)}</div>
        <div style={{ fontSize: 11, color: "#1E2A5A", fontWeight: 600 }}>Cliquer pour modifier</div>
      </div>

      {/* Popup */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Objectifs de vente</h3>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20 }}>
              {/* Annual total */}
              <div style={{ background: "#f0f7fb", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Objectif annuel (total)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{fmt(currentTotal)}</div>
                </div>
                <div style={{ fontSize: 12, color: "#8399a9" }}>Somme des 12 mois</div>
              </div>

              {/* Monthly targets */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {targets.map(t => {
                  const monthLabel = format(new Date(t.month), "MMMM yyyy", { locale: fr });
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", textTransform: "capitalize", minWidth: 140 }}>{monthLabel}</span>
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          value={values[t.id] ?? ""}
                          onChange={(e) => updateValue(t.id, e.target.value)}
                          style={{
                            height: 34, width: 140, borderRadius: 8, border: "1px solid #dce8f0",
                            padding: "0 30px 0 10px", fontSize: 13, fontWeight: 600, color: "#1a2a3a",
                            textAlign: "right", outline: "none",
                          }}
                        />
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#8399a9" }}>€</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
              <button onClick={() => setOpen(false)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
