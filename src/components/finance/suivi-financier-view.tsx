"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type R = Record<string, unknown>;

const FISCAL_MONTHS = [
  { key: "09", label: "sept." }, { key: "10", label: "oct." }, { key: "11", label: "nov." }, { key: "12", label: "déc." },
  { key: "01", label: "janv." }, { key: "02", label: "févr." }, { key: "03", label: "mars" }, { key: "04", label: "avr." },
  { key: "05", label: "mai" }, { key: "06", label: "juin" }, { key: "07", label: "juil." }, { key: "08", label: "août" },
];

function fmt(n: number) {
  if (n === 0) return "0,00 €";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";
}

function fmtShort(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

export function SuiviFinancierView({ salesTargets, wonDeals, billingMonths, monthlyCharges }: {
  salesTargets: R[]; wonDeals: R[]; billingMonths: R[]; monthlyCharges: R[];
}) {
  const router = useRouter();
  const [editingCell, setEditingCell] = useState<{ month: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const defaultFY = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const [fyYear, setFyYear] = useState(defaultFY);

  // Available fiscal years (from 2024 to current+1)
  const fyOptions = Array.from({ length: 4 }, (_, i) => defaultFY - 2 + i);

  // Build charge map
  const chargeMap: Record<string, R> = {};
  monthlyCharges.forEach((c: R) => { chargeMap[c.month as string] = c; });

  // Build month data
  const monthData = FISCAL_MONTHS.map((m, i) => {
    const yr = i < 4 ? fyYear : fyYear + 1;
    const mStr = `${yr}-${m.key}`;
    const mLabel = `${m.label}-${String(yr).slice(2)}`;

    // Objectif Commandes
    const target = salesTargets.find((t: R) => (t.month as string).startsWith(mStr));
    const objectif = Number(target?.target_amount) || 0;

    // Commandes (deals gagnés)
    const commandes = wonDeals.filter((d: R) => ((d.close_date ?? d.created_at) as string).startsWith(mStr))
      .reduce((s: number, d: R) => s + (Number(d.amount) || 0), 0);

    // Manual charges
    const charges = chargeMap[mStr] ?? {};

    // Billing months by status
    const mBilling = billingMonths.filter((bm: R) => (bm.month as string).startsWith(mStr));
    const commandesFacturable = mBilling.reduce((s: number, bm: R) => s + (Number(bm.amount) || 0), 0);
    // Facturé = auto-calculé (facture + encaisse) avec override manuel possible
    const factureCalc = mBilling.filter((bm: R) => bm.status === "facture" || bm.status === "encaisse").reduce((s: number, bm: R) => s + (Number(bm.amount) || 0), 0);
    const factureManual = Number(charges.facture_ht) || 0;
    const facture = factureManual > 0 ? factureManual : factureCalc;

    // Encaissé TTC = saisie manuelle dans monthly_charges
    const encaisseTTC = Number(charges.encaisse_ttc) || 0;
    // Encaissé HT = override manuel si renseigné, sinon TTC / 1.2
    const encaisseHTManual = Number(charges.encaisse_ht) || 0;
    const encaisseHT = encaisseHTManual > 0 ? encaisseHTManual : (encaisseTTC > 0 ? encaisseTTC / 1.2 : 0);
    const tvaCollecte = encaisseTTC - encaisseHT;
    const rhPrev = Number(charges.rh_previsionnel) || 0;
    const chargesDiverses = Number(charges.charges_diverses) || 0;
    const chargesTTC = Number(charges.charges_ttc) || 0;
    const tvaDeductible = chargesTTC * 0.025;
    const chargesHT = chargesTTC - tvaDeductible;
    const resultat = encaisseTTC - chargesTTC;
    const tresorerie = Number(charges.tresorerie) || 0;
    const rbstDettes = Number(charges.rbst_dettes) || 0;
    const pretPGE = Number(charges.pret_pge) || 0;
    const pretBPI = Number(charges.pret_boost_bpi) || 0;
    const pretTreso = Number(charges.pret_tresorerie) || 0;

    return {
      mStr, mLabel, objectif, commandes, commandesFacturable, facture,
      encaisseTTC, tvaCollecte, encaisseHT,
      rhPrev, chargesDiverses, chargesTTC, tvaDeductible, chargesHT,
      resultat, tresorerie, rbstDettes, pretPGE, pretBPI, pretTreso,
    };
  });

  // Cumuls
  const cumul = {
    objectif: monthData.reduce((s, m) => s + m.objectif, 0),
    commandes: monthData.reduce((s, m) => s + m.commandes, 0),
    commandesFacturable: monthData.reduce((s, m) => s + m.commandesFacturable, 0),
    facture: monthData.reduce((s, m) => s + m.facture, 0),
    encaisseTTC: monthData.reduce((s, m) => s + m.encaisseTTC, 0),
    tvaCollecte: monthData.reduce((s, m) => s + m.tvaCollecte, 0),
    encaisseHT: monthData.reduce((s, m) => s + m.encaisseHT, 0),
    chargesTTC: monthData.reduce((s, m) => s + m.chargesTTC, 0),
    tvaDeductible: monthData.reduce((s, m) => s + m.tvaDeductible, 0),
    chargesHT: monthData.reduce((s, m) => s + m.chargesHT, 0),
    resultat: monthData.reduce((s, m) => s + m.resultat, 0),
  };

  async function saveManualField(month: string, field: string, value: number) {
    setSaving(true);
    const supabase = createClient();
    const existing = chargeMap[month];
    if (existing?.id) {
      await supabase.from("monthly_charges").update({ [field]: value }).eq("id", existing.id as string);
    } else {
      await supabase.from("monthly_charges").insert({ month, [field]: value });
    }
    setSaving(false);
    setEditingCell(null);
    router.refresh();
  }

  function ManualCell({ month, field, value }: { month: string; field: string; value: number }) {
    const isEditing = editingCell?.month === month && editingCell?.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveManualField(month, field, parseFloat(editValue) || 0)}
          onKeyDown={(e) => { if (e.key === "Enter") saveManualField(month, field, parseFloat(editValue) || 0); if (e.key === "Escape") setEditingCell(null); }}
          style={{ width: "100%", height: 24, border: "1px solid #1E2A5A", borderRadius: 4, padding: "0 4px", fontSize: 11, textAlign: "right" }}
        />
      );
    }
    return (
      <span
        onClick={() => { setEditingCell({ month, field }); setEditValue(String(value)); }}
        style={{ cursor: "pointer", borderBottom: "1px dashed #ccc" }}
      >
        {fmt(value)}
      </span>
    );
  }

  const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "6px 8px", textAlign: "center", color: "white", background: "#161f45", position: "sticky" as const, top: 0, zIndex: 1 };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "6px 8px", color: "#1a2a3a", whiteSpace: "nowrap", position: "sticky" as const, left: 0, zIndex: 1, borderBottom: "1px solid #e8ecf1" };
  const cellStyle: React.CSSProperties = { fontSize: 11, padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid #e8ecf1" };

  const ROW_COLORS: Record<string, string> = {
    objectif: "#fffef5",
    commandes: "#fefbf0",
    commandesFacturable: "#fef8ed",
    facture: "#f5f9ff",
    encaisseTTC: "#f3faf5",
    tvaCollecte: "#faf5fd",
    encaisseHT: "#f3faf5",
    rhPrev: "#fef5f7",
    chargesDiverses: "#fef5f7",
    chargesTTC: "#fef0f0",
    tvaDeductible: "#faf5fd",
    chargesHT: "#fef0f0",
    resultat: "#f0f5fb",
    tresorerie: "#edf5fc",
    rbstDettes: "#fafafa",
    pretPGE: "#fafafa",
    pretBPI: "#fafafa",
    pretTreso: "#fafafa",
  };

  function Row({ label, field, values, isCumul, isManual, manualField, color }: {
    label: string; field: string; values: number[]; isCumul?: number; isManual?: boolean; manualField?: string; color?: string;
  }) {
    const bg = color ?? ROW_COLORS[field] ?? "white";
    return (
      <tr>
        <td style={{ ...labelStyle, background: bg, borderRight: "2px solid #161f45" }}>{label}</td>
        {values.map((v, i) => (
          <td key={i} style={{ ...cellStyle, background: bg, color: v < 0 ? "#e74c3c" : v === 0 ? "#ccc" : "#1a2a3a" }}>
            {isManual && manualField ? (
              <ManualCell month={monthData[i].mStr} field={manualField} value={v} />
            ) : fmt(v)}
          </td>
        ))}
        <td style={{ ...cellStyle, background: bg, fontWeight: 800, color: (isCumul ?? 0) < 0 ? "#e74c3c" : "#161f45", borderLeft: "2px solid #161f45" }}>
          {isCumul !== undefined ? fmt(isCumul) : ""}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fiscal year filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#8399a9", textTransform: "uppercase" }}>Année fiscale :</span>
        <select
          value={fyYear}
          onChange={(e) => setFyYear(parseInt(e.target.value))}
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 14, fontWeight: 700, color: "#1a2a3a", cursor: "pointer" }}
        >
          {fyOptions.map(y => (
            <option key={y} value={y}>{y}/{y + 1}</option>
          ))}
        </select>
      </div>

    <div className="lca-card" style={{ overflow: "hidden" }}>
      <div className="lca-bar-gradient" />
      <div style={{ overflowX: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 180 }}></th>
              {monthData.map(m => (
                <th key={m.mStr} style={{ ...thStyle, minWidth: 95 }}>{m.mLabel}</th>
              ))}
              <th style={{ ...thStyle, minWidth: 95, background: "#0f1630" }}>CUMUL</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Objectif Commandes" field="objectif" values={monthData.map(m => m.objectif)} isCumul={cumul.objectif} />
            <Row label="Commandes" field="commandes" values={monthData.map(m => m.commandes)} isCumul={cumul.commandes} />
            <Row label="Facturable ADV" field="commandesFacturable" values={monthData.map(m => m.commandesFacturable)} isCumul={cumul.commandesFacturable} />
            <Row label="Facturé HT" field="facture" values={monthData.map(m => m.facture)} isCumul={cumul.facture} isManual manualField="facture_ht" />
            <Row label="Encaissé TTC" field="encaisseTTC" values={monthData.map(m => m.encaisseTTC)} isCumul={cumul.encaisseTTC} isManual manualField="encaisse_ttc" />
            <Row label="TVA collectée" field="tvaCollecte" values={monthData.map(m => m.tvaCollecte)} isCumul={cumul.tvaCollecte} />
            <Row label="Encaissé HT" field="encaisseHT" values={monthData.map(m => m.encaisseHT)} isCumul={cumul.encaisseHT} isManual manualField="encaisse_ht" />
            {/* Separator */}
            <tr><td colSpan={14} style={{ height: 2, background: "#dce8f0" }} /></tr>
            <Row label="Rh prévisionnel" field="rhPrev" values={monthData.map(m => m.rhPrev)} isManual manualField="rh_previsionnel" />
            <Row label="Charges diverses" field="chargesDiverses" values={monthData.map(m => m.chargesDiverses)} isManual manualField="charges_diverses" />
            <Row label="Charges TTC" field="chargesTTC" values={monthData.map(m => m.chargesTTC)} isCumul={cumul.chargesTTC} isManual manualField="charges_ttc" />
            <Row label="TVA déductible" field="tvaDeductible" values={monthData.map(m => m.tvaDeductible)} isCumul={cumul.tvaDeductible} />
            <Row label="Charges HT" field="chargesHT" values={monthData.map(m => m.chargesHT)} isCumul={cumul.chargesHT} />
            {/* Separator */}
            <tr><td colSpan={14} style={{ height: 2, background: "#dce8f0" }} /></tr>
            <Row label="Résultat" field="resultat" values={monthData.map(m => m.resultat)} isCumul={cumul.resultat} />
            <Row label="Trésorerie Monthly" field="tresorerie" values={monthData.map(m => m.tresorerie)} isManual manualField="tresorerie" />
            {/* Separator */}
            <tr><td colSpan={14} style={{ height: 2, background: "#dce8f0" }} /></tr>
            <Row label="Rbst Dettes" field="rbstDettes" values={monthData.map(m => m.rbstDettes)} isManual manualField="rbst_dettes" />
            <Row label="Prêt PGE" field="pretPGE" values={monthData.map(m => m.pretPGE)} isManual manualField="pret_pge" />
            <Row label="Prêt Boost BPI" field="pretBPI" values={monthData.map(m => m.pretBPI)} isManual manualField="pret_boost_bpi" />
            <Row label="Prêt de trésorerie" field="pretTreso" values={monthData.map(m => m.pretTreso)} isManual manualField="pret_tresorerie" />
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
