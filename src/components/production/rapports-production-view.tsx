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
import { useCurrentRoles } from "@/lib/use-current-roles";
import { fmtDuration } from "@/lib/utils";

type R = Record<string, unknown>;

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function hoursToJ(h: number) {
  return Math.round(h / 8 * 10) / 10;
}

export function RapportsProductionView({ servicePlans, sessions, invoices, deliverySessions }: {
  servicePlans: R[]; sessions: R[]; invoices: R[]; deliverySessions?: R[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, onlyOwnData, firstName: currentFirstName } = useCurrentRoles();
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
      // Expert filter (forced for restricted externes)
      const effectiveExpert = onlyOwnData && currentFirstName ? currentFirstName : filterExpert;
      if (effectiveExpert) {
        const trainers = (s.trainers as string[]) ?? [];
        if (!trainers.includes(effectiveExpert)) return false;
      }
      return true;
    });
  }, [sessions, periodMode, filterMonth, customFrom, customTo, filterExpert, isRestrictedExterne, currentFirstName]);

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

      // Sessions for this plan (training_sessions for planning data)
      const planSessions = filteredSessions.filter((s: R) => s.service_plan_id === plan.id && s.status !== "cancelled");
      planSessions.forEach((s: R) => {
        const hours = Number(s.duration_hours) || 0;
        const isBillable = s.is_billable !== false;
        c.sessionsTotal++;
        c.hoursTotal += hours;
        if (s.status === "done" || s.status === "no_show") {
          c.sessionsDone++;
          c.hoursDone += hours;
          if (isBillable) c.consumedAmount += hours * hourlyRate;
        } else {
          c.sessionsPlanned++;
          c.hoursPlanned += hours;
          if (isBillable) c.plannedAmount += hours * hourlyRate;
        }
      });

    });

    // Set facturable: use MAX of deliverySessions amounts vs training_sessions calculation
    Object.values(companyMap).forEach(c => {
      const companyDelivery = (deliverySessions ?? []).filter((ds: R) => {
        const dsCompany = ds.companies as { id: string } | null;
        return dsCompany?.id === c.companyId;
      });
      const deliveryFact = companyDelivery.reduce((sum: number, ds: R) => sum + (Number(ds.billable_amount) || 0), 0);
      // Also compute from training_sessions done+billable for this company
      const companyTS = sessions.filter((s: R) => {
        const sp = s.service_plans as { company_id: string } | null;
        return sp?.company_id === c.companyId && (s.status === "done" || s.status === "no_show") && s.is_billable !== false;
      });
      const tsFact = companyTS.reduce((sum: number, s: R) => {
        const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
        return sum + (Number(s.duration_hours) || 0) * rate;
      }, 0);
      c.facturableAmount = Math.max(deliveryFact, tsFact);
    });

    // Filter: only companies with remaining sessions (not all done)
    const activeCompanies = Object.values(companyMap)
      .filter(c => c.sessionsPlanned > 0 || c.sessionsTotal === 0)
      .sort((a, b) => b.totalBudget - a.totalBudget);

    // Pre-compute remaining per plan (shared between KPI cards and table)
    // Matches Planification page: remaining = budget - consumed(billable) - engaged(billable)
    function computePlanRemaining(plan: R) {
      const hourlyRate = Number(plan.hourly_rate) || 0;
      const planBudget = Number(plan.budget) || 0;
      const vtTotal = Number(plan.vt_planned) || 0;
      const daysTotal = Number(plan.days_planned) || 0;
      const planSessions = filteredSessions.filter((s: R) => s.service_plan_id === plan.id && s.status !== "cancelled");
      const doneSessions = planSessions.filter((s: R) => s.status === "done" || s.status === "no_show");
      const plannedSessions = planSessions.filter((s: R) => s.status === "planned");
      // Billable only for budget calculation (same as Planification)
      const consumed = doneSessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
      const engaged = plannedSessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
      const remaining = Math.max(0, planBudget - consumed - engaged);
      // VT/J remaining counts (all sessions, not just billable)
      const vtDone = doneSessions.filter((s: R) => s.session_type === "vt").length;
      const vtScheduled = plannedSessions.filter((s: R) => s.session_type === "vt").length;
      const daysDone = doneSessions.filter((s: R) => s.session_type === "journee").length;
      const daysScheduled = plannedSessions.filter((s: R) => s.session_type === "journee").length;
      const vtRemaining = Math.max(0, vtTotal - vtDone - vtScheduled);
      const daysRemaining = Math.max(0, daysTotal - daysDone - daysScheduled);
      const remainingLabel = [vtRemaining > 0 ? `${vtRemaining} VT` : "", daysRemaining > 0 ? `${daysRemaining} J` : ""].filter(Boolean).join(" + ");
      const hasPlanned = plannedSessions.length > 0 || planSessions.length === 0;
      return { remaining, remainingLabel, hasPlanned };
    }

    // Sum remaining only for plans that appear in the table (hasPlanned filter)
    let totalRemainingAmount = 0;
    activeCompanies.forEach(c => {
      c.plans.forEach((plan: R) => {
        const { remaining, hasPlanned } = computePlanRemaining(plan);
        if (hasPlanned) totalRemainingAmount += remaining;
      });
    });

    const totals = {
      budget: activeCompanies.reduce((s, c) => s + c.totalBudget, 0),
      consumed: activeCompanies.reduce((s, c) => s + c.consumedAmount, 0),
      planned: activeCompanies.reduce((s, c) => s + c.plannedAmount, 0),
      facturable: activeCompanies.reduce((s, c) => s + c.facturableAmount, 0),
      hoursDone: activeCompanies.reduce((s, c) => s + c.hoursDone, 0),
      hoursPlanned: activeCompanies.reduce((s, c) => s + c.hoursPlanned, 0),
    };
    const totalRemaining = totalRemainingAmount;

    // Chart data — same logic as table rows: per-plan billable only, summed by company
    const chartData = activeCompanies.map(c => {
      let consumed = 0, engaged = 0, remaining = 0;
      c.plans.forEach((plan: R) => {
        const hr = Number(plan.hourly_rate) || 0;
        const ps = filteredSessions.filter((s: R) => s.service_plan_id === plan.id && s.status !== "cancelled");
        const done = ps.filter((s: R) => (s.status === "done" || s.status === "no_show") && s.is_billable !== false);
        const planned = ps.filter((s: R) => s.status === "planned" && s.is_billable !== false);
        const hasPlanned = ps.filter((s: R) => s.status === "planned").length > 0 || ps.length === 0;
        if (!hasPlanned) return;
        consumed += done.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hr, 0);
        engaged += planned.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hr, 0);
        remaining += computePlanRemaining(plan).remaining;
      });
      return {
        name: c.companyName.length > 15 ? c.companyName.slice(0, 14) + "…" : c.companyName,
        Consommé: consumed,
        Engagé: engaged,
        Reste: remaining,
      };
    }).filter(c => c.Consommé > 0 || c.Engagé > 0 || c.Reste > 0);

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
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Reste à planifier</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: totalRemaining > 0 ? "#e74c3c" : "#27ae60" }}>{fmt(totalRemaining)}</div>
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
                    <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Reste à planifier</TableHead>
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
                      const doneSessions = planSessions.filter((s: R) => s.status === "done" || s.status === "no_show");
                      const plannedSessions = planSessions.filter((s: R) => s.status === "planned");

                      // Match Planification page: consumed & engaged = billable sessions only
                      const billableDone = doneSessions.filter((s: R) => s.is_billable !== false);
                      const billablePlanned = plannedSessions.filter((s: R) => s.is_billable !== false);
                      const consumed = billableDone.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
                      const facturable = consumed;
                      const engaged = billablePlanned.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0) * hourlyRate, 0);
                      const pct = planBudget > 0 ? Math.round((consumed / planBudget) * 100) : 0;

                      const { remaining, remainingLabel, hasPlanned } = computePlanRemaining(plan);

                      const programName = (plan.training_programs as { name: string } | null)?.name ?? "Plan de formation";
                      const dealName = (plan.deals as { name: string } | null)?.name;
                      const label = dealName ? `${programName} — ${dealName}` : programName;

                      return { planId: plan.id as string, label, planBudget, consumed, engaged, remaining, remainingLabel, pct, facturable, hasPlanned };
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
                        <TableCell style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: p.remaining > 0 ? "#e74c3c" : "#27ae60" }}>{fmt(p.remaining)}</div>
                          {p.remainingLabel && <div style={{ fontSize: 10, color: "#8399a9" }}>{p.remainingLabel}</div>}
                        </TableCell>
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
          <option value="sessions_annulees">Sessions annulées</option>
          <option value="parcours_non_termines">Parcours non terminés</option>
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
        {!onlyOwnData && (
        <select value={filterExpert} onChange={(e) => setFilterExpert(e.target.value)}
          style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", background: "white", padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>
          <option value="">Tous les experts</option>
          {allExperts.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        )}
      </div>

      {selectedReport === "parcours_en_cours" && renderParcoursEnCours()}

      {selectedReport === "sessions_annulees" && (() => {
        const cancelled = sessions.filter((s: R) => s.status === "cancelled");
        if (cancelled.length === 0) return <div className="lca-card" style={{ padding: 24, textAlign: "center", color: "#8399a9" }}>Aucune session annulée</div>;
        return (
          <div className="lca-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1" }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", margin: 0 }}>Sessions annulées ({cancelled.length})</h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancelled.sort((a: R, b: R) => String(b.session_date).localeCompare(String(a.session_date))).map((s: R) => {
                    const sp = s.service_plans as R | null;
                    const company = sp?.companies as { id: string; name: string } | null;
                    const trainers = ((s.trainers as string[]) ?? []).join(", ");
                    return (
                      <TableRow key={String(s.id)}>
                        <TableCell style={{ fontWeight: 600 }}>{s.session_date ? format(new Date(String(s.session_date)), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                        <TableCell>
                          {company ? (
                            <span onClick={() => router.push(`/clients/${company.id}`)} style={{ color: "#1a6b9c", cursor: "pointer", fontWeight: 600, textDecoration: "underline dotted" }}>{company.name}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: s.session_type === "journee" ? "#fff3e0" : "#e8f0fe", color: s.session_type === "journee" ? "#FF6B35" : "#1a6b9c" }}>
                            {s.session_type === "journee" ? "Journée" : "VT"}
                          </span>
                        </TableCell>
                        <TableCell>{fmtDuration(s.duration_hours as number)}</TableCell>
                        <TableCell style={{ fontSize: 12, color: "#7a8bab" }}>{trainers || "—"}</TableCell>
                        <TableCell style={{ fontSize: 12, color: "#7a8bab", maxWidth: 200 }} className="truncate">{String(s.notes ?? "") || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })()}

      {selectedReport === "parcours_non_termines" && (() => {
        // Entreprises avec tous les plans terminés mais qui avaient des sessions
        const companyMap: Record<string, { companyId: string; companyName: string; totalSessions: number; doneSessions: number; cancelledSessions: number; budget: number; lastSessionDate: string }> = {};
        servicePlans.forEach((plan: R) => {
          const company = plan.companies as { id: string; name: string } | null;
          if (!company) return;
          const cid = company.id;
          if (!companyMap[cid]) companyMap[cid] = { companyId: cid, companyName: company.name, totalSessions: 0, doneSessions: 0, cancelledSessions: 0, budget: 0, lastSessionDate: "" };
          const c = companyMap[cid];
          c.budget += Number(plan.budget) || 0;
          const planSessions = sessions.filter((s: R) => s.service_plan_id === plan.id);
          planSessions.forEach((s: R) => {
            c.totalSessions++;
            if (s.status === "done" || s.status === "no_show") { c.doneSessions++; if (String(s.session_date) > c.lastSessionDate) c.lastSessionDate = String(s.session_date); }
            if (s.status === "cancelled") c.cancelledSessions++;
          });
        });
        // "Non terminé" = a des sessions done mais le plan est terminé prématurément (sessions annulées ou budget non consommé)
        const nonTermines = Object.values(companyMap).filter(c => {
          const plannedCount = c.totalSessions - c.doneSessions - c.cancelledSessions;
          return plannedCount === 0 && c.cancelledSessions > 0;
        }).sort((a, b) => b.cancelledSessions - a.cancelledSessions);

        if (nonTermines.length === 0) return <div className="lca-card" style={{ padding: 24, textAlign: "center", color: "#8399a9" }}>Aucun parcours non terminé avec sessions annulées</div>;
        return (
          <div className="lca-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1" }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", margin: 0 }}>Parcours avec sessions annulées ({nonTermines.length})</h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead className="text-center">Sessions faites</TableHead>
                    <TableHead className="text-center">Sessions annulées</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead>Dernière session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonTermines.map(c => (
                    <TableRow key={c.companyId}>
                      <TableCell>
                        <span onClick={() => router.push(`/clients/${c.companyId}`)} style={{ color: "#1a6b9c", cursor: "pointer", fontWeight: 600, textDecoration: "underline dotted" }}>{c.companyName}</span>
                      </TableCell>
                      <TableCell className="text-center" style={{ fontWeight: 600 }}>{c.doneSessions}</TableCell>
                      <TableCell className="text-center" style={{ fontWeight: 600, color: "#c62828" }}>{c.cancelledSessions}</TableCell>
                      <TableCell className="text-right" style={{ fontWeight: 600 }}>{fmt(c.budget)}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#7a8bab" }}>{c.lastSessionDate ? format(new Date(c.lastSessionDate), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })()}

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
