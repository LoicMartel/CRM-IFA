"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertTriangle, X, FileText, Merge } from "lucide-react";

interface ServicePlanRef {
  id: string;
  company_id: string;
  companies: { name: string; address?: string; city?: string } | null;
}

interface LearnerRef {
  id: string;
  first_name: string;
  last_name: string;
}

interface TeamMemberRef {
  first_name: string;
  last_name: string;
  zoom_link: string | null;
}

interface ParsedCreneau {
  numero: number;
  date: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  titre: string;
  type: "journee" | "vt";
  jourLabel: string;
}

interface SessionRow {
  id: number;
  date: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  type: "journee" | "vt";
  jourLabel: string;
  titre: string;
  servicePlanId: string | null;
  sessionLocation: string;
  trainers: string[];
  learnerIds: string[];
  selected: boolean;
}

export function PDFSessionsImportModal({
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
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [pdfApprenants, setPdfApprenants] = useState<string[]>([]);
  const [pdfFormateurs, setPdfFormateurs] = useState<string[]>([]);
  const [mergeByDay, setMergeByDay] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!open) return null;

  function normalizeName(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function splitName(nom: string): { firstName: string; lastName: string } {
    const parts = nom.trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
    const firstIsUpper = parts[0] === parts[0].toUpperCase() && parts[0].length > 1;
    const lastIsUpper = parts[parts.length - 1] === parts[parts.length - 1].toUpperCase() && parts[parts.length - 1].length > 1;
    if (firstIsUpper && !lastIsUpper) {
      let splitIdx = 1;
      for (let i = 1; i < parts.length; i++) {
        if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) splitIdx = i + 1;
        else break;
      }
      return { firstName: parts.slice(splitIdx).join(" "), lastName: parts.slice(0, splitIdx).join(" ") };
    }
    if (lastIsUpper) {
      let splitIdx = parts.length - 1;
      for (let i = parts.length - 1; i >= 1; i--) {
        if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) splitIdx = i;
        else break;
      }
      return { firstName: parts.slice(0, splitIdx).join(" "), lastName: parts.slice(splitIdx).join(" ") };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }

  function matchLearnerIds(apprenantNames: string[]): string[] {
    const ids: string[] = [];
    for (const rawName of apprenantNames) {
      const { firstName, lastName } = splitName(rawName);
      const fnN = normalizeName(firstName);
      const lnN = normalizeName(lastName);
      const match = learners.find((l) => {
        const lFn = normalizeName(l.first_name);
        const lLn = normalizeName(l.last_name);
        return (lFn === fnN && lLn === lnN) || (lFn === lnN && lLn === fnN);
      });
      if (match && !ids.includes(match.id)) ids.push(match.id);
    }
    return ids;
  }

  function resolveLocation(type: "journee" | "vt", planId: string | null, trainerFirstNames: string[]): string {
    if (type === "journee") {
      const plan = planId ? servicePlans.find((sp) => sp.id === planId) : null;
      if (plan?.companies) {
        return [plan.companies.address, plan.companies.city].filter(Boolean).join(", ");
      }
      return "";
    }
    // VT → zoom link
    if (trainerFirstNames.length > 0) {
      const member = teamMembers.find((m) => m.first_name.toLowerCase() === trainerFirstNames[0].toLowerCase());
      if (member?.zoom_link) return member.zoom_link;
    }
    return "";
  }

  function extractTrainerFirstNames(formateurs: string[]): string[] {
    return formateurs.map((f) => splitName(f).firstName || f);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    const arrayBuffer = await file.arrayBuffer();

    try {
      const res = await fetch("/api/visioformation/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: arrayBuffer,
      });
      const data = await res.json();

      if (data.error) {
        setParseError(data.error);
        return;
      }

      setPdfApprenants(data.apprenants);
      setPdfFormateurs(data.formateurs);

      const trainerFirstNames = extractTrainerFirstNames(data.formateurs);
      const matchedLearnerIds = matchLearnerIds(data.apprenants);

      const sessionRows: SessionRow[] = data.creneaux.map((c: ParsedCreneau, idx: number) => ({
        id: idx,
        date: c.date,
        heureDebut: c.heureDebut,
        heureFin: c.heureFin,
        dureeHeures: c.dureeHeures,
        type: c.type,
        jourLabel: c.jourLabel,
        titre: c.titre,
        servicePlanId: null,
        sessionLocation: resolveLocation(c.type, null, trainerFirstNames),
        trainers: trainerFirstNames,
        learnerIds: matchedLearnerIds,
        selected: true,
      }));

      setRows(sessionRows);
      setStage(2);
    } catch {
      setParseError("Erreur lors du parsing du PDF");
    }
  }

  function updateRow(idx: number, updates: Partial<SessionRow>) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      // Recalculate location if plan changed
      if (updates.servicePlanId !== undefined || updates.type !== undefined) {
        const row = next[idx];
        next[idx].sessionLocation = resolveLocation(row.type, row.servicePlanId, row.trainers);
      }
      return next;
    });
  }

  function applyPlanToAll(planId: string) {
    setRows((prev) => prev.map((r) => ({
      ...r,
      servicePlanId: planId,
      sessionLocation: resolveLocation(r.type, planId, r.trainers),
    })));
  }

  // Get displayable rows (merged or not)
  function getDisplayRows(): SessionRow[] {
    if (!mergeByDay) return rows;

    const byDay = new Map<string, SessionRow[]>();
    rows.forEach((r) => {
      if (!byDay.has(r.date)) byDay.set(r.date, []);
      byDay.get(r.date)!.push(r);
    });

    const merged: SessionRow[] = [];
    byDay.forEach((dayRows) => {
      const sorted = [...dayRows].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
      merged.push({
        ...sorted[0],
        heureFin: sorted[sorted.length - 1].heureFin,
        dureeHeures: sorted.reduce((s, r) => s + r.dureeHeures, 0),
      });
    });
    return merged;
  }

  const displayRows = getDisplayRows();
  const selectedRows = displayRows.filter((r) => r.selected);
  const hasNoPlan = selectedRows.some((r) => !r.servicePlanId);

  async function handleImport() {
    setImporting(true);
    const payload = selectedRows.map((r) => ({
      servicePlanId: r.servicePlanId!,
      sessionType: r.type,
      sessionDate: r.date,
      sessionTime: r.heureDebut,
      durationHours: r.dureeHeures,
      status: "planned",
      trainers: r.trainers,
      notes: "",
      learnerIds: r.learnerIds,
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
      setResult({ created: 0, errors: ["Erreur réseau"] });
      setStage(3);
    }
    setImporting(false);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 16, width: "95%", maxWidth: 1100, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText style={{ width: 20, height: 20, color: "#1a6b9c" }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", margin: 0 }}>Importer des sessions depuis un PDF Visioformation</h2>
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
              <FileText style={{ width: 48, height: 48, color: "#dce8f0", margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1a2a3a", marginBottom: 8 }}>Téléchargez le bilan quotidien (PDF)</h3>
              <p style={{ fontSize: 13, color: "#8399a9", maxWidth: 500, margin: "0 auto 24px" }}>
                Sur Visioformation, ouvrez une formation &gt; Parcours &gt; &quot;Télécharger/Voir bilan quotidien&quot;, puis importez le PDF ici.
              </p>
              {parseError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fde8e8", borderLeft: "4px solid #e74c3c", color: "#c62828", fontSize: 13, marginBottom: 16, maxWidth: 500, margin: "0 auto 16px" }}>
                  {parseError}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{ height: 44, borderRadius: 10, padding: "0 24px", background: "linear-gradient(135deg, #1a6b9c 0%, #0d4f7a 100%)", color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 15px rgba(26,107,156,0.3)" }}>
                Choisir un fichier PDF
              </button>
            </div>
          )}

          {/* Stage 2: Preview */}
          {stage === 2 && (
            <>
              {/* Info bar */}
              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ padding: "6px 12px", borderRadius: 8, background: "#e8f0fe", fontSize: 12, color: "#0d4f7a" }}>
                  {pdfFormateurs.join(", ")}
                </div>
                <div style={{ padding: "6px 12px", borderRadius: 8, background: "#e8f5e9", fontSize: 12, color: "#2e7d32" }}>
                  {pdfApprenants.length} apprenants
                </div>
                <div style={{ padding: "6px 12px", borderRadius: 8, background: "#fff3e0", fontSize: 12, color: "#e65100" }}>
                  {displayRows.length} session(s)
                </div>
              </div>

              {/* Plan de formation selector (applies to all) */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, padding: "12px 16px", background: "#f8fbfd", borderRadius: 10, border: "1px solid #e8ecf1" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a", whiteSpace: "nowrap" }}>Plan de formation :</span>
                <select
                  value={displayRows[0]?.servicePlanId || ""}
                  onChange={(e) => applyPlanToAll(e.target.value)}
                  style={{ flex: 1, height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }}
                >
                  <option value="">-- Sélectionner un plan --</option>
                  {servicePlans.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.companies?.name ?? "Sans entreprise"}</option>
                  ))}
                </select>
              </div>

              {hasNoPlan && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "#fde8e8", borderLeft: "4px solid #e74c3c", marginBottom: 12 }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#e74c3c", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#c62828" }}>Veuillez sélectionner un plan de formation avant d&apos;importer.</span>
                </div>
              )}

              {/* Merge option */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", fontSize: 13, color: "#5a6f80" }}>
                <input type="checkbox" checked={mergeByDay} onChange={(e) => setMergeByDay(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#1a6b9c" }} />
                <Merge style={{ width: 14, height: 14 }} />
                Regrouper matin + après-midi en 1 session par jour
              </label>

              {/* Sessions table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #dce8f0", background: "white" }}>
                      <th style={{ padding: "8px 4px", width: 30 }}></th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Date</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Début</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Fin</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Durée</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Type</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Jour</th>
                      <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Lieu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0", opacity: row.selected ? 1 : 0.4 }}>
                        <td style={{ padding: "6px 4px", textAlign: "center" }}>
                          <input type="checkbox" checked={row.selected} onChange={() => updateRow(row.id, { selected: !row.selected })} />
                        </td>
                        <td style={{ padding: "6px 4px", fontWeight: 600, color: "#1a2a3a" }}>{row.date}</td>
                        <td style={{ padding: "6px 4px" }}>
                          <input type="time" value={row.heureDebut} onChange={(e) => updateRow(row.id, { heureDebut: e.target.value })}
                            style={{ height: 28, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 6px", fontSize: 12, width: 80 }} />
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <input type="time" value={row.heureFin} onChange={(e) => updateRow(row.id, { heureFin: e.target.value })}
                            style={{ height: 28, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 6px", fontSize: 12, width: 80 }} />
                        </td>
                        <td style={{ padding: "6px 4px" }}>{row.dureeHeures}h</td>
                        <td style={{ padding: "6px 4px" }}>
                          <select value={row.type} onChange={(e) => updateRow(row.id, { type: e.target.value as "journee" | "vt" })}
                            style={{ height: 28, borderRadius: 6, border: "1px solid #dce8f0", fontSize: 11, padding: "0 4px" }}>
                            <option value="journee">Journée</option>
                            <option value="vt">VT</option>
                          </select>
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                            background: row.type === "journee" ? "#e8f5e9" : "#e3f2fd",
                            color: row.type === "journee" ? "#2e7d32" : "#1565c0",
                          }}>
                            {row.jourLabel || row.type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "6px 4px", fontSize: 11, color: "#5a6f80", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.sessionLocation || "—"}
                        </td>
                      </tr>
                    ))}
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
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Import terminé</h3>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#e8f5e9", fontSize: 14, fontWeight: 600, color: "#2e7d32" }}>
                  {result.created} session(s) créée(s)
                </div>
                {result.errors.length > 0 && (
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: "#fde8e8", fontSize: 14, fontWeight: 600, color: "#c62828" }}>
                    {result.errors.length} erreur(s)
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
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e8ecf1", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {stage === 2 && (
            <>
              <button onClick={() => { setStage(1); setRows([]); }} style={{ height: 40, borderRadius: 8, padding: "0 20px", border: "1px solid #dce8f0", background: "white", color: "#5a6f80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Retour
              </button>
              <button
                onClick={handleImport}
                disabled={importing || hasNoPlan || selectedRows.length === 0}
                style={{
                  height: 40, borderRadius: 8, padding: "0 24px", border: "none",
                  background: (importing || hasNoPlan || selectedRows.length === 0) ? "#8399a9" : "linear-gradient(135deg, #1a6b9c 0%, #0d4f7a 100%)",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: (importing || hasNoPlan) ? "default" : "pointer",
                  boxShadow: (importing || hasNoPlan) ? "none" : "0 4px 15px rgba(26,107,156,0.3)",
                }}
              >
                {importing ? "Import en cours..." : `Confirmer l'import (${selectedRows.length} session(s))`}
              </button>
            </>
          )}
          {stage === 3 && (
            <button onClick={() => { onClose(); router.refresh(); }} style={{ height: 40, borderRadius: 8, padding: "0 24px", border: "none", background: "#1a6b9c", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
