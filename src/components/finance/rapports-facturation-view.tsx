"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getCurrentFiscalYearStart, getFiscalYearKey, getFiscalYearOptions, type FiscalMode } from "@/lib/fiscal-year";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, CreditCard, Clock, AlertTriangle, Building2, ArrowUpDown } from "lucide-react";

/* ---- Types ---- */

interface BillingMonthData {
  id: string;
  month: string;
  amount: number;
  status: string | null;
}

interface BillingEntryData {
  id: string;
  company_id: string | null;
  client_name: string;
  funding_type: string | null;
  fiscal_year: string;
  notes: string | null;
  billing_months: BillingMonthData[];
  companies: { id: string; name: string } | null;
}

interface CompanyRef { id: string; name: string; }

/* ---- Helpers ---- */

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const PIE_COLORS = ["#1E2A5A", "#E8732A", "#2ecc71", "#8e44ad", "#e74c3c", "#f39c12", "#1abc9c", "#8399a9", "#3498db", "#d35400"];

// Ordre = cycle de vie de l'échéance (cf. BillingStatus dans database.ts).
const STATUS_META: Record<string, { label: string; bg: string; text: string; barColor: string }> = {
  a_valider: { label: "À valider", bg: "#ffe8b3", text: "#92600a", barColor: "#f59e0b" },
  planifie: { label: "Planifié", bg: "#e7e0ff", text: "#5b21b6", barColor: "#8b5cf6" },
  a_facturer: { label: "À facturer", bg: "#bdd7ee", text: "#1f4e79", barColor: "#3498db" },
  facture: { label: "Facturé", bg: "#ffc7ce", text: "#9c0006", barColor: "#e74c3c" },
  encaisse: { label: "Encaissé", bg: "#c6efce", text: "#006100", barColor: "#27ae60" },
  non_fait: { label: "Non fait", bg: "#f5f5f5", text: "#888888", barColor: "#bdc3c7" },
};

const MONTH_LABELS: Record<number, string> = {
  0: "janv", 1: "févr", 2: "mars", 3: "avr", 4: "mai", 5: "juin",
  6: "juil", 7: "août", 8: "sept", 9: "oct", 10: "nov", 11: "déc",
};

function getFiscalMonths(fy: string, mode: FiscalMode = "sep-aug"): string[] {
  const [startYear] = fy.split("-").map(Number);
  const months: string[] = [];
  if (mode === "jan-dec") {
    for (let m = 0; m < 12; m++) months.push(`${startYear}-${String(m + 1).padStart(2, "0")}-01`);
  } else {
    for (let m = 8; m < 12; m++) months.push(`${startYear}-${String(m + 1).padStart(2, "0")}-01`);
    for (let m = 0; m < 8; m++) months.push(`${startYear + 1}-${String(m + 1).padStart(2, "0")}-01`);
  }
  return months;
}

function monthLabel(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM yy", { locale: fr });
  } catch {
    return dateStr.slice(0, 7);
  }
}

/* ---- Component ---- */

export function RapportsFacturationView({ entries, companies, fiscalMode = "sep-aug" }: {
  entries: BillingEntryData[];
  companies: CompanyRef[];
  fiscalMode?: FiscalMode;
}) {
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState("global");
  const [fiscalYear, setFiscalYear] = useState(() => getFiscalYearKey(getCurrentFiscalYearStart(fiscalMode), fiscalMode));
  const [companySortGlobal, setCompanySortGlobal] = useState<"asc" | "desc" | null>(null);
  const [companySortStatus, setCompanySortStatus] = useState<"asc" | "desc" | null>(null);
  const [nameSortGlobal, setNameSortGlobal] = useState<"asc" | "desc" | null>(null);
  const [nameSortStatus, setNameSortStatus] = useState<"asc" | "desc" | null>(null);

  const yearOptions = getFiscalYearOptions(4, fiscalMode).map(o => o.value);
  const fiscalMonths = useMemo(() => getFiscalMonths(fiscalYear, fiscalMode), [fiscalYear, fiscalMode]);

  // Filter entries by fiscal year
  const filtered = useMemo(() =>
    entries.filter((e) => e.fiscal_year === fiscalYear),
  [entries, fiscalYear]);

  // All billing months for the fiscal year
  const allMonths = useMemo(() =>
    filtered.flatMap((e) => e.billing_months.map((m) => ({ ...m, entry: e }))),
  [filtered]);

  // Global KPIs (HT = montant / 1.2)
  const kpis = useMemo(() => {
    const total = allMonths.reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const a_valider = allMonths.filter((m) => m.status === "a_valider").reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const planifie = allMonths.filter((m) => m.status === "planifie").reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const a_facturer = allMonths.filter((m) => m.status === "a_facturer").reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const facture = allMonths.filter((m) => m.status === "facture").reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const encaisse = allMonths.filter((m) => m.status === "encaisse").reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const non_fait = allMonths.filter((m) => m.status === "non_fait").reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    return { total, a_valider, planifie, a_facturer, facture, encaisse, non_fait };
  }, [allMonths]);

  // ====== GLOBAL REPORT ======
  function renderGlobal() {
    // By month stacked data
    const byMonthStatus: Record<string, Record<string, number>> = {};
    for (const mk of fiscalMonths) byMonthStatus[mk] = { a_valider: 0, planifie: 0, a_facturer: 0, facture: 0, encaisse: 0, non_fait: 0 };
    for (const m of allMonths) {
      if (byMonthStatus[m.month] && m.status) {
        byMonthStatus[m.month][m.status] += Number(m.amount) / 1.2;
      }
    }
    const stackedData = fiscalMonths.map((mk) => ({
      month: monthLabel(mk),
      ...byMonthStatus[mk],
    }));

    // By funding type
    const byFunding: Record<string, number> = {};
    for (const m of allMonths) {
      const ft = m.entry.funding_type || "Non défini";
      byFunding[ft] = (byFunding[ft] || 0) + Number(m.amount) / 1.2;
    }
    const fundingData = Object.entries(byFunding)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    // By client (top 15)
    const byClient: Record<string, { name: string; amount: number; company: string | null }> = {};
    for (const e of filtered) {
      const total = e.billing_months.reduce((s, m) => s + Number(m.amount) / 1.2, 0);
      byClient[e.id] = { name: e.client_name, amount: total, company: e.companies?.name ?? null };
    }
    const clientDataRaw = Object.values(byClient).sort((a, b) => b.amount - a.amount).slice(0, 15);
    const clientData = companySortGlobal
      ? [...clientDataRaw].sort((a, b) => {
          const ca = (a.company ?? "").toLowerCase();
          const cb = (b.company ?? "").toLowerCase();
          return companySortGlobal === "asc" ? ca.localeCompare(cb, "fr") : cb.localeCompare(ca, "fr");
        })
      : nameSortGlobal
      ? [...clientDataRaw].sort((a, b) => {
          const na = a.name.toLowerCase();
          const nb = b.name.toLowerCase();
          return nameSortGlobal === "asc" ? na.localeCompare(nb, "fr") : nb.localeCompare(na, "fr");
        })
      : clientDataRaw;

    // By status (pie)
    const statusPieData = [
      { name: "À valider", value: kpis.a_valider, fill: "#f59e0b" },
      { name: "Planifié", value: kpis.planifie, fill: "#8b5cf6" },
      { name: "À facturer", value: kpis.a_facturer, fill: "#3498db" },
      { name: "Facturé", value: kpis.facture, fill: "#e74c3c" },
      { name: "Encaissé", value: kpis.encaisse, fill: "#27ae60" },
      { name: "Non fait", value: kpis.non_fait, fill: "#bdc3c7" },
    ].filter(d => d.value > 0);

    return (
      <>
        {/* Stacked bar chart */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>CA par mois et statut</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stackedData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="a_valider" name="À valider" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="planifie" name="Planifié" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="a_facturer" name="À facturer" stackId="a" fill="#3498db" />
                <Bar dataKey="facture" name="Facturé" stackId="a" fill="#e74c3c" />
                <Bar dataKey="encaisse" name="Encaissé" stackId="a" fill="#27ae60" />
                <Bar dataKey="non_fait" name="Non fait" stackId="a" fill="#bdc3c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Pie by funding type */}
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par financement</h3>
              {fundingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={fundingData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}
                    >
                      {fundingData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>

          {/* Pie by status */}
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par statut</h3>
              {kpis.total > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}
                    >
                      {statusPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Top clients */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Top 15 clients</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>#</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, cursor: "pointer" }} onClick={() => { setNameSortGlobal(nameSortGlobal === "asc" ? "desc" : nameSortGlobal === "desc" ? null : "asc"); setCompanySortGlobal(null); }}>
                    <span className="inline-flex items-center gap-1">Raison sociale <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, cursor: "pointer" }} onClick={() => { setCompanySortGlobal(companySortGlobal === "asc" ? "desc" : companySortGlobal === "desc" ? null : "asc"); setNameSortGlobal(null); }}>
                    <span className="inline-flex items-center gap-1">Société <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "right" }}>Montant total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientData.map((c, i) => (
                  <TableRow key={i} className="hover:bg-[#f0f7fb]">
                    <TableCell style={{ fontSize: 13, fontWeight: 700, color: "#8399a9" }}>{i + 1}</TableCell>
                    <TableCell style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{c.name}</TableCell>
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{c.company ?? "—"}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>{fmt(c.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  // ====== STATUS-SPECIFIC REPORT ======
  function renderStatusReport(status: string) {
    const meta = STATUS_META[status];
    const statusMonths = allMonths.filter((m) => m.status === status);
    const totalAmount = statusMonths.reduce((s, m) => s + Number(m.amount) / 1.2, 0);
    const uniqueClients = new Set(statusMonths.map((m) => m.entry.id)).size;

    // By month
    const byMonth: Record<string, number> = {};
    for (const mk of fiscalMonths) byMonth[mk] = 0;
    for (const m of statusMonths) {
      if (byMonth[m.month] !== undefined) byMonth[m.month] += Number(m.amount) / 1.2;
    }
    const monthData = fiscalMonths
      .filter((mk) => byMonth[mk] > 0)
      .map((mk) => ({ month: monthLabel(mk), montant: byMonth[mk] }));

    // By client
    const byClient: Record<string, { name: string; company: string | null; fundingType: string | null; amount: number; count: number }> = {};
    for (const m of statusMonths) {
      const key = m.entry.id;
      if (!byClient[key]) byClient[key] = {
        name: m.entry.client_name,
        company: m.entry.companies?.name ?? null,
        fundingType: m.entry.funding_type,
        amount: 0,
        count: 0,
      };
      byClient[key].amount += Number(m.amount) / 1.2;
      byClient[key].count += 1;
    }
    const clientDataRaw = Object.values(byClient).sort((a, b) => b.amount - a.amount);
    const clientData = companySortStatus
      ? [...clientDataRaw].sort((a, b) => {
          const ca = (a.company ?? "").toLowerCase();
          const cb = (b.company ?? "").toLowerCase();
          return companySortStatus === "asc" ? ca.localeCompare(cb, "fr") : cb.localeCompare(ca, "fr");
        })
      : nameSortStatus
      ? [...clientDataRaw].sort((a, b) => {
          const na = a.name.toLowerCase();
          const nb = b.name.toLowerCase();
          return nameSortStatus === "asc" ? na.localeCompare(nb, "fr") : nb.localeCompare(na, "fr");
        })
      : clientDataRaw;

    // Pie by client
    const pieData = clientData.slice(0, 8).map((c) => ({ name: c.name, value: c.amount }));

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total {meta.label.toLowerCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: meta.text }}>{fmt(totalAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Cellules</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{statusMonths.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients concernés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1E2A5A" }}>{uniqueClients}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>% du total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#E8732A" }}>
              {kpis.total > 0 ? `${Math.round((totalAmount / kpis.total) * 100)}%` : "0%"}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>{meta.label} par mois</h3>
              {monthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="montant" fill={meta.barColor} radius={[4, 4, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par client</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => {
                        const n = (name as string).length > 15 ? (name as string).slice(0, 14) + "…" : name;
                        return `${n} (${((percent ?? 0) * 100).toFixed(0)}%)`;
                      }}
                      labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Detail by client */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Détail par client — {meta.label}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, cursor: "pointer" }} onClick={() => { setNameSortStatus(nameSortStatus === "asc" ? "desc" : nameSortStatus === "desc" ? null : "asc"); setCompanySortStatus(null); }}>
                    <span className="inline-flex items-center gap-1">Raison sociale <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, cursor: "pointer" }} onClick={() => { setCompanySortStatus(companySortStatus === "asc" ? "desc" : companySortStatus === "desc" ? null : "asc"); setNameSortStatus(null); }}>
                    <span className="inline-flex items-center gap-1">Société <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>Financement</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "center" }}>Mois</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune donnée</TableCell></TableRow>
                ) : (
                  <>
                    {clientData.map((c, i) => (
                      <TableRow key={i} className="hover:bg-[#f0f7fb]">
                        <TableCell style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{c.name}</TableCell>
                        <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{c.company ?? "—"}</TableCell>
                        <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{c.fundingType ?? "—"}</TableCell>
                        <TableCell style={{ textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{c.count}</TableCell>
                        <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: meta.text }}>{fmt(c.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} style={{ fontWeight: 800, color: "#1a2a3a", fontSize: 13, borderTop: "2px solid #1a2a3a" }}>Total</TableCell>
                      <TableCell style={{ textAlign: "center", fontWeight: 800, color: "#1a2a3a", fontSize: 13, borderTop: "2px solid #1a2a3a" }}>{statusMonths.length}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#1a2a3a", fontSize: 13, borderTop: "2px solid #1a2a3a" }}>{fmt(totalAmount)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  const TABS = [
    { key: "global", label: "Vue globale", icon: <Building2 className="h-4 w-4" /> },
    { key: "a_valider", label: "À valider", icon: <AlertTriangle className="h-4 w-4" /> },
    { key: "planifie", label: "Planifié", icon: <Clock className="h-4 w-4" /> },
    { key: "a_facturer", label: "À facturer", icon: <Clock className="h-4 w-4" /> },
    { key: "facture", label: "Facturé", icon: <Receipt className="h-4 w-4" /> },
    { key: "encaisse", label: "Encaissé", icon: <CreditCard className="h-4 w-4" /> },
    { key: "non_fait", label: "Non fait", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid gap-3 md:grid-cols-7">
        {[
          { label: "Total HT", value: kpis.total, color: "#1a2a3a" },
          { label: "À valider HT", value: kpis.a_valider, color: "#92600a" },
          { label: "Planifié HT", value: kpis.planifie, color: "#5b21b6" },
          { label: "À facturer HT", value: kpis.a_facturer, color: "#1f4e79" },
          { label: "Facturé HT", value: kpis.facture, color: "#9c0006" },
          { label: "Encaissé HT", value: kpis.encaisse, color: "#006100" },
          { label: "Non fait HT", value: kpis.non_fait, color: "#888888" },
        ].map((k) => (
          <div key={k.label} className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{fmt(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          {TABS.map((tab) => {
            const meta = STATUS_META[tab.key];
            const isActive = selectedReport === tab.key;
            return (
              <button key={tab.key} onClick={() => setSelectedReport(tab.key)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 8, fontSize: 13, fontWeight: isActive ? 700 : 500,
                border: isActive ? "2px solid " + (meta?.text ?? "#1E2A5A") : "1px solid #dce8f0",
                background: isActive ? (meta?.bg ?? "#f0f7ff") : "white",
                color: isActive ? (meta?.text ?? "#1E2A5A") : "#5a6a7a",
                cursor: "pointer",
              }}>
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm font-semibold"
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value)}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>Année {y}</option>
          ))}
        </select>
      </div>

      {/* Report content */}
      {selectedReport === "global" && renderGlobal()}
      {selectedReport === "a_valider" && renderStatusReport("a_valider")}
      {selectedReport === "planifie" && renderStatusReport("planifie")}
      {selectedReport === "a_facturer" && renderStatusReport("a_facturer")}
      {selectedReport === "facture" && renderStatusReport("facture")}
      {selectedReport === "encaisse" && renderStatusReport("encaisse")}
      {selectedReport === "non_fait" && renderStatusReport("non_fait")}
    </div>
  );
}
