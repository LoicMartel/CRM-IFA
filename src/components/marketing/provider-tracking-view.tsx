"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, TrendingUp, DollarSign, Users, Target, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";

interface Provider {
  id: string;
  name: string;
}

interface WeeklyStat {
  id: string;
  provider_id: string;
  period_start: string;
  period_end: string;
  expenses: number;
  page_visits: number;
  leads: number;
  r0_booked: number;
  r0_done: number;
  r1_booked: number;
  r1_done: number;
  rdv_booked_inbound: number;
  rdv_done_inbound: number;
  sales: number;
  revenue: number;
  comment: string | null;
  marketing_providers: { name: string } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " \u20ac";
}

function fmtPct(n: number) {
  if (!isFinite(n)) return "—";
  return (n * 100).toFixed(1) + " %";
}

function fmtNum(n: number) {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

// Computed metrics
function computeMetrics(s: WeeklyStat) {
  const totalRdvBooked = s.r0_booked + s.r1_booked + s.rdv_booked_inbound;
  const totalRdvDone = s.r0_done + s.r1_done + s.rdv_done_inbound;
  return {
    txConversion: s.page_visits > 0 ? s.leads / s.page_visits : 0,
    cpl: s.leads > 0 ? s.expenses / s.leads : 0,
    totalRdvBooked,
    totalRdvDone,
    cprdvBooked: totalRdvBooked > 0 ? s.expenses / totalRdvBooked : 0,
    cprdvDone: totalRdvDone > 0 ? s.expenses / totalRdvDone : 0,
    txPriseRdv: s.leads > 0 ? totalRdvBooked / s.leads : 0,
    panierMoyen: s.sales > 0 ? s.revenue / s.sales : 0,
    cpv: s.sales > 0 ? s.expenses / s.sales : 0,
    margeBrute: s.revenue - s.expenses,
    roas: s.expenses > 0 ? s.revenue / s.expenses : 0,
  };
}

function formatWeek(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const f = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${f(s)} au ${f(e)}/${e.getFullYear().toString().slice(2)}`;
}

// Get Monday of current week
function getCurrentMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function getSundayFromMonday(monday: string) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

const emptyForm = {
  provider_id: "",
  period_start: getCurrentMonday(),
  expenses: "",
  page_visits: "",
  leads: "",
  r0_booked: "",
  r0_done: "",
  r1_booked: "",
  r1_done: "",
  rdv_booked_inbound: "",
  rdv_done_inbound: "",
  sales: "",
  revenue: "",
  comment: "",
};

export function ProviderTrackingView({
  providers,
  stats,
}: {
  providers: Provider[];
  stats: WeeklyStat[];
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const [activeTab, setActiveTab] = useState("global");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const commentVoice = useVoiceDictation(() => form.comment, (t) => setForm((f) => ({ ...f, comment: t })));

  // Filter period
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom">("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filteredByTab = activeTab === "global"
    ? stats
    : stats.filter((s) => s.provider_id === activeTab);

  const filtered = filteredByTab.filter((s) => {
    if (periodMode === "month") {
      return s.period_start.startsWith(filterMonth);
    }
    if (periodMode === "custom" && customFrom && customTo) {
      return s.period_start >= customFrom && s.period_end <= customTo;
    }
    return true;
  });

  // KPIs
  const totalExpenses = filtered.reduce((a, s) => a + Number(s.expenses), 0);
  const totalLeads = filtered.reduce((a, s) => a + s.leads, 0);
  const totalSales = filtered.reduce((a, s) => a + s.sales, 0);
  const totalRevenue = filtered.reduce((a, s) => a + Number(s.revenue), 0);
  const avgCpl = totalLeads > 0 ? totalExpenses / totalLeads : 0;
  const globalRoas = totalExpenses > 0 ? totalRevenue / totalExpenses : 0;

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      provider_id: activeTab !== "global" ? activeTab : providers[0]?.id ?? "",
    });
    setOpen(true);
  }

  function openEdit(s: WeeklyStat) {
    setEditingId(s.id);
    setForm({
      provider_id: s.provider_id,
      period_start: s.period_start,
      expenses: String(s.expenses),
      page_visits: String(s.page_visits),
      leads: String(s.leads),
      r0_booked: String(s.r0_booked),
      r0_done: String(s.r0_done),
      r1_booked: String(s.r1_booked),
      r1_done: String(s.r1_done),
      rdv_booked_inbound: String(s.rdv_booked_inbound),
      rdv_done_inbound: String(s.rdv_done_inbound),
      sales: String(s.sales),
      revenue: String(s.revenue),
      comment: s.comment ?? "",
    });
    setOpen(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer cette ligne ?")) return;
    const supabase = createClient();
    await supabase.from("marketing_weekly_stats").delete().eq("id", id);
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const periodEnd = getSundayFromMonday(form.period_start);
    const payload = {
      provider_id: form.provider_id,
      period_start: form.period_start,
      period_end: periodEnd,
      expenses: parseFloat(form.expenses) || 0,
      page_visits: parseInt(form.page_visits) || 0,
      leads: parseInt(form.leads) || 0,
      r0_booked: parseInt(form.r0_booked) || 0,
      r0_done: parseInt(form.r0_done) || 0,
      r1_booked: parseInt(form.r1_booked) || 0,
      r1_done: parseInt(form.r1_done) || 0,
      rdv_booked_inbound: parseInt(form.rdv_booked_inbound) || 0,
      rdv_done_inbound: parseInt(form.rdv_done_inbound) || 0,
      sales: parseInt(form.sales) || 0,
      revenue: parseFloat(form.revenue) || 0,
      comment: form.comment || null,
      created_by: currentMemberId || null,
    };

    if (editingId) {
      await supabase.from("marketing_weekly_stats").update(payload).eq("id", editingId);
    } else {
      await supabase.from("marketing_weekly_stats").insert(payload);
    }
    setSaving(false);
    setOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    router.refresh();
  }

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => setActiveTab("global")}
          style={{
            height: 36, borderRadius: 8, padding: "0 20px", fontSize: 14,
            fontWeight: activeTab === "global" ? 700 : 500,
            border: `1px solid ${activeTab === "global" ? "#1a6b9c" : "#dce8f0"}`,
            background: activeTab === "global" ? "#1a6b9c" : "white",
            color: activeTab === "global" ? "white" : "#5a6f80",
            cursor: "pointer",
          }}
        >
          Global
        </button>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveTab(p.id)}
            style={{
              height: 36, borderRadius: 8, padding: "0 20px", fontSize: 14,
              fontWeight: activeTab === p.id ? 700 : 500,
              border: `1px solid ${activeTab === p.id ? "#1a6b9c" : "#dce8f0"}`,
              background: activeTab === p.id ? "#1a6b9c" : "white",
              color: activeTab === p.id ? "white" : "#5a6f80",
              cursor: "pointer",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Dépenses</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e74c3c" }}>{fmt(totalExpenses)}</div>
          </div>
          <DollarSign style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Leads</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalLeads}</div>
          </div>
          <Users style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CPL moyen</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{avgCpl > 0 ? fmt(avgCpl) : "—"}</div>
          </div>
          <Target style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Ventes</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{totalSales}</div>
          </div>
          <TrendingUp style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CA généré</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalRevenue)}</div>
          </div>
          <DollarSign style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>ROAS</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: globalRoas >= 1 ? "#27ae60" : "#e74c3c" }}>{globalRoas > 0 ? fmtNum(globalRoas) : "—"}</div>
          </div>
          <TrendingUp style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as "all" | "month" | "custom")}
          >
            <option value="all">Toutes les périodes</option>
            <option value="month">Par mois</option>
            <option value="custom">Personnalisé</option>
          </select>
          {periodMode === "month" && (
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40 h-9" />
          )}
          {periodMode === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-9 text-xs" />
              <span style={{ color: "#8399a9" }}>au</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-9 text-xs" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={(f: ExportFormat) => exportData(
            filtered.map((s) => {
              const m = computeMetrics(s);
              return {
                periode: formatWeek(s.period_start, s.period_end),
                prestataire: s.marketing_providers?.name ?? "",
                depenses: s.expenses, visites: s.page_visits, leads: s.leads,
                tx_conversion: (m.txConversion * 100).toFixed(1) + "%",
                cpl: m.cpl.toFixed(2),
                r0_pris: s.r0_booked, r0_faits: s.r0_done,
                r1_pris: s.r1_booked, r1_faits: s.r1_done,
                rdv_inbound_pris: s.rdv_booked_inbound, rdv_inbound_faits: s.rdv_done_inbound,
                ventes: s.sales, ca: s.revenue,
                roas: m.roas.toFixed(2), marge: m.margeBrute.toFixed(2),
                commentaire: s.comment ?? "",
              };
            }),
            [
              { key: "periode", label: "Période" }, { key: "prestataire", label: "Prestataire" },
              { key: "depenses", label: "Dépenses" }, { key: "visites", label: "Visites" },
              { key: "leads", label: "Leads" }, { key: "tx_conversion", label: "Tx Conversion" },
              { key: "cpl", label: "CPL" }, { key: "r0_pris", label: "R0 Pris" },
              { key: "r0_faits", label: "R0 Faits" }, { key: "r1_pris", label: "R1 Pris" },
              { key: "r1_faits", label: "R1 Faits" }, { key: "rdv_inbound_pris", label: "Total RDV pris" },
              { key: "rdv_inbound_faits", label: "Total RDV faits" }, { key: "ventes", label: "Ventes" },
              { key: "ca", label: "CA" }, { key: "roas", label: "ROAS" },
              { key: "marge", label: "Marge" }, { key: "commentaire", label: "Commentaire" },
            ],
            "suivi-prestataires", f
          )} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle semaine
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border" style={{ overflowX: "auto" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ whiteSpace: "nowrap", minWidth: 130 }}>Période</TableHead>
              {activeTab === "global" && <TableHead>Prestataire</TableHead>}
              <TableHead style={{ textAlign: "right" }}>Dépenses</TableHead>
              <TableHead style={{ textAlign: "right" }}>Visites</TableHead>
              <TableHead style={{ textAlign: "right" }}>Leads</TableHead>
              <TableHead style={{ textAlign: "right" }}>Tx Conv.</TableHead>
              <TableHead style={{ textAlign: "right" }}>CPL</TableHead>
              <TableHead style={{ textAlign: "right" }}>R0 Pris</TableHead>
              <TableHead style={{ textAlign: "right" }}>R0 Faits</TableHead>
              <TableHead style={{ textAlign: "right" }}>R1 Pris</TableHead>
              <TableHead style={{ textAlign: "right" }}>R1 Faits</TableHead>
              <TableHead style={{ textAlign: "right" }}>Total RDV pris</TableHead>
              <TableHead style={{ textAlign: "right" }}>Total RDV faits</TableHead>
              <TableHead style={{ textAlign: "right" }}>CPRDV Pris</TableHead>
              <TableHead style={{ textAlign: "right" }}>CPRDV Fait</TableHead>
              <TableHead style={{ textAlign: "right" }}>Tx Prise RDV</TableHead>
              <TableHead style={{ textAlign: "right" }}>Ventes</TableHead>
              <TableHead style={{ textAlign: "right" }}>CA</TableHead>
              <TableHead style={{ textAlign: "right" }}>Panier moy.</TableHead>
              <TableHead style={{ textAlign: "right" }}>CPV</TableHead>
              <TableHead style={{ textAlign: "right" }}>Marge</TableHead>
              <TableHead style={{ textAlign: "right" }}>ROAS</TableHead>
              <TableHead style={{ minWidth: 150 }}>Commentaire</TableHead>
              <TableHead style={{ width: 70 }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={activeTab === "global" ? 24 : 23} className="text-center text-muted-foreground py-8">
                  Aucune donnée pour cette période
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const m = computeMetrics(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell style={{ whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>{formatWeek(s.period_start, s.period_end)}</TableCell>
                    {activeTab === "global" && (
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#e3f2fd", color: "#1565c0" }}>
                          {s.marketing_providers?.name ?? "—"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell style={{ textAlign: "right", fontWeight: 600 }}>{fmt(Number(s.expenses))}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.page_visits}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: "#1a6b9c" }}>{s.leads}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{fmtPct(m.txConversion)}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.leads > 0 ? fmt(m.cpl) : "—"}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.r0_booked}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.r0_done}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.r1_booked}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.r1_done}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.rdv_booked_inbound}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.rdv_done_inbound}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{m.totalRdvBooked > 0 ? fmt(m.cprdvBooked) : "—"}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{m.totalRdvDone > 0 ? fmt(m.cprdvDone) : "—"}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{fmtPct(m.txPriseRdv)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: "#27ae60" }}>{s.sales}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: "#27ae60" }}>{fmt(Number(s.revenue))}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.sales > 0 ? fmt(m.panierMoyen) : "—"}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.sales > 0 ? fmt(m.cpv) : "—"}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: m.margeBrute >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(m.margeBrute)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, color: m.roas >= 1 ? "#27ae60" : "#e74c3c" }}>{m.roas > 0 ? fmtNum(m.roas) : "—"}</TableCell>
                    <TableCell style={{ fontSize: 12, color: "#5a6f80", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.comment ?? ""}>
                      {s.comment ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEdit(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>

          {/* Totals row */}
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fbfd", fontWeight: 700, fontSize: 13 }}>
                <td style={{ padding: "8px 16px" }}>TOTAL</td>
                {activeTab === "global" && <td></td>}
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{fmt(totalExpenses)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.page_visits, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px", color: "#1a6b9c" }}>{totalLeads}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>
                  {fmtPct(filtered.reduce((a, s) => a + s.page_visits, 0) > 0 ? totalLeads / filtered.reduce((a, s) => a + s.page_visits, 0) : 0)}
                </td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{totalLeads > 0 ? fmt(totalExpenses / totalLeads) : "—"}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.r0_booked, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.r0_done, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.r1_booked, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.r1_done, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.rdv_booked_inbound, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{filtered.reduce((a, s) => a + s.rdv_done_inbound, 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{(() => { const totalRdvB = filtered.reduce((a, s) => a + s.rdv_booked_inbound, 0); return totalRdvB > 0 ? fmt(totalExpenses / totalRdvB) : "—"; })()}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{(() => { const totalRdvD = filtered.reduce((a, s) => a + s.rdv_done_inbound, 0); return totalRdvD > 0 ? fmt(totalExpenses / totalRdvD) : "—"; })()}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{fmtPct(totalLeads > 0 ? filtered.reduce((a, s) => a + s.rdv_booked_inbound, 0) / totalLeads : 0)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px", color: "#27ae60" }}>{totalSales}</td>
                <td style={{ textAlign: "right", padding: "8px 16px", color: "#27ae60" }}>{fmt(totalRevenue)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{totalSales > 0 ? fmt(totalRevenue / totalSales) : "—"}</td>
                <td style={{ textAlign: "right", padding: "8px 16px" }}>{totalSales > 0 ? fmt(totalExpenses / totalSales) : "—"}</td>
                <td style={{ textAlign: "right", padding: "8px 16px", color: totalRevenue - totalExpenses >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(totalRevenue - totalExpenses)}</td>
                <td style={{ textAlign: "right", padding: "8px 16px", color: globalRoas >= 1 ? "#27ae60" : "#e74c3c" }}>{globalRoas > 0 ? fmtNum(globalRoas) : "—"}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      {/* Sheet form */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingId ? "Modifier la semaine" : "Nouvelle semaine"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {/* Provider */}
            <div className="space-y-2">
              <Label>Prestataire *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.provider_id}
                onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <Label>Semaine du (lundi) *</Label>
              <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
              {form.period_start && (
                <p style={{ fontSize: 11, color: "#8399a9" }}>
                  Semaine du {formatWeek(form.period_start, getSundayFromMonday(form.period_start))}
                </p>
              )}
            </div>

            {/* Acquisition */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginTop: 16 }}>
              Acquisition
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dépenses (EUR)</Label>
                <Input type="number" step="0.01" value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Visites de page</Label>
                <Input type="number" value={form.page_visits} onChange={(e) => setForm({ ...form, page_visits: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Leads</Label>
              <Input type="number" value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })} placeholder="0" />
            </div>

            {/* RDV */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginTop: 16 }}>
              Rendez-vous
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>R0 pris directs</Label>
                <Input type="number" value={form.r0_booked} onChange={(e) => setForm({ ...form, r0_booked: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>R0 faits directs</Label>
                <Input type="number" value={form.r0_done} onChange={(e) => setForm({ ...form, r0_done: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>R1 pris setting</Label>
                <Input type="number" value={form.r1_booked} onChange={(e) => setForm({ ...form, r1_booked: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>R1 faits setting</Label>
                <Input type="number" value={form.r1_done} onChange={(e) => setForm({ ...form, r1_done: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total RDV pris</Label>
                <Input type="number" value={form.rdv_booked_inbound} onChange={(e) => setForm({ ...form, rdv_booked_inbound: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Total RDV faits</Label>
                <Input type="number" value={form.rdv_done_inbound} onChange={(e) => setForm({ ...form, rdv_done_inbound: e.target.value })} placeholder="0" />
              </div>
            </div>

            {/* Ventes */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginTop: 16 }}>
              Ventes
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ventes</Label>
                <Input type="number" value={form.sales} onChange={(e) => setForm({ ...form, sales: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>CA généré (EUR)</Label>
                <Input type="number" step="0.01" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} placeholder="0" />
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label>Commentaire</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Observations, contexte..."
              />
              <VoiceButton isRecording={commentVoice.isRecording} isFormatting={commentVoice.isFormatting} onClick={commentVoice.toggleRecording} tone={commentVoice.tone} onToneChange={commentVoice.setTone} />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !form.provider_id || !form.period_start}
              className="w-full"
            >
              {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
