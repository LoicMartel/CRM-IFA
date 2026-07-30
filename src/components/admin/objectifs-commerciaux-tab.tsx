"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFiscalMonthsFull, getCurrentFiscalYearStart, getFiscalYearOptions, type FiscalMode } from "@/lib/fiscal-year";

interface TeamMemberOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface UserTarget {
  id: string;
  team_member_id: string;
  month: string;
  target_amount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " \u20ac";
}

export function ObjectifsCommerciauxTab({
  accountManagers,
  userTargets: initialTargets,
  fiscalMode,
}: {
  accountManagers: TeamMemberOption[];
  userTargets: UserTarget[];
  fiscalMode: FiscalMode;
}) {
  const router = useRouter();
  const [fyYear, setFyYear] = useState(() => getCurrentFiscalYearStart(fiscalMode));
  const [selectedMemberId, setSelectedMemberId] = useState<string>(accountManagers[0]?.id ?? "");
  const [targets, setTargets] = useState<UserTarget[]>(initialTargets);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const months = getFiscalMonthsFull(fyYear, fiscalMode);

  async function loadTargets(memberId: string, fy: number) {
    if (!memberId) return;
    setLoading(true);
    const supabase = createClient();
    const monthDates = getFiscalMonthsFull(fy, fiscalMode).map(m => m.date);

    const { data } = await supabase
      .from("user_sales_targets")
      .select("id, team_member_id, month, target_amount")
      .eq("team_member_id", memberId)
      .in("month", monthDates);

    const loaded = (data ?? []) as UserTarget[];
    setTargets(loaded);

    const v: Record<string, string> = {};
    loaded.forEach(t => {
      v[t.month.slice(0, 10)] = String(t.target_amount);
    });
    setValues(v);
    setLoading(false);
  }

  function handleMemberChange(memberId: string) {
    setSelectedMemberId(memberId);
    loadTargets(memberId, fyYear);
  }

  function handleFyChange(fy: number) {
    setFyYear(fy);
    loadTargets(selectedMemberId, fy);
  }

  function updateValue(monthDate: string, val: string) {
    setValues(prev => ({ ...prev, [monthDate]: val }));
  }

  const annualTotal = months.reduce((s, m) => s + (parseFloat(values[m.date] ?? "0") || 0), 0);

  async function handleSave() {
    if (!selectedMemberId) return;
    setSaving(true);
    const supabase = createClient();

    for (const m of months) {
      const newAmount = parseFloat(values[m.date] ?? "0") || 0;
      const existing = targets.find(t => t.month.slice(0, 10) === m.date);

      if (existing) {
        if (newAmount !== existing.target_amount) {
          await supabase
            .from("user_sales_targets")
            .update({ target_amount: newAmount, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      } else if (newAmount > 0) {
        await supabase
          .from("user_sales_targets")
          .insert({ team_member_id: selectedMemberId, month: m.date, target_amount: newAmount });
      }
    }

    setSaving(false);
    // Reload to sync state
    await loadTargets(selectedMemberId, fyYear);
    router.refresh();
  }

  // Apply uniform target
  const [uniformAmount, setUniformAmount] = useState("");

  function applyUniform() {
    const amount = parseFloat(uniformAmount) || 0;
    if (amount <= 0) return;
    const monthly = Math.round(amount / 12);
    const v: Record<string, string> = {};
    months.forEach(m => { v[m.date] = String(monthly); });
    setValues(v);
  }

  // Initialize on first load
  useState(() => {
    if (selectedMemberId) {
      loadTargets(selectedMemberId, fyYear);
    }
  });

  const selectedMember = accountManagers.find(m => m.id === selectedMemberId);

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="lca-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Target style={{ width: 20, height: 20, color: "#E8732A" }} />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a", margin: 0 }}>Objectifs Commerciaux</h2>
        </div>
        <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 20, lineHeight: 1.5 }}>
          Definissez les objectifs de vente mensuels pour chaque Account Manager. Ces objectifs s'afficheront sur leur tableau de bord personnel.
        </p>

        {accountManagers.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#8399a9", fontSize: 13 }}>
            Aucun membre avec le badge &quot;Account Manager&quot; trouv&eacute;. Ajoutez ce badge dans la gestion d'equipe.
          </div>
        ) : (
          <>
            {/* Selectors row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              {/* Account Manager selector */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#5a6f80", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Account Manager
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => handleMemberChange(e.target.value)}
                  style={{
                    height: 40, width: "100%", borderRadius: 8, border: "1px solid #dce8f0",
                    padding: "0 12px", fontSize: 14, fontWeight: 600, color: "#1a2a3a", cursor: "pointer",
                    background: "white",
                  }}
                >
                  {accountManagers.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>

              {/* Fiscal year selector */}
              <div style={{ minWidth: 160 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#5a6f80", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Annee fiscale
                </label>
                <select
                  value={fyYear}
                  onChange={(e) => handleFyChange(Number(e.target.value))}
                  style={{
                    height: 40, width: "100%", borderRadius: 8, border: "1px solid #dce8f0",
                    padding: "0 12px", fontSize: 14, fontWeight: 600, color: "#1a2a3a", cursor: "pointer",
                    background: "white",
                  }}
                >
                  {getFiscalYearOptions(5, fiscalMode).map(o => (
                    <option key={o.startYear} value={o.startYear}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick fill: uniform annual target */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>
                  Objectif annuel (repartition uniforme)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={uniformAmount}
                    onChange={(e) => setUniformAmount(e.target.value)}
                    placeholder="Ex: 600 000"
                    style={{
                      height: 36, width: "100%", borderRadius: 8, border: "1px solid #dce8f0",
                      padding: "0 30px 0 10px", fontSize: 13, color: "#1a2a3a", outline: "none",
                    }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#8399a9" }}>&euro;</span>
                </div>
              </div>
              <button
                onClick={applyUniform}
                disabled={!uniformAmount}
                style={{
                  height: 36, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600,
                  background: uniformAmount ? "#1E2A5A" : "#e8ecf1",
                  color: uniformAmount ? "white" : "#8399a9",
                  border: "none", cursor: uniformAmount ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}
              >
                Appliquer
              </button>
            </div>

            {/* Annual total */}
            <div style={{ background: "#f0f7fb", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>
                  Objectif annuel — {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : ""}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{fmt(annualTotal)}</div>
              </div>
              <div style={{ fontSize: 12, color: "#8399a9" }}>Somme des 12 mois</div>
            </div>

            {/* Monthly grid */}
            {loading ? (
              <p style={{ color: "#8399a9", fontSize: 13, textAlign: "center", padding: 20 }}>Chargement...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {months.map(m => (
                  <div key={m.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", minWidth: 160 }}>
                      {m.label}
                    </span>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        value={values[m.date] ?? ""}
                        onChange={(e) => updateValue(m.date, e.target.value)}
                        placeholder="0"
                        style={{
                          height: 34, width: 160, borderRadius: 8, border: "1px solid #dce8f0",
                          padding: "0 30px 0 10px", fontSize: 13, fontWeight: 600, color: "#1a2a3a",
                          textAlign: "right", outline: "none",
                        }}
                      />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#8399a9" }}>&euro;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Save button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={handleSave}
                disabled={saving || !selectedMemberId}
                style={{
                  height: 40, borderRadius: 8, padding: "0 28px", fontSize: 14, fontWeight: 700,
                  background: saving ? "#8399a9" : "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)",
                  color: "white", border: "none", cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Enregistrement..." : "Enregistrer les objectifs"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
