"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, Users, Target, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  marketing_providers: { name: string } | null;
}

interface Expense {
  id: string;
  period_start: string;
  provider_name: string;
  amount: number;
}

interface Lead {
  id: string;
  created_at: string;
  source_id: string | null;
  lead_sources: { name: string }[] | { name: string } | null;
}

interface Provider {
  id: string;
  name: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " \u20ac";
}

function fmtNum(n: number) {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
}

function getSourceName(l: Lead): string {
  if (!l.lead_sources) return "Non définie";
  if (Array.isArray(l.lead_sources)) return l.lead_sources[0]?.name ?? "Non définie";
  return l.lead_sources.name;
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function fmtMonthLabel(ym: string): string {
  try {
    const [y, m] = ym.split("-");
    return format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMM yyyy", { locale: fr });
  } catch {
    return ym;
  }
}

export function MarketingReportsView({
  weeklyStats,
  expenses,
  leads,
  providers,
}: {
  weeklyStats: WeeklyStat[];
  expenses: Expense[];
  leads: Lead[];
  providers: Provider[];
}) {
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom">("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterProviderId, setFilterProviderId] = useState<string>("");

  // Filter data
  function inPeriod(dateStr: string) {
    if (periodMode === "month") return dateStr.startsWith(filterMonth);
    if (periodMode === "custom" && customFrom && customTo) return dateStr >= customFrom && dateStr <= customTo;
    return true;
  }

  const selectedProviderName = filterProviderId ? providers.find(p => p.id === filterProviderId)?.name ?? "" : "";
  const filteredStats = weeklyStats.filter((s) => inPeriod(s.period_start) && (!filterProviderId || s.provider_id === filterProviderId));
  const filteredExpenses = expenses.filter((e) => inPeriod(e.period_start) && (!selectedProviderName || e.provider_name === selectedProviderName));
  const filteredLeads = leads.filter((l) => inPeriod(l.created_at.split("T")[0]));

  // === GLOBAL KPIs ===
  const totalAdSpend = filteredStats.reduce((a, s) => a + Number(s.expenses), 0);
  const totalProviderCosts = filteredExpenses.reduce((a, e) => a + Number(e.amount), 0);
  const totalInvestment = totalAdSpend + totalProviderCosts;
  const totalLeads = filteredStats.reduce((a, s) => a + s.leads, 0);
  const totalSales = filteredStats.reduce((a, s) => a + s.sales, 0);
  const totalRevenue = filteredStats.reduce((a, s) => a + Number(s.revenue), 0);
  const globalCpl = totalLeads > 0 ? totalInvestment / totalLeads : 0;
  const globalRoas = totalInvestment > 0 ? totalRevenue / totalInvestment : 0;

  // === SOURCE DES LEADS ===
  const leadsBySource: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    const src = getSourceName(l);
    leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;
  });
  const sortedSources = Object.entries(leadsBySource).sort((a, b) => b[1] - a[1]);
  const maxSourceCount = Math.max(...Object.values(leadsBySource), 1);

  // === LEADS PAR MOIS ===
  const leadsByMonth: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    const mk = getMonthKey(l.created_at.split("T")[0]);
    leadsByMonth[mk] = (leadsByMonth[mk] ?? 0) + 1;
  });
  const sortedMonths = Object.entries(leadsByMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthCount = Math.max(...Object.values(leadsByMonth), 1);

  // === PERFORMANCE PAR PRESTATAIRE ===
  const statsByProvider: Record<string, { expenses: number; leads: number; sales: number; revenue: number }> = {};
  filteredStats.forEach((s) => {
    const name = s.marketing_providers?.name ?? "Inconnu";
    if (!statsByProvider[name]) statsByProvider[name] = { expenses: 0, leads: 0, sales: 0, revenue: 0 };
    statsByProvider[name].expenses += Number(s.expenses);
    statsByProvider[name].leads += s.leads;
    statsByProvider[name].sales += s.sales;
    statsByProvider[name].revenue += Number(s.revenue);
  });

  // === DÉPENSES PAR PRESTATAIRE (coûts) ===
  const costsByProvider: Record<string, number> = {};
  filteredExpenses.forEach((e) => {
    costsByProvider[e.provider_name] = (costsByProvider[e.provider_name] ?? 0) + Number(e.amount);
  });
  const sortedCosts = Object.entries(costsByProvider).sort((a, b) => b[1] - a[1]);
  const maxCost = Math.max(...Object.values(costsByProvider), 1);

  const SOURCE_COLORS = ["#1a6b9c", "#e65100", "#6a1b9a", "#2e7d32", "#c62828", "#0d4f7a", "#f57c00", "#4a148c"];

  return (
    <>
      {/* Period & provider filters */}
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
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={filterProviderId}
          onChange={(e) => setFilterProviderId(e.target.value)}
        >
          <option value="">Tous les prestataires</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Global KPIs */}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Investissement total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e74c3c" }}>{fmt(totalInvestment)}</div>
          </div>
          <DollarSign style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Leads générés</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalLeads}</div>
          </div>
          <Users style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CPL global</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{globalCpl > 0 ? fmt(globalCpl) : "—"}</div>
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
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>ROAS global</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: globalRoas >= 1 ? "#27ae60" : "#e74c3c" }}>{globalRoas > 0 ? fmtNum(globalRoas) : "—"}</div>
          </div>
          <BarChart3 style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Source des leads */}
        <div className="lca-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Source des leads</h3>
          {sortedSources.length === 0 ? (
            <p style={{ color: "#8399a9", fontSize: 13 }}>Aucune donnée</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedSources.map(([source, count], i) => (
                <div key={source}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#1a2a3a" }}>{source}</span>
                    <span style={{ fontWeight: 700, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(count / maxSourceCount) * 100}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length], borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leads par mois */}
        <div className="lca-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Leads par mois</h3>
          {sortedMonths.length === 0 ? (
            <p style={{ color: "#8399a9", fontSize: 13 }}>Aucune donnée</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedMonths.map(([month, count]) => (
                <div key={month}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#1a2a3a", textTransform: "capitalize" }}>{fmtMonthLabel(month)}</span>
                    <span style={{ fontWeight: 700, color: "#1a6b9c" }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(count / maxMonthCount) * 100}%`, background: "#1a6b9c", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance par prestataire (ads) */}
        <div className="lca-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Performance par prestataire (Ads)</h3>
          {Object.keys(statsByProvider).length === 0 ? (
            <p style={{ color: "#8399a9", fontSize: 13 }}>Aucune donnée</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(statsByProvider).map(([name, data]) => {
                const roas = data.expenses > 0 ? data.revenue / data.expenses : 0;
                const cpl = data.leads > 0 ? data.expenses / data.leads : 0;
                return (
                  <div key={name} style={{ padding: 12, background: "#f8fbfd", borderRadius: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2a3a", marginBottom: 8 }}>{name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: "#8399a9" }}>Dépenses</div>
                        <div style={{ fontWeight: 700, color: "#e74c3c" }}>{fmt(data.expenses)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#8399a9" }}>Leads</div>
                        <div style={{ fontWeight: 700, color: "#1a6b9c" }}>{data.leads}</div>
                      </div>
                      <div>
                        <div style={{ color: "#8399a9" }}>CPL</div>
                        <div style={{ fontWeight: 700, color: "#e65100" }}>{cpl > 0 ? fmt(cpl) : "—"}</div>
                      </div>
                      <div>
                        <div style={{ color: "#8399a9" }}>ROAS</div>
                        <div style={{ fontWeight: 700, color: roas >= 1 ? "#27ae60" : "#e74c3c" }}>{roas > 0 ? fmtNum(roas) : "—"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coûts prestataires */}
        <div className="lca-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Coûts prestataires</h3>
          {sortedCosts.length === 0 ? (
            <p style={{ color: "#8399a9", fontSize: 13 }}>Aucune donnée</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedCosts.map(([name, amount], i) => (
                <div key={name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#1a2a3a" }}>{name}</span>
                    <span style={{ fontWeight: 700, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }}>{fmt(amount)}</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(amount / maxCost) * 100}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length], borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #dce8f0", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, color: "#e74c3c" }}>{fmt(totalProviderCosts)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
