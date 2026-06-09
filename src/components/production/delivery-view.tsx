"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getCurrentFiscalYearStart, getFiscalYearOptions as getFYOptions, isInFiscalYear } from "@/lib/fiscal-year";

interface DeliverySession {
  id: string;
  week_number: string | null;
  session_date: string;
  company_id: string | null;
  theme_id: string | null;
  delivery_mode: string;
  is_billable: boolean;
  attendee_names: string | null;
  session_label: string | null;
  hours_planned: number | null;
  hours_delivered: number | null;
  learners_planned: number | null;
  learners_delivered: number | null;
  hourly_rate: number | null;
  billable_amount: number | null;
  non_billable_amount: number | null;
  trainer_id: string | null;
  session_themes: { name: string } | null;
  team_members: { id: string; first_name: string; last_name: string } | null;
  companies: { id: string; name: string } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function getDeliveryFYOptions() {
  const options = getFYOptions(5);
  return [
    ...options.map(o => ({ value: String(o.startYear), label: o.label })),
    { value: "", label: "Toutes les ann\u00e9es" },
  ];
}

export function DeliveryView({ sessions }: { sessions: DeliverySession[] }) {
  const router = useRouter();
  const [fiscalYear, setFiscalYear] = useState<string>(String(getCurrentFiscalYearStart()));
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTrainer, setFilterTrainer] = useState("");
  const [filterBillable, setFilterBillable] = useState("");
  const [periodMode, setPeriodMode] = useState<"all" | "week" | "month" | "custom">("all");
  const [filterWeek, setFilterWeek] = useState(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split("T")[0];
  });
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Extract unique trainers
  const allTrainers = Array.from(new Set(sessions.map(s => s.team_members ? `${s.team_members.first_name} ${s.team_members.last_name}` : "").filter(Boolean))).sort();

  // Determine session type from theme name or hours
  function getSessionType(s: DeliverySession): "vt" | "journee" {
    const theme = s.session_themes?.name ?? s.session_label ?? "";
    if (theme.startsWith("J ") || theme.startsWith("J1") || theme.startsWith("J2")) return "journee";
    if ((Number(s.hours_delivered) || 0) >= 4) return "journee";
    return "vt";
  }

  const fyOptions = getDeliveryFYOptions();

  const filtered = sessions.filter(s => {
    // Fiscal year filter
    if (fiscalYear && !isInFiscalYear(s.session_date, parseInt(fiscalYear))) return false;

    const sessionType = getSessionType(s);
    if (filterType && sessionType !== filterType) return false;
    if (filterTrainer) {
      const trainerName = s.team_members ? `${s.team_members.first_name} ${s.team_members.last_name}` : "";
      if (trainerName !== filterTrainer) return false;
    }
    if (filterBillable === "yes" && s.is_billable === false) return false;
    if (filterBillable === "no" && s.is_billable !== false) return false;

    // Date filter
    const date = s.session_date;
    if (periodMode === "week") {
      const weekStart = new Date(filterWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (date < filterWeek || date > weekEnd.toISOString().split("T")[0]) return false;
    } else if (periodMode === "month") {
      if (!date.startsWith(filterMonth)) return false;
    } else if (periodMode === "custom") {
      if (customFrom && date < customFrom) return false;
      if (customTo && date > customTo) return false;
    }
    if (search) {
      const companyName = (s.companies?.name ?? "").toLowerCase();
      const attendees = (s.attendee_names ?? "").toLowerCase();
      if (!companyName.includes(search.toLowerCase()) && !attendees.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // Totals for filtered
  const totalHours = filtered.reduce((acc, s) => acc + (Number(s.hours_delivered) || 0), 0);
  const totalBillableHours = filtered.filter(s => s.is_billable !== false).reduce((acc, s) => acc + (Number(s.hours_delivered) || 0), 0);
  const totalAmount = filtered.reduce((acc, s) => acc + (Number(s.billable_amount) || 0), 0);
  const totalNonBillable = filtered.reduce((acc, s) => acc + (Number(s.non_billable_amount) || 0), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sessions réalisées</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures délivrées</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalHours.toFixed(1)}h</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures facturables</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{totalBillableHours.toFixed(0)}h</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturable sur Delivery</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalAmount)}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Non facturable</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{fmt(totalNonBillable)}</div>
        </div>
      </div>

      {/* Filters — single row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto" }}>
        <select value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", fontWeight: 600, flexShrink: 0 }}>
          {fyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as any)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", flexShrink: 0 }}>
          <option value="all">Toutes les dates</option>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="custom">Personnalisé</option>
        </select>
        {periodMode === "week" && (
          <input type="date" value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", flexShrink: 0 }} />
        )}
        {periodMode === "month" && (
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", flexShrink: 0 }} />
        )}
        {periodMode === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, flexShrink: 0 }} />
            <span style={{ color: "#8399a9", flexShrink: 0 }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, flexShrink: 0 }} />
          </>
        )}
        <div className="relative" style={{ flexShrink: 0 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#8399a9" }} />
          <input
            placeholder="Rechercher entreprise ou participant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", paddingLeft: 36, paddingRight: 12, fontSize: 13, width: 260, color: "#1a2a3a" }}
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", flexShrink: 0 }}>
          <option value="">VT + Journées</option>
          <option value="vt">VT uniquement</option>
          <option value="journee">Journées uniquement</option>
        </select>
        <select value={filterTrainer} onChange={(e) => setFilterTrainer(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", flexShrink: 0 }}>
          <option value="">Tous les experts</option>
          {allTrainers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterBillable} onChange={(e) => setFilterBillable(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", flexShrink: 0 }}>
          <option value="">Facturable + Non fact.</option>
          <option value="yes">Facturable</option>
          <option value="no">Non facturable</option>
        </select>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 13, color: "#5a6f80", display: "flex", gap: 20 }}>
        <span>{filtered.length} session{filtered.length > 1 ? "s" : ""}</span>
        <span>Total : <strong style={{ color: "#1a2a3a" }}>{totalHours.toFixed(1)}h</strong></span>
        <span>Facturable : <strong style={{ color: "#27ae60" }}>{fmt(totalAmount)}</strong></span>
      </div>

      {/* Table */}
      <div className="lca-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Type</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Thème</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Mode</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Expert</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Participants</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Durée</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>
                    Aucune session trouvée
                  </TableCell>
                </TableRow>
              ) : filtered.map(s => {
                const sessionType = getSessionType(s);
                const hours = Number(s.hours_delivered) || 0;
                const amount = Number(s.billable_amount) || 0;
                const nonBillableAmount = Number(s.non_billable_amount) || 0;
                const themeName = s.session_themes?.name ?? "";
                const label = s.session_label ?? "";
                const displayTheme = themeName || label || "—";
                const trainer = s.team_members;

                return (
                  <TableRow key={s.id} className="hover:bg-[#f0f7fb]">
                    <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>
                      {format(new Date(s.session_date), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                        background: sessionType === "vt" ? "#e8f0fe" : "#fff3e0",
                        color: sessionType === "vt" ? "#1a6b9c" : "#FF6B35",
                      }}>
                        {sessionType === "vt" ? "VT" : "Journée"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.companies ? (
                        <span
                          onClick={() => router.push(`/clients/${s.companies!.id}`)}
                          style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                        >
                          {s.companies.name}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>
                      {displayTheme}
                    </TableCell>
                    <TableCell>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                        background: s.delivery_mode === "présentiel" ? "#e3f2fd" : "#f5f5f5",
                        color: s.delivery_mode === "présentiel" ? "#1565c0" : "#777",
                      }}>
                        {s.delivery_mode === "présentiel" ? "Présentiel" : "Distanciel"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {trainer ? (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10, background: "#fff3e0", color: "#e65100" }}>
                          {trainer.first_name}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </TableCell>
                    <TableCell style={{ fontSize: 11, color: "#5a6f80", maxWidth: 200 }} className="truncate">
                      {s.attendee_names || "—"}
                    </TableCell>
                    <TableCell style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: "#1a2a3a" }}>{hours > 0 ? `${hours}h` : "—"}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                      {s.is_billable === false ? (
                        nonBillableAmount > 0 ? (
                          <span style={{ color: "#FF6B35", fontWeight: 600 }}>{fmt(nonBillableAmount)}</span>
                        ) : (
                          <span style={{ color: "#999", fontStyle: "italic", fontWeight: 400 }}>Non fact.</span>
                        )
                      ) : (
                        <span style={{ color: "#27ae60" }}>{fmt(amount)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
