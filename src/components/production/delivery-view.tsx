"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Video, Building2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SessionLearnerJoin {
  learner_id: string;
  learners: { id: string; first_name: string; last_name: string } | null;
}

interface DeliverySession {
  id: string;
  service_plan_id: string;
  session_type: "vt" | "journee";
  session_date: string;
  duration_hours: number | null;
  status: string;
  trainers: string[] | null;
  is_billable: boolean;
  notes: string | null;
  training_session_learners: SessionLearnerJoin[];
  service_plans: {
    id: string;
    company_id: string;
    hourly_rate: number | null;
    format: string | null;
    mode: string | null;
    deal_id: string | null;
    companies: { id: string; name: string } | null;
    training_programs: { name: string } | null;
    training_types: { name: string } | null;
  } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: "#e8f0fe", text: "#0d4f7a", label: "Planifié" },
  done: { bg: "#e8f5e9", text: "#2e7d32", label: "Réalisé" },
  cancelled: { bg: "#fce4ec", text: "#c62828", label: "Annulé" },
};

export function DeliveryView({ sessions }: { sessions: DeliverySession[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("done");
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
  const [viewLearner, setViewLearner] = useState<{ id: string; first_name: string; last_name: string; email?: string; phone?: string; position?: string; status?: string; company_name?: string } | null>(null);
  const [loadingLearner, setLoadingLearner] = useState(false);

  async function openLearnerPopup(learnerId: string, firstName: string, lastName: string) {
    setViewLearner({ id: learnerId, first_name: firstName, last_name: lastName });
    setLoadingLearner(true);
    const supabase = createClient();
    const { data } = await supabase.from("learners").select("*, companies(name)").eq("id", learnerId).single();
    if (data) {
      setViewLearner({ id: data.id, first_name: data.first_name, last_name: data.last_name, email: data.email ?? undefined, phone: data.phone ?? undefined, position: data.position ?? undefined, status: data.status ?? undefined, company_name: (data.companies as any)?.name ?? undefined });
    }
    setLoadingLearner(false);
  }

  // Extract unique trainers
  const allTrainers = Array.from(new Set(sessions.flatMap(s => s.trainers ?? []))).sort();

  const filtered = sessions.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterType && s.session_type !== filterType) return false;
    if (filterTrainer && !(s.trainers ?? []).includes(filterTrainer)) return false;
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
      const companyName = (s.service_plans?.companies?.name ?? "").toLowerCase();
      const learnerNames = (s.training_session_learners ?? []).map(sl => {
        const l = sl.learners;
        return l ? `${l.first_name} ${l.last_name}`.toLowerCase() : "";
      }).join(" ");
      if (!companyName.includes(search.toLowerCase()) && !learnerNames.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // Totals for filtered
  const totalHours = filtered.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0);
  const totalAmount = filtered.filter(s => s.is_billable !== false).reduce((s, sess) => {
    const rate = Number(sess.service_plans?.hourly_rate) || 0;
    return s + (Number(sess.duration_hours) || 0) * rate;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#8399a9" }} />
          <input
            placeholder="Rechercher entreprise ou apprenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", paddingLeft: 36, paddingRight: 12, fontSize: 13, width: 280, color: "#1a2a3a" }}
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="">Tous les statuts</option>
          <option value="done">Réalisé</option>
          <option value="planned">Planifié</option>
          <option value="cancelled">Annulé</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="">VT + Journées</option>
          <option value="vt">VT uniquement</option>
          <option value="journee">Journées uniquement</option>
        </select>
        <select value={filterTrainer} onChange={(e) => setFilterTrainer(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="">Tous les experts</option>
          {allTrainers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterBillable} onChange={(e) => setFilterBillable(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="">Facturable + Non fact.</option>
          <option value="yes">Facturable</option>
          <option value="no">Non facturable</option>
        </select>
        <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as any)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="all">Toutes les dates</option>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="custom">Personnalisé</option>
        </select>
        {periodMode === "week" && (
          <input type="date" value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
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

      {/* Summary */}
      <div style={{ fontSize: 13, color: "#5a6f80", display: "flex", gap: 20 }}>
        <span>{filtered.length} session{filtered.length > 1 ? "s" : ""}</span>
        <span>Total : <strong style={{ color: "#1a2a3a" }}>{totalHours}h</strong></span>
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
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Programme</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Expert(s)</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Apprenants</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Durée</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Statut</TableHead>
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
                const plan = s.service_plans;
                const sc = statusColors[s.status] ?? statusColors.planned;
                const hourlyRate = Number(plan?.hourly_rate) || 0;
                const hours = Number(s.duration_hours) || 0;
                const amount = s.is_billable !== false ? hours * hourlyRate : 0;
                const learners = (s.training_session_learners ?? []).map(sl => sl.learners).filter(Boolean);

                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-[#f0f7fb]" onClick={() => router.push("/planning")}>
                    <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>
                      {format(new Date(s.session_date), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                        background: s.session_type === "vt" ? "#e8f0fe" : "#fff3e0",
                        color: s.session_type === "vt" ? "#1a6b9c" : "#FF6B35",
                      }}>
                        {s.session_type === "vt" ? "VT" : "Journée"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {plan?.companies ? (
                        <span
                          onClick={(e) => { e.stopPropagation(); router.push(`/clients/${plan.companies!.id}`); }}
                          style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                        >
                          {plan.companies.name}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>
                      {plan?.training_programs?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {(s.trainers && s.trainers.length > 0) ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {s.trainers.map(t => (
                            <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10, background: "#fff3e0", color: "#e65100" }}>{t}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </TableCell>
                    <TableCell>
                      {learners.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {learners.map(l => (
                            <span
                              key={l!.id}
                              onClick={(e) => { e.stopPropagation(); openLearnerPopup(l!.id, l!.first_name, l!.last_name); }}
                              style={{ fontSize: 11, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                            >
                              {l!.first_name} {l!.last_name}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </TableCell>
                    <TableCell style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: "#1a2a3a" }}>{hours}h</TableCell>
                    <TableCell style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                      {s.is_billable === false ? (
                        <span style={{ color: "#999", fontStyle: "italic", fontWeight: 400 }}>Non fact.</span>
                      ) : (
                        <span style={{ color: s.status === "done" ? "#27ae60" : "#8399a9" }}>{fmt(amount)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {viewLearner && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setViewLearner(null); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>{viewLearner.first_name} {viewLearner.last_name}</h3>
              <button onClick={() => setViewLearner(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 20 }} className="space-y-3">
              {loadingLearner ? <div style={{ textAlign: "center", color: "#8399a9", padding: 20 }}>Chargement...</div> : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {viewLearner.status && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: viewLearner.status === "actuel" ? "#e8f5e9" : viewLearner.status === "futur" ? "#e8f0fe" : "#f5f5f5", color: viewLearner.status === "actuel" ? "#2e7d32" : viewLearner.status === "futur" ? "#0d4f7a" : "#777" }}>{viewLearner.status}</span>}
                    {viewLearner.company_name && <span style={{ fontSize: 12, color: "#8399a9" }}>{viewLearner.company_name}</span>}
                  </div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>✉️</span><span style={{ fontSize: 13, color: viewLearner.email ? "#1a2a3a" : "#ccc" }}>{viewLearner.email || "Non renseigné"}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>📞</span><span style={{ fontSize: 13, color: viewLearner.phone ? "#1a2a3a" : "#ccc" }}>{viewLearner.phone ? formatPhone(viewLearner.phone) : "Non renseigné"}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>💼</span><span style={{ fontSize: 13, color: viewLearner.position ? "#1a2a3a" : "#ccc" }}>{viewLearner.position || "Non renseigné"}</span></div>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setViewLearner(null)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
