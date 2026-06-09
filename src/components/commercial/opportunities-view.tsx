"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEAL_STAGE_LABELS } from "@/types/database";
import { getDefaultCustomFrom, getCurrentFiscalYearStart, getFiscalYearRange, getFiscalYearOptions, getFiscalYearLabel } from "@/lib/fiscal-year";
import type { DealStage } from "@/types/database";
import Link from "next/link";

interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  training_days: number | null;
  probability: number;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  contacts: { first_name: string; last_name: string } | null;
  companies: { id: string; name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const stageColors: Record<string, { bg: string; text: string }> = {
  opportunities: { bg: "#e3f2fd", text: "#1565c0" },
  quote_to_send: { bg: "#fff3e0", text: "#e65100" },
  quote_sent: { bg: "#f3e5f5", text: "#6a1b9a" },
  opco_deposit: { bg: "#e8f0fe", text: "#0d4f7a" },
};

const OPP_STAGES = ["opportunities"];
const PIPE_STAGES = ["quote_to_send", "quote_to_validate", "quote_sent", "opco_deposit", "quote_signed"];

export function OpportunitiesView({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [periodMode, setPeriodMode] = useState<"fiscal" | "month" | "custom">("fiscal");
  const [selectedFY, setSelectedFY] = useState(() => getCurrentFiscalYearStart());
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState(() => getDefaultCustomFrom());
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [showOpp, setShowOpp] = useState(true);
  const [showPipe, setShowPipe] = useState(true);

  // Period filter
  const filtered = deals.filter(d => {
    const date = d.created_at?.split("T")[0] ?? "";
    if (periodMode === "fiscal") {
      const { from: fyFrom, to: fyTo } = getFiscalYearRange(selectedFY);
      if (date < fyFrom || date > fyTo) return false;
    } else if (periodMode === "month") {
      if (!date.startsWith(filterMonth)) return false;
    } else if (periodMode === "custom") {
      if (date < customFrom || date > customTo) return false;
    }

    // Type filter
    const isOpp = OPP_STAGES.includes(d.stage);
    const isPipe = PIPE_STAGES.includes(d.stage);
    if (isOpp && !showOpp) return false;
    if (isPipe && !showPipe) return false;

    return true;
  });

  const totalAmount = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalDays = filtered.reduce((s, d) => s + (Number(d.training_days) || 0), 0);
  const oppCount = filtered.filter(d => OPP_STAGES.includes(d.stage)).length;
  const pipeCount = filtered.filter(d => PIPE_STAGES.includes(d.stage)).length;
  const devisCount = filtered.filter(d => d.stage === "quote_to_send" || d.stage === "quote_to_validate" || d.stage === "quote_sent").length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length} deals</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totalAmount)}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Jours formation</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{totalDays.toFixed(1)}j</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Opportunités</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1565c0" }}>{oppCount}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Devis en cours</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{devisCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
          padding: "6px 12px", borderRadius: 8, border: `1px solid ${showOpp ? "#1565c0" : "#dce8f0"}`,
          background: showOpp ? "#e3f2fd" : "white", color: showOpp ? "#1565c0" : "#5a6f80", fontWeight: showOpp ? 600 : 400,
        }}>
          <input type="checkbox" checked={showOpp} onChange={(e) => setShowOpp(e.target.checked)} style={{ accentColor: "#1565c0" }} />
          Opportunités
        </label>
        <label style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
          padding: "6px 12px", borderRadius: 8, border: `1px solid ${showPipe ? "#e65100" : "#dce8f0"}`,
          background: showPipe ? "#fff3e0" : "white", color: showPipe ? "#e65100" : "#5a6f80", fontWeight: showPipe ? 600 : 400,
        }}>
          <input type="checkbox" checked={showPipe} onChange={(e) => setShowPipe(e.target.checked)} style={{ accentColor: "#e65100" }} />
          Pipe
        </label>
        <select
          value={periodMode}
          onChange={(e) => setPeriodMode(e.target.value as "fiscal" | "month" | "custom")}
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
        >
          <option value="fiscal">Année fiscale</option>
          <option value="month">Mois</option>
          <option value="custom">Personnalisé</option>
        </select>
        {periodMode === "fiscal" && (
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(Number(e.target.value))}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}
          >
            {getFiscalYearOptions(5).map(o => (
              <option key={o.startYear} value={o.startYear}>{o.label}</option>
            ))}
          </select>
        )}
        {periodMode === "month" && (
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
        )}
        {periodMode === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
            <span style={{ color: "#8399a9" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="lca-card" style={{ overflow: "hidden" }}>
        <div className="lca-bar-gradient" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e8ecf1" }}>Deal</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e8ecf1" }}>Contact</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e8ecf1" }}>Entreprise</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e8ecf1" }}>Stage</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e8ecf1" }}>Probabilité</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "right", borderBottom: "2px solid #e8ecf1" }}>Montant</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e8ecf1" }}>Jours</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#1a6b9c", padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e8ecf1" }}>Propriétaire</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune opportunité trouvée</td>
                </tr>
              ) : filtered.map(d => {
                const sc = stageColors[d.stage] ?? { bg: "#f5f5f5", text: "#555" };
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid #e8ecf1" }} className="hover:bg-[#f0f7fb]">
                    <td style={{ padding: "10px 12px" }}>
                      <Link href="/deals" style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                        {d.name}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      {d.contacts ? (
                        <Link href={`/contacts/${d.contact_id}`} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                          {d.contacts.first_name} {d.contacts.last_name}
                        </Link>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      {d.companies ? (
                        <Link href={`/clients/${d.companies.id}`} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                          {d.companies.name}
                        </Link>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: sc.bg, color: sc.text }}>
                        {DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{d.probability}%</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>{fmt(Number(d.amount) || 0)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{d.training_days ? `${Number(d.training_days).toFixed(1)}j` : "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {d.team_members ? (
                        <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 11, fontWeight: 700, lineHeight: "28px", textAlign: "center" }}>
                          {d.team_members.first_name[0]}{d.team_members.last_name[0]}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
