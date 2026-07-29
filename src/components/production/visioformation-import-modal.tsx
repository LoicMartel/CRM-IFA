"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertTriangle, X, Building2 } from "lucide-react";
import {
  parseVisioformationExport,
  buildImportRows,
  type ImportRow,
} from "@/lib/visioformation";

interface Company {
  id: string;
  name: string;
}

interface Learner {
  id: string;
  email: string | null;
}

export function VisioformationImportModal({
  open,
  onClose,
  learners,
  companies,
}: {
  open: boolean;
  onClose: () => void;
  learners: Learner[];
  companies: Company[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  if (!open) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const visioRows = parseVisioformationExport(buffer);
      const importRows = buildImportRows(visioRows, learners, companies);
      setRows(importRows);
      setSelected(new Set(importRows.map((_, i) => i)));
      setStage(2);
    };
    reader.readAsArrayBuffer(file);
  }

  function toggleRow(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((_, i) => i)));
    }
  }

  function updateCompany(idx: number, companyId: string) {
    setRows((prev) => {
      const next = [...prev];
      const company = companies.find((c) => c.id === companyId);
      next[idx] = {
        ...next[idx],
        companyId: companyId || null,
        companyName: company?.name ?? "",
        companyMatchType: companyId ? "exact" : "none",
      };
      return next;
    });
  }

  const selectedRows = rows.filter((_, i) => selected.has(i));
  const toCreate = selectedRows.filter((r) => r.action === "create").length;
  const toUpdate = selectedRows.filter((r) => r.action === "update").length;

  async function handleImport() {
    setImporting(true);
    const payload = selectedRows.map((r) => ({
      action: r.action,
      existingId: r.existingId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      tel: r.tel,
      companyId: r.companyId,
    }));

    try {
      const res = await fetch("/api/visioformation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const data = await res.json();
      setResult(data);
      setStage(3);
    } catch {
      setResult({ created: 0, updated: 0, errors: ["Erreur réseau"] });
      setStage(3);
    }
    setImporting(false);
  }

  const matchColors = {
    exact: { bg: "#e8f5e9", text: "#2e7d32" },
    partial: { bg: "#fff3e0", text: "#e65100" },
    domain: { bg: "#e3f2fd", text: "#1565c0" },
    none: { bg: "#f5f5f5", text: "#999" },
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
        background: "white", borderRadius: 16, width: "95%", maxWidth: 1100,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid #e8ecf1",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Upload style={{ width: 20, height: 20, color: "#1E2A5A" }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", margin: 0 }}>
              Importer depuis Visioformation
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
                Téléchargez le fichier Excel depuis Visioformation
              </h3>
              <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
                Sur Visioformation, cliquez sur &quot;Télécharger toutes les données apprenant&quot; puis importez le fichier ici.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  height: 44, borderRadius: 10, padding: "0 24px",
                  background: "linear-gradient(135deg, #1E2A5A 0%, #161f45 100%)",
                  color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(26,107,156,0.3)",
                }}
              >
                Choisir un fichier Excel
              </button>
            </div>
          )}

          {/* Stage 2: Preview */}
          {stage === 2 && (
            <>
              {/* Summary */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e8f5e9", fontSize: 13, fontWeight: 600, color: "#2e7d32" }}>
                  {toCreate} à créer
                </div>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e3f2fd", fontSize: 13, fontWeight: 600, color: "#1565c0" }}>
                  {toUpdate} à mettre à jour
                </div>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#f5f5f5", fontSize: 13, fontWeight: 600, color: "#666" }}>
                  {rows.length - selected.size} ignorés
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #dce8f0", position: "sticky", top: 0, background: "white" }}>
                      <th style={{ padding: "8px 4px", textAlign: "center", width: 30 }}>
                        <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} />
                      </th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1E2A5A" }}>Action</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1E2A5A" }}>Nom</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1E2A5A" }}>Email</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1E2A5A" }}>Téléphone</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1E2A5A", minWidth: 200 }}>
                        <Building2 style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle" }} /> Entreprise
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const mc = matchColors[row.companyMatchType];
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            opacity: selected.has(idx) ? 1 : 0.4,
                          }}
                        >
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleRow(idx)} />
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                              background: row.action === "create" ? "#e8f5e9" : "#e3f2fd",
                              color: row.action === "create" ? "#2e7d32" : "#1565c0",
                            }}>
                              {row.action === "create" ? "Créer" : "Màj"}
                            </span>
                          </td>
                          <td style={{ padding: "6px 4px", fontWeight: 600, color: "#1a2a3a" }}>
                            {row.firstName} {row.lastName}
                          </td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80" }}>{row.email}</td>
                          <td style={{ padding: "6px 4px", color: "#5a6f80" }}>{row.tel || "—"}</td>
                          <td style={{ padding: "6px 4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <select
                                value={row.companyId || ""}
                                onChange={(e) => updateCompany(idx, e.target.value)}
                                style={{
                                  flex: 1, height: 28, borderRadius: 6, fontSize: 11,
                                  border: `1.5px solid ${mc.text}20`,
                                  background: mc.bg, color: mc.text,
                                  padding: "0 6px",
                                }}
                              >
                                <option value="">— Aucune —</option>
                                {companies.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              {row.companyMatchType !== "none" && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                                  background: mc.bg, color: mc.text, whiteSpace: "nowrap",
                                }}>
                                  {row.companyMatchType === "exact" ? "Exact" : row.companyMatchType === "partial" ? "Partiel" : "Domaine"}
                                </span>
                              )}
                            </div>
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
                Import terminé
              </h3>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e8f5e9", fontSize: 14, fontWeight: 600, color: "#2e7d32" }}>
                  {result.created} créés
                </div>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e3f2fd", fontSize: 14, fontWeight: 600, color: "#1565c0" }}>
                  {result.updated} mis à jour
                </div>
                {result.errors.length > 0 && (
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: "#fde8e8", fontSize: 14, fontWeight: 600, color: "#c62828" }}>
                    {result.errors.length} erreurs
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
                disabled={importing || selected.size === 0}
                style={{
                  height: 40, borderRadius: 8, padding: "0 24px", border: "none",
                  background: importing ? "#8399a9" : "linear-gradient(135deg, #1E2A5A 0%, #161f45 100%)",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: importing ? "default" : "pointer",
                  boxShadow: importing ? "none" : "0 4px 15px rgba(26,107,156,0.3)",
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
                background: "#1E2A5A", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
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
