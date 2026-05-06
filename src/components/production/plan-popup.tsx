"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Video, Building2, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: "#e8f0fe", text: "#0d4f7a", label: "Planifié" },
  done: { bg: "#e8f5e9", text: "#2e7d32", label: "Réalisé" },
  cancelled: { bg: "#fce4ec", text: "#c62828", label: "Annulé" },
  no_show: { bg: "#fff3e0", text: "#e65100", label: "No show" },
};

const formatLabels: Record<string, string> = {
  individuel: "Individuel",
  collectif: "Collectif",
  individuel_collectif: "Individuel + Collectif",
};
const modeLabels: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  mixte: "Mixte",
};

interface PlanPopupProps {
  planId: string;
  onClose: () => void;
}

interface PlanData {
  id: string;
  company_id: string;
  format: string | null;
  mode: string | null;
  vt_planned: number | null;
  days_planned: number | null;
  hourly_rate: number | null;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  companies: { name: string } | null;
  training_programs: { name: string } | null;
  training_types: { name: string } | null;
  service_plan_learners: { learner_id: string; learners: { id: string; first_name: string; last_name: string; status: string | null } | null }[];
  training_sessions: {
    id: string;
    session_type: string;
    session_date: string;
    session_time: string | null;
    duration_hours: number | null;
    status: string;
    trainers: string[] | null;
    is_billable: boolean;
    notes: string | null;
    training_session_learners: { learner_id: string; learners: { id: string; first_name: string; last_name: string } | null }[];
  }[];
}

export function PlanPopup({ planId, onClose }: PlanPopupProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  async function fetchPlan() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("service_plans")
      .select(`
        *,
        companies(name),
        training_programs(name),
        training_types(name),
        primary_trainer:team_members!service_plans_primary_trainer_id_fkey(first_name, last_name),
        service_plan_learners(learner_id, learners(id, first_name, last_name, status)),
        training_sessions(*, training_session_learners(learner_id, learners(id, first_name, last_name)))
      `)
      .eq("id", planId)
      .single();
    setPlan(data as PlanData | null);
    setLoading(false);
  }

  async function handleSessionStatus(sessionId: string, newStatus: string) {
    setLocalStatuses(prev => ({ ...prev, [sessionId]: newStatus }));
    const supabase = createClient();
    await supabase.from("training_sessions").update({ status: newStatus }).eq("id", sessionId);
    try { await fetch("/api/learners/sync-status"); } catch {}
    try { await fetch("/api/sessions/sync-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingSessionId: sessionId }) }); } catch {}
    await fetchPlan();
    router.refresh();
  }

  async function handleDeleteSession(sessionId: string) {
    if (!window.confirm("Supprimer cette session ?")) return;
    const supabase = createClient();
    await supabase.from("training_session_learners").delete().eq("training_session_id", sessionId);
    await supabase.from("training_sessions").delete().eq("id", sessionId);
    await fetchPlan();
    router.refresh();
  }

  async function handleSaveNotes(sessionId: string) {
    setSavingNotes(true);
    const supabase = createClient();
    await supabase.from("training_sessions").update({ notes: notesText || null }).eq("id", sessionId);
    setEditingNotes(null);
    setSavingNotes(false);
    await fetchPlan();
  }

  if (loading || !plan) {
    return (
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: "white", borderRadius: 14, padding: 40, textAlign: "center", color: "#8399a9" }}>
          Chargement...
        </div>
      </div>
    );
  }

  const sessions = plan.training_sessions ?? [];
  const learners = (plan.service_plan_learners ?? []).map(spl => spl.learners).filter(Boolean);
  const hourlyRate = Number(plan.hourly_rate) || 0;

  const vtDone = sessions.filter(s => s.session_type === "vt" && s.status === "done").length;
  const vtPlanned = sessions.filter(s => s.session_type === "vt" && s.status === "planned").length;
  const vtTotal = plan.vt_planned ?? 0;
  const vtRemaining = Math.max(0, vtTotal - vtDone - vtPlanned);
  const vtPct = vtTotal > 0 ? Math.round((vtDone / vtTotal) * 100) : 0;

  const daysDone = sessions.filter(s => s.session_type === "journee" && s.status === "done").length;
  const daysPlannedCount = sessions.filter(s => s.session_type === "journee" && s.status === "planned").length;
  const daysTotal = plan.days_planned ?? 0;
  const daysRemaining = Math.max(0, daysTotal - daysDone - daysPlannedCount);
  const daysPct = daysTotal > 0 ? Math.round((daysDone / daysTotal) * 100) : 0;

  const billableDone = sessions.filter(s => s.status === "done" && s.is_billable !== false);
  const totalHoursDone = billableDone.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0);
  const consumedAmount = totalHoursDone * hourlyRate;
  const budgetInitial = Number(plan.budget) || 0;
  const budgetRemaining = budgetInitial - consumedAmount;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 720, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
              {plan.companies?.name ?? "—"}
            </h3>
            <div style={{ fontSize: 13, color: "#5a6f80", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {plan.training_programs?.name && <span>{plan.training_programs.name}</span>}
              {plan.training_types?.name && <span>· {plan.training_types.name}</span>}
              {plan.format && <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: "#f3e5f5", color: "#6a1b9a" }}>{formatLabels[plan.format] ?? plan.format}</span>}
              {plan.mode && <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: "#fff3e0", color: "#e65100" }}>{modeLabels[plan.mode] ?? plan.mode}</span>}
              {(plan as any).primary_trainer && <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: "#e8f5e9", color: "#2e7d32" }}>Expert : {(plan as any).primary_trainer.first_name} {(plan as any).primary_trainer.last_name}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }} className="space-y-4">
          {/* Counters */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* VT */}
            <div style={{ background: "#f8fbfd", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Video className="h-3.5 w-3.5" style={{ color: "#1a6b9c" }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>VT</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#1a6b9c" }}>{vtDone} / {vtTotal}</span>
              </div>
              <div style={{ height: 6, background: "#e8ecf1", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${vtPct}%`, background: "#1a6b9c", borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#5a6f80" }}>
                <span>Réalisées : <strong style={{ color: "#2ecc71" }}>{vtDone}</strong></span>
                <span>Planifiées : <strong style={{ color: "#1a6b9c" }}>{vtPlanned}</strong></span>
                <span>Restantes : <strong style={{ color: vtRemaining > 0 ? "#e74c3c" : "#2ecc71" }}>{vtRemaining}</strong></span>
              </div>
            </div>
            {/* Journées */}
            <div style={{ background: "#fdf8f5", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 className="h-3.5 w-3.5" style={{ color: "#FF6B35" }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>Journées</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#FF6B35" }}>{daysDone} / {daysTotal}</span>
              </div>
              <div style={{ height: 6, background: "#e8ecf1", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${daysPct}%`, background: "#FF6B35", borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#5a6f80" }}>
                <span>Réalisées : <strong style={{ color: "#2ecc71" }}>{daysDone}</strong></span>
                <span>Planifiées : <strong style={{ color: "#FF6B35" }}>{daysPlannedCount}</strong></span>
                <span>Restantes : <strong style={{ color: daysRemaining > 0 ? "#e74c3c" : "#2ecc71" }}>{daysRemaining}</strong></span>
              </div>
            </div>
          </div>

          {/* Budget + Période */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" style={{ fontSize: 13 }}>
            {budgetInitial > 0 && (
              <div>
                <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Budget</div>
                <div style={{ fontWeight: 800, color: "#27ae60", fontSize: 16 }}>{fmt(budgetInitial)}</div>
                {hourlyRate > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: "#5a6f80", marginTop: 4 }}>Taux : <strong>{hourlyRate.toFixed(2)} €/h</strong></div>
                    <div style={{ fontSize: 12, color: "#5a6f80" }}>Consommé : <strong style={{ color: "#1a2a3a" }}>{fmt(consumedAmount)}</strong></div>
                    <div style={{ fontSize: 12, color: budgetRemaining >= 0 ? "#27ae60" : "#e74c3c", fontWeight: 700 }}>Restant : {fmt(budgetRemaining)}</div>
                  </>
                )}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Période</div>
              <div style={{ color: "#1a2a3a" }}>
                {plan.start_date ? format(new Date(plan.start_date), "dd MMM yyyy", { locale: fr }) : "—"} — {plan.end_date ? format(new Date(plan.end_date), "dd MMM yyyy", { locale: fr }) : "—"}
              </div>
            </div>
            {learners.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Apprenants ({learners.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {learners.map(l => (
                    <span key={l!.id} style={{ fontSize: 11, color: "#1a2a3a" }}>{l!.first_name} {l!.last_name}{learners.indexOf(l) < learners.length - 1 ? "," : ""}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {plan.notes && (
            <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic", padding: "8px 12px", background: "#f8fbfd", borderRadius: 8 }}>
              {plan.notes}
            </div>
          )}

          {/* Sessions */}
          <div>
            <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 14, marginBottom: 8 }}>Sessions ({sessions.length})</div>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8399a9", padding: 16, fontStyle: "italic", fontSize: 13 }}>Aucune session</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sessions
                  .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
                  .map((s) => {
                    const effectiveStatus = localStatuses[s.id] ?? s.status;
                    const sc = statusColors[effectiveStatus] ?? statusColors.planned;
                    const isVT = s.session_type === "vt";
                    const sLearners = (s.training_session_learners ?? []).map(sl => sl.learners).filter(Boolean);
                    const dateStr = (() => {
                      try {
                        const d = format(new Date(s.session_date), "EEE d MMM", { locale: fr });
                        if (!s.session_time) return d;
                        return `${d} à ${String(s.session_time).slice(0, 5)}`;
                      } catch { return s.session_date; }
                    })();

                    return (
                      <div key={s.id} style={{
                        padding: "8px 12px", borderRadius: 8,
                        background: isVT ? "#f8fbfd" : "#fdf8f5",
                        borderLeft: `3px solid ${isVT ? "#1a6b9c" : "#FF6B35"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isVT ? "#1a6b9c" : "#FF6B35" }}>
                            {dateStr} · {isVT ? "VT" : "Journée"} — {Number(s.duration_hours) || 0}h
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                            <button
                              onClick={() => { setEditingNotes(s.id); setNotesText(s.notes ?? ""); }}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
                              title="Modifier les notes"
                            >
                              <Pencil className="h-3 w-3" style={{ color: "#8399a9" }} />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(s.id)}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3 w-3" style={{ color: "#e74c3c" }} />
                            </button>
                          </div>
                        </div>
                        {(s.trainers && s.trainers.length > 0) && (
                          <div style={{ fontSize: 11, color: "#5a6f80", marginTop: 2 }}>
                            {s.trainers.join(", ")}
                          </div>
                        )}
                        {sLearners.length > 0 && (
                          <div style={{ fontSize: 11, color: "#5a6f80", marginTop: 1 }}>
                            {sLearners.map(l => `${l!.first_name} ${l!.last_name}`).join(", ")}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <select
                            value={effectiveStatus}
                            onChange={(e) => handleSessionStatus(s.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ height: 24, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 6px", fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, cursor: "pointer" }}
                          >
                            <option value="planned">Planifié</option>
                            <option value="done">Réalisé</option>
                            <option value="no_show">No show</option>
                            <option value="cancelled">Annulé</option>
                          </select>
                          {hourlyRate > 0 && s.is_billable !== false && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: effectiveStatus === "done" ? "#2e7d32" : "#8399a9" }}>
                              {fmt((Number(s.duration_hours) || 0) * hourlyRate)}
                            </span>
                          )}
                          {s.is_billable === false && <span style={{ fontSize: 10, color: "#999" }}>NF</span>}
                        </div>
                        {s.notes && editingNotes !== s.id && (
                          <div style={{ fontSize: 11, color: "#8399a9", marginTop: 3, fontStyle: "italic" }}>{s.notes}</div>
                        )}
                        {editingNotes === s.id && (
                          <div style={{ marginTop: 6 }}>
                            <textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              style={{ width: "100%", minHeight: 60, borderRadius: 8, border: "1px solid #dce8f0", padding: 8, fontSize: 12, color: "#1a2a3a", resize: "vertical" }}
                              placeholder="Notes..."
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                              <button
                                onClick={() => handleSaveNotes(s.id)}
                                disabled={savingNotes}
                                style={{ height: 28, borderRadius: 6, background: "#1a6b9c", color: "white", fontSize: 11, fontWeight: 600, padding: "0 12px", border: "none", cursor: "pointer" }}
                              >
                                {savingNotes ? "..." : "Sauvegarder"}
                              </button>
                              <button
                                onClick={() => setEditingNotes(null)}
                                style={{ height: 28, borderRadius: 6, background: "#e8ecf1", color: "#5a6f80", fontSize: 11, fontWeight: 600, padding: "0 12px", border: "none", cursor: "pointer" }}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
          <button
            onClick={() => { onClose(); router.push("/planning"); }}
            style={{ fontSize: 12, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Voir dans Planification
          </button>
          <button onClick={onClose} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
