"use client";

import { useState, useRef } from "react";
import { Upload, AlertTriangle, X } from "lucide-react";
import {
  parsePlansExport,
  buildPlanImportRows,
  type PlanImportRow,
  type CompanyRefPlan,
  type LearnerRefPlan,
} from "@/lib/visioformation-plans";

export type { PlanImportRow };

export function VisioformationPlansImportModal({
  open,
  onClose,
  companies,
  learners,
  onStartImport,
  existingPlanCompanyIds = [],
}: {
  open: boolean;
  onClose: () => void;
  companies: CompanyRefPlan[];
  learners: LearnerRefPlan[];
  onStartImport: (plans: PlanImportRow[]) => void;
  existingPlanCompanyIds?: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<1 | 2>(1);
  const [rows, setRows] = useState<PlanImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  if (!open) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const visioRows = parsePlansExport(buffer);
      const planRows = buildPlanImportRows(visioRows, companies, learners);
      setRows(planRows);
      // Pre-select rows that have a company match (but NOT those with existing plans)
      setSelected(new Set(planRows.map((r, i) => (r.companyId && !existingSet.has(r.companyId) ? i : -1)).filter((i) => i >= 0)));
      setStage(2);
    };
    reader.readAsArrayBuffer(file);
  }

  const existingSet = new Set(existingPlanCompanyIds);
  const hasUnmatched = rows.some((r) => !r.companyId);

  function hasExistingPlan(row: PlanImportRow) {
    return !!row.companyId && existingSet.has(row.companyId);
  }

  function toggleRow(idx: number) {
    if (!rows[idx]?.companyId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    const selectableIndices = rows.map((r, i) => (r.companyId ? i : -1)).filter((i) => i >= 0);
    const allSelected = selectableIndices.every((i) => selected.has(i));
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIndices));
  }

  function updateCompany(idx: number, companyId: string) {
    setRows((prev) => {
      const next = [...prev];
      const company = companies.find((c) => c.id === companyId);
      next[idx] = {
        ...next[idx],
        companyId: companyId || null,
        companyName: company?.name ?? "",
        matchType: companyId ? "exact" : "none",
      };
      return next;
    });
    if (companyId && !selected.has(idx)) {
      setSelected((prev) => new Set(prev).add(idx));
    }
    if (!companyId) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  function handleConfirm() {
    const selectedPlans = rows.filter((_, i) => selected.has(i));
    const duplicates = selectedPlans.filter((r) => hasExistingPlan(r));
    if (duplicates.length > 0) {
      const names = duplicates.map((d) => d.companyName || d.entreprise).join(", ");
      const ok = window.confirm(
        `Attention : ${duplicates.length} plan${duplicates.length > 1 ? "s" : ""} concern${duplicates.length > 1 ? "ent" : "e"} des entreprises qui ont déjà un plan de formation :\n\n${names}\n\nNormalement il n'y a qu'un seul plan par deal signé. Voulez-vous quand même créer de nouveaux plans pour ces entreprises ?`
      );
      if (!ok) return;
    }
    // Reset modal state for next time
    setStage(1);
    setRows([]);
    setSelected(new Set());
    onClose();
    onStartImport(selectedPlans);
  }

  const matchColors: Record<string, { bg: string; text: string }> = {
    exact: { bg: "#e8f5e9", text: "#2e7d32" },
    partial: { bg: "#fff3e0", text: "#e65100" },
    none: { bg: "#f5f5f5", text: "#999" },
  };

  const modeLabels: Record<string, string> = {
    presentiel: "Présentiel",
    distanciel: "Distanciel",
    mixte: "Mixte",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 16, width: "95%", maxWidth: 1200,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid #e8ecf1",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Upload style={{ width: 20, height: 20, color: "#1a6b9c" }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", margin: 0 }}>
              Importer des plans de formation depuis Visioformation
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X style={{ width: 20, height: 20, color: "#8399a9" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Stage 1: Upload */}
          {stage === 1 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Upload style={{ width: 48, height: 48, color: "#dce8f0", margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1a2a3a", marginBottom: 8 }}>
                Importez le fichier &quot;Suivi activité formation&quot;
              </h3>
              <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
                Exportez le fichier Excel depuis Visioformation. Les sessions seront regroupées par entreprise pour créer un plan de formation par client.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  height: 44, borderRadius: 10, padding: "0 24px",
                  background: "linear-gradient(135deg, #1a6b9c 0%, #0d4f7a 100%)",
                  color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(26,107,156,0.3)",
                }}
              >
                Choisir un fichier Excel
              </button>
            </div>
          )}

          {/* Stage 2: Preview & Select */}
          {stage === 2 && (
            <>
              {hasUnmatched && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, marginBottom: 16,
                  background: "#fde8e8", border: "1px solid #f5c6c6",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <AlertTriangle style={{ width: 18, height: 18, color: "#c62828", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#c62828" }}>
                    Certaines entreprises n&apos;ont pas été trouvées dans le CRM. Associez-les manuellement ou créez-les d&apos;abord.
                  </span>
                </div>
              )}

              <div style={{
                padding: "12px 16px", borderRadius: 10, marginBottom: 16,
                background: "#e8f0fe", border: "1px solid #b3d4fc",
                fontSize: 13, color: "#0d4f7a",
              }}>
                Sélectionnez les plans à importer. Chaque plan sera ouvert un par un dans le formulaire pour compléter les détails (parcours, type, budget, etc.).
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e8f5e9", fontSize: 13, fontWeight: 600, color: "#2e7d32" }}>
                  {selected.size} plan{selected.size > 1 ? "s" : ""} à importer
                </div>
                {rows.some((r) => hasExistingPlan(r)) && (
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: "#fff3e0", fontSize: 13, fontWeight: 600, color: "#e65100" }}>
                    {rows.filter((r) => hasExistingPlan(r)).length} avec plan existant
                  </div>
                )}
                {hasUnmatched && (
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: "#fde8e8", fontSize: 13, fontWeight: 600, color: "#c62828" }}>
                    {rows.filter((r) => !r.companyId).length} sans entreprise
                  </div>
                )}
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#f5f5f5", fontSize: 13, fontWeight: 600, color: "#666" }}>
                  {rows.length - selected.size} ignoré{(rows.length - selected.size) > 1 ? "s" : ""}
                </div>
              </div>

              <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #dce8f0", position: "sticky", top: 0, background: "white" }}>
                      <th style={{ padding: "8px 4px", textAlign: "center", width: 30 }}>
                        <input type="checkbox" checked={rows.some((r) => r.companyId) && rows.every((r, i) => !r.companyId || selected.has(i))} onChange={toggleAll} />
                      </th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Entreprise (Visio)</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Sessions</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>VT</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Journées</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Heures</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Mode</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Période</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Apprenants</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Formateurs</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c", minWidth: 220 }}>Entreprise CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const hasCompany = !!row.companyId;
                      const existing = hasExistingPlan(row);
                      const mc = matchColors[row.matchType];
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            opacity: selected.has(idx) ? 1 : hasCompany ? 0.4 : 1,
                            background: !hasCompany ? "#fef2f2" : existing ? "#fff8f0" : undefined,
                          }}
                        >
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleRow(idx)} disabled={!hasCompany} />
                          </td>
                          <td style={{ padding: "6px 4px", fontWeight: 600, color: !hasCompany ? "#c62828" : "#1a2a3a", maxWidth: 200 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                              {row.entreprise}
                              {existing && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "#fff3e0", color: "#e65100", whiteSpace: "nowrap", flexShrink: 0 }}>plan existant</span>}
                            </div>
                          </td>
                          <td style={{ padding: "6px 4px", textAlign: "center", color: "#5a6f80", fontWeight: 700 }}>{row.sessionCount}</td>
                          <td style={{ padding: "6px 4px", textAlign: "center", color: "#0d4f7a" }}>{row.vtCount}</td>
                          <td style={{ padding: "6px 4px", textAlign: "center", color: "#e65100" }}>{row.journeeCount}</td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80" }}>{row.totalHours}h</td>
                          <td style={{ padding: "6px 4px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                              background: row.mode === "distanciel" ? "#fff3e0" : row.mode === "presentiel" ? "#e8f5e9" : "#fce4ec",
                              color: row.mode === "distanciel" ? "#e65100" : row.mode === "presentiel" ? "#2e7d32" : "#c62828",
                            }}>
                              {modeLabels[row.mode]}
                            </span>
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80", fontSize: 11, whiteSpace: "nowrap" }}>
                            {row.startDate && row.endDate ? `${row.startDate} → ${row.endDate}` : row.startDate ?? "—"}
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80" }}>
                            <span title={row.learnerNames.join(", ")}>
                              {row.learnerNames.length} ({row.matchedLearnerIds.length} liés)
                            </span>
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80", fontSize: 11 }}>
                            {row.formateurs.join(", ") || "—"}
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            <select
                              value={row.companyId || ""}
                              onChange={(e) => updateCompany(idx, e.target.value)}
                              style={{
                                width: "100%", height: 28, borderRadius: 6, fontSize: 11,
                                border: `1.5px solid ${mc.text}20`,
                                background: mc.bg, color: mc.text,
                                padding: "0 6px",
                              }}
                            >
                              <option value="">-- Aucune entreprise --</option>
                              {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid #e8ecf1",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          {stage === 2 && (
            <>
              <button
                onClick={() => { setStage(1); setRows([]); }}
                style={{
                  height: 40, borderRadius: 8, padding: "0 20px", border: "1px solid #dce8f0",
                  background: "white", color: "#5a6f80", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Retour
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                style={{
                  height: 40, borderRadius: 8, padding: "0 24px", border: "none",
                  background: selected.size === 0 ? "#8399a9" : "linear-gradient(135deg, #1a6b9c 0%, #0d4f7a 100%)",
                  color: "white", fontSize: 13, fontWeight: 700,
                  cursor: selected.size === 0 ? "default" : "pointer",
                  boxShadow: selected.size === 0 ? "none" : "0 4px 15px rgba(26,107,156,0.3)",
                }}
              >
                Commencer l&apos;import ({selected.size} plan{selected.size > 1 ? "s" : ""})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
