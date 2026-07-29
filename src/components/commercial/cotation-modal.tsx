"use client";

import { useState, useEffect, useRef } from "react";
import { X, Calculator, Save, FileDown, Mail, ChevronDown, ChevronUp, Loader2, Plus, Trash2, FileText } from "lucide-react";
import { computeCotation, CotationRow, CotationResults, MONTH_KEYS, MONTH_LABELS, createRow, rowTotal } from "@/lib/cotation-engine";
import { useCurrentMember } from "@/lib/use-current-member";
import { QuoteSendModal } from "@/components/commercial/quote-send-modal";

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

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company_id: string | null;
}

interface EditQuotation {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  nb_learners: number;
  nb_rise_up: number;
  deal_id: string | null;
  months: any; // supports both old format and new rows format
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
  contacts: Contact[];
  editQuotation?: EditQuotation | null;
  onSaved?: () => void;
}

const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
const fmtN = (n: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n);

/** Parse a value that might use comma as decimal separator */
function parseDecimal(val: string): number {
  return parseFloat(val.replace(",", ".")) || 0;
}

function loadRows(data: any): CotationRow[] {
  // New format: { rows: [...] }
  if (data?.rows && Array.isArray(data.rows)) return data.rows;
  // Old format: { janv: { presentiel, vt }, ... } — convert to rows
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const hasPresentiel = Object.values(data).some((m: any) => m?.presentiel > 0);
    const hasVt = Object.values(data).some((m: any) => m?.vt > 0);
    const rows: CotationRow[] = [];
    if (hasPresentiel) {
      const r = createRow("presentiel", "Présentiel");
      for (const k of MONTH_KEYS) r.months[k] = (data[k]?.presentiel || 0);
      rows.push(r);
    }
    if (hasVt) {
      const r = createRow("vt", "Visio Training");
      for (const k of MONTH_KEYS) r.months[k] = (data[k]?.vt || 0);
      rows.push(r);
    }
    if (rows.length > 0) return rows;
  }
  return [createRow("vt")];
}

export function CotationModal({ open, onClose, deals, companies, contacts, editQuotation, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const currentMemberId = useCurrentMember();

  const [form, setForm] = useState(() => initForm(editQuotation));

  useEffect(() => {
    if (open) setForm(initForm(editQuotation));
  }, [open, editQuotation]);

  function initForm(eq?: EditQuotation | null) {
    return {
      companyId: "" as string,
      companyName: eq?.company_name ?? "",
      contactId: "" as string,
      contactName: eq?.contact_name ?? "",
      dealId: eq?.deal_id ?? "" as string,
      nbLearners: eq?.nb_learners ?? 1,
      nbRiseUp: eq?.nb_rise_up ?? 0,
      rows: loadRows(eq?.months),
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

  const results: CotationResults = computeCotation({
    nbLearners: form.nbLearners,
    rows: form.rows,
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

  function updateRow(rowId: string, field: string, value: any) {
    setForm(f => ({
      ...f,
      rows: f.rows.map(r => r.id === rowId ? { ...r, [field]: value } : r),
    }));
  }

  function updateRowMonth(rowId: string, monthKey: string, value: number) {
    setForm(f => ({
      ...f,
      rows: f.rows.map(r => r.id === rowId
        ? { ...r, months: { ...r.months, [monthKey]: Math.max(0, value) } }
        : r
      ),
    }));
  }

  function addRow() {
    setForm(f => ({ ...f, rows: [...f.rows, createRow("vt")] }));
  }

  function removeRow(rowId: string) {
    setForm(f => ({ ...f, rows: f.rows.filter(r => r.id !== rowId) }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        id: editQuotation?.id,
        company_id: form.companyId || null,
        company_name: form.companyName,
        contact_id: form.contactId || null,
        contact_name: form.contactName,
        deal_id: form.dealId || null,
        nb_learners: form.nbLearners,
        nb_rise_up: form.nbRiseUp,
        months: { rows: form.rows },
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
      if (data.success) { onSaved?.(); onClose(); }
    } catch { /* error */ } finally { setSaving(false); }
  }

  function handleExportPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(generatePrintHtml(form, results));
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  async function handleSendEmail() {
    const contact = contacts.find(c => `${c.first_name} ${c.last_name}` === form.contactName || c.id === form.contactId);
    if (!contact) {
      alert("Veuillez sélectionner un contact pour envoyer l'email.");
      return;
    }
    setSendingEmail(true);
    try {
      // Generate PDF client-side from the cotation HTML
      const html2pdf = (await import("html2pdf.js")).default;
      const container = document.createElement("div");
      container.innerHTML = generatePrintHtml(form, results);
      // Extract just the body content
      const bodyMatch = container.innerHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyDiv = document.createElement("div");
      bodyDiv.innerHTML = bodyMatch ? bodyMatch[1] : container.innerHTML;
      bodyDiv.style.width = "800px";
      document.body.appendChild(bodyDiv);

      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: "cotation.pdf",
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        })
        .from(bodyDiv)
        .outputPdf("blob");

      document.body.removeChild(bodyDiv);

      // Convert blob to base64
      const reader = new FileReader();
      const pdfBase64: string = await new Promise((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:...;base64,
        };
        reader.readAsDataURL(pdfBlob);
      });

      const res = await fetch("/api/cotation/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "",
          contactFirstName: contact.first_name,
          companyName: form.companyName,
          memberId: currentMemberId,
          contactId: contact.id,
          dealId: form.dealId || null,
          pdfBase64,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("Cotation envoyée par email !" + (form.dealId ? " PDF sauvegardé dans le deal." : ""));
      } else {
        alert("Erreur : " + (data.error || "Échec de l'envoi"));
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de l'email.");
    }
    setSendingEmail(false);
  }

  if (!open) return null;

  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm";

  // Totals per month across all rows
  const monthTotal = (k: string) => form.rows.reduce((s, r) => s + (r.months[k] || 0), 0);

  return (
    <>
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
            <Calculator style={{ width: 18, height: 18, color: "#1E2A5A" }} />
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
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1E2A5A", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
              Informations client
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Entreprise</label>
                <select
                  value={form.companyId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    const company = companies.find(c => c.id === cid);
                    setForm({ ...form, companyId: cid, companyName: company?.name ?? "", contactId: "", contactName: "", dealId: "" });
                  }}
                  className={inputCls}
                >
                  <option value="">Sélectionner une entreprise</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Contact</label>
                <select
                  value={form.contactId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    const contact = contacts.find(c => c.id === cid);
                    setForm({ ...form, contactId: cid, contactName: contact ? `${contact.first_name} ${contact.last_name}` : "" });
                  }}
                  className={inputCls}
                >
                  <option value="">Sélectionner un contact</option>
                  {(form.companyId
                    ? contacts.filter(c => c.company_id === form.companyId)
                    : contacts
                  ).map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Deal associé</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select
                    value={form.dealId}
                    onChange={(e) => setForm({ ...form, dealId: e.target.value })}
                    className={inputCls}
                    style={{ flex: 1 }}
                  >
                    <option value="">Aucun deal</option>
                    {(form.companyId ? deals.filter(d => d.companies?.name === form.companyName || d.companies?.name === companies.find(c => c.id === form.companyId)?.name) : deals)
                      .map(d => <option key={d.id} value={d.id}>{d.name || "Deal sans nom"} — {fmtE(Number(d.amount) || 0)}</option>)}
                  </select>
                  {form.companyId && !form.dealId && (
                    <button
                      type="button"
                      onClick={async () => {
                        const dealName = prompt("Nom du deal :", `${form.companyName}`);
                        if (!dealName) return;
                        const amount = prompt("Montant (€) :", String(results.totalHt));
                        const { createClient } = await import("@/lib/supabase/client");
                        const supabase = createClient();
                        const { data: newDeal } = await supabase.from("deals").insert({
                          name: dealName,
                          company_id: form.companyId,
                          contact_id: form.contactId || null,
                          owner_id: currentMemberId,
                          stage: "quote_to_send",
                          amount: parseFloat(amount || "0") || 0,
                          probability: 40,
                        }).select("id").single();
                        if (newDeal) {
                          setForm({ ...form, dealId: newDeal.id });
                          alert("Deal créé !");
                        }
                      }}
                      style={{ height: 36, borderRadius: 8, border: "1px solid #1E2A5A", background: "white", color: "#1E2A5A", fontSize: 11, fontWeight: 600, padding: "0 10px", cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      + Deal
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 100px 1fr", gap: 12, alignItems: "end", marginTop: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Apprenants</label>
                <input type="number" min={1} value={form.nbLearners} onChange={(e) => setForm({ ...form, nbLearners: Math.max(1, parseInt(e.target.value) || 1) })} className={inputCls} style={{ textAlign: "center", fontWeight: 700, fontSize: 15 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Rise Up</label>
                <input type="number" min={0} value={form.nbRiseUp} onChange={(e) => setForm({ ...form, nbRiseUp: Math.max(0, parseInt(e.target.value) || 0) })} className={inputCls} style={{ textAlign: "center", fontWeight: 700, fontSize: 15 }} />
              </div>
              <div></div>
            </div>
          </div>

          {/* ═══ Zone B: Monthly Grid with dynamic rows ═══ */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1E2A5A", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Grille mensuelle
              <button onClick={addRow} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #1E2A5A", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "#1E2A5A", cursor: "pointer" }}>
                <Plus style={{ width: 12, height: 12 }} /> Ajouter une ligne
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700, color: "#5a6f80", fontSize: 11, width: 180 }}></th>
                    {MONTH_KEYS.map(k => (
                      <th key={k} style={{ padding: "8px 2px", textAlign: "center", fontWeight: 700, fontSize: 10, color: monthTotal(k) > 0 ? "#1E2A5A" : "#8399a9" }}>
                        {MONTH_LABELS[k]}
                      </th>
                    ))}
                    <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 800, fontSize: 11, color: "#1a2a3a", borderLeft: "2px solid #dce8f0" }}>Total</th>
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((row) => {
                    const isPres = row.type === "presentiel";
                    const color = isPres ? "#1E2A5A" : "#27ae60";
                    const bgActive = isPres ? "#e8f0fe" : "#e8f5e9";
                    const total = rowTotal(row);
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: "4px 4px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <select
                              value={row.type}
                              onChange={(e) => updateRow(row.id, "type", e.target.value)}
                              style={{ width: 50, height: 28, borderRadius: 6, border: "1px solid #dce8f0", fontSize: 10, fontWeight: 700, color, background: "white", cursor: "pointer", padding: "0 2px" }}
                            >
                              <option value="vt">VT</option>
                              <option value="presentiel">Prés.</option>
                            </select>
                            <input
                              value={row.title}
                              onChange={(e) => updateRow(row.id, "title", e.target.value)}
                              placeholder={isPres ? "Journée présentielle" : "Visio Training"}
                              style={{ flex: 1, height: 28, borderRadius: 6, border: "1px solid #dce8f0", fontSize: 11, fontWeight: 600, color: "#1a2a3a", padding: "0 6px", outline: "none", minWidth: 80 }}
                            />
                          </div>
                        </td>
                        {MONTH_KEYS.map(k => (
                          <td key={k} style={{ padding: "3px 1px", textAlign: "center" }}>
                            <DecimalInput
                              value={row.months[k] || 0}
                              onChange={(v) => updateRowMonth(row.id, k, v)}
                              style={{
                                width: 44, height: 32, borderRadius: 6, border: "1px solid #dce8f0",
                                textAlign: "center" as const, fontSize: 13, fontWeight: 700,
                                background: (row.months[k] || 0) > 0 ? bgActive : "white",
                                color: (row.months[k] || 0) > 0 ? color : "#8399a9",
                                outline: "none",
                              }}
                            />
                          </td>
                        ))}
                        <td style={{ padding: "4px 6px", textAlign: "center", fontWeight: 800, fontSize: 13, color, borderLeft: "2px solid #dce8f0" }}>
                          {fmtN(total, total % 1 === 0 ? 0 : 1)}
                        </td>
                        <td style={{ padding: "4px 2px", textAlign: "center" }}>
                          {form.rows.length > 1 && (
                            <button onClick={() => removeRow(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 2 }} title="Supprimer">
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr style={{ borderTop: "2px solid #e8ecf1" }}>
                    <td style={{ padding: "8px 4px", fontWeight: 700, fontSize: 11, color: "#8399a9", textTransform: "uppercase" }}>Total</td>
                    {MONTH_KEYS.map(k => {
                      const t = monthTotal(k);
                      return (
                        <td key={k} style={{ padding: "8px 2px", textAlign: "center", fontWeight: 700, fontSize: 11, color: t > 0 ? "#1a2a3a" : "#dce8f0" }}>
                          {t > 0 ? fmtN(t, t % 1 === 0 ? 0 : 1) : "—"}
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 800, fontSize: 13, color: "#1a2a3a", borderLeft: "2px solid #dce8f0" }}>
                      {fmtN(results.totalPresentielDays + results.totalVtSessions, 0)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Zone C: Results ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 20, borderRadius: 12, background: "#f8fbfd", border: "1px solid #e8ecf1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1E2A5A", marginBottom: 14 }}>Volume d&apos;heures</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.presentielHours > 0 && <ResultRow label="Heures présentiel" value={`${fmtN(results.presentielHours, 0)}h`} />}
                {results.vtHours > 0 && <ResultRow label="Heures VT" value={`${fmtN(results.vtHours, 0)}h`} />}
                <ResultRow label="Heures formation" value={`${fmtN(results.formationHours, 0)}h`} bold />
                <div style={{ borderTop: "1px solid #e8ecf1", margin: "4px 0" }} />
                <ResultRow label="Heures préparation" value={`${fmtN(results.prepHours, 1)}h`} />
                {results.travelHours > 0 && <ResultRow label="Heures déplacement" value={`${fmtN(results.travelHours, 1)}h`} />}
                <ResultRow label="Heures intervention" value={`${fmtN(results.interventionHours, 1)}h`} />
                <ResultRow label="Heures mobilisation" value={`${fmtN(results.mobilisationHours, 1)}h`} bold />
              </div>
            </div>
            <div style={{ padding: 20, borderRadius: 12, background: "#f8fbfd", border: "1px solid #e8ecf1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1E2A5A", marginBottom: 14 }}>Synthèse financière</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.costPresentielLca > 0 && <ResultRow label="Présentiel LCA" value={fmtE(results.costPresentielLca)} />}
                {results.costVtLca > 0 && <ResultRow label="VT LCA" value={fmtE(results.costVtLca)} />}
                <ResultRow label="Préparation" value={fmtE(results.costPrep)} />
                {results.costTravel > 0 && <ResultRow label="Déplacement" value={fmtE(results.costTravel)} />}
                {results.costPresentielClient > 0 && <ResultRow label={`THR (${results.totalPresentielDays}j × ${fmtE(form.costPerDayPresentiel)}/j)`} value={fmtE(results.costPresentielClient)} />}
                {results.costFournitures > 0 && <ResultRow label={`Fournitures (${form.nbLearners} × ${fmtE(form.costFournituresPerLearner)})`} value={fmtE(results.costFournitures)} />}
                {form.nbRiseUp > 0 && <ResultRow label={`Rise Up (${form.nbRiseUp} × ${fmtE(form.riseUpCostPerLicense)})`} value={fmtE(results.costRiseUp)} />}
                <div style={{ borderTop: "2px solid #1E2A5A", margin: "4px 0" }} />
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
            <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5a6f80", padding: "4px 0" }}>
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
                  <AdvancedField label="THR (€)" value={form.costPerDayPresentiel} onChange={v => setForm({ ...form, costPerDayPresentiel: v })} />
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
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} style={{ minHeight: 48, resize: "vertical" }} placeholder="Notes internes sur cette cotation..." />
          </div>
        </div>

        {/* ═══ Zone E: Actions ═══ */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #e8ecf1", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#f8fbfd" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>Total :</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#27ae60" }}>{fmtE(results.totalHt)}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ height: 40, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 20px", border: "none", cursor: "pointer" }}>Annuler</button>
            <button onClick={handleExportPdf} disabled={results.totalHt === 0} style={{ height: 40, borderRadius: 8, border: "1px solid #1E2A5A", background: "white", color: "#1E2A5A", fontSize: 13, fontWeight: 600, padding: "0 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: results.totalHt === 0 ? 0.4 : 1 }}>
              <FileDown style={{ width: 14, height: 14 }} /> Exporter PDF
            </button>
            <button onClick={handleSendEmail} disabled={sendingEmail || results.totalHt === 0 || !form.contactName} style={{ height: 40, borderRadius: 8, border: "1px solid #27ae60", background: "white", color: "#27ae60", fontSize: 13, fontWeight: 600, padding: "0 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: (sendingEmail || results.totalHt === 0 || !form.contactName) ? 0.4 : 1 }}>
              {sendingEmail ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Mail style={{ width: 14, height: 14 }} />}
              {sendingEmail ? "Envoi..." : "Envoyer par email"}
            </button>
            {(() => {
              const canGenerate = !!(form.dealId && editQuotation?.id);
              return (
                <button
                  onClick={() => setShowQuoteModal(true)}
                  disabled={!canGenerate}
                  title={canGenerate ? "Générer un devis depuis cette cotation" : "Enregistrez la cotation et liez un deal d'abord"}
                  style={{ height: 40, borderRadius: 8, border: "1px solid #e8632b", background: "white", color: "#e8632b", fontSize: 13, fontWeight: 600, padding: "0 18px", cursor: canGenerate ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, opacity: canGenerate ? 1 : 0.4 }}
                >
                  <FileText style={{ width: 14, height: 14 }} /> Générer un devis
                </button>
              );
            })()}
            <button onClick={handleSave} disabled={saving || results.totalHt === 0} style={{ height: 40, borderRadius: 8, border: "none", padding: "0 24px", background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: (saving || results.totalHt === 0) ? 0.5 : 1 }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>

    {showQuoteModal && form.dealId && editQuotation?.id && (
      <QuoteSendModal
        dealId={form.dealId}
        dealName={deals.find((d) => d.id === form.dealId)?.companies?.name ?? form.companyName}
        fromQuotation={editQuotation.id}
        onClose={() => setShowQuoteModal(false)}
        onDone={() => { setShowQuoteModal(false); onSaved?.(); }}
      />
    )}
    </>
  );
}

/** Number input with native spinners stepping by 0.5, supports comma entry */
function DecimalInput({ value, onChange, style }: { value: number; onChange: (v: number) => void; style?: React.CSSProperties }) {
  return (
    <input
      type="number"
      min={0}
      step={0.5}
      value={value || ""}
      placeholder="0"
      style={style}
      onChange={(e) => {
        const v = parseFloat(e.target.value.replace(",", ".")) || 0;
        onChange(Math.max(0, v));
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}

function ResultRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#5a6f80" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: "#1a2a3a" }}>{value}</span>
    </div>
  );
}

function AdvancedField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 600, color: "#8399a9", display: "block", marginBottom: 3 }}>{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-sm" style={{ textAlign: "center" }} />
    </div>
  );
}

/* ── PDF Export ── */

function generatePrintHtml(
  form: { companyName: string; contactName: string; nbLearners: number; nbRiseUp: number; rows: CotationRow[]; notes: string; costPerDayPresentiel: number; costFournituresPerLearner: number; riseUpCostPerLicense: number },
  results: CotationResults,
): string {
  const fE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  const fN = (n: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n);
  const keys = MONTH_KEYS as readonly string[];

  // Only show rows that have data
  const activeRows = form.rows.filter(r => rowTotal(r) > 0);

  const rowsHtml = activeRows.map(row => {
    const isPres = row.type === "presentiel";
    const color = isPres ? "#1E2A5A" : "#27ae60";
    const label = row.title || (isPres ? "Présentiel" : "Visio Training");
    const total = rowTotal(row);
    const cells = keys.map(k => {
      const v = row.months[k] || 0;
      return `<td style="text-align:center;padding:6px 4px;border:1px solid #ddd;color:${v > 0 ? color : '#ccc'};font-weight:${v > 0 ? 700 : 400};">${v > 0 ? fN(v, v % 1 === 0 ? 0 : 1) : "—"}</td>`;
    }).join("");
    return `<tr><td style="padding:6px 8px;font-weight:700;color:${color};border:1px solid #ddd;">${label}</td>${cells}<td style="text-align:center;font-weight:800;border:1px solid #ddd;">${fN(total, total % 1 === 0 ? 0 : 1)}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotation — ${form.companyName || "Client"}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a2a3a; padding: 30px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; color: #1E2A5A; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #1E2A5A; text-transform: uppercase; letter-spacing: 0.1em; margin: 24px 0 10px; border-bottom: 2px solid #1E2A5A; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f0f6fa; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #1E2A5A; border: 1px solid #ddd; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-item { background: #f8fbfd; padding: 10px 14px; border-radius: 8px; }
  .info-label { font-size: 10px; text-transform: uppercase; color: #8399a9; font-weight: 700; }
  .info-value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .result-box { background: #f8fbfd; padding: 16px; border-radius: 8px; border: 1px solid #e8ecf1; }
  .result-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .result-row.bold { font-weight: 800; font-size: 13px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 18px; font-weight: 800; border-top: 2px solid #1E2A5A; margin-top: 8px; }
  .total-value { color: #27ae60; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
  <div style="width:50px;height:50px;border:2px solid #0f1630;border-radius:8px;display:flex;align-items:center;justify-content:center;">
    <span style="font-size:8px;font-weight:700;text-align:center;line-height:1.2;color:#0f1630;">LA<br>CLOSING<br>ACADÉMIE®</span>
  </div>
  <div>
    <h1>Cotation — ${form.companyName || "Client"}</h1>
    <div style="color:#8399a9;font-size:12px;">${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${form.contactName ? ` • Contact : ${form.contactName}` : ""}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-item"><div class="info-label">Apprenants</div><div class="info-value">${form.nbLearners}</div></div>
  ${results.totalPresentielDays > 0 ? `<div class="info-item"><div class="info-label">Jours présentiel</div><div class="info-value">${results.totalPresentielDays}</div></div>` : ""}
  ${results.totalVtSessions > 0 ? `<div class="info-item"><div class="info-label">Sessions VT</div><div class="info-value">${results.totalVtSessions}</div></div>` : ""}
  ${form.nbRiseUp > 0 ? `<div class="info-item"><div class="info-label">Licences Rise Up</div><div class="info-value">${form.nbRiseUp}</div></div>` : ""}
</div>

${activeRows.length > 0 ? `
<h2>Planning mensuel</h2>
<table>
  <thead><tr><th></th>${keys.map(k => `<th>${MONTH_LABELS[k]}</th>`).join("")}<th>Total</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
` : ""}

<h2>Synthèse</h2>
<div class="results-grid">
  <div class="result-box">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1E2A5A;margin-bottom:10px;">Volume d'heures</div>
    <div class="result-row"><span>Heures formation</span><span style="font-weight:700;">${fN(results.formationHours, 0)}h</span></div>
    <div class="result-row"><span>Heures préparation</span><span>${fN(results.prepHours, 1)}h</span></div>
    ${results.travelHours > 0 ? `<div class="result-row"><span>Heures déplacement</span><span>${fN(results.travelHours, 1)}h</span></div>` : ""}
    <div class="result-row"><span>Heures intervention</span><span>${fN(results.interventionHours, 1)}h</span></div>
    <div class="result-row bold"><span>Heures mobilisation</span><span>${fN(results.mobilisationHours, 1)}h</span></div>
  </div>
  <div class="result-box">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1E2A5A;margin-bottom:10px;">Détail financier</div>
    ${results.costPresentielLca > 0 ? `<div class="result-row"><span>Présentiel LCA</span><span>${fE(results.costPresentielLca)}</span></div>` : ""}
    ${results.costVtLca > 0 ? `<div class="result-row"><span>VT LCA</span><span>${fE(results.costVtLca)}</span></div>` : ""}
    <div class="result-row"><span>Préparation</span><span>${fE(results.costPrep)}</span></div>
    ${results.costTravel > 0 ? `<div class="result-row"><span>Déplacement</span><span>${fE(results.costTravel)}</span></div>` : ""}
    ${results.costPresentielClient > 0 ? `<div class="result-row"><span>THR</span><span>${fE(results.costPresentielClient)}</span></div>` : ""}
    ${results.costFournitures > 0 ? `<div class="result-row"><span>Fournitures</span><span>${fE(results.costFournitures)}</span></div>` : ""}
    ${form.nbRiseUp > 0 ? `<div class="result-row"><span>Rise Up</span><span>${fE(results.costRiseUp)}</span></div>` : ""}
    <div class="total-row"><span>Total HT</span><span class="total-value">${fE(results.totalHt)}</span></div>
    <div class="result-row bold"><span>Taux mobilisation LCA hors THR</span><span>${fE(results.hourlyRateMobilisationLca)}</span></div>
    <div class="result-row"><span>Taux mobilisation LCA / apprenant</span><span>${fE(results.hourlyRateMobilisationLcaPerLearner)}</span></div>
  </div>
</div>

${form.notes ? `<h2>Notes</h2><p style="color:#5a6f80;">${form.notes}</p>` : ""}

<div style="margin-top:30px;padding-top:16px;border-top:1px solid #e8ecf1;text-align:center;font-size:10px;color:#8399a9;">
  IFA Formation® — Document généré le ${new Date().toLocaleDateString("fr-FR")}
</div>
</body></html>`;
}
