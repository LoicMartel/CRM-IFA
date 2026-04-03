"use client";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";

type R = Record<string, unknown>;

const FM = [
  { key: "09", label: "Sept." }, { key: "10", label: "Oct." }, { key: "11", label: "Nov." }, { key: "12", label: "Déc." },
  { key: "01", label: "Janv." }, { key: "02", label: "Févr." }, { key: "03", label: "Mars" }, { key: "04", label: "Avr." },
  { key: "05", label: "Mai" }, { key: "06", label: "Juin" }, { key: "07", label: "Juil." }, { key: "08", label: "Août" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function pct(n: number) {
  return (n * 100).toFixed(2) + "%";
}

export function FinanceDashboard({ wonDeals, billingMonths, trainingSessions, monthlyCharges, salesTargets, monthlyFinances = [] }: {
  wonDeals: R[]; billingMonths: R[]; trainingSessions: R[]; monthlyCharges: R[]; salesTargets: R[]; monthlyFinances?: R[];
}) {
  const now = new Date();
  const fyYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  const chargeMap: Record<string, R> = {};
  monthlyCharges.forEach((c: R) => { chargeMap[c.month as string] = c; });

  const financeMap: Record<string, R> = {};
  monthlyFinances.forEach((f: R) => { financeMap[(f.month as string).slice(0, 7)] = f; });

  // Build monthly rows
  const months = FM.map((m, i) => {
    const yr = i < 4 ? fyYear : fyYear + 1;
    const mStr = `${yr}-${m.key}`;

    const commandes = wonDeals.filter((d: R) => ((d.close_date ?? d.created_at) as string).startsWith(mStr)).reduce((s: number, d: R) => s + (Number(d.amount) || 0), 0);

    const mSessions = trainingSessions.filter((s: R) => (s.session_date as string).startsWith(mStr));
    const doneBillable = mSessions.filter((s: R) => s.status === "done" && s.is_billable !== false);
    const delivre = doneBillable.reduce((s: number, sess: R) => {
      const rate = Number((sess.service_plans as R)?.hourly_rate) || 0;
      return s + (Number(sess.duration_hours) || 0) * rate;
    }, 0);

    // Facturable / Delivery = sessions done + billable × taux horaire (from delivery)
    const facturableDelivery = delivre;

    const ch = chargeMap[mStr] ?? {};

    // Facturable ADV = total billing_months du mois
    const mBms = billingMonths.filter((bm: R) => (bm.month as string).startsWith(mStr));
    const facturableADV = mBms.reduce((s: number, bm: R) => s + (Number(bm.amount) || 0), 0);

    // Facturé = override manuel sinon calcul auto (facture + encaisse)
    const factureManual = Number(ch.facture_ht) || 0;
    const factureCalc = mBms.filter((bm: R) => bm.status === "facture" || bm.status === "encaisse").reduce((s: number, bm: R) => s + (Number(bm.amount) || 0), 0);
    const facture = factureManual > 0 ? factureManual : factureCalc;

    // Encaissé HT = override manuel si renseigné, sinon TTC / 1.2
    const encaisseTTC = Number(ch.encaisse_ttc) || 0;
    const encaisseHTManual = Number(ch.encaisse_ht) || 0;
    const encaisse = encaisseHTManual > 0 ? encaisseHTManual : (encaisseTTC > 0 ? encaisseTTC / 1.2 : 0);

    // Décaissé = Charges HT (TTC - 2.5% TVA déductible)
    const chargesTTC = Number(ch.charges_ttc) || 0;
    const decaisse = chargesTTC - chargesTTC * 0.025;
    const rbstEmprunt = Number(ch.rbst_dettes) || 0;
    const charges = decaisse - rbstEmprunt; // Charges = Décaissé - Remb. emprunt

    const fin = financeMap[mStr] ?? {};
    const encours = Number(fin.client_receivables) || 0;

    const fluxTreso = encaisse - decaisse; // Flux = Encaissé - Décaissé
    const solde = Number(ch.tresorerie) || 0;
    const cashMgmt = decaisse > 0 ? fluxTreso / decaisse : 0; // Cash Mgmt = Flux / Décaissé

    const ebitda = facture - charges; // EBITDA = Facturé - Charges
    const ebitdaPct = facture > 0 ? ebitda / facture : 0; // EBITDA % = EBITDA / Facturé

    return {
      label: m.label, mStr, commandes, delivre, facturableDelivery, facturableADV,
      facture, encaisse, encours, decaisse, rbstEmprunt, charges,
      fluxTreso, solde, cashMgmt, ebitda, ebitdaPct,
    };
  });

  // Cumulative EBITDA
  let ebitdaCum = 0;
  const monthsWithCum = months.map(m => {
    ebitdaCum += m.ebitda;
    const facCum = months.slice(0, months.indexOf(m) + 1).reduce((s, x) => s + x.facture, 0); // Facturé cumulé
    return { ...m, ebitdaCum, ebitdaCumPct: facCum > 0 ? ebitdaCum / facCum : 0 };
  });

  // Totals
  const tot = {
    commandes: months.reduce((s, m) => s + m.commandes, 0),
    delivre: months.reduce((s, m) => s + m.delivre, 0),
    facturableDelivery: months.reduce((s, m) => s + m.facturableDelivery, 0),
    facturableADV: months.reduce((s, m) => s + m.facturableADV, 0),
    facture: months.reduce((s, m) => s + m.facture, 0),
    encaisse: months.reduce((s, m) => s + m.encaisse, 0),
    encours: [...months].reverse().find(m => m.encours > 0)?.encours ?? 0,
    decaisse: months.reduce((s, m) => s + m.decaisse, 0),
    rbstEmprunt: months.reduce((s, m) => s + m.rbstEmprunt, 0),
    charges: months.reduce((s, m) => s + m.charges, 0),
    fluxTreso: months.reduce((s, m) => s + m.fluxTreso, 0),
    ebitda: ebitdaCum,
  };

  const annualTarget = salesTargets.reduce((s: number, t: R) => s + (Number(t.target_amount) || 0), 0) || 860000;
  const objPct = annualTarget > 0 ? (tot.commandes / annualTarget * 100).toFixed(1) : "0";
  const lastMonthWithData = [...monthsWithCum].reverse().find(m => m.encaisse > 0 || m.commandes > 0);
  const lastFacture = [...months].reverse().find(m => m.facture > 0);
  const lastADV = [...months].reverse().find(m => m.facturableADV > 0);
  const lastSolde = [...months].reverse().find(m => m.solde > 0);

  // Chart data (only months with some data)
  const chartData = monthsWithCum.filter((_, i) => {
    const upTo = monthsWithCum.slice(0, i + 1);
    return upTo.some(m => m.commandes > 0 || m.encaisse > 0 || m.delivre > 0);
  });

  const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "6px 6px", textAlign: "center", color: "white", background: "#0d4f7a", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { fontSize: 11, padding: "5px 6px", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid #e8ecf1" };
  const tdLabelStyle: React.CSSProperties = { ...tdStyle, textAlign: "left", fontWeight: 700, color: "#1a2a3a", position: "sticky" as const, left: 0, background: "white", zIndex: 1 };

  function TdVal({ v, color }: { v: number; color?: string }) {
    return <td style={{ ...tdStyle, color: v === 0 ? "#ccc" : v < 0 ? "#e74c3c" : color ?? "#1a2a3a" }}>{fmt(v)}</td>;
  }
  function TdPct({ v }: { v: number }) {
    return <td style={{ ...tdStyle, color: v === 0 ? "#ccc" : v < 0 ? "#e74c3c" : "#27ae60", fontWeight: 600 }}>{(v * 100).toFixed(2)}%</td>;
  }

  return (
    <div className="space-y-5">
      {/* 6 KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#1a6b9c" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Commandes totales</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{fmt(tot.commandes)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>Obj +15% : {fmt(annualTarget)} | Obj +35%...</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#0d4f7a" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturable ADV</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{fmt(tot.facturableADV)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>Dernier : {lastADV ? `${fmt(lastADV.facturableADV)} (${lastADV.label})` : "—"}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#e74c3c" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturé</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{fmt(tot.facture)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>Dernier : {lastFacture ? `${fmt(lastFacture.facture)} (${lastFacture.label})` : "—"}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#27ae60" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Encaissés</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{fmt(tot.encaisse)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>Facturés : {fmt(tot.facture)}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#FF6B35" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Décaissé total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{fmt(tot.decaisse)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>Charges : {fmt(tot.charges)}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#8e44ad" }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>EBITDA Cumulé</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: tot.ebitda >= 0 ? "#1a2a3a" : "#e74c3c" }}>{fmt(tot.ebitda)}</div>
            <div style={{ fontSize: 11, color: tot.ebitda >= 0 ? "#27ae60" : "#e74c3c", fontWeight: 600 }}>{tot.facture > 0 ? (tot.ebitda / tot.facture * 100).toFixed(2) : 0}% ({lastMonthWithData?.label ?? ""})</div>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Funnel Financier */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Funnel Financier — Commandes → Facturé → Encaissé</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="label" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K €`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="commandes" name="Commandes" fill="#1a6b9c" radius={[3, 3, 0, 0]} />
                <Bar dataKey="delivre" name="Délivré" fill="#2ecc71" radius={[3, 3, 0, 0]} />
                <Bar dataKey="facture" name="Facturé" fill="#e74c3c" radius={[3, 3, 0, 0]} />
                <Bar dataKey="encaisse" name="Encaissé" fill="#FF6B35" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolution solde du compte */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Évolution du solde de compte</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData.filter(m => m.solde > 0 || m.encaisse > 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="label" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K €`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Area type="monotone" dataKey="solde" name="Solde du compte" stroke="#1a6b9c" fill="#e8f0fe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* EBITDA Mensuel */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>EBITDA Mensuel</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="label" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K €`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="ebitda" name="EBITDA" radius={[3, 3, 0, 0]} animationDuration={1000}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.ebitda >= 0 ? "#1a6b9c" : "#fce4ec"} stroke={entry.ebitda < 0 ? "#e74c3c" : "none"} strokeWidth={entry.ebitda < 0 ? 1 : 0} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash Management */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Cash Management (%)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                <XAxis dataKey="label" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8399a9", fontSize: 10 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line type="monotone" dataKey="cashMgmt" name="Cash Management %" stroke="#27ae60" strokeWidth={2} dot={{ fill: "#27ae60", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tableau Financier Complet */}
      <div className="lca-card" style={{ overflow: "hidden" }}>
        <div className="lca-bar-gradient" />
        <div style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Tableau Financier Complet</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 150 }}>INDICATEUR</th>
                  {monthsWithCum.map(m => <th key={m.mStr} style={thStyle}>{m.label.toUpperCase()}</th>)}
                  <th style={{ ...thStyle, background: "#0a3d5f" }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {/* Commandes */}
                <tr><td style={tdLabelStyle}>Commandes</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.commandes} />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.commandes)}</td></tr>
                <tr><td style={tdLabelStyle}>Délivré</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.delivre} color="#1a6b9c" />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.delivre)}</td></tr>
                <tr><td style={tdLabelStyle}>Facturable / Delivery</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.facturableDelivery} />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.facturableDelivery)}</td></tr>
                <tr><td style={tdLabelStyle}>Facturable / ADV</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.facturableADV} />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.facturableADV)}</td></tr>
                <tr><td style={tdLabelStyle}>Facturés</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.facture} color="#e74c3c" />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.facture)}</td></tr>
                <tr><td style={tdLabelStyle}>Encaissés</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.encaisse} color="#27ae60" />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.encaisse)}</td></tr>
                <tr style={{ background: "#f0faf0" }}><td style={{ ...tdLabelStyle, background: "#f0faf0" }}>Encours Clients</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.encours} color="#27ae60" />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#27ae60" }}>{fmt(tot.encours)}</td></tr>
                {/* Separator */}
                <tr><td colSpan={14} style={{ height: 2, background: "#dce8f0" }} /></tr>
                <tr><td style={tdLabelStyle}>Décaissé</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.decaisse} />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.decaisse)}</td></tr>
                <tr><td style={tdLabelStyle}>Remb. emprunt</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.rbstEmprunt} />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#0d4f7a" }}>{fmt(tot.rbstEmprunt)}</td></tr>
                <tr><td style={tdLabelStyle}>Charges</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.charges} color="#e74c3c" />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#e74c3c" }}>{fmt(tot.charges)}</td></tr>
                {/* Separator */}
                <tr><td colSpan={14} style={{ height: 2, background: "#dce8f0" }} /></tr>
                <tr><td style={tdLabelStyle}>Flux de trésorerie</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.fluxTreso} />)}<td style={{ ...tdStyle, fontWeight: 800, color: tot.fluxTreso >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(tot.fluxTreso)}</td></tr>
                <tr><td style={tdLabelStyle}>Solde du compte</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.solde} color="#1a6b9c" />)}<td style={{ ...tdStyle, fontWeight: 800, color: "#1a6b9c" }}>{lastSolde ? fmt(lastSolde.solde) : "—"}</td></tr>
                <tr><td style={tdLabelStyle}>Cash Management</td>{monthsWithCum.map(m => <TdPct key={m.mStr} v={m.cashMgmt} />)}<td style={{ ...tdStyle, fontWeight: 800 }}>{tot.decaisse > 0 ? (tot.fluxTreso / tot.decaisse * 100).toFixed(2) + "%" : "—"}</td></tr>
                {/* Separator */}
                <tr><td colSpan={14} style={{ height: 2, background: "#dce8f0" }} /></tr>
                <tr><td style={tdLabelStyle}>EBITDA</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.ebitda} />)}<td style={{ ...tdStyle, fontWeight: 800, color: tot.ebitda >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(tot.ebitda)}</td></tr>
                <tr><td style={tdLabelStyle}>EBITDA %</td>{monthsWithCum.map(m => <TdPct key={m.mStr} v={m.ebitdaPct} />)}<td style={{ ...tdStyle, fontWeight: 800 }}>{tot.facture > 0 ? (tot.ebitda / tot.facture * 100).toFixed(2) + "%" : "—"}</td></tr>
                <tr><td style={tdLabelStyle}>EBITDA Cumulé</td>{monthsWithCum.map(m => <TdVal key={m.mStr} v={m.ebitdaCum} />)}<td style={{ ...tdStyle, fontWeight: 800, color: ebitdaCum >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(ebitdaCum)}</td></tr>
                <tr><td style={tdLabelStyle}>EBITDA Cumulé %</td>{monthsWithCum.map(m => <TdPct key={m.mStr} v={m.ebitdaCumPct} />)}<td style={{ ...tdStyle, fontWeight: 800 }}>{tot.facture > 0 ? (ebitdaCum / tot.facture * 100).toFixed(2) + "%" : "—"}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
