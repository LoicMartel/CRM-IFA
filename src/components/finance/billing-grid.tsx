"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search, Plus, Trash2, Receipt, CreditCard, Clock, AlertTriangle, X, Edit,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import type { BillingStatus } from "@/types/database";

/* ---- Types ---- */

interface BillingMonthData {
  id: string;
  month: string;
  amount: number;
  status: BillingStatus | null;
}

interface BillingEntryData {
  id: string;
  company_id: string | null;
  deal_id: string | null;
  client_name: string;
  funding_type: string | null;
  fiscal_year: string;
  notes: string | null;
  billing_months: BillingMonthData[];
  companies: { id: string; name: string } | null;
  deals: { id: string; name: string; amount: number } | null;
}

interface CompanyRef {
  id: string;
  name: string;
}

interface DealRef {
  id: string;
  name: string;
  amount: number | null;
  company_id: string | null;
  companies: { name: string } | { name: string }[] | null;
}

interface Props {
  entries: BillingEntryData[];
  companies: CompanyRef[];
  deals: DealRef[];
}

/* ---- Constants ---- */

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  encaisse: { bg: "#c6efce", text: "#006100", label: "Encaissé" },
  facture: { bg: "#ffc7ce", text: "#9c0006", label: "Facturé" },
  en_cours: { bg: "#bdd7ee", text: "#1f4e79", label: "En cours" },
  non_fait: { bg: "#ffffff", text: "#888888", label: "Non fait" },
};

const FUNDING_TYPES = ["UP FRONT", "OPCO", "CPF", "autre"];

const MONTH_LABELS: Record<number, string> = {
  0: "janv", 1: "févr", 2: "mars", 3: "avr", 4: "mai", 5: "juin",
  6: "juil", 7: "août", 8: "sept", 9: "oct", 10: "nov", 11: "déc",
};

function getFiscalMonths(fiscalYear: string): { key: string; label: string }[] {
  const [startYear] = fiscalYear.split("-").map(Number);
  const months: { key: string; label: string }[] = [];
  // Sept to Dec of startYear
  for (let m = 8; m < 12; m++) {
    const d = `${startYear}-${String(m + 1).padStart(2, "0")}-01`;
    months.push({ key: d, label: `${MONTH_LABELS[m]}-${String(startYear).slice(2)}` });
  }
  // Jan to Aug of startYear+1
  for (let m = 0; m < 8; m++) {
    const d = `${startYear + 1}-${String(m + 1).padStart(2, "0")}-01`;
    months.push({ key: d, label: `${MONTH_LABELS[m]}-${String(startYear + 1).slice(2)}` });
  }
  return months;
}

function getFiscalMonthsFull(fiscalYear: string): { key: string; label: string }[] {
  const [startYear] = fiscalYear.split("-").map(Number);
  const full: Record<number, string> = {
    0: "Janvier", 1: "Février", 2: "Mars", 3: "Avril", 4: "Mai", 5: "Juin",
    6: "Juillet", 7: "Août", 8: "Septembre", 9: "Octobre", 10: "Novembre", 11: "Décembre",
  };
  const months: { key: string; label: string }[] = [];
  for (let m = 8; m < 12; m++) {
    const d = `${startYear}-${String(m + 1).padStart(2, "0")}-01`;
    months.push({ key: d, label: `${full[m]} ${startYear}` });
  }
  for (let m = 0; m < 8; m++) {
    const d = `${startYear + 1}-${String(m + 1).padStart(2, "0")}-01`;
    months.push({ key: d, label: `${full[m]} ${startYear + 1}` });
  }
  return months;
}

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function fmtCompact(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

/* ---- Component ---- */

export function BillingGrid({ entries, companies, deals }: Props) {
  const router = useRouter();
  const { isReadOnly } = useCurrentRoles();

  const [search, setSearch] = useState("");
  const [fiscalYear, setFiscalYear] = useState("2025-2026");
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<BillingEntryData | null>(null);

  // Cell popover state
  const [popoverCell, setPopoverCell] = useState<{ entryId: string; monthKey: string; monthId: string | null; rect: DOMRect } | null>(null);
  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ entryId: string; monthKey: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formDealId, setFormDealId] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formFundingType, setFormFundingType] = useState("");
  const [formMonthlyFill, setFormMonthlyFill] = useState("");
  const [formMonths, setFormMonths] = useState<Record<string, { amount: string; status: string }>>({});
  const [saving, setSaving] = useState(false);

  const fiscalMonths = useMemo(() => getFiscalMonths(fiscalYear), [fiscalYear]);
  const fiscalMonthsFull = useMemo(() => getFiscalMonthsFull(fiscalYear), [fiscalYear]);

  // Filter entries by fiscal year and search
  const filtered = useMemo(() => {
    let data = entries.filter((e) => e.fiscal_year === fiscalYear);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((e) =>
        e.client_name.toLowerCase().includes(q) ||
        (e.companies?.name ?? "").toLowerCase().includes(q) ||
        (e.funding_type ?? "").toLowerCase().includes(q)
      );
    }
    return data;
  }, [entries, fiscalYear, search]);

  // Build month lookup per entry
  function getMonthData(entry: BillingEntryData, monthKey: string): BillingMonthData | null {
    return entry.billing_months.find((m) => m.month === monthKey) ?? null;
  }

  // KPIs
  const kpis = useMemo(() => {
    const allMonths = filtered.flatMap((e) => e.billing_months);
    return {
      total: allMonths.reduce((s, m) => s + Number(m.amount), 0),
      encaisse: allMonths.filter((m) => m.status === "encaisse").reduce((s, m) => s + Number(m.amount), 0),
      facture: allMonths.filter((m) => m.status === "facture").reduce((s, m) => s + Number(m.amount), 0),
      en_cours: allMonths.filter((m) => m.status === "en_cours").reduce((s, m) => s + Number(m.amount), 0),
      non_fait: allMonths.filter((m) => m.status === "non_fait").reduce((s, m) => s + Number(m.amount), 0),
    };
  }, [filtered]);

  // Column totals
  const colTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const mk of fiscalMonths) totals[mk.key] = 0;
    for (const e of filtered) {
      for (const m of e.billing_months) {
        if (totals[m.month] !== undefined) totals[m.month] += Number(m.amount);
      }
    }
    return totals;
  }, [filtered, fiscalMonths]);

  const grandTotal = useMemo(() => Object.values(colTotals).reduce((s, v) => s + v, 0), [colTotals]);

  // Row total
  function rowTotal(entry: BillingEntryData): number {
    return entry.billing_months.reduce((s, m) => s + Number(m.amount), 0);
  }

  // ---- Actions ----

  async function updateCellStatus(entryId: string, monthKey: string, monthId: string | null, status: BillingStatus | null) {
    const supabase = createClient();
    if (monthId) {
      await supabase.from("billing_months").update({ status, updated_at: new Date().toISOString() }).eq("id", monthId);
    }
    setPopoverCell(null);
    router.refresh();
  }

  async function updateCellAmount(entryId: string, monthKey: string, newAmount: number) {
    const supabase = createClient();
    const entry = entries.find((e) => e.id === entryId);
    const existing = entry?.billing_months.find((m) => m.month === monthKey);

    if (existing) {
      if (newAmount === 0) {
        await supabase.from("billing_months").delete().eq("id", existing.id);
      } else {
        await supabase.from("billing_months").update({ amount: newAmount, updated_at: new Date().toISOString() }).eq("id", existing.id);
      }
    } else if (newAmount > 0) {
      await supabase.from("billing_months").insert({
        billing_entry_id: entryId,
        month: monthKey,
        amount: newAmount,
      });
    }
    setEditingCell(null);
    router.refresh();
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm("Supprimer cette ligne de facturation ?")) return;
    const supabase = createClient();
    await supabase.from("billing_entries").delete().eq("id", entryId);
    router.refresh();
  }

  // ---- Add form ----

  function openAddForm() {
    setFormCompanyId("");
    setFormDealId("");
    setFormClientName("");
    setFormFundingType("");
    setFormMonthlyFill("");
    const months: Record<string, { amount: string; status: string }> = {};
    for (const m of fiscalMonthsFull) months[m.key] = { amount: "", status: "" };
    setFormMonths(months);
    setEditEntry(null);
    setAddOpen(true);
  }

  function openEditForm(entry: BillingEntryData) {
    setFormCompanyId(entry.company_id ?? "");
    setFormDealId(entry.deal_id ?? "");
    setFormClientName(entry.client_name);
    setFormFundingType(entry.funding_type ?? "");
    setFormMonthlyFill("");
    const months: Record<string, { amount: string; status: string }> = {};
    for (const m of fiscalMonthsFull) {
      const existing = entry.billing_months.find((bm) => bm.month === m.key);
      months[m.key] = {
        amount: existing ? String(existing.amount) : "",
        status: existing?.status ?? "",
      };
    }
    setFormMonths(months);
    setEditEntry(entry);
    setAddOpen(true);
  }

  function fillAllMonths() {
    const val = formMonthlyFill;
    if (!val) return;
    setFormMonths((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], amount: val };
      }
      return next;
    });
  }

  async function handleSave() {
    if (!formClientName.trim()) return;
    setSaving(true);
    const supabase = createClient();

    if (editEntry) {
      // Update entry
      await supabase.from("billing_entries").update({
        company_id: formCompanyId || null,
        deal_id: formDealId || null,
        client_name: formClientName.trim(),
        funding_type: formFundingType || null,
        updated_at: new Date().toISOString(),
      }).eq("id", editEntry.id);

      // Upsert months
      for (const [monthKey, data] of Object.entries(formMonths)) {
        const amount = parseFloat(data.amount) || 0;
        const status = data.status || null;
        const existing = editEntry.billing_months.find((m) => m.month === monthKey);

        if (existing) {
          if (amount === 0 && !status) {
            await supabase.from("billing_months").delete().eq("id", existing.id);
          } else {
            await supabase.from("billing_months").update({ amount, status, updated_at: new Date().toISOString() }).eq("id", existing.id);
          }
        } else if (amount > 0) {
          await supabase.from("billing_months").insert({
            billing_entry_id: editEntry.id,
            month: monthKey,
            amount,
            status,
          });
        }
      }
    } else {
      // Create entry
      const { data: newEntry } = await supabase.from("billing_entries").insert({
        company_id: formCompanyId || null,
        deal_id: formDealId || null,
        client_name: formClientName.trim(),
        funding_type: formFundingType || null,
        fiscal_year: fiscalYear,
      }).select("id").single();

      if (newEntry) {
        // Create months in batch
        const monthRows = Object.entries(formMonths)
          .filter(([, d]) => parseFloat(d.amount) > 0)
          .map(([monthKey, d]) => ({
            billing_entry_id: newEntry.id,
            month: monthKey,
            amount: parseFloat(d.amount) || 0,
            status: d.status || null,
          }));

        if (monthRows.length > 0) {
          await supabase.from("billing_months").insert(monthRows);
        }
      }
    }

    setSaving(false);
    setAddOpen(false);
    router.refresh();
  }

  // Close popover on outside click
  useEffect(() => {
    if (!popoverCell) return;
    function handleClick() { setPopoverCell(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [popoverCell]);

  // Focus inline edit
  useEffect(() => {
    if (editingCell && editInputRef.current) editInputRef.current.focus();
  }, [editingCell]);

  // Fiscal year options
  const yearOptions = ["2024-2025", "2025-2026", "2026-2027"];

  return (
    <>
      <style>{`
        .billing-sticky-cell {
          background: white !important;
        }
        tr:hover .billing-sticky-cell {
          background: #fafcfd !important;
        }
        .billing-sticky-header {
          background: #f8fafb !important;
        }
      `}</style>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: "Total", value: kpis.total, icon: <Receipt className="h-4 w-4" />, color: "#1a2a3a" },
          { label: "Encaissé", value: kpis.encaisse, icon: <CreditCard className="h-4 w-4" />, color: "#006100" },
          { label: "Facturé", value: kpis.facture, icon: <Receipt className="h-4 w-4" />, color: "#9c0006" },
          { label: "En cours", value: kpis.en_cours, icon: <Clock className="h-4 w-4" />, color: "#1f4e79" },
          { label: "Non fait", value: kpis.non_fait, icon: <AlertTriangle className="h-4 w-4" />, color: "#888888" },
        ].map((kpi) => (
          <div key={kpi.label} className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color }}>{fmtCompact(kpi.value)}</div>
            </div>
            <span style={{ color: "#8399a9" }}>{kpi.icon}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Fiscal year */}
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm font-semibold"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>Année {y}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-2 items-center flex-wrap">
          {Object.entries(STATUS_COLORS).map(([key, sc]) => (
            <span key={key} style={{
              background: sc.bg, color: sc.text, padding: "2px 10px", borderRadius: 4,
              fontSize: 11, fontWeight: 600,
            }}>
              {sc.label}
            </span>
          ))}
        </div>

        {!isReadOnly && (
          <Button onClick={openAddForm} style={{ gap: 8 }}>
            <Plus className="h-4 w-4" />
            Ajouter un plan de facturation
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#f8fafb", borderBottom: "2px solid #e8ecf1" }}>
                <th style={{ position: "sticky", left: 0, zIndex: 10, background: "#f8fafb", padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#5a6a7a", minWidth: 200, borderRight: "1px solid #e8ecf1" }}>
                  Raison sociale
                </th>
                <th style={{ position: "sticky", left: 200, zIndex: 10, background: "#f8fafb", padding: "10px 8px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#5a6a7a", minWidth: 90, borderRight: "2px solid #dce8f0" }}>
                  Type
                </th>
                {fiscalMonths.map((m) => (
                  <th key={m.key} style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "#5a6a7a", minWidth: 95, borderRight: "1px solid #f0f4f8" }}>
                    {m.label}
                  </th>
                ))}
                <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "#1a2a3a", minWidth: 100, borderLeft: "2px solid #dce8f0" }}>
                  TOTAL
                </th>
                {!isReadOnly && (
                  <th style={{ padding: "10px 8px", width: 60 }}></th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={fiscalMonths.length + 4} style={{ padding: 40, textAlign: "center", color: "#8399a9" }}>
                    Aucune entrée de facturation
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #f0f4f8" }} className="hover:bg-[#fafcfd]">
                    {/* Client name - sticky */}
                    <td className="billing-sticky-cell" style={{
                      position: "sticky", left: 0, zIndex: 5,
                      padding: "8px 12px", fontWeight: 600, fontSize: 12, color: "#1a2a3a",
                      borderRight: "1px solid #e8ecf1", cursor: "pointer",
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={entry.client_name} onClick={() => !isReadOnly && openEditForm(entry)}>
                      <span style={{ color: "#1a6b9c", textDecoration: "underline" }}>{entry.client_name}</span>
                    </td>

                    {/* Funding type - sticky */}
                    <td className="billing-sticky-cell" style={{
                      position: "sticky", left: 200, zIndex: 5,
                      padding: "8px 8px", fontSize: 11, color: "#5a6a7a", fontWeight: 600,
                      borderRight: "2px solid #dce8f0",
                    }}>
                      {entry.funding_type || "—"}
                    </td>

                    {/* Month cells */}
                    {fiscalMonths.map((mk) => {
                      const md = getMonthData(entry, mk.key);
                      const sc = md?.status ? STATUS_COLORS[md.status] : null;
                      const isEditing = editingCell?.entryId === entry.id && editingCell?.monthKey === mk.key;

                      return (
                        <td key={mk.key} style={{
                          padding: 0, textAlign: "right", borderRight: "1px solid #f0f4f8",
                          background: sc?.bg ?? "transparent", color: sc?.text ?? "#1a2a3a",
                          cursor: md ? "pointer" : "default", position: "relative",
                        }}
                          onClick={(e) => {
                            if (isReadOnly || isEditing || !md) return;
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPopoverCell({ entryId: entry.id, monthKey: mk.key, monthId: md.id, rect });
                          }}
                          onDoubleClick={() => {
                            if (isReadOnly) return;
                            setEditingCell({ entryId: entry.id, monthKey: mk.key });
                            setEditingValue(md ? String(md.amount) : "");
                            setPopoverCell(null);
                          }}
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => {
                                const val = parseFloat(editingValue) || 0;
                                updateCellAmount(entry.id, mk.key, val);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = parseFloat(editingValue) || 0;
                                  updateCellAmount(entry.id, mk.key, val);
                                } else if (e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              style={{
                                width: "100%", height: "100%", padding: "6px 8px", border: "2px solid #1a6b9c",
                                background: "white", textAlign: "right", fontSize: 12, outline: "none",
                              }}
                            />
                          ) : (
                            <div style={{ padding: "8px 8px", fontSize: 12, fontWeight: md?.amount ? 500 : 400 }}>
                              {md?.amount ? fmt(md.amount) : ""}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Row total */}
                    <td style={{
                      padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 12,
                      color: "#1a2a3a", borderLeft: "2px solid #dce8f0",
                    }}>
                      {rowTotal(entry) > 0 ? fmt(rowTotal(entry)) : ""}
                    </td>

                    {/* Actions */}
                    {!isReadOnly && (
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                          <button onClick={() => openEditForm(entry)} style={{
                            background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4, borderRadius: 4,
                          }} title="Modifier">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteEntry(entry.id)} style={{
                            background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4, borderRadius: 4,
                          }} title="Supprimer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}

              {/* Totals row */}
              {filtered.length > 0 && (
                <tr style={{ borderTop: "2px solid #dce8f0", background: "#f8fafb" }}>
                  <td className="billing-sticky-header" style={{
                    position: "sticky", left: 0, zIndex: 5,
                    padding: "10px 12px", fontWeight: 800, fontSize: 12, color: "#1a2a3a",
                    borderRight: "1px solid #e8ecf1",
                  }}>
                    TOTAUX
                  </td>
                  <td className="billing-sticky-header" style={{ position: "sticky", left: 200, zIndex: 5, borderRight: "2px solid #dce8f0" }}></td>
                  {fiscalMonths.map((mk) => (
                    <td key={mk.key} style={{
                      padding: "10px 8px", textAlign: "right", fontWeight: 700, fontSize: 12,
                      color: "#1a2a3a", borderRight: "1px solid #f0f4f8",
                    }}>
                      {colTotals[mk.key] > 0 ? fmt(colTotals[mk.key]) : ""}
                    </td>
                  ))}
                  <td style={{
                    padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 13,
                    color: "#1a2a3a", borderLeft: "2px solid #dce8f0",
                  }}>
                    {fmtCompact(grandTotal)}
                  </td>
                  {!isReadOnly && <td></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status popover */}
      {popoverCell && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: popoverCell.rect.bottom + 4,
            left: popoverCell.rect.left,
            zIndex: 200,
            background: "white",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            border: "1px solid #e8ecf1",
            padding: 6,
            display: "flex",
            gap: 4,
          }}
        >
          {Object.entries(STATUS_COLORS).map(([key, sc]) => (
            <button
              key={key}
              onClick={() => updateCellStatus(popoverCell.entryId, popoverCell.monthKey, popoverCell.monthId, key as BillingStatus)}
              style={{
                background: sc.bg, color: sc.text, border: "none", cursor: "pointer",
                padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              }}
              title={sc.label}
            >
              {sc.label}
            </button>
          ))}
          <button
            onClick={() => updateCellStatus(popoverCell.entryId, popoverCell.monthKey, popoverCell.monthId, null)}
            style={{
              background: "#f5f5f5", color: "#666", border: "none", cursor: "pointer",
              padding: "5px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}
            title="Effacer le statut"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Add / Edit Sheet */}
      <Sheet open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setEditEntry(null); }}>
        <SheetContent style={{ width: 520, maxWidth: "95vw", overflowY: "auto" }}>
          <SheetHeader>
            <SheetTitle>{editEntry ? "Modifier le plan de facturation" : "Ajouter un plan de facturation"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            {/* Company */}
            <div className="space-y-2">
              <Label>Société</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={formCompanyId}
                onChange={(e) => {
                  setFormCompanyId(e.target.value);
                  if (!formClientName && e.target.value) {
                    const c = companies.find((c) => c.id === e.target.value);
                    if (c) setFormClientName(c.name);
                  }
                }}
              >
                <option value="">Aucune société</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Deal */}
            <div className="space-y-2">
              <Label>Deal associé</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={formDealId}
                onChange={(e) => {
                  setFormDealId(e.target.value);
                  if (e.target.value) {
                    const deal = deals.find((d) => d.id === e.target.value);
                    if (deal) {
                      // Auto-remplir la société si pas encore sélectionnée
                      if (!formCompanyId && deal.company_id) setFormCompanyId(deal.company_id);
                      // Auto-remplir la raison sociale si vide
                      const compName = Array.isArray(deal.companies) ? deal.companies[0]?.name : deal.companies?.name;
                      if (!formClientName) setFormClientName(compName ?? deal.name);
                    }
                  }
                }}
              >
                <option value="">Aucun deal</option>
                {(formCompanyId
                  ? deals.filter((d) => d.company_id === formCompanyId)
                  : deals
                ).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.amount ? ` (${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(d.amount)} €)` : ""}{(() => { const cn = Array.isArray(d.companies) ? d.companies[0]?.name : d.companies?.name; return cn ? ` — ${cn}` : ""; })()}
                  </option>
                ))}
              </select>
            </div>

            {/* Raison sociale */}
            <div className="space-y-2">
              <Label>Raison sociale *</Label>
              <Input
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                placeholder="Ex: anglais@marseille, WSE Rennes..."
              />
              <p style={{ fontSize: 11, color: "#8399a9" }}>Champ libre — peut être différent du nom de la société</p>
            </div>

            {/* Funding type */}
            <div className="space-y-2">
              <Label>Type de financement</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={formFundingType}
                onChange={(e) => setFormFundingType(e.target.value)}
              >
                <option value="">Aucun</option>
                {FUNDING_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>

            {/* Monthly fill shortcut */}
            <div style={{ padding: "12px 14px", background: "#f0f7ff", borderRadius: 10, border: "1px solid #dce8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1a6b9c", marginBottom: 8 }}>
                Remplir tous les mois (mensualisation)
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input
                  type="number"
                  placeholder="Montant mensuel"
                  value={formMonthlyFill}
                  onChange={(e) => setFormMonthlyFill(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button variant="outline" onClick={fillAllMonths} disabled={!formMonthlyFill} style={{ whiteSpace: "nowrap" }}>
                  Appliquer
                </Button>
              </div>
            </div>

            {/* Monthly grid */}
            <div className="space-y-1">
              <Label>Montants par mois</Label>
              <div style={{ border: "1px solid #e8ecf1", borderRadius: 8, overflow: "hidden" }}>
                {fiscalMonthsFull.map((m, i) => (
                  <div key={m.key} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                    borderBottom: i < 11 ? "1px solid #f0f4f8" : "none",
                    background: i % 2 === 0 ? "#fafcfd" : "white",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1a2a3a", width: 130, flexShrink: 0 }}>
                      {m.label}
                    </span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formMonths[m.key]?.amount ?? ""}
                      onChange={(e) => setFormMonths((prev) => ({
                        ...prev,
                        [m.key]: { ...prev[m.key], amount: e.target.value },
                      }))}
                      style={{ flex: 1, height: 32, fontSize: 12 }}
                    />
                    <select
                      className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      style={{ width: 110, flexShrink: 0 }}
                      value={formMonths[m.key]?.status ?? ""}
                      onChange={(e) => setFormMonths((prev) => ({
                        ...prev,
                        [m.key]: { ...prev[m.key], status: e.target.value },
                      }))}
                    >
                      <option value="">— Statut —</option>
                      <option value="encaisse">Encaissé</option>
                      <option value="facture">Facturé</option>
                      <option value="en_cours">En cours</option>
                      <option value="non_fait">Non fait</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || !formClientName.trim()} className="w-full" style={{ height: 42, marginTop: 8 }}>
              {saving ? "Enregistrement..." : editEntry ? "Mettre à jour" : "Ajouter le plan"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
