import Link from "next/link";
import { SalesChart } from "@/components/dashboard/sales-chart";
import {
  Target, TrendingUp, GraduationCap, Wallet, ArrowRight, Calendar, AlertTriangle, CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

async function getData() {
  const supabase = await createClient();
  const [
    { data: allDeals },
    { data: salesTargets },
    { data: trainingSessions },
    { data: servicePlans },
    { data: billingMonthsData },
    { data: monthlyChargesData },
  ] = await Promise.all([
    supabase.from("deals").select("*, team_members(first_name, last_name), contacts(first_name, last_name)"),
    supabase.from("sales_targets").select("*").order("month", { ascending: true }),
    supabase.from("training_sessions").select("*, service_plans(hourly_rate)").order("session_date", { ascending: true }),
    supabase.from("service_plans").select("id, budget, vt_planned, days_planned"),
    supabase.from("billing_months").select("id, amount, month, status"),
    supabase.from("monthly_charges").select("month, charges_ttc, encaisse_ttc, facture_ht, tresorerie"),
  ]);

  const deals = allDeals ?? [];
  const targets = salesTargets ?? [];
  const sessions = trainingSessions ?? [];
  const plans = servicePlans ?? [];

  // Won deals
  const wonDeals = deals.filter(d => d.stage === "closed_won");
  const totalCA = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const recentWonDeals = wonDeals.sort((a, b) => (b.close_date ?? b.created_at).localeCompare(a.close_date ?? a.created_at)).slice(0, 5);

  // Pipeline deals (not closed)
  const pipeDeals = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage));
  const totalPipe = pipeDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Deduplicate targets: keep only one entry per year-month (prefer end-of-month)
  const targetsByMonth = new Map<string, typeof targets[0]>();
  for (const t of targets) {
    const ym = (t.month as string).slice(0, 7); // "2025-09"
    const existing = targetsByMonth.get(ym);
    if (!existing || (t.month as string) > (existing.month as string)) {
      targetsByMonth.set(ym, t);
    }
  }
  const dedupedTargets = Array.from(targetsByMonth.values()).sort((a, b) => (a.month as string).localeCompare(b.month as string));

  // Annual target (only target_amount from deduplicated sales_targets)
  const annualTarget = dedupedTargets.reduce((s, t) => s + (Number(t.target_amount) || 0), 0) || 860000;
  const annualPct = annualTarget > 0 ? (totalCA / annualTarget) * 100 : 0;

  // Current month: compute actual from deals closed this month
  const nowDate = new Date();
  const currentMonthStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthCA = wonDeals.filter(d => (d.close_date ?? d.created_at ?? "").startsWith(currentMonthStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const lastTarget = targets.find(t => t.month && t.month.startsWith(currentMonthStr)) ?? targets[targets.length - 1];

  // Sessions stats
  const doneSessions = sessions.filter(s => s.status === "done" || s.status === "no_show");
  const allActiveSessions = sessions.filter(s => s.status !== "cancelled");
  const totalHoursDelivered = doneSessions.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0);
  const totalHoursPlanned = allActiveSessions.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0);

  // Hours sold from service plans
  const totalHoursSold = plans.reduce((s, p) => {
    return s + (Number(p.vt_planned) || 0) + (Number(p.days_planned) || 0) * 8;
  }, 0);
  const realizationPct = totalHoursSold > 0 ? (totalHoursDelivered / totalHoursSold * 100) : 0;

  // Facturable
  const totalFacturable = doneSessions.filter(s => s.is_billable !== false).reduce((s, sess) => {
    const rate = Number((sess.service_plans as any)?.hourly_rate) || 0;
    return s + (Number(sess.duration_hours) || 0) * rate;
  }, 0);
  const totalNonFacturable = doneSessions.filter(s => s.is_billable === false).reduce((s, sess) => {
    const rate = Number((sess.service_plans as any)?.hourly_rate) || 0;
    return s + (Number(sess.duration_hours) || 0) * rate;
  }, 0);
  const nonFactPct = (totalFacturable + totalNonFacturable) > 0 ? (totalNonFacturable / (totalFacturable + totalNonFacturable) * 100) : 0;

  // Billing-based KPIs
  const bms = billingMonthsData ?? [];
  const charges = monthlyChargesData ?? [];

  // Facturable ADV = total de tous les billing_months (commandes facturables)
  const facturableADV = bms.reduce((s: number, bm: any) => s + (Number(bm.amount) || 0), 0);

  // Facturé = cumul des facture_ht manuels, sinon calcul auto (facture + encaisse)
  const totalFacture = charges.reduce((s: number, c: any) => {
    const manual = Number(c.facture_ht) || 0;
    if (manual > 0) return s + manual;
    const mStr = c.month as string;
    const monthBms = bms.filter((bm: any) => (bm.month as string).startsWith(mStr));
    return s + monthBms.filter((bm: any) => bm.status === "facture" || bm.status === "encaisse").reduce((sum: number, bm: any) => sum + (Number(bm.amount) || 0), 0);
  }, 0);

  // Encaissé HT = override manuel si renseigné, sinon TTC / 1.2
  const totalEncaisse = charges.reduce((s: number, c: any) => {
    const manual = Number(c.encaisse_ht) || 0;
    if (manual > 0) return s + manual;
    const ttc = Number(c.encaisse_ttc) || 0;
    return s + (ttc > 0 ? ttc / 1.2 : 0);
  }, 0);

  // Décaissé = cumul charges HT from monthly_charges
  const totalDecaisse = charges.reduce((s: number, c: any) => {
    const ttc = Number(c.charges_ttc) || 0;
    return s + (ttc - ttc * 0.025); // charges HT = TTC - 2.5% TVA déductible
  }, 0);

  // Solde du compte = trésorerie du dernier mois renseigné
  const lastTresorerie = charges
    .filter((c: any) => Number(c.tresorerie) > 0)
    .sort((a: any, b: any) => (b.month as string).localeCompare(a.month as string))[0];
  const soldeCompte = lastTresorerie ? Number(lastTresorerie.tresorerie) : null;

  // Chart data: objectif from deduplicated targets, réalisé from won deals by end of month
  const chartData = dedupedTargets.filter(t => Number(t.target_amount) > 0).map((t, i, arr) => {
    const objCum = arr.slice(0, i + 1).reduce((s, x) => s + Number(x.target_amount), 0);
    // Use end of month to capture all deals closed within the month
    const monthEnd = (t.month as string).slice(0, 7); // "2025-09"
    const dealsUpToMonth = wonDeals.filter(d => {
      const dealMonth = (d.close_date ?? d.created_at ?? "").slice(0, 7);
      return dealMonth <= monthEnd;
    });
    const realCum = dealsUpToMonth.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const monthLabel = new Date(t.month).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
    return { month: monthLabel, objectifCumule: objCum, realiseCumule: realCum };
  });

  return {
    totalCA, totalPipe, totalFacturable, totalNonFacturable, nonFactPct,
    totalHoursDelivered, totalHoursSold, realizationPct,
    totalHoursPlanned,
    annualTarget, annualPct,
    monthName: nowDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    monthActual: currentMonthCA,
    monthTarget: Number(lastTarget?.target_amount ?? 80000),
    monthPct: Number(lastTarget?.target_amount) > 0 ? (currentMonthCA / Number(lastTarget?.target_amount)) * 100 : 0,
    recentOrders: recentWonDeals,
    pipeCount: pipeDeals.length,
    totalPipeAmount: totalPipe,
    sessionsCount: doneSessions.length,
    daysDelivered: Math.round(totalHoursDelivered / 8 * 10) / 10,
    daysPlanned: Math.round(totalHoursPlanned / 8 * 10) / 10,
    facturableADV, totalFacture, totalEncaisse, totalDecaisse, soldeCompte,
    chartData,
    targets: dedupedTargets,
  };
}

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const d = await getData();

  return (
    <div style={{ padding: 24 }} className="space-y-5">
      <h2 className="lca-handwritten" style={{ fontSize: 28, fontStyle: "italic" }}>
        Tableau de bord dirigeant
      </h2>

      {/* 7 KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard bar="green" label="Commandes réalisées" value={fmt(d.totalCA)} sub={`${d.annualPct.toFixed(1)}% de l'objectif`} subGreen />
        <KpiCard bar="blue" label="Facturable ADV" value={fmt(d.facturableADV)} sub={`Facturés : ${fmt(d.totalFacture)}`} />
        <KpiCard bar="green" label="Facturé" value={fmt(d.totalFacture)} sub={`Encaissés : ${fmt(d.totalEncaisse)}`} />
        <KpiCard bar="green" label="Encaissés" value={fmt(d.totalEncaisse)} sub={`Facturés : ${fmt(d.totalFacture)}`} />
        <KpiCard bar="orange" label="Décaissés" value={fmt(d.totalDecaisse)} sub={`Charges cumulées`} />
        <KpiCard bar="blue" label="Solde du compte" value={d.soldeCompte ? fmt(d.soldeCompte) : "—"} sub="Dernier mois disponible" />
        <KpiCard bar="orange" label="Réalisation heures" value={`${d.realizationPct.toFixed(1)}%`} sub={`${d.totalHoursDelivered.toFixed(0)}h / ${d.totalHoursSold}h vendues`} />
      </div>

      {/* Progression annuelle */}
      <div className="lca-card">
        <div className="lca-bar-gradient" />
        <div style={{ padding: 20 }}>
          <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
            <div>
              <div className="lca-label">Progression annuelle commandes</div>
              <div className="lca-sub">{fmt(d.totalCA)} sur {fmt(d.annualTarget)}</div>
            </div>
            <div className="lca-big-pct">{d.annualPct.toFixed(1)}%</div>
          </div>
          <ProgressBar pct={d.annualPct} />
          <div className="flex justify-between" style={{ marginTop: 10, fontSize: 12 }}>
            <span style={{ color: "#8399a9" }}>0 €</span>
            <span style={{ color: "#E8732A", fontWeight: 700 }}>{fmt(d.totalCA)}</span>
            <span style={{ color: "#8399a9" }}>{fmt(d.annualTarget)}</span>
          </div>
        </div>
      </div>

      {/* Mois en cours */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="lca-card">
          <div className="lca-bar-green" />
          <div style={{ padding: 20 }}>
            <div className="lca-label" style={{ textTransform: "uppercase" }}>{d.monthName}</div>
            <div className="lca-big-pct" style={{ marginTop: 6 }}>{fmt(d.monthActual)}</div>
            <div className="lca-sub">Objectif : {fmt(d.monthTarget)}</div>
            <div style={{ marginTop: 12 }}>
              {d.monthPct >= 100 ? (
                <span className="lca-badge-green"><CheckCircle style={{ width: 14, height: 14 }} /> Objectif atteint !</span>
              ) : (
                <span className="lca-badge-orange">{d.monthPct.toFixed(0)}% de l&apos;objectif</span>
              )}
            </div>
          </div>
        </div>

        <div className="lca-card">
          <div className="lca-bar-gradient-hot" />
          <div style={{ padding: 20 }}>
            <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
              <div className="lca-label">Progression du mois</div>
              <div className="lca-big-pct">{d.monthPct.toFixed(1)}%</div>
            </div>
            <ProgressBar pct={d.monthPct} />
            <div className="flex justify-between" style={{ marginTop: 10, fontSize: 12 }}>
              <span style={{ color: "#8399a9" }}>0 €</span>
              <span style={{ color: "#E8732A", fontWeight: 700 }}>{fmt(d.monthActual)}</span>
              <span style={{ color: "#8399a9" }}>{fmt(d.monthTarget)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graphique Tendance */}
      <SalesChart data={d.chartData} />

      {/* Commandes + Points d'attention */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="lca-card">
          <div className="lca-bar-blue" />
          <div style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a" }}>Dernières commandes</h3>
              <Link href="/orders" style={{ color: "#E8732A", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                Voir tout <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
            {d.recentOrders.length === 0 ? (
              <p style={{ color: "#8399a9", fontSize: 14 }}>Aucune commande</p>
            ) : d.recentOrders.map((o: Record<string, unknown>, i: number) => {
              const tm = o.team_members as Record<string, string> | null;
              return (
                <div key={i} className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: i < d.recentOrders.length - 1 ? "1px solid #eef1f6" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>{o.name as string}</div>
                    <div style={{ fontSize: 11, color: "#8399a9", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Calendar style={{ width: 12, height: 12 }} /> {fmtDate(o.close_date as string)}
                      {tm && <span>— {tm.first_name} {tm.last_name}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#27ae60" }}>{fmt(Number(o.amount))}</span>
                </div>
              );
            })}
          </div>
        </div>

        <PointsAttention
          annualPct={d.annualPct}
          annualTarget={d.annualTarget}
          totalCA={d.totalCA}
          totalFacturable={d.totalFacturable}
          totalNonFacturable={d.totalNonFacturable}
          nonFactPct={d.nonFactPct}
          realizationPct={d.realizationPct}
          totalHoursDelivered={d.totalHoursDelivered}
          totalHoursSold={d.totalHoursSold}
          daysDelivered={d.daysDelivered}
          daysPlanned={d.daysPlanned}
          targets={d.targets}
        />
      </div>

      {/* Accès rapides */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { href: "/leads", Icon: Target, color: "#1E2A5A", bg: "#edf4fc", label: "Sales Reports", sub: "Rapports commerciaux" },
          { href: "/deals", Icon: TrendingUp, color: "#E8732A", bg: "#fef0ea", label: "Pipeline", sub: `${fmt(d.totalPipeAmount)} en cours` },
          { href: "/delivery", Icon: GraduationCap, color: "#8e44ad", bg: "#f5eef8", label: "Delivery", sub: `${d.sessionsCount} sessions réalisées` },
          { href: "/synthese-service", Icon: Wallet, color: "#27ae60", bg: "#eaf7ef", label: "Synthèse Service", sub: `Facturable : ${fmt(d.totalFacturable)}` },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="lca-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div style={{ background: item.bg, borderRadius: 8, padding: 10 }}>
                <item.Icon style={{ width: 20, height: 20, color: item.color }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#8399a9" }}>{item.sub}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ bar, label, value, sub, subGreen }: { bar: string; label: string; value: string; sub?: string; subGreen?: boolean }) {
  const barColors: Record<string, string> = { green: "#27ae60", blue: "#1E2A5A", orange: "#E8732A" };
  return (
    <div className="lca-card">
      <div style={{ height: 5, background: barColors[bar] }} />
      <div style={{ padding: "14px 14px 12px" }}>
        <div className="lca-label">{label}</div>
        <div className="lca-value">{value}</div>
        {sub && <div className={subGreen ? "lca-sub-green" : "lca-sub"}>{sub}</div>}
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const w = Math.min(Math.max(pct, 0), 100);
  const over = pct > 100;
  return (
    <div className="lca-progress-wrapper">
      <div className="lca-progress-track">
        <div
          className="lca-progress-fill"
          style={{
            width: `${w}%`,
            background: over
              ? "linear-gradient(90deg, #0f1630 0%, #1E2A5A 25%, #E8732A 60%, #e74c3c 100%)"
              : "linear-gradient(90deg, #0f1630 0%, #1E2A5A 40%, #1E2A5A 70%, #E8732A 100%)",
          }}
        />
      </div>
      <div className="lca-progress-badge" style={{ left: `clamp(0px, calc(${w}% - 20px), calc(100% - 40px))` }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

function PointsAttention({
  annualPct, annualTarget, totalCA, totalFacturable, totalNonFacturable, nonFactPct,
  realizationPct, totalHoursDelivered, totalHoursSold, daysDelivered, daysPlanned, targets,
}: {
  annualPct: number; annualTarget: number; totalCA: number; totalFacturable: number;
  totalNonFacturable: number; nonFactPct: number; realizationPct: number;
  totalHoursDelivered: number; totalHoursSold: number; daysDelivered: number; daysPlanned: number;
  targets: { month: string; target_amount: number }[];
}) {
  function fmt(n: number) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  }

  // Calculate cumulative target up to current month from actual targets
  const now = new Date();
  const currentMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
  const targetCumule = targets
    .filter(t => (t.month as string) <= currentMonthEnd)
    .reduce((s, t) => s + (Number(t.target_amount) || 0), 0);
  const retard = Math.round(targetCumule - totalCA);
  const retardPct = targetCumule > 0 ? ((targetCumule - totalCA) / targetCumule * 100) : 0;

  const alertes: { icon: string; text: string }[] = [];
  if (retard > 0) {
    alertes.push({ icon: "⚠️", text: `Retard Commandes de ${fmt(retard)} vs objectif cumulé (${retardPct.toFixed(1)}%)` });
  }

  const vigilances: { icon: string; text: string }[] = [];
  if (nonFactPct > 10) {
    vigilances.push({ icon: "🧹", text: `Non facturable à ${nonFactPct.toFixed(1)}% (${fmt(totalNonFacturable)})` });
  }
  vigilances.push({ icon: "⏱️", text: `Taux de réalisation : ${realizationPct.toFixed(1)}% (${totalHoursDelivered.toFixed(0)}h / ${totalHoursSold}h vendues)` });

  const positifs: { icon: string; text: string }[] = [];
  if (daysPlanned > 0) {
    const planPct = daysDelivered / daysPlanned * 100;
    positifs.push({ icon: "✅", text: `Planification : ${daysDelivered}j délivrés / ${daysPlanned}j planifiés (${planPct.toFixed(0)}%)` });
  }
  if (totalFacturable > 0) {
    positifs.push({ icon: "📈", text: `Facturable cumulé : ${fmt(totalFacturable)}` });
  }

  return (
    <div className="lca-card">
      <div className="lca-bar-red" />
      <div style={{ padding: 20 }}>
        <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 16, marginBottom: 16 }}>
          Points d&apos;attention
        </h3>

        <div className="lca-label" style={{ marginBottom: 10, borderBottom: "1px solid #e6f0f7", paddingBottom: 6 }}>Alertes critiques</div>
        {alertes.length === 0 ? (
          <div style={{ padding: "10px 14px", background: "#e8f5e9", borderRadius: 8, borderLeft: "4px solid #27ae60", marginBottom: 8, fontSize: 13, color: "#27ae60", fontWeight: 500 }}>
            ✅ Aucune alerte critique
          </div>
        ) : alertes.map((a, i) => (
          <div key={i} style={{ padding: "10px 14px", background: "#fce4ec", borderRadius: 8, borderLeft: "4px solid #e74c3c", marginBottom: 8, fontSize: 13, color: "#c62828", fontWeight: 500 }}>
            {a.icon} {a.text}
          </div>
        ))}

        <div className="lca-label" style={{ marginTop: 16, marginBottom: 10, borderBottom: "1px solid #e6f0f7", paddingBottom: 6 }}>Points de vigilance</div>
        {vigilances.map((v, i) => (
          <div key={i} style={{ padding: "10px 14px", background: "#fff8e1", borderRadius: 8, borderLeft: "4px solid #f59e0b", marginBottom: 8, fontSize: 13, color: "#e65100", fontWeight: 500 }}>
            {v.icon} {v.text}
          </div>
        ))}

        <div className="lca-label" style={{ marginTop: 16, marginBottom: 10, borderBottom: "1px solid #e6f0f7", paddingBottom: 6 }}>Signaux positifs</div>
        {positifs.map((p, i) => (
          <div key={i} style={{ padding: "10px 14px", background: "#e8f5e9", borderRadius: 8, borderLeft: "4px solid #27ae60", marginBottom: 8, fontSize: 13, color: "#1b5e20", fontWeight: 500 }}>
            {p.icon} {p.text}
          </div>
        ))}
      </div>
    </div>
  );
}
