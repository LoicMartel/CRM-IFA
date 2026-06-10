"use client";

import { useState } from "react";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { SalesTargetsEditor } from "@/components/commercial/sales-targets-editor";
import { getCurrentFiscalYearStart, getFiscalYearOptions } from "@/lib/fiscal-year";

type R = Record<string, unknown>;

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "0 \u20ac";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " \u20ac";
}

const FY_MONTHS = [
  { key: "09", label: "sept" }, { key: "10", label: "oct" }, { key: "11", label: "nov" }, { key: "12", label: "d\u00e9c" },
  { key: "01", label: "janv" }, { key: "02", label: "f\u00e9vr" }, { key: "03", label: "mars" }, { key: "04", label: "avr" },
  { key: "05", label: "mai" }, { key: "06", label: "juin" }, { key: "07", label: "juil" }, { key: "08", label: "ao\u00fbt" },
];

interface Props {
  targets: R[];
  orders: R[];
  pipe: R[];
}

export function SyntheseSalesContent({ targets, orders, pipe }: Props) {
  const [fyYear, setFyYear] = useState(() => getCurrentFiscalYearStart());

  // Filter orders and targets by selected fiscal year
  const fyFrom = `${fyYear}-09`;
  const fyTo = `${fyYear + 1}-08`;

  const fyOrders = orders.filter(d => {
    const date = ((d.close_date ?? d.created_at ?? "") as string).slice(0, 7);
    return date >= fyFrom && date <= fyTo;
  });

  const fyTargets = targets.filter(t => {
    const m = (t.month as string).slice(0, 7);
    return m >= fyFrom && m <= fyTo;
  });

  const totalCA = fyOrders.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalPipe = pipe.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const annualTarget = fyTargets.reduce((s, t) => s + (Number(t.target_amount) || 0), 0) || 860000;
  const annualPct = annualTarget > 0 ? (totalCA / annualTarget) * 100 : 0;

  // Current month
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthCA = fyOrders.filter(d => ((d.close_date ?? d.created_at ?? "") as string).startsWith(currentMonthStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const lastTarget = fyTargets.find(t => t.month && (t.month as string).startsWith(currentMonthStr)) ?? fyTargets[fyTargets.length - 1];
  const monthTarget = Number(lastTarget?.target_amount ?? 80000);
  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Cumulative target up to current month
  const currentMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
  const elapsedMonths = fyTargets.filter(t => (t.month as string) <= currentMonthEnd).length;
  const targetCumule = fyTargets.filter(t => (t.month as string) <= currentMonthEnd).reduce((s, t) => s + (Number(t.target_amount) || 0), 0);
  const ecart = totalCA - targetCumule;

  // Chart data
  let objCum = 0;
  let realCum = 0;
  const chartData = FY_MONTHS.map((m) => {
    const yr = parseInt(m.key) >= 9 ? fyYear : fyYear + 1;
    const mStr = `${yr}-${m.key}`;
    const target = fyTargets.find(t => (t.month as string).startsWith(mStr));
    objCum += Number(target?.target_amount) || 0;
    const monthDeals = fyOrders.filter(d => ((d.close_date ?? d.created_at ?? "") as string).startsWith(mStr));
    realCum += monthDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    return { month: m.label, objectifCumule: objCum, realiseCumule: realCum };
  });

  // Monthly breakdown
  const monthlyMap = new Map<string, { month: string; target: number; actual: number }>();
  fyTargets.filter(t => Number(t.target_amount) > 0).forEach((t) => {
    const mStr = (t.month as string).slice(0, 7);
    if (monthlyMap.has(mStr)) return;
    const monthDealsCA = fyOrders.filter(d => ((d.close_date ?? d.created_at ?? "") as string).startsWith(mStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const target = Number(t.target_amount);
    monthlyMap.set(mStr, {
      month: new Date(t.month as string).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      target,
      actual: monthDealsCA,
    });
  });
  const monthlyData = Array.from(monthlyMap.values()).map(m => ({
    ...m,
    pct: m.target > 0 ? Math.round((m.actual / m.target) * 100) : 0,
  }));

  // Source breakdown
  const sourceMap: Record<string, number> = {};
  fyOrders.forEach((o) => {
    const src = (o.lead_sources as { name: string } | null)?.name ?? "Autre";
    sourceMap[src] = (sourceMap[src] || 0) + (Number(o.amount) || 0);
  });
  const sourceData = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);

  // Expert breakdown
  const trainerMap: Record<string, number> = {};
  fyOrders.forEach((o) => {
    const tm = o.team_members as { first_name: string; last_name: string } | null;
    const name = tm ? `${tm.first_name} ${tm.last_name}` : "Non assign\u00e9";
    trainerMap[name] = (trainerMap[name] || 0) + (Number(o.amount) || 0);
  });
  const trainerData = Object.entries(trainerMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-6 space-y-5">
      {/* Fiscal year selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#8399a9", textTransform: "uppercase" }}>Ann\u00e9e fiscale :</span>
        <select
          value={fyYear}
          onChange={(e) => setFyYear(Number(e.target.value))}
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 14, fontWeight: 700, color: "#1a2a3a", cursor: "pointer" }}
        >
          {getFiscalYearOptions(5).map(o => (
            <option key={o.startYear} value={o.startYear}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <SalesTargetsEditor
          targets={(fyTargets as any).filter((t: any) => Number(t.target_amount) >= 0).map((t: any) => ({ id: t.id, month: t.month, target_amount: Number(t.target_amount) }))}
          annualTarget={annualTarget}
        />
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CA Commandes</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{fmt(totalCA)}</div>
          <div style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>{annualPct.toFixed(1)}% — {fyOrders.length} deals gagn\u00e9s</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Pipeline en cours</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totalPipe)}</div>
          <div style={{ fontSize: 11, color: "#8399a9" }}>{pipe.length} deals actifs</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>{monthName}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmt(currentMonthCA)}</div>
          <div style={{ fontSize: 11, color: "#8399a9" }}>Objectif : {fmt(monthTarget)}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>\u00c9cart vs objectif cumul\u00e9</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: ecart >= 0 ? "#27ae60" : "#e74c3c" }}>
            {ecart >= 0 ? "+" : ""}{fmt(ecart)}
          </div>
          <div style={{ fontSize: 11, color: "#8399a9" }}>{elapsedMonths} mois \u00e9coul\u00e9s</div>
        </div>
      </div>

      {/* Chart */}
      <SalesChart data={chartData} />

      {/* Monthly breakdown + Sources */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="lca-card">
          <div style={{ height: 4, background: "#1a6b9c" }} />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Suivi mensuel</h3>
            <div className="space-y-2">
              {monthlyData.map((m) => (
                <div key={m.month} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid #e6f0f7" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", textTransform: "capitalize" }}>{m.month}</div>
                    <div style={{ fontSize: 11, color: "#8399a9" }}>Obj: {fmt(m.target)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: m.pct >= 100 ? "#27ae60" : "#1a2a3a" }}>{fmt(m.actual)}</div>
                    <div style={{ fontSize: 11, color: m.pct >= 100 ? "#27ae60" : m.pct > 0 ? "#FF6B35" : "#8399a9", fontWeight: 600 }}>
                      {m.pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="lca-card">
            <div style={{ height: 4, background: "#FF6B35" }} />
            <div style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Par source</h3>
              <div className="space-y-2">
                {sourceData.map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between" style={{ padding: "4px 0", borderBottom: "1px solid #e6f0f7" }}>
                    <span style={{ fontSize: 13, color: "#1a2a3a" }}>{name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#FF6B35" }}>{fmt(amount)}</span>
                  </div>
                ))}
                {sourceData.length === 0 && <p style={{ fontSize: 13, color: "#8399a9" }}>Aucune donn\u00e9e</p>}
              </div>
            </div>
          </div>

          <div className="lca-card">
            <div style={{ height: 4, background: "#27ae60" }} />
            <div style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Par Expert</h3>
              <div className="space-y-2">
                {trainerData.map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between" style={{ padding: "4px 0", borderBottom: "1px solid #e6f0f7" }}>
                    <span style={{ fontSize: 13, color: "#1a2a3a" }}>{name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#27ae60" }}>{fmt(amount)}</span>
                  </div>
                ))}
                {trainerData.length === 0 && <p style={{ fontSize: 13, color: "#8399a9" }}>Aucune donn\u00e9e</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
