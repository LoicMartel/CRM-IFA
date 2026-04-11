"use client";

import { useState, useEffect } from "react";
import { X, Calculator, Save, FileDown, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { computeCotation, CotationResults, MONTH_KEYS, MONTH_LABELS, emptyMonths } from "@/lib/cotation-engine";

interface Deal {
  id: string;
  name: string;
  amount: number | null;
  companies: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface EditQuotation {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  nb_learners: number;
  nb_rise_up: number;
  deal_id: string | null;
  months: Record<string, { presentiel: number; vt: number }>;
  tjm_lca: number;
  base_coeff: number;
  travel_coeff: number;
  prep_coeff: number;
  cost_per_day_presentiel: number;
  rise_up_cost_per_license: number;
  vt_duration_hours: number;
  presentiel_hours_per_day: number;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  deals: Deal[];
  companies: Company[];
  editQuotation?: EditQuotation | null;
  onSaved?: () => void;
}

const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
const fmtN = (n: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n);

export function CotationModal({ open, onClose, deals, companies, editQuotation, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState(() => initForm(editQuotation));

  // Reset form when editQuotation changes
  useEffect(() => {
    if (open) setForm(initForm(editQuotation));
  }, [open, editQuotation]);

  function initForm(eq?: EditQuotation | null) {
    return {
      companyName: eq?.company_name ?? "",
      contactName: eq?.contact_name ?? "",
      nbLearners: eq?.nb_learners ?? 1,
      nbRiseUp: eq?.nb_rise_up ?? 0,
      dealId: eq?.deal_id ?? "",
      months: eq?.months ? { ...emptyMonths(), ...eq.months } : emptyMonths(),
      tjmLca: eq?.tjm_lca ?? 2200,
      baseCoeff: eq?.base_coeff ?? 1.00,
      travelCoeff: eq?.travel_coeff ?? 0.25,
      prepCoeff: eq?.prep_coeff ?? 0.25,
      costPerDayPresentiel: eq?.cost_per_day_presentiel ?? 350,
      riseUpCostPerLicense: eq?.rise_up_cost_per_license ?? 690,
      vtDurationHours: eq?.vt_duration_hours ?? 1,
      presentielHoursPerDay: eq?.presentiel_hours_per_day ?? 8,
      costFournituresPerLearner: 50,
      notes: eq?.notes ?? "",
    };
  }

  // Real-time calculation
  const results: CotationResults = computeCotation({
    nbLearners: form.nbLearners,
    months: form.months,
    nbRiseUp: form.nbRiseUp,
    tjmLca: form.tjmLca,
    baseCoeff: form.baseCoeff,
    travelCoeff: form.travelCoeff,
    prepCoeff: form.prepCoeff,
    costPerDayPresentiel: form.costPerDayPresentiel,
    riseUpCostPerLicense: form.riseUpCostPerLicense,
    vtDurationHours: form.vtDurationHours,
    presentielHoursPerDay: form.presentielHoursPerDay,
    costFournituresPerLearner: form.costFournituresPerLearner,
  });

  function setMonth(key: string, field: "presentiel" | "vt", value: number) {
    setForm(f => ({
      ...f,
      months: { ...f.months, [key]: { ...f.months[key], [field]: Math.max(0, value) } },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        id: editQuotation?.id,
        company_name: form.companyName,
        contact_name: form.contactName,
        nb_learners: form.nbLearners,
        nb_rise_up: form.nbRiseUp,
        deal_id: form.dealId || null,
        months: form.months,
        tjm_lca: form.tjmLca,
        base_coeff: form.baseCoeff,
        travel_coeff: form.travelCoeff,
        prep_coeff: form.prepCoeff,
        cost_per_day_presentiel: form.costPerDayPresentiel,
        rise_up_cost_per_license: form.riseUpCostPerLicense,
        vt_duration_hours: form.vtDurationHours,
        presentiel_hours_per_day: form.presentielHoursPerDay,
        total_ht: results.totalHt,
        total_presentiel_days: results.totalPresentielDays,
        total_vt_sessions: results.totalVtSessions,
        total_hours_formation: results.formationHours,
        total_hours_intervention: results.interventionHours,
        total_hours_mobilisation: results.mobilisationHours,
        notes: form.notes,
      };
      const res = await fetch("/api/cotation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSaved?.();
        onClose();
      }
    } catch { /* error */ } finally {
      setSaving(false);
    }
  }

  function handleExportPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(generatePrintHtml(form, results));
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  if (!open) return null;

  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm";
  const totalPerMonth = (key: string) => (form.months[key]?.presentiel || 0) + (form.months[key]?.vt || 0);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 14, width: "100%", maxWidth: 1100,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Calculator style={{ width: 18, height: 18, color: "#1a6b9c" }} />
            {editQuotation ? "Modifier la cotation" : "Nouvelle cotation"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }} className="space-y-6">

          {/* ═══ Zone A: Client Info ═══ */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
              Informations client
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px", gap: 12, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Entreprise</label>
                <input
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  list="cotation-companies"
                  className={inputCls}
                  placeholder="Nom de l'entreprise"
                />
                <datalist id="cotation-companies">
                  {companies.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Contact</label>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className={inputCls}
                  placeholder="Nom du contact"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Apprenants</label>
                <input
                  type="number" min={1}
                  value={form.nbLearners}
                  onChange={(e) => setForm({ ...form, nbLearners: Math.max(1, parseInt(e.target.value) || 1) })}
                  className={inputCls}
                  style={{ textAlign: "center", fontWeight: 700, fontSize: 15 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Rise Up</label>
                <input
                  type="number" min={0}
                  value={form.nbRiseUp}
                  onChange={(e) => setForm({ ...form, nbRiseUp: Math.max(0, parseInt(e.target.value) || 0) })}
                  className={inputCls}
                  style={{ textAlign: "center", fontWeight: 700, fontSize: 15 }}
                />
              </div>
            </div>
          </div>

          {/* ═══ Zone B: Monthly Grid ═══ */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
              Grille mensuelle
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#5a6f80", fontSize: 11, width: 100 }}></th>
                    {MONTH_KEYS.map(k => (
                      <th key={k} style={{
                        padding: "8px 4px", textAlign: "center", fontWeight: 700, fontSize: 11,
                        color: totalPerMonth(k) > 0 ? "#1a6b9c" : "#8399a9",
                      }}>
                        {MONTH_LABELS[k]}
                      </th>
                    ))}
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, fontSize: 11, color: "#1a2a3a", borderLeft: "2px solid #dce8f0" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Presentiel row */}
                  <tr>
                    <td style={{ padding: "6px 10px", fontWeight: 700, fontSize: 12, color: "#1a6b9c" }}>
                      Présentiel
                    </td>
                    {MONTH_KEYS.map(k => (
                      <td key={k} style={{ padding: "4px 2px", textAlign: "center" }}>
                        <input
                          type="number" min={0} max={20}
                          value={form.months[k]?.presentiel || ""}
                          onChange={(e) => setMonth(k, "presentiel", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          style={{
                            width: 48, height: 36, borderRadius: 8, border: "1px solid #dce8f0",
                            textAlign: "center", fontSize: 14, fontWeight: 700,
                            background: (form.months[k]?.presentiel || 0) > 0 ? "#e8f0fe" : "white",
                            color: (form.months[k]?.presentiel || 0) > 0 ? "#1a6b9c" : "#8399a9",
                            outline: "none",
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 800, fontSize: 14, color: "#1a6b9c", borderLeft: "2px solid #dce8f0" }}>
                      {results.totalPresentielDays}
                    </td>
                  </tr>
                  {/* VT row */}
                  <tr>
                    <td style={{ padding: "6px 10px", fontWeight: 700, fontSize: 12, color: "#27ae60" }}>
                      Visio Training
                    </td>
                    {MONTH_KEYS.map(k => (
                      <td key={k} style={{ padding: "4px 2px", textAlign: "center" }}>
                        <input
                          type="number" min={0} max={20}
                          value={form.months[k]?.vt || ""}
                          onChange={(e) => setMonth(k, "vt", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          style={{
                            width: 48, height: 36, borderRadius: 8, border: "1px solid #dce8f0",
                            textAlign: "center", fontSize: 14, fontWeight: 700,
                            background: (form.months[k]?.vt || 0) > 0 ? "#e8f5e9" : "white",
                            color: (form.months[k]?.vt || 0) > 0 ? "#27ae60" : "#8399a9",
                            outline: "none",
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 800, fontSize: 14, color: "#27ae60", borderLeft: "2px solid #dce8f0" }}>
                      {results.totalVtSessions}
                    </td>
                  </tr>
                  {/* Total row */}
                  <tr style={{ borderTop: "2px solid #e8ecf1" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700, fontSize: 11, color: "#8399a9", textTransform: "uppercase" }}>Total</td>
                    {MONTH_KEYS.map(k => {
                      const t = totalPerMonth(k);
                      return (
                        <td key={k} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, fontSize: 12, color: t > 0 ? "#1a2a3a" : "#dce8f0" }}>
                          {t || "—"}
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, fontSize: 14, color: "#1a2a3a", borderLeft: "2px solid #dce8f0" }}>
                      {results.totalPresentielDays + results.totalVtSessions}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Zone C: Results ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Hours */}
            <div style={{ padding: 20, borderRadius: 12, background: "#f8fbfd", border: "1px solid #e8ecf1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", marginBottom: 14 }}>
                Volume d&apos;heures
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ResultRow label="Heures présentiel" value={`${fmtN(results.presentielHours, 0)}h`} />
                <ResultRow label="Heures VT" value={`${fmtN(results.vtHours, 0)}h`} />
                <ResultRow label="Heures formation" value={`${fmtN(results.formationHours, 0)}h`} bold />
                <div style={{ borderTop: "1px solid #e8ecf1", margin: "4px 0" }} />
                <ResultRow label="Heures préparation" value={`${fmtN(results.prepHours, 1)}h`} />
                <ResultRow label="Heures déplacement" value={`${fmtN(results.travelHours, 1)}h`} />
                <ResultRow label="Heures intervention" value={`${fmtN(results.interventionHours, 1)}h`} />
                <ResultRow label="Heures mobilisation" value={`${fmtN(results.mobilisationHours, 1)}h`} bold />
              </div>
            </div>

            {/* Financial */}
            <div style={{ padding: 20, borderRadius: 12, background: "#f8fbfd", border: "1px solid #e8ecf1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", marginBottom: 14 }}>
                Synthèse financière
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ResultRow label="Présentiel LCA" value={fmtE(results.costPresentielLca)} />
                <ResultRow label="VT LCA" value={fmtE(results.costVtLca)} />
                <ResultRow label="Préparation" value={fmtE(results.costPrep)} />
                <ResultRow label="Déplacement" value={fmtE(results.costTravel)} />
                <ResultRow label={`Frais présentiel (${results.totalPresentielDays}j × ${fmtE(form.costPerDayPresentiel)}/j)`} value={fmtE(results.costPresentielClient)} />
                {results.costFournitures > 0 && (
                  <ResultRow label={`Fournitures (${form.nbLearners} × ${fmtE(form.costFournituresPerLearner)})`} value={fmtE(results.costFournitures)} />
                )}
                {form.nbRiseUp > 0 && (
                  <ResultRow label={`Rise Up (${form.nbRiseUp} × ${fmtE(form.riseUpCostPerLicense)})`} value={fmtE(results.costRiseUp)} />
                )}
                <div style={{ borderTop: "2px solid #1a6b9c", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#1a2a3a" }}>Total HT</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{fmtE(results.totalHt)}</span>
                </div>
                <div style={{ borderTop: "1px solid #e8ecf1", margin: "4px 0" }} />
                <ResultRow label="Taux horaire formation" value={fmtE(results.hourlyRateFormation)} />
                <ResultRow label="Taux horaire / apprenant" value={fmtE(results.hourlyRatePerLearner)} />
                <div style={{ borderTop: "1px solid #e8ecf1", margin: "4px 0" }} />
                <ResultRow label="Taux mobilisation LCA hors THR" value={fmtE(results.hourlyRateMobilisationLca)} bold />
                <ResultRow label="Taux mobilisation LCA / apprenant" value={fmtE(results.hourlyRateMobilisationLcaPerLearner)} />
              </div>
            </div>
          </div>

          {/* ═══ Zone D: Advanced Params ═══ */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "none",
                border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5a6f80",
                padding: "4px 0",
              }}
            >
              {showAdvanced ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
              Paramètres avancés
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 12, padding: 16, borderRadius: 10, background: "#f8fbfd", border: "1px solid #e8ecf1" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <AdvancedField label="TJM LCA (€)" value={form.tjmLca} onChange={v => setForm({ ...form, tjmLca: v })} />
                  <AdvancedField label="Coeff. base" value={form.baseCoeff} onChange={v => setForm({ ...form, baseCoeff: v })} step={0.05} />
                  <AdvancedField label="Coeff. déplacement" value={form.travelCoeff} onChange={v => setForm({ ...form, travelCoeff: v })} step={0.05} />
                  <AdvancedField label="Coeff. préparation" value={form.prepCoeff} onChange={v => setForm({ ...form, prepCoeff: v })} step={0.05} />
                  <AdvancedField label="Coût/jour présentiel (€)" value={form.costPerDayPresentiel} onChange={v => setForm({ ...form, costPerDayPresentiel: v })} />
                  <AdvancedField label="Coût Rise Up/licence (€)" value={form.riseUpCostPerLicense} onChange={v => setForm({ ...form, riseUpCostPerLicense: v })} />
                  <AdvancedField label="Fournitures/apprenant (€)" value={form.costFournituresPerLearner} onChange={v => setForm({ ...form, costFournituresPerLearner: v })} />
                  <AdvancedField label="Durée VT (heures)" value={form.vtDurationHours} onChange={v => setForm({ ...form, vtDurationHours: v })} step={0.5} />
                  <AdvancedField label="Heures/jour présentiel" value={form.presentielHoursPerDay} onChange={v => setForm({ ...form, presentielHoursPerDay: v })} />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
              style={{ minHeight: 48, resize: "vertical" }}
              placeholder="Notes internes sur cette cotation..."
            />
          </div>
        </div>

        {/* ═══ Zone E: Actions ═══ */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #e8ecf1",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          background: "#f8fbfd",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>Total :</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#27ae60" }}>{fmtE(results.totalHt)}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ height: 40, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 20px", border: "none", cursor: "pointer" }}>
              Annuler
            </button>
            <button
              onClick={handleExportPdf}
              disabled={results.totalHt === 0}
              style={{
                height: 40, borderRadius: 8, border: "1px solid #1a6b9c", background: "white",
                color: "#1a6b9c", fontSize: 13, fontWeight: 600, padding: "0 18px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                opacity: results.totalHt === 0 ? 0.4 : 1,
              }}
            >
              <FileDown style={{ width: 14, height: 14 }} /> Exporter PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving || results.totalHt === 0}
              style={{
                height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                opacity: (saving || results.totalHt === 0) ? 0.5 : 1,
              }}
            >
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ResultRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#5a6f80" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? "#1a2a3a" : "#1a2a3a" }}>{value}</span>
    </div>
  );
}

function AdvancedField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 600, color: "#8399a9", display: "block", marginBottom: 3 }}>{label}</label>
      <input
        type="number" step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-sm"
        style={{ textAlign: "center" }}
      />
    </div>
  );
}

/* ── PDF Export ── */

function generatePrintHtml(
  form: { companyName: string; contactName: string; nbLearners: number; nbRiseUp: number; months: Record<string, { presentiel: number; vt: number }>; notes: string },
  results: CotationResults,
): string {
  const fE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  const fN = (n: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n);
  const labels: Record<string, string> = { janv: "Janv", fevr: "Févr", mars: "Mars", avr: "Avr", mai: "Mai", juin: "Juin", juil: "Juil", aout: "Août", sept: "Sept", oct: "Oct", nov: "Nov", dec: "Déc" };
  const keys = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];

  const monthCells = keys.map(k => {
    const p = form.months[k]?.presentiel || 0;
    const v = form.months[k]?.vt || 0;
    return `<td style="text-align:center;padding:6px 4px;border:1px solid #ddd;">
      ${p > 0 ? `<div style="color:#1a6b9c;font-weight:700;">${p}P</div>` : ""}
      ${v > 0 ? `<div style="color:#27ae60;font-weight:700;">${v}V</div>` : ""}
      ${p === 0 && v === 0 ? '<div style="color:#ccc;">—</div>' : ""}
    </td>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotation — ${form.companyName || "Client"}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a2a3a; padding: 30px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; color: #1a6b9c; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #1a6b9c; text-transform: uppercase; letter-spacing: 0.1em; margin: 24px 0 10px; border-bottom: 2px solid #1a6b9c; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f0f6fa; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #1a6b9c; border: 1px solid #ddd; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-item { background: #f8fbfd; padding: 10px 14px; border-radius: 8px; }
  .info-label { font-size: 10px; text-transform: uppercase; color: #8399a9; font-weight: 700; }
  .info-value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .result-box { background: #f8fbfd; padding: 16px; border-radius: 8px; border: 1px solid #e8ecf1; }
  .result-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .result-row.bold { font-weight: 800; font-size: 13px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 18px; font-weight: 800; border-top: 2px solid #1a6b9c; margin-top: 8px; }
  .total-value { color: #27ae60; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
  <div style="width:50px;height:50px;border:2px solid #0a3d5f;border-radius:8px;display:flex;align-items:center;justify-content:center;">
    <span style="font-size:8px;font-weight:700;text-align:center;line-height:1.2;color:#0a3d5f;">LA<br>CLOSING<br>ACADÉMIE®</span>
  </div>
  <div>
    <h1>Cotation — ${form.companyName || "Client"}</h1>
    <div style="color:#8399a9;font-size:12px;">${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${form.contactName ? ` • Contact : ${form.contactName}` : ""}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-item"><div class="info-label">Apprenants</div><div class="info-value">${form.nbLearners}</div></div>
  <div class="info-item"><div class="info-label">Jours présentiel</div><div class="info-value">${results.totalPresentielDays}</div></div>
  <div class="info-item"><div class="info-label">Sessions VT</div><div class="info-value">${results.totalVtSessions}</div></div>
  <div class="info-item"><div class="info-label">Licences Rise Up</div><div class="info-value">${form.nbRiseUp}</div></div>
</div>

<h2>Planning mensuel</h2>
<table>
  <thead><tr><th></th>${keys.map(k => `<th>${labels[k]}</th>`).join("")}<th>Total</th></tr></thead>
  <tbody>
    <tr><td style="padding:6px 8px;font-weight:700;color:#1a6b9c;border:1px solid #ddd;">Présentiel</td>${monthCells}<td style="text-align:center;font-weight:800;border:1px solid #ddd;">${results.totalPresentielDays + results.totalVtSessions}</td></tr>
  </tbody>
</table>

<h2>Synthèse</h2>
<div class="results-grid">
  <div class="result-box">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1a6b9c;margin-bottom:10px;">Volume d'heures</div>
    <div class="result-row"><span>Heures formation</span><span style="font-weight:700;">${fN(results.formationHours, 0)}h</span></div>
    <div class="result-row"><span>Heures préparation</span><span>${fN(results.prepHours, 1)}h</span></div>
    <div class="result-row"><span>Heures déplacement</span><span>${fN(results.travelHours, 1)}h</span></div>
    <div class="result-row"><span>Heures intervention</span><span>${fN(results.interventionHours, 1)}h</span></div>
    <div class="result-row bold"><span>Heures mobilisation</span><span>${fN(results.mobilisationHours, 1)}h</span></div>
  </div>
  <div class="result-box">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1a6b9c;margin-bottom:10px;">Détail financier</div>
    <div class="result-row"><span>Présentiel LCA</span><span>${fE(results.costPresentielLca)}</span></div>
    <div class="result-row"><span>VT LCA</span><span>${fE(results.costVtLca)}</span></div>
    <div class="result-row"><span>Préparation</span><span>${fE(results.costPrep)}</span></div>
    <div class="result-row"><span>Déplacement</span><span>${fE(results.costTravel)}</span></div>
    <div class="result-row"><span>Frais présentiel</span><span>${fE(results.costPresentielClient)}</span></div>
    ${results.costFournitures > 0 ? `<div class="result-row"><span>Fournitures</span><span>${fE(results.costFournitures)}</span></div>` : ""}
    ${form.nbRiseUp > 0 ? `<div class="result-row"><span>Rise Up</span><span>${fE(results.costRiseUp)}</span></div>` : ""}
    <div class="total-row"><span>Total HT</span><span class="total-value">${fE(results.totalHt)}</span></div>
    <div class="result-row bold"><span>Taux mobilisation LCA hors THR</span><span>${fE(results.hourlyRateMobilisationLca)}</span></div>
    <div class="result-row"><span>Taux mobilisation LCA / apprenant</span><span>${fE(results.hourlyRateMobilisationLcaPerLearner)}</span></div>
  </div>
</div>

${form.notes ? `<h2>Notes</h2><p style="color:#5a6f80;">${form.notes}</p>` : ""}

<div style="margin-top:30px;padding-top:16px;border-top:1px solid #e8ecf1;text-align:center;font-size:10px;color:#8399a9;">
  La Closing Académie® — Document généré le ${new Date().toLocaleDateString("fr-FR")}
</div>
</body></html>`;
}
