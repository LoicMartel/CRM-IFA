"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type R = Record<string, unknown>;

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function hoursToJ(h: number) {
  return Math.round(h / 8 * 10) / 10;
}

export function RapportsProductionView({ servicePlans, sessions, invoices }: {
  servicePlans: R[]; sessions: R[]; invoices: R[];
}) {
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState("parcours_en_cours");
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom">("all");
  const [filterMonth, setFilterMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterExpert, setFilterExpert] = useState("");

  // All experts from sessions
  const allExperts = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s: R) => {
      ((s.trainers as string[]) ?? []).forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Global filtered sessions (by period + expert)
  const filteredSessions = useMemo(() => {
    return sessions.filter((s: R) => {
      const d = s.session_date as string | undefined;
      if (!d) return false;
      // Period filter
      if (periodMode === "month" && !d.startsWith(filterMonth)) return false;
      if (periodMode === "custom") {
        if (customFrom && d < customFrom) return false;
        if (customTo && d > customTo) return false;
      }
      // Expert filter
      if (filterExpert) {
        const trainers = (s.trainers as string[]) ?? [];
        if (!trainers.includes(filterExpert)) return false;
      }
      return true;
    });
  }, [sessions, periodMode, filterMonth, customFrom, customTo, filterExpert]);

  // ====== REPORT: PARCOURS EN COURS ======
  function renderParcoursEnCours() {
    // Group by company via service plans
    const companyMap: Record<string, {
      companyId: string;
      companyName: string;
      plans: R[];
      totalBudget: number;
      totalHourlyRate: number;
      vtPlanned: number;
      daysPlanned: number;
      sessionsDone: number;
      sessionsPlanned: number;
      sessionsTotal: number;
      hoursDone: number;
      hoursPlanned: number;
      hoursTotal: number;
      consumedAmount: number;
      plannedAmount: number;
      facturableAmount: number;
    }> = {};

    servicePlans.forEach((plan: R) => {
      const company = plan.companies as { id: string; name: string } | null;
      if (!company) return;
      const cid = company.id;

      if (!companyMap[cid]) {
        companyMap[cid] = {
          companyId: cid,
          companyName: company.name,
          plans: [],
          totalBudget: 0,
          totalHourlyRate: 0,
          vtPlanned: 0,
          daysPlanned: 0,
          sessionsDone: 0,
          sessionsPlanned: 0,
          sessionsTotal: 0,
          hoursDone: 0,
          hoursPlanned: 0,
          hoursTotal: 0,
          consumedAmount: 0,
          plannedAmount: 0,
          facturableAmount: 0,
        };
      }
      const c = companyMap[cid];
      c.plans.push(plan);
      c.totalBudget += Number(plan.budget) || 0;
      c.vtPlanned += Number(plan.vt_planned) || 0;
      c.daysPlanned += Number(plan.days_planned) || 0;

      const hourlyRate = Number(plan.hourly_rate) || 0;
      if (hourlyRate > c.totalHourlyRate) c.totalHourlyRate = hourlyRate;

      // Sessions for this plan
      const planSessions = filteredSessions.filter((s: R) => s.service_plan_id === plan.id && s.status !== "cancelled");
      planSessions.forEach((s: R) => {
        const hours = Number(s.duration_hours) || 0;
        const isBillable = s.is_billable !== false;
        c.sessionsTotal++;
        c.hoursTotal += hours;
        if (s.status === "done") {
          c.sessionsDone++;
          c.hoursDone += hours;
          c.consumedAmount += hours * hourlyRate;
          if (isBillable) c.facturableAmount += hours * hourlyRate;
        } else {
          c.sessionsPlanned++;
          c.hoursPlanned += hours;
          if (isBillable) c.plannedAmount += hours * hourlyRate;
        }
      });
    });

    // Filter: only companies with remaining sessions (not all done)
    const activeCompanies = Object.values(companyMap)
      .filter(c => c.sessionsPlanned > 0 || c.sessionsTotal === 0)
      .sort((a, b) => b.totalBudget - a.totalBudget);

    const totals = {
      budget: activeCompanies.reduce((s, c) => s + c.totalBudget, 0),
      consumed: activeCompanies.reduce((s, c) => s + c.consumedAmount, 0),
      planned: activeCompanies.reduce((s, c) => s + c.plannedAmount, 0),
      facturable: activeCompanies.reduce((s, c) => s + c.facturableAmount, 0),
      hoursDone: activeCompanies.reduce((s, c) => s + c.hoursDone, 0),
      hoursPlanned: activeCompanies.reduce((s, c) => s + c.hoursPlanned, 0),
    };
    const totalRemaining = totals.budget - totals.consumed - totals.planned;

    // Chart data
    const chartData = activeCompanies.map(c => ({
      name: c.companyName.length > 15 ? c.companyName.slice(0, 14) + "…" : c.companyName,
      Consommé: c.consumedAmount,
      Engagé: c.plannedAmount,
      Reste: Math.max(0, c.totalBudget - c.consumedAmount - c.plannedAmount),
    }));

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-5">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Parcours en cours</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{activeCompanies.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Budget total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totals.budget)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Consommé</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{fmt(totals.consumed)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{totals.hoursDone.toFixed(0)}h réalisées</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturable sur Delivery</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{fmt(totals.facturable)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Reste à prévoir</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: totalRemaining > 0 ? "#e74c3c" : "#27ae60" }}>{fmt(totalRemaining)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{totals.hoursPlanned.toFixed(0)}h planifiées</div>
          </div>
        </div>

        {/* Table with plans grouped by company */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Parcours en cours par entreprise</h3>
            <div style={{ overflowX: "auto" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Plan de formation</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Budget</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Consommé</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Avancement</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Facturable</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Engagé</TableHead>
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Reste à prévoir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCompanies.length === 0 ? (
                    <TableRow><TableCell colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucun parcours en cours</TableCell></TableRow>
                  ) : activeCompanies.map(c => {
                    // Build plan-level rows
                    const planRows = c.plans.map((plan: R) => {
                      const planBudget = Number(plan.budget) || 0;
                      const hourlyRate = Number(plan.hourly_rate) || 0;
                      const planSessions = filteredSessions.filter((s: R) => s.service_plan_id === plan.id && s.status !== "cancelled");
                      const doneSessions = planSessions.filter((s: R) => s.status === "done");
                      const plannedSessions = planSessions.filter((s: R) => s.status === "planned");
                      const consumed = doneSessions.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
                      const facturable = doneSessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
                      const engaged = plannedSessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
                      const pct = planBudget > 0 ? Math.round((consumed / planBudget) * 100) : 0;
                      const remaining = Math.max(0, planBudget - consumed - engaged);

                      const programName = (plan.training_programs as { name: string } | null)?.name ?? "Plan de formation";
                      const dealName = (plan.deals as { name: string } | null)?.name;
                      const label = dealName ? `${programName} — ${dealName}` : programName;

                      return { planId: plan.id as string, label, planBudget, consumed, engaged, remaining, pct, facturable, hasPlanned: plannedSessions.length > 0 || planSessions.length === 0 };
                    }).filter((p: any) => p.hasPlanned);

                    if (planRows.length === 0) return null;

                    return planRows.map((p: any, idx: number) => (
                      <TableRow key={p.planId} className="hover:bg-[#f0f7fb]">
                        {idx === 0 ? (
                          <TableCell rowSpan={planRows.length} style={{ verticalAlign: "top", borderBottom: "2px solid #e8ecf1" }}>
                            <span onClick={() => router.push(`/clients/${c.companyId}`)} style={{ fontWeight: 700, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                              {c.companyName}
                            </span>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <span onClick={() => router.push("/planning")} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                            {p.label}
                          </span>
                        </TableCell>
                        <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>{fmt(p.planBudget)}</TableCell>
                        <TableCell style={{ textAlign: "right", fontSize: 13, color: "#27ae60", fontWeight: 600 }}>{fmt(p.consumed)}</TableCell>
                        <TableCell style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            <div style={{ width: 60, height: 6, background: "#e8ecf1", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(p.pct, 100)}%`, background: p.pct >= 80 ? "#e74c3c" : p.pct >= 50 ? "#FF6B35" : "#27ae60", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#1a2a3a" }}>{p.pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell style={{ textAlign: "right", fontSize: 13, color: "#FF6B35", fontWeight: 600 }}>{fmt(p.facturable)}</TableCell>
                        <TableCell style={{ textAlign: "right", fontSize: 13, color: "#1a6b9c" }}>{fmt(p.engaged)}</TableCell>
                        <TableCell style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: p.remaining > 0 ? "#e74c3c" : "#27ae60" }}>{fmt(p.remaining)}</TableCell>
                      </TableRow>
                    ));
                  })}
                  {activeCompanies.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totals.budget)}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#27ae60", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totals.consumed)}</TableCell>
                      <TableCell style={{ borderTop: "2px solid #0d4f7a" }}></TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#FF6B35", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totals.facturable)}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#1a6b9c", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totals.planned)}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#e74c3c", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalRemaining)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Budget par entreprise — Consommé / Engagé / Reste</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                  <XAxis dataKey="name" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8399a9", fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="Consommé" stackId="a" fill="#27ae60" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Engagé" stackId="a" fill="#1a6b9c" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Reste" stackId="a" fill="#e8ecf1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <select
          style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", background: "white", padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1a2a3a", minWidth: 250 }}
          value={selectedReport}
          onChange={(e) => setSelectedReport(e.target.value)}
        >
          <option value="parcours_en_cours">Parcours en cours</option>
          <option value="vt_non_fermees">VT non fermées</option>
          <option value="journees_non_fermees">Journées non fermées</option>
        </select>
        <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as any)}
          style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", background: "white", padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>
          <option value="all">Toutes les dates</option>
          <option value="month">Par mois</option>
          <option value="custom">Personnalisé</option>
        </select>
        {periodMode === "month" && (
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 14, color: "#1a2a3a" }} />
        )}
        {periodMode === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13 }} />
            <span style={{ color: "#8399a9" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13 }} />
          </>
        )}
        <select value={filterExpert} onChange={(e) => setFilterExpert(e.target.value)}
          style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", background: "white", padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>
          <option value="">Tous les experts</option>
          {allExperts.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {selectedReport === "parcours_en_cours" && renderParcoursEnCours()}

      {selectedReport === "vt_non_fermees" && (() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const overdue = filteredSessions.filter((s: R) => {
          if (s.status !== "planned") return false;
          const date = s.session_date as string | undefined;
          return date ? date < todayStr : false;
        }).sort((a: R, b: R) => new Date(b.session_date as string).getTime() - new Date(a.session_date as string).getTime());

        const totalHours = overdue.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);

        return (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>VT non fermées</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{overdue.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures non fermées</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{totalHours}h</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant non fermé</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(overdue.reduce((sum: number, s: R) => {
                  const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
                  return sum + (Number(s.duration_hours) || 0) * rate;
                }, 0))}</div>
              </div>
            </div>

            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Sessions planifiées non fermées ({overdue.length})</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Retard</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Type</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Expert(s)</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Durée</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdue.length === 0 ? (
                        <TableRow><TableCell colSpan={7} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune VT non fermée</TableCell></TableRow>
                      ) : overdue.map((s: R) => {
                        const sDate = new Date(s.session_date as string);
                        const diffDays = Math.floor((new Date().getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
                        const retardLabel = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? "1 jour" : `${diffDays} jours`;
                        const company = (s.service_plans as R)?.companies as { id: string; name: string } | null;
                        const trainers = (s.trainers as string[]) ?? [];
                        const hours = Number(s.duration_hours) || 0;
                        const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
                        const amount = hours * rate;
                        const isJournee = s.session_type === "journee";

                        return (
                          <TableRow key={s.id as string} className="hover:bg-[#f0f7fb]" style={{ cursor: "pointer" }} onClick={() => router.push("/planning")}>
                            <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>
                              {format(sDate, "dd MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: diffDays > 7 ? "#fde8e8" : "#fff3e0", color: diffDays > 7 ? "#e74c3c" : "#FF6B35" }}>
                                {retardLabel}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: isJournee ? "#fff3e0" : "#e8f0fe", color: isJournee ? "#e65100" : "#1a6b9c" }}>
                                {isJournee ? "Journée" : "VT"}
                              </span>
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {company ? (
                                <span onClick={(e) => { e.stopPropagation(); router.push(`/clients/${company.id}`); }} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                                  {company.name}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {trainers.length > 0 ? trainers.join(", ") : "—"}
                            </TableCell>
                            <TableCell style={{ textAlign: "center", fontSize: 13, color: "#1a2a3a" }}>{hours}h</TableCell>
                            <TableCell style={{ textAlign: "right", fontWeight: 600, fontSize: 13, color: "#1a2a3a" }}>{fmt(amount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {selectedReport === "journees_non_fermees" && (() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const overdue = filteredSessions.filter((s: R) => {
          if (s.status !== "planned") return false;
          if (s.session_type !== "journee") return false;
          const date = s.session_date as string | undefined;
          return date ? date < todayStr : false;
        }).sort((a: R, b: R) => new Date(b.session_date as string).getTime() - new Date(a.session_date as string).getTime());

        const totalHours = overdue.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);

        return (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Journées non fermées</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{overdue.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures non fermées</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{totalHours}h</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant non fermé</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(overdue.reduce((sum: number, s: R) => {
                  const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
                  return sum + (Number(s.duration_hours) || 0) * rate;
                }, 0))}</div>
              </div>
            </div>

            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Journées planifiées non fermées ({overdue.length})</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Retard</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Lieu</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Expert(s)</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Durée</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdue.length === 0 ? (
                        <TableRow><TableCell colSpan={7} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune journée non fermée</TableCell></TableRow>
                      ) : overdue.map((s: R) => {
                        const sDate = new Date(s.session_date as string);
                        const diffDays = Math.floor((new Date().getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
                        const retardLabel = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? "1 jour" : `${diffDays} jours`;
                        const company = (s.service_plans as R)?.companies as { id: string; name: string } | null;
                        const trainers = (s.trainers as string[]) ?? [];
                        const hours = Number(s.duration_hours) || 0;
                        const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
                        const amount = hours * rate;
                        const location = s.session_location as string | null;

                        return (
                          <TableRow key={s.id as string} className="hover:bg-[#f0f7fb]" style={{ cursor: "pointer" }} onClick={() => router.push("/planning")}>
                            <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>
                              {format(sDate, "dd MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: diffDays > 7 ? "#fde8e8" : "#fff3e0", color: diffDays > 7 ? "#e74c3c" : "#FF6B35" }}>
                                {retardLabel}
                              </span>
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {company ? (
                                <span onClick={(e) => { e.stopPropagation(); router.push(`/clients/${company.id}`); }} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                                  {company.name}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {location ? <span>📍 {location}</span> : "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {trainers.length > 0 ? trainers.join(", ") : "—"}
                            </TableCell>
                            <TableCell style={{ textAlign: "center", fontSize: 13, color: "#1a2a3a" }}>{hours}h</TableCell>
                            <TableCell style={{ textAlign: "right", fontWeight: 600, fontSize: 13, color: "#1a2a3a" }}>{fmt(amount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
