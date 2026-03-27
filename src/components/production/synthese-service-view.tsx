"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";

type R = Record<string, unknown>;

const TRAINERS_FALLBACK = ["Alexandre", "Rafi", "Loïc", "Guillaume", "Iman"];
const TRAINER_COLORS: Record<string, string> = {
  Alexandre: "#1a6b9c",
  Rafi: "#2ecc71",
  Loïc: "#FF6B35",
  Guillaume: "#8399a9",
  Iman: "#8e44ad",
};

const FISCAL_MONTHS = [
  { key: "09", label: "Sept." }, { key: "10", label: "Oct." }, { key: "11", label: "Nov." }, { key: "12", label: "Déc." },
  { key: "01", label: "Janv." }, { key: "02", label: "Févr." }, { key: "03", label: "Mars" }, { key: "04", label: "Avr." },
  { key: "05", label: "Mai" }, { key: "06", label: "Juin" }, { key: "07", label: "Juil." }, { key: "08", label: "Août" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function hoursToJ(h: number) {
  return Math.round(h / 8 * 10) / 10;
}

function fmtJ(h: number) {
  const j = hoursToJ(h);
  return `${j}j`;
}

// Fiscal year: Sept Y to Aug Y+1
function getFiscalYear() {
  const now = new Date();
  const m = now.getMonth(); // 0-indexed
  const y = now.getFullYear();
  if (m >= 8) return { start: `${y}-09-01`, end: `${y + 1}-08-31`, label: `${y % 100}/${(y + 1) % 100}` };
  return { start: `${y - 1}-09-01`, end: `${y}-08-31`, label: `${(y - 1) % 100}/${y % 100}` };
}

function getQuarters(fy: { start: string }) {
  const y = parseInt(fy.start.slice(0, 4));
  return [
    { label: "T1 (Sept-Nov)", start: `${y}-09-01`, end: `${y}-11-30` },
    { label: "T2 (Déc-Fév)", start: `${y}-12-01`, end: `${y + 1}-02-28` },
    { label: "T3 (Mars-Mai)", start: `${y + 1}-03-01`, end: `${y + 1}-05-31` },
    { label: "T4 (Juin-Août)", start: `${y + 1}-06-01`, end: `${y + 1}-08-31` },
  ];
}

function getMonths(fy: { start: string }) {
  const y = parseInt(fy.start.slice(0, 4));
  return FISCAL_MONTHS.map((m, i) => {
    const yr = i < 4 ? y : y + 1;
    const daysInMonth = new Date(yr, parseInt(m.key), 0).getDate();
    return { label: `${m.label} ${yr}`, start: `${yr}-${m.key}-01`, end: `${yr}-${m.key}-${daysInMonth}` };
  });
}

export function SyntheseServiceView({ sessions, servicePlans, deals, expertNames }: { sessions: R[]; servicePlans: R[]; deals: R[]; expertNames?: string[] }) {
  const TRAINERS = expertNames && expertNames.length > 0 ? expertNames : TRAINERS_FALLBACK;
  const fy = getFiscalYear();
  const [detailPeriod, setDetailPeriod] = useState("year");
  const [detailIdx, setDetailIdx] = useState(0);
  const [cmdPeriod, setCmdPeriod] = useState("year");
  const [cmdIdx, setCmdIdx] = useState(0);

  const quarters = useMemo(() => getQuarters(fy), [fy.start]);
  const months = useMemo(() => getMonths(fy), [fy.start]);

  // Filter helpers
  function inRange(dateStr: string, start: string, end: string) {
    return dateStr >= start && dateStr <= end;
  }

  function getDateRange(mode: string, idx: number): { start: string; end: string } {
    if (mode === "year") return { start: fy.start, end: fy.end ?? `${parseInt(fy.start.slice(0, 4)) + 1}-08-31` };
    if (mode === "quarter") return quarters[idx] ?? quarters[0];
    return months[idx] ?? months[0];
  }

  function getPeriodLabel(mode: string, idx: number) {
    if (mode === "year") return `Année complète ${fy.label}`;
    if (mode === "quarter") return quarters[idx]?.label ?? "";
    return months[idx]?.label ?? "";
  }

  // ========== GLOBAL COMPUTATIONS (fiscal year) ==========
  const fyStart = fy.start;
  const fyEnd = `${parseInt(fy.start.slice(0, 4)) + 1}-08-31`;

  const fySessions = sessions.filter((s: R) => inRange(s.session_date as string, fyStart, fyEnd));
  const doneSessions = fySessions.filter((s: R) => s.status === "done");
  const plannedSessions = fySessions.filter((s: R) => s.status === "planned");
  const allActiveSessions = fySessions.filter((s: R) => s.status !== "cancelled");

  const totalHoursDelivered = doneSessions.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
  const totalHoursPlanned = allActiveSessions.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);

  // Total hours sold = sum of (vt_planned + days_planned*8) from service plans
  const totalHoursSold = servicePlans.reduce((sum: number, p: R) => {
    const vtH = (Number(p.vt_planned) || 0); // VT count - each VT is ~1-3h, approximate
    const dayH = (Number(p.days_planned) || 0) * 8;
    return sum + vtH + dayH;
  }, 0);

  const realizationRate = totalHoursSold > 0 ? (totalHoursDelivered / totalHoursSold * 100) : 0;

  // Facturable / non facturable
  const billableDone = doneSessions.filter((s: R) => s.is_billable !== false);
  const nonBillableDone = doneSessions.filter((s: R) => s.is_billable === false);

  const totalFacturable = billableDone.reduce((sum: number, s: R) => {
    const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
    return sum + (Number(s.duration_hours) || 0) * rate;
  }, 0);
  const totalNonFacturable = nonBillableDone.reduce((sum: number, s: R) => {
    const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
    return sum + (Number(s.duration_hours) || 0) * rate;
  }, 0);

  const nonFactPct = (totalFacturable + totalNonFacturable) > 0 ? (totalNonFacturable / (totalFacturable + totalNonFacturable) * 100) : 0;

  // Average daily rate
  const totalDaysDelivered = hoursToJ(totalHoursDelivered);
  const avgDailyRate = totalDaysDelivered > 0 ? totalFacturable / totalDaysDelivered : 0;

  // Days to plan = total training_days from won deals - total planned sessions hours / 8
  const wonDeals = deals.filter((d: R) => d.stage === "closed_won");
  const totalWonDays = wonDeals.reduce((sum: number, d: R) => sum + (Number(d.training_days) || 0), 0);
  const totalPlannedDays = hoursToJ(totalHoursPlanned);
  const daysToplan = Math.max(0, totalWonDays - totalPlannedDays);
  const hoursToplan = daysToplan * 8;

  // Unique trainers with data
  const activeTrainers = TRAINERS.filter(t => fySessions.some((s: R) => ((s.trainers as string[]) ?? []).includes(t)));

  // ========== PORTEFEUILLE BY TRAINER (bar chart) ==========
  const portfolioData = activeTrainers.map(t => {
    const trainerPlans = new Set<string>();
    fySessions.forEach((s: R) => {
      if (((s.trainers as string[]) ?? []).includes(t)) trainerPlans.add(s.service_plan_id as string);
    });
    const budget = Array.from(trainerPlans).reduce((sum, planId) => {
      const plan = servicePlans.find((p: R) => p.id === planId);
      return sum + (Number(plan?.budget) || 0);
    }, 0);
    return { name: t, montant: budget };
  });

  // ========== JOURS DELIVRES PAR MOIS (stacked bar) ==========
  const monthlyData = FISCAL_MONTHS.map((m, i) => {
    const yr = i < 4 ? parseInt(fy.start.slice(0, 4)) : parseInt(fy.start.slice(0, 4)) + 1;
    const monthStr = `${yr}-${m.key}`;
    const entry: Record<string, any> = { month: m.label };
    activeTrainers.forEach(t => {
      const hours = doneSessions.filter((s: R) => {
        const d = (s.session_date as string).slice(0, 7);
        return d === monthStr && ((s.trainers as string[]) ?? []).includes(t);
      }).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
      entry[t] = hoursToJ(hours);
    });
    return entry;
  });

  // ========== DETAIL CONSULTANT EXPERTS TABLE ==========
  function computeDetailData(start: string, end: string) {
    const periodSessions = sessions.filter((s: R) => inRange(s.session_date as string, start, end) && s.status !== "cancelled");
    const periodDone = periodSessions.filter((s: R) => s.status === "done");

    return activeTrainers.map(t => {
      const tSessions = periodSessions.filter((s: R) => ((s.trainers as string[]) ?? []).includes(t));
      const tDone = periodDone.filter((s: R) => ((s.trainers as string[]) ?? []).includes(t));

      // Portefeuille
      const planIds = new Set<string>();
      tSessions.forEach((s: R) => planIds.add(s.service_plan_id as string));
      const portfolio = Array.from(planIds).reduce((sum, pid) => {
        const p = servicePlans.find((pp: R) => pp.id === pid);
        return sum + (Number(p?.budget) || 0);
      }, 0);

      const visioHours = tSessions.filter((s: R) => s.session_type === "vt").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
      const presentielHours = tSessions.filter((s: R) => s.session_type === "journee").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
      const totalPrevues = visioHours + presentielHours;
      const totalDelivrees = tDone.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);

      const facturable = tDone.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => {
        const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
        return sum + (Number(s.duration_hours) || 0) * rate;
      }, 0);
      const nonFact = tDone.filter((s: R) => s.is_billable === false).reduce((sum: number, s: R) => {
        const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
        return sum + (Number(s.duration_hours) || 0) * rate;
      }, 0);

      // Pipe = deals in pipeline for companies where this trainer works
      const companyIds = new Set<string>();
      tSessions.forEach((s: R) => {
        const cid = (s.service_plans as R)?.company_id as string;
        if (cid) companyIds.add(cid);
      });
      const pipe = deals.filter((d: R) => companyIds.has(d.company_id as string) && !["closed_won", "closed_lost"].includes(d.stage as string)).length;

      return {
        trainer: t,
        portfolio, visioHours, presentielHours, totalPrevues, totalDelivrees,
        facturable, nonFact, pipe,
      };
    });
  }

  const detailRange = getDateRange(detailPeriod, detailIdx);
  const detailData = computeDetailData(detailRange.start, detailRange.end);
  const detailTotals = detailData.reduce((acc, r) => ({
    portfolio: acc.portfolio + r.portfolio,
    visioHours: acc.visioHours + r.visioHours,
    presentielHours: acc.presentielHours + r.presentielHours,
    totalPrevues: acc.totalPrevues + r.totalPrevues,
    totalDelivrees: acc.totalDelivrees + r.totalDelivrees,
    facturable: acc.facturable + r.facturable,
    nonFact: acc.nonFact + r.nonFact,
    pipe: acc.pipe + r.pipe,
  }), { portfolio: 0, visioHours: 0, presentielHours: 0, totalPrevues: 0, totalDelivrees: 0, facturable: 0, nonFact: 0, pipe: 0 });

  // ========== COMMANDES PLANIFIEES TABLE ==========
  function computeCmdData(start: string, end: string) {
    const periodSessions = sessions.filter((s: R) => inRange(s.session_date as string, start, end) && s.status !== "cancelled");
    return activeTrainers.map(t => {
      const tSessions = periodSessions.filter((s: R) => ((s.trainers as string[]) ?? []).includes(t));
      const visioH = tSessions.filter((s: R) => s.session_type === "vt").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
      const presH = tSessions.filter((s: R) => s.session_type === "journee").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
      return { trainer: t, totalH: visioH + presH, presH, visioH };
    });
  }

  const cmdRange = getDateRange(cmdPeriod, cmdIdx);
  const cmdData = computeCmdData(cmdRange.start, cmdRange.end);
  const cmdTotals = cmdData.reduce((acc, r) => ({ totalH: acc.totalH + r.totalH, presH: acc.presH + r.presH, visioH: acc.visioH + r.visioH }), { totalH: 0, presH: 0, visioH: 0 });

  // ========== VISIO VS PRESENTIEL CHART ==========
  const visioPresentielData = activeTrainers.map(t => {
    const tSessions = allActiveSessions.filter((s: R) => ((s.trainers as string[]) ?? []).includes(t));
    const visio = hoursToJ(tSessions.filter((s: R) => s.session_type === "vt").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0));
    const presentiel = hoursToJ(tSessions.filter((s: R) => s.session_type === "journee").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0));
    return { name: t, Visio: visio, Présentiel: presentiel };
  });

  // ========== FACTURABLE VS NON FACTURABLE CHART ==========
  const factNonFactData = activeTrainers.map(t => {
    const tDone = doneSessions.filter((s: R) => ((s.trainers as string[]) ?? []).includes(t));
    const fact = tDone.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => {
      const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
      return sum + (Number(s.duration_hours) || 0) * rate;
    }, 0);
    const nonF = tDone.filter((s: R) => s.is_billable === false).reduce((sum: number, s: R) => {
      const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
      return sum + (Number(s.duration_hours) || 0) * rate;
    }, 0);
    return { name: t, Facturable: fact, "Non Facturable": nonF };
  });

  // Period selector component
  function PeriodSelector({ mode, setMode, idx, setIdx }: { mode: string; setMode: (v: string) => void; idx: number; setIdx: (v: number) => void }) {
    const options = mode === "year" ? [{ label: `Année complète ${fy.label}` }] : mode === "quarter" ? quarters : months;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#8399a9", textTransform: "uppercase" }}>Période :</span>
        <select
          value={mode === "year" ? "year_0" : `${mode}_${idx}`}
          onChange={(e) => {
            const [m, i] = e.target.value.split("_");
            setMode(m);
            setIdx(parseInt(i));
          }}
          style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, fontWeight: 600, color: "#1a2a3a", cursor: "pointer" }}
        >
          <option value="year_0">Année complète {fy.label}</option>
          <optgroup label="Trimestriel">
            {quarters.map((q, i) => <option key={`q${i}`} value={`quarter_${i}`}>{q.label}</option>)}
          </optgroup>
          <optgroup label="Mensuel">
            {months.map((m, i) => <option key={`m${i}`} value={`month_${i}`}>{m.label}</option>)}
          </optgroup>
        </select>
      </div>
    );
  }

  const thStyle = { fontSize: 11, fontWeight: 700 as const, color: "white", padding: "8px 10px", textAlign: "center" as const, background: "#0d4f7a" };
  const thStyleLeft = { ...thStyle, textAlign: "left" as const };
  const tdStyle = { fontSize: 13, padding: "8px 10px", textAlign: "center" as const, borderBottom: "1px solid #e8ecf1", color: "#1a2a3a" };
  const tdStyleLeft = { ...tdStyle, textAlign: "left" as const, fontWeight: 600 as const };
  const totalTdStyle = { ...tdStyle, fontWeight: 800 as const, color: "#0d4f7a", borderTop: "2px solid #0d4f7a" };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#1a6b9c" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Jours planifiés / délivrés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmtJ(totalHoursDelivered)} / {fmtJ(totalHoursPlanned)}</div>
            <div style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>{totalHoursPlanned > 0 ? (totalHoursDelivered / totalHoursPlanned * 100).toFixed(1) : 0}% planif.</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#2ecc71" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taux de réalisation</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{realizationRate.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: "#5a6f80" }}>{totalHoursDelivered.toFixed(0)}h réalisées sur {totalHoursSold}h vendues</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#FF6B35" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taux moyen journalier</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmt(avgDailyRate)}</div>
            <div style={{ fontSize: 11, color: "#e74c3c", fontWeight: 600 }}>Goal : 2 500 €</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#8e44ad" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Commandes à planifier</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{Math.round(daysToplan)} jours</div>
            <div style={{ fontSize: 11, color: "#5a6f80" }}>{Math.round(hoursToplan)} heures</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#27ae60" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturable sur Delivery</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmt(totalFacturable)}</div>
            <div style={{ fontSize: 11, color: "#5a6f80" }}>{activeTrainers.length} Experts</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#e74c3c" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total non facturable</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmt(totalNonFacturable)}</div>
            <div style={{ fontSize: 11, color: "#e74c3c", fontWeight: 600 }}>{nonFactPct.toFixed(1)}% du total</div>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Portefeuille par Expert */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Portefeuille par Expert</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={portfolioData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="name" tick={{ fill: "#1a2a3a", fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K €`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="montant" radius={[4, 4, 0, 0]} animationDuration={1000}>
                  {portfolioData.map((entry, i) => (
                    <Cell key={i} fill={TRAINER_COLORS[entry.name] ?? "#8399a9"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jours de Formation Délivrés par Mois */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Jours de Formation Délivrés par Mois</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${v}j`} />
                <Tooltip formatter={(v) => `${v}j`} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                {activeTrainers.map(t => (
                  <Bar key={t} dataKey={t} stackId="a" fill={TRAINER_COLORS[t]} radius={[0, 0, 0, 0]} animationDuration={1000} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Commandes délivrées par Expert */}
      <div className="lca-card">
        <div className="lca-bar-gradient" />
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a" }}>Commandes délivrées par Expert</h3>
            <PeriodSelector mode={detailPeriod} setMode={setDetailPeriod} idx={detailIdx} setIdx={setDetailIdx} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyleLeft}>EXPERT</th>
                  <th style={thStyle}>PORTEFEUILLE</th>
                  <th style={thStyle}>VISIO</th>
                  <th style={thStyle}>PRÉSENTIEL</th>
                  <th style={thStyle}>TOTAL PRÉVUES</th>
                  <th style={thStyle}>TOTAL DÉLIVRÉES</th>
                  <th style={thStyle}>FACTURABLE</th>
                  <th style={thStyle}>NON FACT.</th>
                  <th style={thStyle}>PIPE</th>
                </tr>
              </thead>
              <tbody>
                {detailData.map(r => (
                  <tr key={r.trainer} style={{ cursor: "pointer" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f0f7fb"} onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                    <td style={tdStyleLeft}>{r.trainer}</td>
                    <td style={tdStyle}>{fmt(r.portfolio)}</td>
                    <td style={tdStyle}>{fmtJ(r.visioHours)}</td>
                    <td style={tdStyle}>{fmtJ(r.presentielHours)}</td>
                    <td style={tdStyle}>{fmtJ(r.totalPrevues)}</td>
                    <td style={tdStyle}>{fmtJ(r.totalDelivrees)}</td>
                    <td style={tdStyle}>{fmt(r.facturable)}</td>
                    <td style={tdStyle}>{fmt(r.nonFact)}</td>
                    <td style={tdStyle}>{r.pipe}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...totalTdStyle, textAlign: "left", fontWeight: 800 }}>Total</td>
                  <td style={totalTdStyle}>{fmt(detailTotals.portfolio)}</td>
                  <td style={totalTdStyle}>{fmtJ(detailTotals.visioHours)}</td>
                  <td style={totalTdStyle}>{fmtJ(detailTotals.presentielHours)}</td>
                  <td style={totalTdStyle}>{fmtJ(detailTotals.totalPrevues)}</td>
                  <td style={totalTdStyle}>{fmtJ(detailTotals.totalDelivrees)}</td>
                  <td style={totalTdStyle}>{fmt(detailTotals.facturable)}</td>
                  <td style={totalTdStyle}>{fmt(detailTotals.nonFact)}</td>
                  <td style={totalTdStyle}>{detailTotals.pipe}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Commandes Planifiées par Expert */}
      <div className="lca-card">
        <div className="lca-bar-gradient" />
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a" }}>Commandes Planifiées par Expert</h3>
            <PeriodSelector mode={cmdPeriod} setMode={setCmdPeriod} idx={cmdIdx} setIdx={setCmdIdx} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyleLeft, width: "30%" }}>CONSULTANT EXPERT</th>
                  <th style={thStyle}>TOTAL PLANIFIÉ</th>
                  <th style={thStyle}>PRÉSENTIEL</th>
                  <th style={thStyle}>VISIO</th>
                </tr>
              </thead>
              <tbody>
                {cmdData.map(r => (
                  <tr key={r.trainer} style={{ cursor: "pointer" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f0f7fb"} onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                    <td style={tdStyleLeft}>{r.trainer}</td>
                    <td style={tdStyle}>{fmtJ(r.totalH)}</td>
                    <td style={tdStyle}>{fmtJ(r.presH)}</td>
                    <td style={tdStyle}>{fmtJ(r.visioH)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...totalTdStyle, textAlign: "left", fontWeight: 800 }}>Total</td>
                  <td style={totalTdStyle}>{fmtJ(cmdTotals.totalH)}</td>
                  <td style={totalTdStyle}>{fmtJ(cmdTotals.presH)}</td>
                  <td style={totalTdStyle}>{fmtJ(cmdTotals.visioH)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Visio vs Présentiel (Prévues) */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Visio vs Présentiel (Prévues)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={visioPresentielData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="name" tick={{ fill: "#1a2a3a", fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${v}j`} />
                <Tooltip formatter={(v) => `${v}j`} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Bar dataKey="Visio" fill="#1a6b9c" radius={[4, 4, 0, 0]} animationDuration={1000} />
                <Bar dataKey="Présentiel" fill="#FF6B35" radius={[4, 4, 0, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Facturable vs Non Facturable par Expert */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Facturable vs Non Facturable par Expert</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={factNonFactData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis type="number" tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K €`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#1a2a3a", fontSize: 12, fontWeight: 600 }} width={80} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Bar dataKey="Facturable" stackId="a" fill="#2ecc71" radius={[0, 0, 0, 0]} animationDuration={1000} />
                <Bar dataKey="Non Facturable" stackId="a" fill="#e74c3c" radius={[0, 4, 4, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
