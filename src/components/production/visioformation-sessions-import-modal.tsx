"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertTriangle, X } from "lucide-react";
import {
  parseSessionsExport,
  buildSessionImportRows,
  type SessionImportRow,
  type ServicePlanRef,
  type LearnerRef,
  type TeamMemberRef,
} from "@/lib/visioformation-sessions";

export function VisioformationSessionsImportModal({
  open,
  onClose,
  servicePlans,
  learners,
  teamMembers = [],
}: {
  open: boolean;
  onClose: () => void;
  servicePlans: ServicePlanRef[];
  learners: LearnerRef[];
  teamMembers?: TeamMemberRef[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<SessionImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  if (!open) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const visioRows = parseSessionsExport(buffer);
      const importRows = buildSessionImportRows(visioRows, servicePlans, learners, teamMembers);
      setRows(importRows);
      // Only pre-select rows that have a matching plan
      setSelected(new Set(importRows.map((r, i) => (r.servicePlanId ? i : -1)).filter((i) => i >= 0)));
      setStage(2);
    };
    reader.readAsArrayBuffer(file);
  }

  const hasUnmatched = rows.some((r) => !r.servicePlanId);
  const hasSelectedWithoutPlan = Array.from(selected).some((i) => !rows[i]?.servicePlanId);

  function toggleRow(idx: number) {
    // Cannot select rows without a plan
    if (!rows[idx]?.servicePlanId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    const selectableIndices = rows.map((r, i) => (r.servicePlanId ? i : -1)).filter((i) => i >= 0);
    const allSelected = selectableIndices.every((i) => selected.has(i));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIndices));
    }
  }

  function updateServicePlan(idx: number, planId: string) {
    setRows((prev) => {
      const next = [...prev];
      const plan = servicePlans.find((sp) => sp.id === planId);
      const companyAddress = plan?.companies
        ? [plan.companies.address, plan.companies.city].filter(Boolean).join(", ")
        : "";
      // Re-resolve location with new plan's company address
      const row = next[idx];
      let sessionLocation = row.sessionLocation;
      if (row.sessionType === "journee" && !row.raw.lieuFormation) {
        sessionLocation = companyAddress;
      }
      next[idx] = {
        ...next[idx],
        servicePlanId: planId || null,
        servicePlanLabel: plan?.companies?.name ?? "",
        matchType: planId ? "exact" : "none",
        sessionLocation,
      };
      return next;
    });
    // If a plan is now assigned and the row was not selected, auto-select it
    if (planId && !selected.has(idx)) {
      setSelected((prev) => new Set(prev).add(idx));
    }
    // If plan removed, deselect
    if (!planId) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  const selectedRows = rows.filter((_, i) => selected.has(i));

  async function handleImport() {
    setImporting(true);
    const payload = selectedRows.map((r) => ({
      servicePlanId: r.servicePlanId!,
      sessionType: r.sessionType,
      sessionDate: r.dateDebut,
      durationHours: r.durationHours,
      status: r.status,
      trainers: r.trainers,
      notes: "",
      learnerIds: r.matchedLearnerIds,
      sessionLocation: r.sessionLocation,
    }));

    try {
      const res = await fetch("/api/visioformation/import-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: payload }),
      });
      const data = await res.json();
      setResult(data);
      setStage(3);
    } catch {
      setResult({ created: 0, errors: ["Erreur reseau"] });
      setStage(3);
    }
    setImporting(false);
  }

  const matchColors: Record<string, { bg: string; text: string }> = {
    exact: { bg: "#e8f5e9", text: "#2e7d32" },
    partial: { bg: "#fff3e0", text: "#e65100" },
    none: { bg: "#f5f5f5", text: "#999" },
  };

  const statusLabels: Record<string, string> = {
    planned: "Planifie",
    done: "Termine",
    cancelled: "Annule",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose(); }}
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
              Importer des sessions depuis Visioformation
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
                Importez le fichier &quot;Suivi activite formation&quot;
              </h3>
              <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
                Exportez le fichier Excel depuis Visioformation (Suivi activite formation.xlsx) puis importez-le ici.
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

          {/* Stage 2: Preview & Validate */}
          {stage === 2 && (
            <>
              {/* Warning banner */}
              {hasUnmatched && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, marginBottom: 16,
                  background: "#fde8e8", border: "1px solid #f5c6c6",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <AlertTriangle style={{ width: 18, height: 18, color: "#c62828", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#c62828" }}>
                    Certaines sessions n&apos;ont pas de plan de formation associe. Veuillez creer les plans manquants avant d&apos;importer.
                  </span>
                </div>
              )}

              {/* Summary */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e8f5e9", fontSize: 13, fontWeight: 600, color: "#2e7d32" }}>
                  {selected.size} session{selected.size > 1 ? "s" : ""} a importer
                </div>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#f5f5f5", fontSize: 13, fontWeight: 600, color: "#666" }}>
                  {rows.length - selected.size} ignoree{rows.length - selected.size > 1 ? "s" : ""}
                </div>
                {hasUnmatched && (
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: "#fde8e8", fontSize: 13, fontWeight: 600, color: "#c62828" }}>
                    {rows.filter((r) => !r.servicePlanId).length} sans plan
                  </div>
                )}
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #dce8f0", position: "sticky", top: 0, background: "white" }}>
                      <th style={{ padding: "8px 4px", textAlign: "center", width: 30 }}>
                        <input type="checkbox" checked={rows.some((r) => r.servicePlanId) && rows.every((r, i) => !r.servicePlanId || selected.has(i))} onChange={toggleAll} />
                      </th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Titre</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Date</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Duree</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Type</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Statut</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Formateur</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Entreprise</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Apprenants</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c", minWidth: 220 }}>Plan de formation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const hasPlan = !!row.servicePlanId;
                      const mc = matchColors[row.matchType];
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            opacity: selected.has(idx) ? 1 : hasPlan ? 0.4 : 1,
                            background: !hasPlan ? "#fef2f2" : undefined,
                          }}
                        >
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={selected.has(idx)}
                              onChange={() => toggleRow(idx)}
                              disabled={!hasPlan}
                            />
                          </td>
                          <td style={{ padding: "6px 4px", fontWeight: 600, color: !hasPlan ? "#c62828" : "#1a2a3a", maxWidth: 180 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.titre}</div>
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80", whiteSpace: "nowrap" }}>{row.dateDebut}</td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80" }}>{row.durationHours}h</td>
                          <td style={{ padding: "6px 4px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                              background: row.sessionType === "vt" ? "#e8f0fe" : "#fff3e0",
                              color: row.sessionType === "vt" ? "#0d4f7a" : "#e65100",
                            }}>
                              {row.sessionType === "vt" ? "VT" : "Journee"}
                            </span>
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                              background: row.status === "done" ? "#e8f5e9" : "#e8f0fe",
                              color: row.status === "done" ? "#2e7d32" : "#0d4f7a",
                            }}>
                              {statusLabels[row.status] ?? row.status}
                            </span>
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80", fontSize: 11 }}>
                            {row.trainers.join(", ") || "\u2014"}
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80", fontWeight: 500 }}>
                            {row.entreprise || "\u2014"}
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80" }}>
                            <span title={row.apprenantNames.join(", ")}>
                              {row.nbApprenants} ({row.matchedLearnerIds.length} lies)
                            </span>
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            <select
                              value={row.servicePlanId || ""}
                              onChange={(e) => updateServicePlan(idx, e.target.value)}
                              style={{
                                width: "100%", height: 28, borderRadius: 6, fontSize: 11,
                                border: `1.5px solid ${mc.text}20`,
                                background: mc.bg, color: mc.text,
                                padding: "0 6px",
                              }}
                            >
                              <option value="">-- Aucun plan --</option>
                              {servicePlans.map((sp) => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.companies?.name ?? "Sans entreprise"} (plan {sp.id.slice(0, 6)})
                                </option>
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

          {/* Stage 3: Result */}
          {stage === 3 && result && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              {result.errors.length === 0 ? (
                <CheckCircle style={{ width: 48, height: 48, color: "#2e7d32", margin: "0 auto 16px" }} />
              ) : (
                <AlertTriangle style={{ width: 48, height: 48, color: "#e65100", margin: "0 auto 16px" }} />
              )}
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>
                Import termine
              </h3>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e8f5e9", fontSize: 14, fontWeight: 600, color: "#2e7d32" }}>
                  {result.created} session{result.created > 1 ? "s" : ""} creee{result.created > 1 ? "s" : ""}
                </div>
                {result.errors.length > 0 && (
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: "#fde8e8", fontSize: 14, fontWeight: 600, color: "#c62828" }}>
                    {result.errors.length} erreur{result.errors.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div style={{ textAlign: "left", maxWidth: 500, margin: "0 auto", padding: 12, background: "#fde8e8", borderRadius: 8 }}>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#c62828", marginBottom: 4 }}>{err}</div>
                  ))}
                </div>
              )}
            </div>
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
                onClick={handleImport}
                disabled={importing || selected.size === 0 || hasSelectedWithoutPlan}
                style={{
                  height: 40, borderRadius: 8, padding: "0 24px", border: "none",
                  background: (importing || selected.size === 0 || hasSelectedWithoutPlan) ? "#8399a9" : "linear-gradient(135deg, #1a6b9c 0%, #0d4f7a 100%)",
                  color: "white", fontSize: 13, fontWeight: 700,
                  cursor: (importing || selected.size === 0 || hasSelectedWithoutPlan) ? "default" : "pointer",
                  boxShadow: (importing || selected.size === 0 || hasSelectedWithoutPlan) ? "none" : "0 4px 15px rgba(26,107,156,0.3)",
                }}
              >
                {importing ? "Import en cours..." : `Confirmer l'import (${selected.size})`}
              </button>
            </>
          )}
          {stage === 3 && (
            <button
              onClick={() => { onClose(); router.refresh(); }}
              style={{
                height: 40, borderRadius: 8, padding: "0 24px", border: "none",
                background: "#1a6b9c", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
