"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { getCurrentFiscalYearStart, getFiscalYearOptions } from "@/lib/fiscal-year";

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
function getFiscalYearFromStart(y: number) {
  return { start: `${y}-09-01`, end: `${y + 1}-08-31`, label: `${y % 100}/${(y + 1) % 100}` };
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

export function SyntheseServiceView({ sessions, servicePlans, deals, expertNames, deliverySessions }: { sessions: R[]; servicePlans: R[]; deals: R[]; expertNames?: string[]; deliverySessions?: R[] }) {
  const TRAINERS = expertNames && expertNames.length > 0 ? expertNames : TRAINERS_FALLBACK;
  const [selectedFY, setSelectedFY] = useState(() => getCurrentFiscalYearStart());
  const fy = useMemo(() => getFiscalYearFromStart(selectedFY), [selectedFY]);
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
  const plannedSessions = fySessions.filter((s: R) => s.status === "planned");
  const allActiveSessions = fySessions.filter((s: R) => s.status !== "cancelled");

  // Use deliverySessions for all "delivered" metrics
  const fyDelivery = (deliverySessions ?? []).filter((s: R) => inRange(s.session_date as string, fyStart, fyEnd));
  const totalHoursDelivered = fyDelivery.reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0);
  const totalHoursPlanned = totalHoursDelivered + plannedSessions.reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);

  // Total hours sold = sum of (vt_planned + days_planned*8) from service plans
  const totalHoursSold = servicePlans.reduce((sum: number, p: R) => {
    const vtH = (Number(p.vt_planned) || 0); // VT count - each VT is ~1-3h, approximate
    const dayH = (Number(p.days_planned) || 0) * 8;
    return sum + vtH + dayH;
  }, 0);

  const realizationRate = totalHoursSold > 0 ? (totalHoursDelivered / totalHoursSold * 100) : 0;

  // Facturable / non facturable from deliverySessions
  const deliveryFacturable = fyDelivery.reduce((sum: number, s: R) => sum + (Number(s.billable_amount) || 0), 0);
  const deliveryNonFacturable = fyDelivery.reduce((sum: number, s: R) => sum + (Number(s.non_billable_amount) || 0), 0);

  // Also compute facturable from training_sessions (done) using service_plan hourly_rate
  const doneFySessions = fySessions.filter((s: R) => s.status === "done" || s.status === "no_show");
  const tsFacturable = doneFySessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => {
    const hours = Number(s.duration_hours) || 0;
    const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
    return sum + hours * rate;
  }, 0);
  const tsNonFacturable = doneFySessions.filter((s: R) => s.is_billable === false).reduce((sum: number, s: R) => {
    const hours = Number(s.duration_hours) || 0;
    const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
    return sum + hours * rate;
  }, 0);

  // Combine both sources (use the higher value to avoid double-counting)
  const totalFacturable = Math.max(deliveryFacturable, tsFacturable);
  const totalNonFacturable = Math.max(deliveryNonFacturable, tsNonFacturable);

  const nonFactPct = (totalFacturable + totalNonFacturable) > 0 ? (totalNonFacturable / (totalFacturable + totalNonFacturable) * 100) : 0;

  // Average daily rate — from training_sessions (more up to date) or deliverySessions
  const tsBillableHours = doneFySessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
  const deliveryBillableHours = fyDelivery.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0);
  const billableHours = Math.max(tsBillableHours, deliveryBillableHours);
  const billableDays = hoursToJ(billableHours);
  const totalDaysDelivered = hoursToJ(totalHoursDelivered);
  const avgDailyRate = billableDays > 0 ? totalFacturable / billableDays : 0;

  // Days to plan = total capacity - done - already planned (all time, not just FY)
  const allPlanSessions = sessions.filter((s: R) => s.status !== "cancelled");
  const vtDone = allPlanSessions.filter((s: R) => s.session_type === "vt" && (s.status === "done" || s.status === "no_show")).length;
  const vtPlanned = allPlanSessions.filter((s: R) => s.session_type === "vt" && s.status === "planned").length;
  const vtTotal = servicePlans.reduce((s: number, p: R) => s + (Number(p.vt_planned) || 0), 0);
  const daysDoneCount = allPlanSessions.filter((s: R) => s.session_type === "journee" && (s.status === "done" || s.status === "no_show")).length;
  const daysDoneH = allPlanSessions.filter((s: R) => s.session_type === "journee" && (s.status === "done" || s.status === "no_show")).reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
  const daysPlannedCount = allPlanSessions.filter((s: R) => s.session_type === "journee" && s.status === "planned").length;
  const daysPlannedH = allPlanSessions.filter((s: R) => s.session_type === "journee" && s.status === "planned").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
  const daysTotal = servicePlans.reduce((s: number, p: R) => s + (Number(p.days_planned) || 0), 0);
  const remainingVt = Math.max(0, vtTotal - vtDone - vtPlanned);
  const remainingDays = Math.max(0, daysTotal - daysDoneCount - daysPlannedCount);
  // Avg journée duration from existing sessions, fallback to 8h
  const avgJourneeDur = (daysDoneCount + daysPlannedCount) > 0 ? (daysDoneH + daysPlannedH) / (daysDoneCount + daysPlannedCount) : 8;
  const hoursToplan = remainingVt + remainingDays * avgJourneeDur;
  const daysToplan = avgJourneeDur > 0 ? hoursToplan / avgJourneeDur : 0;

  // Unique trainers with data (from both sources)
  const activeTrainers = TRAINERS.filter(t => {
    const inTrainingSessions = fySessions.some((s: R) => ((s.trainers as string[]) ?? []).includes(t));
    const inDelivery = fyDelivery.some((s: R) => {
      const trainer = s.team_members as { first_name: string; last_name: string } | null;
      return trainer?.first_name === t;
    });
    return inTrainingSessions || inDelivery;
  });

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

  // ========== JOURS DELIVRES PAR MOIS (stacked bar) — from deliverySessions ==========
  const monthlyData = FISCAL_MONTHS.map((m, i) => {
    const yr = i < 4 ? parseInt(fy.start.slice(0, 4)) : parseInt(fy.start.slice(0, 4)) + 1;
    const monthStr = `${yr}-${m.key}`;
    const entry: Record<string, any> = { month: m.label };
    activeTrainers.forEach(t => {
      const hours = fyDelivery.filter((s: R) => {
        const d = (s.session_date as string).slice(0, 7);
        const trainer = s.team_members as { first_name: string; last_name: string } | null;
        return d === monthStr && trainer?.first_name === t;
      }).reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0);
      entry[t] = hoursToJ(hours);
    });
    return entry;
  });

  // ========== DETAIL CONSULTANT EXPERTS TABLE — all from deliverySessions ==========
  function computeDetailData(start: string, end: string) {
    const periodDelivery = (deliverySessions ?? []).filter((s: R) => inRange(s.session_date as string, start, end));

    return activeTrainers.map(t => {
      const tDelivery = periodDelivery.filter((ds: R) => {
        const trainer = ds.team_members as { first_name: string; last_name: string } | null;
        return trainer?.first_name === t;
      });

      // Portefeuille from service plans where trainer has sessions
      const companyIds = new Set<string>();
      tDelivery.forEach((s: R) => {
        const company = s.companies as { id: string; name: string } | null;
        if (company?.id) companyIds.add(company.id);
      });
      const portfolio = servicePlans.filter((p: R) => companyIds.has(p.company_id as string)).reduce((sum: number, p: R) => sum + (Number(p.budget) || 0), 0);

      // Hours from delivery: distanciel = visio, présentiel = présentiel
      const visioHours = tDelivery.filter((s: R) => s.delivery_mode === "distanciel").reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0);
      const presentielHours = tDelivery.filter((s: R) => s.delivery_mode === "présentiel").reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0);
      const totalPrevues = tDelivery.reduce((sum: number, s: R) => sum + (Number(s.hours_planned) || 0), 0);
      const totalDelivrees = tDelivery.reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0);

      const facturable = tDelivery.reduce((sum: number, s: R) => sum + (Number(s.billable_amount) || 0), 0);
      const nonFact = tDelivery.reduce((sum: number, s: R) => sum + (Number(s.non_billable_amount) || 0), 0);

      // Pipe = deals in pipeline
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
  // Source unique : training_sessions (done + planned + no_show), somme des duration_hours réelles
  function computeCmdData(start: string, end: string) {
    const periodSessions = sessions.filter((s: R) => inRange(s.session_date as string, start, end) && s.status !== "cancelled");

    return activeTrainers.map(t => {
      const tSessions = periodSessions.filter((s: R) => ((s.trainers as string[]) ?? []).includes(t));

      const presH = tSessions.filter((s: R) => s.session_type === "journee").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);
      const visioH = tSessions.filter((s: R) => s.session_type === "vt").reduce((sum: number, s: R) => sum + (Number(s.duration_hours) || 0), 0);

      // Facturable : sessions billable × hourly_rate
      const plannedFacturable = tSessions.filter((s: R) => s.is_billable !== false).reduce((sum: number, s: R) => {
        const hours = Number(s.duration_hours) || 0;
        const rate = Number((s.service_plans as R)?.hourly_rate) || 0;
        return sum + hours * rate;
      }, 0);

      return { trainer: t, totalH: visioH + presH, presH, visioH, plannedFacturable };
    });
  }

  const cmdRange = getDateRange(cmdPeriod, cmdIdx);
  const cmdData = computeCmdData(cmdRange.start, cmdRange.end);
  const cmdTotals = cmdData.reduce((acc, r) => ({ totalH: acc.totalH + r.totalH, presH: acc.presH + r.presH, visioH: acc.visioH + r.visioH, plannedFacturable: acc.plannedFacturable + r.plannedFacturable }), { totalH: 0, presH: 0, visioH: 0, plannedFacturable: 0 });

  // ========== VISIO VS PRESENTIEL CHART — from deliverySessions ==========
  const visioPresentielData = activeTrainers.map(t => {
    const tDelivery = fyDelivery.filter((s: R) => {
      const trainer = s.team_members as { first_name: string; last_name: string } | null;
      return trainer?.first_name === t;
    });
    const visio = hoursToJ(tDelivery.filter((s: R) => s.delivery_mode === "distanciel").reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0));
    const presentiel = hoursToJ(tDelivery.filter((s: R) => s.delivery_mode === "présentiel").reduce((sum: number, s: R) => sum + (Number(s.hours_delivered) || 0), 0));
    return { name: t, Visio: visio, Présentiel: presentiel };
  });

  // ========== FACTURABLE VS NON FACTURABLE CHART ==========
  const factNonFactData = activeTrainers.map(t => {
    const tDelivery = fyDelivery.filter((ds: R) => {
      const trainer = ds.team_members as { first_name: string; last_name: string } | null;
      return trainer?.first_name === t;
    });
    const fact = tDelivery.reduce((sum: number, s: R) => sum + (Number(s.billable_amount) || 0), 0);
    const nonF = tDelivery.reduce((sum: number, s: R) => sum + (Number(s.non_billable_amount) || 0), 0);
    return { name: t, Facturable: fact, "Non Facturable": nonF };
  });

  // Period selector component
  const fyOptions = getFiscalYearOptions(5);
  function PeriodSelector({ mode, setMode, idx, setIdx }: { mode: string; setMode: (v: string) => void; idx: number; setIdx: (v: number) => void }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#8399a9", textTransform: "uppercase" }}>Période :</span>
        <select
          value={mode === "year" ? `fy_${selectedFY}` : `${mode}_${idx}`}
          onChange={(e) => {
            const val = e.target.value;
            if (val.startsWith("fy_")) {
              setSelectedFY(Number(val.split("_")[1]));
              setMode("year");
              setIdx(0);
            } else {
              const [m, i] = val.split("_");
              setMode(m);
              setIdx(parseInt(i));
            }
          }}
          style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, fontWeight: 600, color: "#1a2a3a", cursor: "pointer" }}
        >
          <optgroup label="Année fiscale">
            {fyOptions.map(o => <option key={o.startYear} value={`fy_${o.startYear}`}>Année complète {o.label}</option>)}
          </optgroup>
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
      {/* Fiscal year selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#8399a9", textTransform: "uppercase" }}>Année fiscale :</span>
        <select
          value={selectedFY}
          onChange={(e) => setSelectedFY(Number(e.target.value))}
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 14, fontWeight: 700, color: "#1a2a3a", cursor: "pointer" }}
        >
          {getFiscalYearOptions(5).map(o => (
            <option key={o.startYear} value={o.startYear}>{o.label}</option>
          ))}
        </select>
      </div>

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
                  <th style={{ ...thStyleLeft, width: "25%" }}>CONSULTANT EXPERT</th>
                  <th style={thStyle}>TOTAL PLANIFIÉ</th>
                  <th style={thStyle}>PRÉSENTIEL</th>
                  <th style={thStyle}>VISIO</th>
                  <th style={thStyle}>FACTURABLE</th>
                </tr>
              </thead>
              <tbody>
                {cmdData.map(r => (
                  <tr key={r.trainer} style={{ cursor: "pointer" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f0f7fb"} onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                    <td style={tdStyleLeft}>{r.trainer}</td>
                    <td style={tdStyle}>{fmtJ(r.totalH)}</td>
                    <td style={tdStyle}>{fmtJ(r.presH)}</td>
                    <td style={tdStyle}>{fmtJ(r.visioH)}</td>
                    <td style={tdStyle}>{fmt(r.plannedFacturable)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...totalTdStyle, textAlign: "left", fontWeight: 800 }}>Total</td>
                  <td style={totalTdStyle}>{fmtJ(cmdTotals.totalH)}</td>
                  <td style={totalTdStyle}>{fmtJ(cmdTotals.presH)}</td>
                  <td style={totalTdStyle}>{fmtJ(cmdTotals.visioH)}</td>
                  <td style={totalTdStyle}>{fmt(cmdTotals.plannedFacturable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Visio vs Présentiel (Délivrées) */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Visio vs Présentiel (Délivrées)</h3>
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
