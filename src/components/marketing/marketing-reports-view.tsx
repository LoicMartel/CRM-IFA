"use client";

import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, Users, Target, BarChart3, Phone, CalendarCheck, UserCheck } from "lucide-react";
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
  revenue: number;
}

interface WonDeal {
  id: string;
  stage: string;
  amount: number | null;
  close_date: string | null;
  source_id: string | null;
  created_at: string;
  lead_sources: { name: string } | { name: string }[] | null;
  contacts?:
    | { source_id: string | null; lead_sources: { name: string } | { name: string }[] | null }
    | { source_id: string | null; lead_sources: { name: string } | { name: string }[] | null }[]
    | null;
}

interface Lead {
  id: string;
  created_at: string;
  source_id: string | null;
  lead_status: string | null;
  lead_sources: { name: string }[] | { name: string } | null;
}

interface SettingActivity {
  contact_id: string;
  type: string;
  description: string | null;
  created_at: string;
}

interface SettingMeeting {
  id: string;
  contact_id: string;
  status: string;
  scheduled_at: string;
  created_at: string;
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

// Tunnel VSL et Tunnel Book = "Pub" dans les depenses
const PROVIDER_ALIASES: Record<string, string> = {
  "Tunnel VSL": "Pub",
  "Tunnel Book": "Pub",
};
function normalizeProvider(name: string): string {
  return PROVIDER_ALIASES[name] ?? name;
}

// Liste des prestataires marketing reconnus (= options de "Nouvelle dépense").
// Seuls les deals attribués à une de ces sources sont comptés dans le CA généré.
const MARKETING_PROVIDERS = ["Pub", "Skaale", "Oliver List", "Agence Personnelle", "LK Premium", "Baptiste", "Pauline", "Hugo", "ASPNL"] as const;
const MARKETING_PROVIDER_SET: ReadonlySet<string> = new Set(MARKETING_PROVIDERS);

// Alias explicites : certaines sources de leads sont attribuées à un prestataire
// précis (ex: LinkedIn = Skaale qui fait la prospection LinkedIn).
const SOURCE_TO_PROVIDER_ALIAS: Record<string, string> = {
  linkedin: "Skaale",
  tiktok: "Agence Personnelle",
  instagram: "Agence Personnelle",
  facebook: "Agence Personnelle",
  youtube: "Agence Personnelle",
};

// Mapping source de lead → prestataire marketing (identique à la page Dépenses).
// Tolère espaces / tirets / casse différents (ex: "OliverList" ↔ "Oliver List").
// Renvoie "" si la source ne correspond à aucun prestataire marketing.
function sourceToProvider(sourceName: string): string {
  if (!sourceName) return "";
  const norm = sourceName.toLowerCase().replace(/[\s\-_]+/g, "");
  // 1. Tunnels publicitaires
  if (norm.includes("tunnel") || norm.includes("metaads")) return "Pub";
  // 2. Alias réseaux sociaux → prestataire dédié
  for (const [key, provider] of Object.entries(SOURCE_TO_PROVIDER_ALIAS)) {
    if (norm.includes(key)) return provider;
  }
  // 3. Match direct sur le nom du prestataire
  for (const p of MARKETING_PROVIDERS) {
    if (p === "Pub") continue;
    if (norm.includes(p.toLowerCase().replace(/[\s\-_]+/g, ""))) return p;
  }
  return ""; // source non marketing (Renouvellement, Prospection, etc.)
}

const SOURCE_COLORS = ["#1a6b9c", "#e65100", "#6a1b9a", "#2e7d32", "#c62828", "#0d4f7a", "#f57c00", "#4a148c"];

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
  wonDeals,
  settingActivities,
  settingMeetings,
}: {
  weeklyStats: WeeklyStat[];
  expenses: Expense[];
  leads: Lead[];
  providers: Provider[];
  wonDeals: WonDeal[];
  settingActivities: SettingActivity[];
  settingMeetings: SettingMeeting[];
}) {
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom">("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterProviderName, setFilterProviderName] = useState<string>("");

  // Filter data
  function inPeriod(dateStr: string) {
    if (periodMode === "month") return dateStr.startsWith(filterMonth);
    if (periodMode === "custom" && customFrom && customTo) return dateStr >= customFrom && dateStr <= customTo;
    return true;
  }

  // Build unified list of all provider names (tunnel names normalized to expense names)
  const tunnelNames = providers.map(p => normalizeProvider(p.name));
  const expenseProviderNames = Array.from(new Set(expenses.map(e => e.provider_name))).sort();
  const allProviderNames = Array.from(new Set([...tunnelNames, ...expenseProviderNames])).sort();

  const filteredStats = weeklyStats.filter((s) => {
    if (!inPeriod(s.period_start)) return false;
    if (!filterProviderName) return true;
    const provName = normalizeProvider(s.marketing_providers?.name ?? "");
    return provName === filterProviderName;
  });
  const filteredExpenses = expenses.filter((e) => inPeriod(e.period_start) && (!filterProviderName || e.provider_name === filterProviderName));
  const filteredLeads = leads.filter((l) => inPeriod(l.created_at.split("T")[0]));
  function getDealSourceName(d: WonDeal): string {
    // 1. Source du deal lui-même
    if (d.lead_sources) {
      const name = Array.isArray(d.lead_sources) ? d.lead_sources[0]?.name : d.lead_sources.name;
      if (name) return name;
    }
    // 2. Fallback : source du contact lié
    if (d.contacts) {
      const contact = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts;
      if (contact?.lead_sources) {
        const name = Array.isArray(contact.lead_sources) ? contact.lead_sources[0]?.name : contact.lead_sources.name;
        if (name) return name;
      }
    }
    return "";
  }
  function getDealProvider(d: WonDeal): string {
    return sourceToProvider(getDealSourceName(d));
  }
  const filteredWonDeals = wonDeals.filter((d) => {
    const dateStr = d.close_date ?? d.created_at.split("T")[0];
    if (!inPeriod(dateStr)) return false;
    const provider = getDealProvider(d);
    // Ne compter que les deals attribués à un prestataire marketing (ignore Renouvellement, Prospection, etc.)
    if (!MARKETING_PROVIDER_SET.has(provider)) return false;
    if (!filterProviderName) return true;
    return provider === filterProviderName;
  });

  // === GLOBAL KPIs ===
  const totalInvestment = filteredExpenses.reduce((a, e) => a + Number(e.amount), 0);
  const totalLeads = filteredLeads.length;
  const totalSales = filteredWonDeals.length;
  // CA généré = somme des deals gagnés/signés, calculée auto (même logique que Dépenses Marketing)
  const totalRevenue = filteredWonDeals.reduce((a, d) => a + (Number(d.amount) || 0), 0);
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
  // Leads par prestataire depuis marketing_weekly_stats
  filteredStats.forEach((s) => {
    const name = normalizeProvider(s.marketing_providers?.name ?? "Inconnu");
    if (!statsByProvider[name]) statsByProvider[name] = { expenses: 0, leads: 0, sales: 0, revenue: 0 };
    statsByProvider[name].leads += s.leads;
  });
  // Dépenses par prestataire depuis marketing_expenses
  filteredExpenses.forEach((e) => {
    const name = e.provider_name;
    if (!statsByProvider[name]) statsByProvider[name] = { expenses: 0, leads: 0, sales: 0, revenue: 0 };
    statsByProvider[name].expenses += Number(e.amount);
  });
  // Ventes ET CA par prestataire depuis les deals gagnés/signés (calcul auto)
  filteredWonDeals.forEach((d) => {
    const name = getDealProvider(d) || "Autre";
    if (!statsByProvider[name]) statsByProvider[name] = { expenses: 0, leads: 0, sales: 0, revenue: 0 };
    statsByProvider[name].sales += 1;
    statsByProvider[name].revenue += Number(d.amount) || 0;
  });

  // === DÉPENSES PAR PRESTATAIRE (coûts) ===
  const costsByProvider: Record<string, number> = {};
  filteredExpenses.forEach((e) => {
    costsByProvider[e.provider_name] = (costsByProvider[e.provider_name] ?? 0) + Number(e.amount);
  });
  const sortedCosts = Object.entries(costsByProvider).sort((a, b) => b[1] - a[1]);
  const maxCost = Math.max(...Object.values(costsByProvider), 1);

  // SOURCE_COLORS est défini au niveau module

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
          value={filterProviderName}
          onChange={(e) => setFilterProviderName(e.target.value)}
        >
          <option value="">Tous les prestataires</option>
          {allProviderNames.map((name) => <option key={name} value={name}>{name}</option>)}
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
                <span style={{ fontWeight: 800, color: "#e74c3c" }}>{fmt(totalInvestment)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Rapport Setting ===== */}
      <SettingReport leads={leads} activities={settingActivities} meetings={settingMeetings} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Rapport Setting – sous-composant avec ses propres filtres          */
/* ------------------------------------------------------------------ */

function SettingReport({
  leads,
  activities,
  meetings,
}: {
  leads: Lead[];
  activities: SettingActivity[];
  meetings: SettingMeeting[];
}) {
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom">("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showSourceDetail, setShowSourceDetail] = useState(false);

  function inPeriod(dateStr: string) {
    if (periodMode === "month") return dateStr.startsWith(filterMonth);
    if (periodMode === "custom" && customFrom && customTo) return dateStr >= customFrom && dateStr <= customTo;
    return true;
  }

  const stats = useMemo(() => {
    // 1. Prospects appelés = leads marketing créés dans la période
    const prospectsAppeles = leads.filter((l) => inPeriod(l.created_at.split("T")[0]));
    const prospectIds = new Set(prospectsAppeles.map((l) => l.id));
    const totalProspects = prospectsAppeles.length;

    // 2. Prospects disqualifiés : not_interested OU ayant une activité "Contacté → Non qualifié"
    const disqualifiedIds = new Set<string>();
    for (const l of prospectsAppeles) {
      if (l.lead_status === "not_interested") disqualifiedIds.add(l.id);
    }
    for (const a of activities) {
      if (prospectIds.has(a.contact_id) && (a.description ?? "").startsWith("Contacté → Non qualifié")) {
        disqualifiedIds.add(a.contact_id);
      }
    }
    const disqualifies = disqualifiedIds.size;
    const qualifies = totalProspects - disqualifies;

    // 3. Tentatives d'appels = toutes les activités type appel dans la période, peu importe la date de création du contact
    const allCallsInPeriod = activities.filter(
      (a) => inPeriod(a.created_at.split("T")[0])
    );
    const totalCalls = allCallsInPeriod.length;

    // Appels sur les prospects du périmètre (pour les métriques contacté)
    const callAttempts = activities.filter(
      (a) => prospectIds.has(a.contact_id) && inPeriod(a.created_at.split("T")[0])
    );

    // 4. Contactés = prospects ayant été au moins une fois en statut "contacted"
    // Soit via une activité "Contacté…", soit via leur lead_status actuel
    // (contacted, booked, rdv_done, signed, no_show = tous passés par "contacted")
    const CONTACTED_OR_AFTER = new Set(["contacted", "booked", "rdv_done", "signed", "no_show"]);
    const contactedIds = new Set<string>();
    // Par statut actuel (si le statut a évolué après "contacted", ils l'ont été)
    for (const l of prospectsAppeles) {
      if (l.lead_status && CONTACTED_OR_AFTER.has(l.lead_status)) {
        contactedIds.add(l.id);
      }
    }
    // Par activité (au cas où le statut a été modifié manuellement)
    for (const a of callAttempts) {
      const desc = a.description ?? "";
      if (desc.startsWith("Contacté")) {
        contactedIds.add(a.contact_id);
      }
    }
    const totalContacted = contactedIds.size;

    // 4b. Contactés par source
    const prospectsBySource = new Map<string, string>();
    for (const l of prospectsAppeles) {
      prospectsBySource.set(l.id, getSourceName(l));
    }
    const sourceStats: { source: string; total: number; contacted: number }[] = [];
    const sourceTotals: Record<string, number> = {};
    const sourceContacted: Record<string, number> = {};
    for (const l of prospectsAppeles) {
      const src = getSourceName(l);
      sourceTotals[src] = (sourceTotals[src] ?? 0) + 1;
    }
    for (const id of contactedIds) {
      const src = prospectsBySource.get(id) ?? "Non définie";
      sourceContacted[src] = (sourceContacted[src] ?? 0) + 1;
    }
    for (const src of Object.keys(sourceTotals).sort((a, b) => sourceTotals[b] - sourceTotals[a])) {
      sourceStats.push({ source: src, total: sourceTotals[src], contacted: sourceContacted[src] ?? 0 });
    }

    // 5. Contactés parmi les qualifiés = contactés qui ne sont pas disqualifiés
    const contactedQualifiesIds = new Set([...contactedIds].filter((id) => !disqualifiedIds.has(id)));
    const totalContactedQualifies = contactedQualifiesIds.size;

    // 6. RDV réservés = meetings créés dans la période pour les prospects du périmètre
    const meetingsInScope = meetings.filter(
      (m) => prospectIds.has(m.contact_id) && inPeriod(m.created_at.split("T")[0])
    );
    const totalRdvBooked = meetingsInScope.length;

    // 7. RDV faits = parmi les meetings réservés (meetingsInScope), combien ont été faits
    // Un RDV est "fait" si le meeting a status "done" OU si le contact a lead_status rdv_done/signed
    const RDV_DONE_OR_AFTER = new Set(["rdv_done", "signed"]);
    const rdvDoneContactIds = new Set<string>();
    for (const l of prospectsAppeles) {
      if (l.lead_status && RDV_DONE_OR_AFTER.has(l.lead_status)) {
        rdvDoneContactIds.add(l.id);
      }
    }
    for (const m of meetingsInScope) {
      if (m.status === "done") rdvDoneContactIds.add(m.contact_id);
    }
    const totalRdvDone = rdvDoneContactIds.size;
    // Dénominateur = même base que RDV réservés, hors annulés
    const totalRdvForShowRate = meetingsInScope.filter((m) => m.status !== "cancelled").length;

    return {
      totalProspects,
      disqualifies,
      qualifies,
      totalCalls,
      totalContacted,
      totalContactedQualifies,
      sourceStats,
      totalRdvBooked,
      totalRdvDone,
      totalRdvForShowRate,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, activities, meetings, periodMode, filterMonth, customFrom, customTo]);

  return (
    <div style={{ borderTop: "2px solid #dce8f0", paddingTop: 24, marginTop: 8 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a2a3a", marginBottom: 16 }}>Rapport Setting</h2>

      {/* Filtres temporels */}
      <div className="flex gap-3 items-center flex-wrap" style={{ marginBottom: 16 }}>
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

      {/* KPI Cards */}
      <div className="grid gap-3 md:grid-cols-4" style={{ marginBottom: 16 }}>
        {/* Prospects appelés */}
        <div className="lca-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Prospects appelés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{stats.totalProspects}</div>
          </div>
          <Users style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>

        {/* Prospects qualifiés */}
        <div className="lca-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Prospects qualifiés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{stats.qualifies}</div>
            <div style={{ fontSize: 10, color: "#8399a9" }}>{stats.disqualifies} disqualifié{stats.disqualifies > 1 ? "s" : ""}</div>
          </div>
          <UserCheck style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>

        {/* Tentatives d'appels */}
        <div className="lca-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Tentatives d{"'"}appels</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#e65100" }}>{stats.totalCalls}</div>
            <div style={{ fontSize: 10, color: "#8399a9" }}>{stats.totalProspects > 0 ? fmtNum(stats.totalCalls / stats.totalProspects) : "—"} appels/prospect</div>
          </div>
          <Phone style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>

        {/* RDV faits */}
        <div className="lca-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>RDV faits</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#2e7d32" }}>{stats.totalRdvDone}</div>
            <div style={{ fontSize: 10, color: "#8399a9" }}>sur {stats.totalRdvForShowRate} réservé{stats.totalRdvForShowRate > 1 ? "s" : ""}</div>
          </div>
          <CalendarCheck style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Taux de conversion (funnel) */}
      <div className="lca-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Funnel Setting</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Contactés / Total */}
          <FunnelRow
            label="Contactés / Total prospects"
            num={stats.totalContacted}
            den={stats.totalProspects}
            color="#1a6b9c"
          />
          {/* Toggle détail par source */}
          <button
            type="button"
            onClick={() => setShowSourceDetail(!showSourceDetail)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "#1a6b9c", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
              padding: 0, marginTop: -4, marginBottom: -4,
            }}
          >
            <span style={{ transition: "transform 0.2s", display: "inline-block", transform: showSourceDetail ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            {showSourceDetail ? "Masquer" : "Voir"} le détail par source
          </button>
          {showSourceDetail && stats.sourceStats.map((s, i) => (
            <FunnelRow
              key={s.source}
              label={`Contactés / ${s.source}`}
              num={s.contacted}
              den={s.total}
              color={SOURCE_COLORS[i % SOURCE_COLORS.length]}
            />
          ))}
          {/* Contactés / Qualifiés */}
          <FunnelRow
            label="Contactés / Qualifiés"
            num={stats.totalContactedQualifies}
            den={stats.qualifies}
            color="#6a1b9a"
          />
          {/* Qualifiés / Contactés */}
          <FunnelRow
            label="Qualifiés / Contactés"
            num={stats.totalContactedQualifies}
            den={stats.totalContacted}
            color="#9c27b0"
          />
          {/* RDV réservés / Contactés qualifiés */}
          <FunnelRow
            label="RDV réservés / Contactés qualifiés"
            num={stats.totalRdvBooked}
            den={stats.totalContactedQualifies}
            color="#e65100"
          />
          {/* RDV faits / RDV réservés */}
          <FunnelRow
            label="RDV faits / RDV réservés"
            num={stats.totalRdvDone}
            den={stats.totalRdvForShowRate}
            color="#2e7d32"
          />
        </div>
      </div>
    </div>
  );
}

function FunnelRow({ label, num, den, color }: { label: string; num: number; den: number; color: string }) {
  const pctVal = den > 0 ? (num / den) * 100 : 0;
  const pctStr = den > 0 ? fmtNum(pctVal) + " %" : "—";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: "#1a2a3a" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>
          {num} / {den} — {pctStr}
        </span>
      </div>
      <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pctVal, 100)}%`, background: color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
