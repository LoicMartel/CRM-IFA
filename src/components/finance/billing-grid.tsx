"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentFiscalYearStart, getFiscalYearKey, getFiscalYearOptions } from "@/lib/fiscal-year";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search, Plus, Trash2, Receipt, CreditCard, Clock, AlertTriangle, X, Edit,
  ExternalLink, Upload, Download, FileText, ArrowUpDown, GripVertical, Send,
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
  notes: string | null;
}

interface BillingEntryData {
  id: string;
  company_id: string | null;
  deal_id: string | null;
  client_name: string;
  funding_type: string | null;
  fiscal_year: string;
  notes: string | null;
  display_order: number;
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
  planifie: { bg: "#e7e0ff", text: "#5b21b6", label: "Planifié" },
  a_valider: { bg: "#ffe8b3", text: "#92600a", label: "À valider" },
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
  const [fiscalYear, setFiscalYear] = useState(() => getFiscalYearKey(getCurrentFiscalYearStart()));
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<BillingEntryData | null>(null);

  // Cell popover state
  const [popoverCell, setPopoverCell] = useState<{ entryId: string; monthKey: string; monthId: string | null; notes: string; rect: DOMRect; dealId: string | null; status: BillingStatus | null; entryName: string } | null>(null);
  const [facturing, setFacturing] = useState(false);
  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ entryId: string; monthKey: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  // Detail popup state
  const [detailEntry, setDetailEntry] = useState<BillingEntryData | null>(null);
  const [detailDocs, setDetailDocs] = useState<{ id: string; name: string; file_path: string; file_size: number | null; document_type: string; created_at: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [formCompanyId, setFormCompanyId] = useState("");
  const [formDealId, setFormDealId] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formFundingType, setFormFundingType] = useState("");
  const [formMonthlyFill, setFormMonthlyFill] = useState("");
  const [formMonths, setFormMonths] = useState<Record<string, { amount: string; status: string }>>({});
  const [saving, setSaving] = useState(false);
  const [companySort, setCompanySort] = useState<"asc" | "desc" | null>(null);

  // Company edit panel state
  const [companyEditOpen, setCompanyEditOpen] = useState(false);
  const [companyEditId, setCompanyEditId] = useState<string | null>(null);
  const [companyEditName, setCompanyEditName] = useState("");
  const [companyEditEntries, setCompanyEditEntries] = useState<{
    id: string | null; client_name: string; funding_type: string; deal_id: string;
  }[]>([]);

  // Drag-and-drop state
  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

  // Group entries by company for display
  const groupedByCompany = useMemo(() => {
    const groups: { companyName: string; companyId: string | null; entries: BillingEntryData[]; displayOrder: number }[] = [];
    const map = new Map<string, BillingEntryData[]>();
    const order: string[] = [];
    for (const e of filtered) {
      const key = e.company_id ?? "__none__";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(e);
    }
    for (const key of order) {
      const entries = map.get(key)!;
      const companyName = entries[0].companies?.name ?? "Sans entreprise";
      const displayOrder = Math.min(...entries.map(e => e.display_order ?? 0));
      groups.push({ companyName, companyId: key === "__none__" ? null : key, entries, displayOrder });
    }
    if (companySort) {
      groups.sort((a, b) => {
        const ca = a.companyName.toLowerCase();
        const cb = b.companyName.toLowerCase();
        return companySort === "asc" ? ca.localeCompare(cb, "fr") : cb.localeCompare(ca, "fr");
      });
    } else {
      // Sort by display_order when no alphabetical sort is active
      groups.sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return groups;
  }, [filtered, companySort]);

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

  async function updateCellNotes(monthId: string, notes: string) {
    const supabase = createClient();
    await supabase.from("billing_months").update({ notes: notes || null, updated_at: new Date().toISOString() }).eq("id", monthId);
    router.refresh();
  }

  async function factureBillingMonth(monthId: string, dealId: string | null, entryName: string) {
    if (!dealId) {
      alert(`Impossible de facturer : aucun deal lié à "${entryName}". Modifier le plan pour le rattacher à un deal.`);
      return;
    }
    if (!confirm(`Créer une facture Pennylane pour cette échéance ?\n\nClient: ${entryName}\n\nCette action déclenche le workflow WF-005 qui génère et envoie la facture automatiquement.`)) return;
    setFacturing(true);
    try {
      const res = await fetch(`/api/billing-months/${monthId}/facturer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de la facturation");
      alert(`Facture en cours de génération côté Pennylane.\nLe statut passera en "Facturé" dans quelques secondes.`);
      setPopoverCell(null);
      setTimeout(() => router.refresh(), 3000);
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFacturing(false);
    }
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

  // ---- Detail popup ----

  async function openDetail(entry: BillingEntryData) {
    setDetailEntry(entry);
    setDetailDocs([]);
    setDetailLoading(true);
    const supabase = createClient();
    const { data: docs } = await supabase
      .from("billing_documents")
      .select("*")
      .eq("billing_entry_id", entry.id)
      .order("created_at", { ascending: false });
    setDetailDocs(docs ?? []);
    setDetailLoading(false);
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !detailEntry) return;
    setUploadingDoc(true);
    const supabase = createClient();
    const storagePath = `${detailEntry.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("billing-documents").upload(storagePath, file);
    if (!uploadError) {
      await supabase.from("billing_documents").insert({
        billing_entry_id: detailEntry.id,
        name: file.name,
        file_path: storagePath,
        file_size: file.size,
        file_type: file.type || file.name.split(".").pop() || null,
        document_type: "autre",
      });
      const { data: docs } = await supabase.from("billing_documents").select("*").eq("billing_entry_id", detailEntry.id).order("created_at", { ascending: false });
      setDetailDocs(docs ?? []);
    }
    setUploadingDoc(false);
    if (e.target) e.target.value = "";
  }

  async function handleDeleteDoc(docId: string, filePath: string) {
    if (!window.confirm("Supprimer ce document ?")) return;
    const supabase = createClient();
    await supabase.storage.from("billing-documents").remove([filePath]);
    await supabase.from("billing_documents").delete().eq("id", docId);
    setDetailDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  async function handleDownloadDoc(filePath: string) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("billing-documents").createSignedUrl(filePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
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

  // ---- Company edit panel ----

  function openCompanyEdit(companyId: string | null, companyName: string) {
    setCompanyEditId(companyId);
    setCompanyEditName(companyName);
    const companyEntries = filtered
      .filter(e => (e.company_id ?? "__none__") === (companyId ?? "__none__"))
      .map(e => ({
        id: e.id as string | null,
        client_name: e.client_name,
        funding_type: e.funding_type ?? "",
        deal_id: e.deal_id ?? "",
      }));
    setCompanyEditEntries(companyEntries);
    setCompanyEditOpen(true);
  }

  function addCompanyEditLine() {
    setCompanyEditEntries(prev => [...prev, { id: null, client_name: "", funding_type: "", deal_id: "" }]);
  }

  function removeCompanyEditLine(idx: number) {
    setCompanyEditEntries(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCompanyEditSave() {
    setSaving(true);
    const supabase = createClient();

    for (const line of companyEditEntries) {
      if (!line.client_name.trim()) continue;
      if (line.id) {
        // Update existing
        await supabase.from("billing_entries").update({
          client_name: line.client_name.trim(),
          funding_type: line.funding_type || null,
          deal_id: line.deal_id || null,
          updated_at: new Date().toISOString(),
        }).eq("id", line.id);
      } else {
        // Create new entry
        await supabase.from("billing_entries").insert({
          company_id: companyEditId,
          client_name: line.client_name.trim(),
          funding_type: line.funding_type || null,
          deal_id: line.deal_id || null,
          fiscal_year: fiscalYear,
        });
      }
    }

    // Delete removed entries
    const existingIds = filtered
      .filter(e => (e.company_id ?? "__none__") === (companyEditId ?? "__none__"))
      .map(e => e.id);
    const keptIds = companyEditEntries.filter(e => e.id).map(e => e.id!);
    const deletedIds = existingIds.filter(id => !keptIds.includes(id));
    for (const id of deletedIds) {
      await supabase.from("billing_entries").delete().eq("id", id);
    }

    setSaving(false);
    setCompanyEditOpen(false);
    router.refresh();
  }

  // ---- Drag-and-drop handlers ----

  async function handleDrop(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const supabase = createClient();
    // Recompute order for all groups
    const reordered = [...groupedByCompany];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Update display_order for all entries
    for (const [idx, group] of reordered.entries()) {
      for (const entry of group.entries) {
        await supabase.from("billing_entries").update({ display_order: idx }).eq("id", entry.id);
      }
    }
    setDragGroupIdx(null);
    setDragOverIdx(null);
    setCompanySort(null); // Reset alphabetical sort to show custom order
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
  const yearOptions = getFiscalYearOptions(4).map(o => o.value);

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
          { label: "Total HT", value: kpis.total / 1.2, icon: <Receipt className="h-4 w-4" />, color: "#1a2a3a" },
          { label: "Encaissé HT", value: kpis.encaisse / 1.2, icon: <CreditCard className="h-4 w-4" />, color: "#006100" },
          { label: "Facturé HT", value: kpis.facture / 1.2, icon: <Receipt className="h-4 w-4" />, color: "#9c0006" },
          { label: "En cours HT", value: kpis.en_cours / 1.2, icon: <Clock className="h-4 w-4" />, color: "#1f4e79" },
          { label: "Non fait HT", value: kpis.non_fait / 1.2, icon: <AlertTriangle className="h-4 w-4" />, color: "#888888" },
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
            <colgroup>
              {!isReadOnly && <col style={{ width: 28 }} />}
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 70 }} />
              {fiscalMonths.map((m) => (
                <col key={m.key} style={{ width: 75 }} />
              ))}
              <col style={{ width: 80 }} />
              {!isReadOnly && <col style={{ width: 40 }} />}
            </colgroup>
            <thead>
              <tr style={{ background: "#f8fafb", borderBottom: "2px solid #e8ecf1" }}>
                {!isReadOnly && (
                  <th style={{ position: "sticky", left: 0, zIndex: 10, background: "#f8fafb", padding: "4px 2px", width: 28, borderRight: "1px solid #e8ecf1" }}></th>
                )}
                <th
                  style={{ position: "sticky", left: isReadOnly ? 0 : 28, zIndex: 10, background: "#f8fafb", padding: "8px 6px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "#5a6a7a", borderRight: "1px solid #e8ecf1", cursor: "pointer" }}
                  onClick={() => setCompanySort(companySort === "asc" ? "desc" : companySort === "desc" ? null : "asc")}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>Entreprise <ArrowUpDown style={{ width: 10, height: 10 }} /></span>
                </th>
                <th style={{ position: "sticky", left: isReadOnly ? 130 : 158, zIndex: 10, background: "#f8fafb", padding: "8px 6px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "#5a6a7a", borderRight: "1px solid #e8ecf1" }}>
                  Raison sociale
                </th>
                <th style={{ position: "sticky", left: isReadOnly ? 230 : 258, zIndex: 10, background: "#f8fafb", padding: "8px 4px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "#5a6a7a", borderRight: "2px solid #dce8f0" }}>
                  Type
                </th>
                {fiscalMonths.map((m) => (
                  <th key={m.key} style={{ padding: "8px 3px", textAlign: "right", fontWeight: 700, fontSize: 10, color: "#5a6a7a", borderRight: "1px solid #f0f4f8" }}>
                    {m.label}
                  </th>
                ))}
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, fontSize: 10, color: "#1a2a3a", borderLeft: "2px solid #dce8f0" }}>
                  TOTAL
                </th>
                {!isReadOnly && (
                  <th style={{ padding: "8px 4px", width: 40 }}></th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={fiscalMonths.length + (isReadOnly ? 5 : 6)} style={{ padding: 40, textAlign: "center", color: "#8399a9" }}>
                    Aucune entrée de facturation
                  </td>
                </tr>
              ) : (
                groupedByCompany.map((group, groupIdx) =>
                  group.entries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: "1px solid #f0f4f8",
                        opacity: dragGroupIdx !== null && dragGroupIdx === groupIdx ? 0.5 : 1,
                        background: dragOverIdx === groupIdx && dragGroupIdx !== groupIdx ? "#e8f4ff" : undefined,
                      }}
                      className="hover:bg-[#fafcfd]"
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(groupIdx); }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={(e) => { e.preventDefault(); if (dragGroupIdx !== null) handleDrop(dragGroupIdx, groupIdx); }}
                    >
                      {/* Drag handle - rowSpan for group */}
                      {!isReadOnly && idx === 0 && (
                        <td className="billing-sticky-cell" rowSpan={group.entries.length} style={{
                          position: "sticky", left: 0, zIndex: 5,
                          padding: "2px", verticalAlign: "middle", textAlign: "center",
                          borderRight: "1px solid #e8ecf1", borderBottom: "2px solid #dce8f0",
                          cursor: "grab",
                        }}
                          draggable
                          onDragStart={() => { setDragGroupIdx(groupIdx); setCompanySort(null); }}
                          onDragEnd={() => { setDragGroupIdx(null); setDragOverIdx(null); }}
                        >
                          <GripVertical style={{ width: 14, height: 14, color: "#8399a9" }} />
                        </td>
                      )}

                      {/* Company name - sticky, rowSpan for group */}
                      {idx === 0 && (
                        <td className="billing-sticky-cell" rowSpan={group.entries.length} style={{
                          position: "sticky", left: isReadOnly ? 0 : 28, zIndex: 5,
                          padding: "6px 6px", fontWeight: 700, fontSize: 11, color: "#1a2a3a",
                          borderRight: "1px solid #e8ecf1", verticalAlign: "top",
                          borderBottom: "2px solid #dce8f0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={group.companyName}>
                          {group.companyId ? (
                            <span
                              onClick={() => openCompanyEdit(group.companyId, group.companyName)}
                              style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                            >
                              {group.companyName}
                            </span>
                          ) : (
                            <span
                              onClick={() => openCompanyEdit(null, group.companyName)}
                              style={{ color: "#8399a9", fontStyle: "italic", cursor: "pointer" }}
                            >
                              {group.companyName}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Client name - sticky */}
                      <td className="billing-sticky-cell" style={{
                        position: "sticky", left: isReadOnly ? 130 : 158, zIndex: 5,
                        padding: "6px 6px", fontWeight: 600, fontSize: 11, color: "#1a2a3a",
                        borderRight: "1px solid #e8ecf1", cursor: "pointer",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }} title={entry.client_name} onClick={() => openDetail(entry)}>
                        <span style={{ color: "#1a6b9c", textDecoration: "underline" }}>{entry.client_name}</span>
                      </td>

                      {/* Funding type - sticky */}
                      <td className="billing-sticky-cell" style={{
                        position: "sticky", left: isReadOnly ? 230 : 258, zIndex: 5,
                        padding: "6px 4px", fontSize: 10, color: "#5a6a7a", fontWeight: 600,
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
                              setPopoverCell({ entryId: entry.id, monthKey: mk.key, monthId: md.id, notes: md.notes ?? "", rect, dealId: entry.deal_id, status: md.status, entryName: entry.client_name });
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
                              <div style={{ padding: "4px 3px", fontSize: 10, fontWeight: md?.amount ? 500 : 400, position: "relative" }}>
                                {md?.amount ? fmt(md.amount) : ""}
                                {md?.notes && (
                                  <span title={md.notes} style={{
                                    position: "absolute", top: 1, right: 1,
                                    width: 5, height: 5, borderRadius: "50%",
                                    background: "#f59e0b",
                                  }} />
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row total */}
                      <td style={{
                        padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: 10,
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
                )
              )}

              {/* Totals row */}
              {filtered.length > 0 && (
                <tr style={{ borderTop: "2px solid #dce8f0", background: "#f8fafb" }}>
                  {!isReadOnly && (
                    <td className="billing-sticky-header" style={{ position: "sticky", left: 0, zIndex: 6, borderRight: "1px solid #e8ecf1" }}></td>
                  )}
                  <td className="billing-sticky-header" style={{
                    position: "sticky", left: isReadOnly ? 0 : 28, zIndex: 6,
                    padding: "8px 6px", fontWeight: 800, fontSize: 10, color: "#1a2a3a",
                    borderRight: "1px solid #e8ecf1",
                  }}>
                    TOTAUX
                  </td>
                  <td className="billing-sticky-header" style={{ position: "sticky", left: isReadOnly ? 130 : 158, zIndex: 6, borderRight: "1px solid #e8ecf1" }}></td>
                  <td className="billing-sticky-header" style={{ position: "sticky", left: isReadOnly ? 230 : 258, zIndex: 6, borderRight: "2px solid #dce8f0" }}></td>
                  {fiscalMonths.map((mk) => (
                    <td key={mk.key} style={{
                      padding: "8px 3px", textAlign: "right", fontWeight: 700, fontSize: 10,
                      color: "#1a2a3a", borderRight: "1px solid #f0f4f8",
                    }}>
                      {colTotals[mk.key] > 0 ? fmt(colTotals[mk.key]) : ""}
                    </td>
                  ))}
                  <td style={{
                    padding: "8px 6px", textAlign: "right", fontWeight: 800, fontSize: 11,
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
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 280,
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
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
          {popoverCell.monthId && popoverCell.dealId && (["non_fait", "en_cours", "planifie", "a_valider", null] as (BillingStatus | null)[]).includes(popoverCell.status) && (
            <button
              onClick={() => factureBillingMonth(popoverCell.monthId!, popoverCell.dealId, popoverCell.entryName)}
              disabled={facturing}
              style={{
                background: "#e8632b", color: "white", border: "none", cursor: facturing ? "wait" : "pointer",
                padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: facturing ? 0.6 : 1,
              }}
              title="Génère une facture Pennylane via WF-005 pour cette échéance"
            >
              <Send className="h-3 w-3" />
              {facturing ? "Facturation en cours…" : popoverCell.status === "a_valider" ? "Valider & facturer" : "Facturer cette échéance"}
            </button>
          )}
          {popoverCell.monthId && (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                type="text"
                placeholder="Note rapide..."
                defaultValue={popoverCell.notes}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateCellNotes(popoverCell.monthId!, (e.target as HTMLInputElement).value);
                    setPopoverCell(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, padding: "5px 8px", border: "1px solid #e8ecf1", borderRadius: 6,
                  fontSize: 11, outline: "none",
                }}
              />
              <button
                onClick={(e) => {
                  const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                  updateCellNotes(popoverCell.monthId!, input.value);
                  setPopoverCell(null);
                }}
                style={{
                  background: "#1a6b9c", color: "white", border: "none", cursor: "pointer",
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                }}
              >
                OK
              </button>
            </div>
          )}
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

      {/* Detail popup */}
      {detailEntry && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setDetailEntry(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "white", borderRadius: 14, width: "100%", maxWidth: 600,
            maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>{detailEntry.client_name}</h3>
                <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>
                  {detailEntry.companies?.name ?? "Sans entreprise"}{detailEntry.funding_type ? ` — ${detailEntry.funding_type}` : ""}
                </div>
              </div>
              <button onClick={() => setDetailEntry(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div style={{ padding: 20 }} className="space-y-5">
              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href="https://app2.visioformation.fr/formateur/login/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                    borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                    background: "#1a6b9c", color: "white", border: "none", cursor: "pointer",
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  VisioFormation
                </a>
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "#f0f7ff", color: "#1a6b9c", border: "1px solid #dce8f0",
                  cursor: uploadingDoc ? "wait" : "pointer", opacity: uploadingDoc ? 0.6 : 1,
                }}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingDoc ? "Envoi..." : "Importer un document"}
                  <input type="file" style={{ display: "none" }} disabled={uploadingDoc} onChange={handleUploadDoc} />
                </label>
                {!isReadOnly && (
                  <button onClick={() => { setDetailEntry(null); openEditForm(detailEntry); }} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: "white", color: "#5a6a7a", border: "1px solid #dce8f0", cursor: "pointer",
                  }}>
                    <Edit className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                )}
              </div>

              {/* KPIs récap */}
              {(() => {
                const months = detailEntry.billing_months;
                const total = months.reduce((s, m) => s + Number(m.amount), 0);
                const enc = months.filter(m => m.status === "encaisse").reduce((s, m) => s + Number(m.amount), 0);
                const fac = months.filter(m => m.status === "facture").reduce((s, m) => s + Number(m.amount), 0);
                const ec = months.filter(m => m.status === "en_cours").reduce((s, m) => s + Number(m.amount), 0);
                const nf = months.filter(m => m.status === "non_fait").reduce((s, m) => s + Number(m.amount), 0);
                return (
                  <div className="grid grid-cols-4 gap-2">
                    <div style={{ background: "#c6efce", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#006100" }}>ENCAISSÉ</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#006100" }}>{fmtCompact(enc)}</div>
                    </div>
                    <div style={{ background: "#ffc7ce", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9c0006" }}>FACTURÉ</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#9c0006" }}>{fmtCompact(fac)}</div>
                    </div>
                    <div style={{ background: "#bdd7ee", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#1f4e79" }}>EN COURS</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1f4e79" }}>{fmtCompact(ec)}</div>
                    </div>
                    <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>NON FAIT</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#888" }}>{fmtCompact(nf)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Monthly detail */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8399a9", marginBottom: 8 }}>
                  Détail par mois ({detailEntry.billing_months.length})
                </div>
                <div style={{ border: "1px solid #e8ecf1", borderRadius: 8, overflow: "hidden" }}>
                  {detailEntry.billing_months
                    .sort((a, b) => a.month.localeCompare(b.month))
                    .map((m, i) => {
                      const sc = m.status ? STATUS_COLORS[m.status] : null;
                      return (
                        <div key={m.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 14px", borderBottom: i < detailEntry.billing_months.length - 1 ? "1px solid #f0f4f8" : "none",
                          background: i % 2 === 0 ? "#fafcfd" : "white",
                        }}>
                          <span style={{ fontSize: 13, color: "#1a2a3a", fontWeight: 500, textTransform: "capitalize" }}>
                            {new Date(m.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>{fmt(m.amount)}</span>
                            {sc && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                                background: sc.bg, color: sc.text,
                              }}>
                                {sc.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Documents */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8399a9", marginBottom: 8 }}>
                  Documents ({detailDocs.length})
                </div>
                {detailLoading ? (
                  <div style={{ fontSize: 12, color: "#8399a9", padding: 12 }}>Chargement...</div>
                ) : detailDocs.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic", padding: 12, background: "#f5f7fa", borderRadius: 8 }}>
                    Aucun document importé
                  </div>
                ) : (
                  <div style={{ border: "1px solid #e8ecf1", borderRadius: 8, overflow: "hidden" }}>
                    {detailDocs.map((doc, i) => (
                      <div key={doc.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                        borderBottom: i < detailDocs.length - 1 ? "1px solid #f0f4f8" : "none",
                        background: i % 2 === 0 ? "#fafcfd" : "white",
                      }}>
                        <FileText className="h-4 w-4" style={{ color: "#1a6b9c", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                          <div style={{ fontSize: 10, color: "#8399a9" }}>
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} Ko` : ""} — {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                        <button onClick={() => handleDownloadDoc(doc.file_path)} style={{
                          background: "#f0f7ff", border: "none", cursor: "pointer", color: "#1a6b9c",
                          padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center",
                        }} title="Télécharger">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {!isReadOnly && (
                          <button onClick={() => handleDeleteDoc(doc.id, doc.file_path)} style={{
                            background: "#fff5f5", border: "none", cursor: "pointer", color: "#e74c3c",
                            padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center",
                          }} title="Supprimer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company edit panel */}
      <Sheet open={companyEditOpen} onOpenChange={(open) => { setCompanyEditOpen(open); }}>
        <SheetContent style={{ width: 560, maxWidth: "95vw", overflowY: "auto" }}>
          <SheetHeader>
            <SheetTitle>Modifier le plan — {companyEditName}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            <div style={{ fontSize: 12, color: "#8399a9" }}>
              Modifiez les raisons sociales existantes ou ajoutez-en de nouvelles pour cette entreprise.
            </div>

            {companyEditEntries.map((line, idx) => (
              <div key={idx} style={{
                border: "1px solid #e8ecf1", borderRadius: 10, padding: 14,
                background: idx % 2 === 0 ? "#fafcfd" : "white",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8399a9", textTransform: "uppercase" }}>
                    {line.id ? `Ligne existante` : "Nouvelle ligne"}
                  </span>
                  <button
                    onClick={() => {
                      if (line.id) {
                        if (!window.confirm("Supprimer cette raison sociale et toutes ses données de facturation ?")) return;
                      }
                      removeCompanyEditLine(idx);
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}
                    title="Supprimer cette ligne"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label style={{ fontSize: 12 }}>Raison sociale *</Label>
                    <Input
                      value={line.client_name}
                      onChange={(e) => setCompanyEditEntries(prev => prev.map((l, i) => i === idx ? { ...l, client_name: e.target.value } : l))}
                      placeholder="Ex: anglais@marseille, WSE Rennes..."
                      style={{ height: 34, fontSize: 13 }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label style={{ fontSize: 12 }}>Type de financement</Label>
                      <select
                        className="flex h-[34px] w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={line.funding_type}
                        onChange={(e) => setCompanyEditEntries(prev => prev.map((l, i) => i === idx ? { ...l, funding_type: e.target.value } : l))}
                      >
                        <option value="">Aucun</option>
                        {FUNDING_TYPES.map((ft) => (
                          <option key={ft} value={ft}>{ft}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label style={{ fontSize: 12 }}>Deal associé</Label>
                      <select
                        className="flex h-[34px] w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={line.deal_id}
                        onChange={(e) => setCompanyEditEntries(prev => prev.map((l, i) => i === idx ? { ...l, deal_id: e.target.value } : l))}
                      >
                        <option value="">Aucun</option>
                        {(companyEditId
                          ? deals.filter(d => d.company_id === companyEditId)
                          : deals
                        ).map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addCompanyEditLine} className="w-full" style={{ borderStyle: "dashed", gap: 8 }}>
              <Plus className="h-4 w-4" />
              Ajouter une raison sociale
            </Button>

            <Button
              onClick={handleCompanyEditSave}
              disabled={saving || companyEditEntries.every(l => !l.client_name.trim())}
              className="w-full"
              style={{ height: 42, marginTop: 8 }}
            >
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
