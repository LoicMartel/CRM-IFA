import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { SalesTargetsEditor } from "@/components/commercial/sales-targets-editor";

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

export default async function SyntheseSalesPage() {
  const supabase = await createClient();

  const [
    { data: salesTargets },
    { data: wonDeals },
    { data: pipeDeals },
  ] = await Promise.all([
    supabase.from("sales_targets").select("*").order("month", { ascending: true }),
    supabase.from("deals").select("*, team_members(first_name, last_name), lead_sources(name)").eq("stage", "closed_won").order("close_date", { ascending: false }),
    supabase.from("deals").select("id, amount, stage").not("stage", "in", '("closed_won","closed_lost")'),
  ]);

  const targets = salesTargets ?? [];
  const orders = wonDeals ?? [];
  const pipe = pipeDeals ?? [];

  // CA from won deals
  const totalCA = orders.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalPipe = pipe.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const annualTarget = targets.reduce((s, t) => s + (Number(t.target_amount) || 0), 0) || 860000;
  const annualPct = annualTarget > 0 ? (totalCA / annualTarget) * 100 : 0;

  // Current month from deals
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthCA = orders.filter(d => (d.close_date ?? d.created_at ?? "").startsWith(currentMonthStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const lastTarget = targets.find(t => t.month && (t.month as string).startsWith(currentMonthStr)) ?? targets[targets.length - 1];
  const monthActual = currentMonthCA;
  const monthTarget = Number(lastTarget?.target_amount ?? 80000);
  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Cumulative target up to current month from actual targets
  const currentMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
  const elapsedMonths = targets.filter(t => (t.month as string) <= currentMonthEnd).length;
  const targetCumule = targets
    .filter(t => (t.month as string) <= currentMonthEnd)
    .reduce((s, t) => s + (Number(t.target_amount) || 0), 0);
  const ecart = totalCA - targetCumule;

  // Chart data: objectif from targets, réalisé from won deals by month
  const chartData = targets.filter(t => Number(t.target_amount) > 0).map((t, i, arr) => {
    const objCum = arr.slice(0, i + 1).reduce((s, x) => s + Number(x.target_amount), 0);
    const monthEnd = t.month as string;
    const dealsUpToMonth = orders.filter(d => (d.close_date ?? d.created_at ?? "") <= monthEnd);
    const realCum = dealsUpToMonth.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const monthLabel = new Date(t.month).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
    return { month: monthLabel, objectifCumule: objCum, realiseCumule: realCum };
  });

  // Monthly breakdown: actual from deals per month (deduplicated by month)
  const monthlyMap = new Map<string, { month: string; target: number; actual: number }>();
  targets.filter(t => Number(t.target_amount) > 0).forEach((t) => {
    const mStr = (t.month as string).slice(0, 7); // "2025-09"
    if (monthlyMap.has(mStr)) return; // skip duplicates
    const monthDealsCA = orders.filter(d => (d.close_date ?? d.created_at ?? "").startsWith(mStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const target = Number(t.target_amount);
    monthlyMap.set(mStr, {
      month: new Date(t.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      target,
      actual: monthDealsCA,
    });
  });
  const monthlyData = Array.from(monthlyMap.values()).map(m => ({
    ...m,
    pct: m.target > 0 ? Math.round((m.actual / m.target) * 100) : 0,
  }));

  // Source breakdown from won deals
  const sourceMap: Record<string, number> = {};
  orders.forEach((o) => {
    const src = (o.lead_sources as { name: string } | null)?.name ?? "Autre";
    sourceMap[src] = (sourceMap[src] || 0) + (Number(o.amount) || 0);
  });
  const sourceData = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);

  // Expert breakdown from won deals
  const trainerMap: Record<string, number> = {};
  orders.forEach((o) => {
    const tm = o.team_members as { first_name: string; last_name: string } | null;
    const name = tm ? `${tm.first_name} ${tm.last_name}` : "Non assigné";
    trainerMap[name] = (trainerMap[name] || 0) + (Number(o.amount) || 0);
  });
  const trainerData = Object.entries(trainerMap).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Header title="Synthèse Sales" />
      <div className="p-6 space-y-5">
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-5">
          <SalesTargetsEditor
            targets={(targets as any).filter((t: any) => Number(t.target_amount) >= 0).map((t: any) => ({ id: t.id, month: t.month, target_amount: Number(t.target_amount) }))}
            annualTarget={annualTarget}
          />
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CA Commandes</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{fmt(totalCA)}</div>
            <div style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>{annualPct.toFixed(1)}% — {orders.length} deals gagnés</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Pipeline en cours</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totalPipe)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{pipe.length} deals actifs</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>{monthName}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{fmt(monthActual)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>Objectif : {fmt(monthTarget)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Écart vs objectif cumulé</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: ecart >= 0 ? "#27ae60" : "#e74c3c" }}>
              {ecart >= 0 ? "+" : ""}{fmt(ecart)}
            </div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{elapsedMonths} mois écoulés</div>
          </div>
        </div>

        {/* Chart */}
        <SalesChart data={chartData} />

        {/* Monthly breakdown + Sources */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Suivi mensuel */}
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

          {/* Sources + Experts */}
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
                  {sourceData.length === 0 && <p style={{ fontSize: 13, color: "#8399a9" }}>Aucune donnée</p>}
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
                  {trainerData.length === 0 && <p style={{ fontSize: 13, color: "#8399a9" }}>Aucune donnée</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
