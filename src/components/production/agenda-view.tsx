"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Mic, MicOff, X, Video, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

const TRAINERS_FALLBACK = ["Alexandre", "Rafi", "Iman", "Guillaume", "Loïc"];

const TRAINER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Alexandre: { bg: "#e8f0fe", text: "#0d4f7a", border: "#1a6b9c" },
  Rafi: { bg: "#fff3e0", text: "#e65100", border: "#FF6B35" },
  Iman: { bg: "#f3e5f5", text: "#6a1b9a", border: "#8e44ad" },
  Guillaume: { bg: "#e8f5e9", text: "#2e7d32", border: "#27ae60" },
  Loïc: { bg: "#fce4ec", text: "#c62828", border: "#e74c3c" },
};

interface SessionLearnerJoin {
  learner_id: string;
  learners: { id: string; first_name: string; last_name: string } | null;
}

interface AgendaSession {
  id: string;
  service_plan_id: string;
  session_type: "vt" | "journee";
  session_date: string;
  duration_hours: number | null;
  session_time: string | null;
  session_location: string | null;
  status: "planned" | "done" | "cancelled";
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
    companies: { name: string } | null;
    training_programs: { name: string } | null;
  } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: "Planifié", bg: "#e8f0fe", text: "#0d4f7a" },
  done: { label: "Réalisé", bg: "#e8f5e9", text: "#2e7d32" },
  cancelled: { label: "Annulé", bg: "#fce4ec", text: "#c62828" },
};

export function AgendaView({ sessions, expertNames }: { sessions: AgendaSession[]; expertNames?: string[] }) {
  const TRAINERS = expertNames && expertNames.length > 0 ? expertNames : TRAINERS_FALLBACK;
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly, onlyOwnData, firstName: currentFirstName } = useCurrentRoles();
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [filterTrainer, setFilterTrainer] = useState("");

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 5);

  // Filter sessions for the current week
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.session_date);
    return d >= weekStart && d <= weekEnd && s.status !== "cancelled";
  });

  function getSessionsForDayAndTrainer(day: Date, trainer: string) {
    return weekSessions.filter(s => {
      const d = new Date(s.session_date);
      if (!isSameDay(d, day)) return false;
      const t = s.trainers ?? [];
      return t.includes(trainer);
    });
  }

  // Also get unassigned sessions (no trainer)
  function getUnassignedForDay(day: Date) {
    return weekSessions.filter(s => {
      const d = new Date(s.session_date);
      if (!isSameDay(d, day)) return false;
      return !s.trainers || s.trainers.length === 0;
    });
  }

  const displayTrainers = onlyOwnData && currentFirstName
    ? TRAINERS.filter(t => t === currentFirstName)
    : filterTrainer ? [filterTrainer] : TRAINERS;
  const hasUnassigned = weekDays.some(d => getUnassignedForDay(d).length > 0);

  const [sessionStatus, setSessionStatus] = useState("planned");

  function openSession(s: AgendaSession) {
    setSelectedSession(s);
    setNotesText(s.notes ?? "");
    setSessionStatus(s.status);
  }

  async function handleSaveSession() {
    if (!selectedSession) return;
    setSavingNotes(true);
    const supabase = createClient();

    // Save both notes and status
    await supabase.from("training_sessions").update({
      notes: notesText || null,
      status: sessionStatus,
    }).eq("id", selectedSession.id);

    // If done, check if all sessions of the plan's company are done → "former_customer"
    if (sessionStatus === "done" && selectedSession.service_plans?.company_id) {
      const companyId = selectedSession.service_plans.company_id as string;
      const { data: companySessions } = await supabase
        .from("training_sessions")
        .select("id, status, service_plans!inner(company_id)")
        .eq("service_plans.company_id", companyId);
      const remaining = (companySessions ?? []).filter(s => s.id !== selectedSession.id && s.status === "planned");
      if (remaining.length === 0) {
        await supabase.from("companies").update({ lifecycle_stage: "former_customer" }).eq("id", companyId);
        await supabase.from("contacts").update({ is_client: false, lifecycle_stage: "former_customer" }).eq("company_id", companyId);
      }
    }

    // Sync learner statuses
    try { await fetch("/api/learners/sync-status"); } catch {}

    setSavingNotes(false);
    setSelectedSession(null);
    stopRecording();
    router.refresh();
  }

  // Speech recognition
  function autoPunctuate(text: string): string {
    let result = text;
    result = result.charAt(0).toUpperCase() + result.slice(1);
    result = result.replace(/\s*virgule\s*/gi, ", ");
    result = result.replace(/\s*point d'exclamation\s*/gi, "! ");
    result = result.replace(/\s*point d'interrogation\s*/gi, "? ");
    result = result.replace(/\s*point\s*$/gi, ".");
    result = result.replace(/\s*point\s+/gi, ". ");
    result = result.replace(/\s*deux[ -]points\s*/gi, " : ");
    result = result.replace(/\s*point-virgule\s*/gi, " ; ");
    result = result.replace(/\s*tiret\s*/gi, " - ");
    result = result.replace(/\s*retour [àa] la ligne\s*/gi, "\n");
    result = result.replace(/\s*aller [àa] la ligne\s*/gi, "\n");
    result = result.replace(/\s*nouvelle ligne\s*/gi, "\n");
    result = result.replace(/\s*saut de ligne\s*/gi, "\n");
    result = result.replace(/\s*[àa] la ligne\s*/gi, "\n");
    result = result.replace(/([.!?]\s+|[\n])(\w)/g, (_, p, c) => p + c.toUpperCase());
    result = result.replace(/ {2,}/g, " ");
    return result.trim();
  }

  function startRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée."); return; }
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = notesText;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const punctuated = autoPunctuate(transcript);
          const startsWithNewline = punctuated.startsWith("\n");
          if (startsWithNewline) {
            finalTranscript = finalTranscript.trimEnd() + punctuated;
          } else {
            if (finalTranscript && !/[.!?:;\n]\s*$/.test(finalTranscript)) finalTranscript += ". ";
            else if (finalTranscript && !/[\s\n]$/.test(finalTranscript)) finalTranscript += " ";
            finalTranscript += punctuated;
          }
        } else {
          interim = transcript;
        }
      }
      setNotesText(finalTranscript + (interim ? " " + interim : ""));
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  function stopRecording() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
  }

  function renderSessionCard(s: AgendaSession) {
    const plan = s.service_plans;
    const company = plan?.companies?.name ?? "—";
    const program = plan?.training_programs?.name ?? "";
    const learners = (s.training_session_learners ?? []).map(sl => sl.learners).filter(Boolean);
    const sc = statusLabels[s.status];
    const isVT = s.session_type === "vt";

    return (
      <div
        key={s.id}
        style={{
          padding: "8px 10px", borderRadius: 8,
          background: isVT ? "#f0f7fb" : "#fdf8f5",
          borderLeft: `3px solid ${isVT ? "#1a6b9c" : "#FF6B35"}`,
          fontSize: 12, marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          {isVT ? <Video className="h-3 w-3" style={{ color: "#1a6b9c" }} /> : <Building2 className="h-3 w-3" style={{ color: "#FF6B35" }} />}
          <span style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 11 }}>{s.session_time ? String(s.session_time).slice(0, 5) + " · " : ""}{isVT ? "VT" : "Journée"} — {Number(s.duration_hours) || 0}h</span>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.text, marginLeft: "auto" }}>{sc.label}</span>
        </div>
        <div style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 12 }}>{company}</div>
        {program && <div style={{ fontSize: 10, color: "#8399a9" }}>{program}</div>}
        {learners.length > 0 && (
          <div style={{ fontSize: 10, color: "#5a6f80", marginTop: 2 }}>
            {learners.map(l => `${l!.first_name} ${l!.last_name}`).join(", ")}
          </div>
        )}
        {!isVT && s.session_location && (
          <div style={{ fontSize: 9, color: "#5a6f80", marginTop: 2 }}>📍 {s.session_location}</div>
        )}
        {!s.is_billable && <span style={{ fontSize: 9, fontWeight: 600, padding: "0 5px", borderRadius: 6, background: "#f5f5f5", color: "#999" }}>NF</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <select
            defaultValue={s.status}
            onClick={(e) => e.stopPropagation()}
            onChange={async (e) => {
              e.stopPropagation();
              const sb = createClient();
              await sb.from("training_sessions").update({ status: e.target.value }).eq("id", s.id);
              router.refresh();
            }}
            style={{ height: 22, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 4px", fontSize: 9, fontWeight: 600, background: sc.bg, color: sc.text, cursor: "pointer" }}
          >
            <option value="planned">Planifié</option>
            <option value="done">Réalisé</option>
            <option value="cancelled">Annulé</option>
            <option value="no_show">No show</option>
          </select>
          <button onClick={(e) => { e.stopPropagation(); openSession(s); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px" }}>
            📋 Suivi
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!window.confirm("Supprimer cette session ?")) return;
              const sb = createClient();
              await sb.from("training_session_learners").delete().eq("training_session_id", s.id);
              await sb.from("training_sessions").delete().eq("id", s.id);
              router.refresh();
            }}
            style={{ display: "inline-flex", alignItems: "center", height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "#fce4ec", color: "#c62828", fontSize: 9, fontWeight: 700, padding: "0 8px" }}
            title="Supprimer"
          >
            🗑
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            style={{ height: 36, width: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "#1a2a3a" }} />
          </button>
          <h2 style={{ fontWeight: 800, fontSize: 18, color: "#1a2a3a", minWidth: 280, textAlign: "center" }}>
            Semaine du {format(weekStart, "d MMMM", { locale: fr })} au {format(weekEnd, "d MMMM yyyy", { locale: fr })}
          </h2>
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            style={{ height: 36, width: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronRight className="h-4 w-4" style={{ color: "#1a2a3a" }} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", padding: "0 14px", fontSize: 13, fontWeight: 600, color: "#1a6b9c", cursor: "pointer" }}
          >
            Aujourd&apos;hui
          </button>
          <input
            type="date"
            value={format(weekStart, "yyyy-MM-dd")}
            onChange={(e) => {
              if (e.target.value) setWeekStart(startOfWeek(new Date(e.target.value), { weekStartsOn: 1 }));
            }}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", cursor: "pointer" }}
            title="Choisir une date"
          />
        </div>
        {!isRestrictedExterne && !isReadOnly && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#8399a9", fontWeight: 600 }}>Filtrer :</span>
          <select
            value={filterTrainer}
            onChange={(e) => setFilterTrainer(e.target.value)}
            style={{ height: 34, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
          >
            <option value="">Tous les experts</option>
            {TRAINERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        )}
      </div>

      {/* Weekly KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sessions cette semaine</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{weekSessions.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>VT</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{weekSessions.filter(s => s.session_type === "vt").length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Journées</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{weekSessions.filter(s => s.session_type === "journee").length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures totales</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{weekSessions.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0)}h</div>
        </div>
      </div>

      {/* Grid: trainers × days */}
      <div className="lca-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 120, padding: "12px 10px", fontSize: 12, fontWeight: 700, color: "#8399a9", textAlign: "left", borderBottom: "2px solid #e8ecf1", background: "#f8fbfd" }}>
                  Expert
                </th>
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, new Date());
                  const dayName = format(day, "EEE", { locale: fr });
                  const dayNum = format(day, "d MMM", { locale: fr });
                  return (
                    <th
                      key={i}
                      style={{
                        padding: "10px 6px", fontSize: 11, fontWeight: 700, textAlign: "center",
                        borderBottom: "2px solid #e8ecf1",
                        background: isToday ? "#e8f0fe" : i >= 5 ? "#fafafa" : "#f8fbfd",
                        color: isToday ? "#1a6b9c" : "#1a2a3a",
                      }}
                    >
                      <div style={{ textTransform: "capitalize" }}>{dayName}</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{dayNum}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayTrainers.map(trainer => {
                const tc = TRAINER_COLORS[trainer] ?? { bg: "#f5f5f5", text: "#555", border: "#999" };
                return (
                  <tr key={trainer}>
                    <td style={{ padding: "10px 10px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tc.text, background: tc.bg, padding: "4px 12px", borderRadius: 20, display: "inline-block" }}>
                        {trainer}
                      </span>
                    </td>
                    {weekDays.map((day, i) => {
                      const daySessions = getSessionsForDayAndTrainer(day, trainer);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <td
                          key={i}
                          style={{
                            padding: "6px 4px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top",
                            background: isToday ? "#f0f7fb" : i >= 5 ? "#fafafa" : "transparent",
                            minHeight: 60,
                          }}
                        >
                          {daySessions.map(s => renderSessionCard(s))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Unassigned row */}
              {hasUnassigned && !filterTrainer && (
                <tr>
                  <td style={{ padding: "10px 10px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#999", background: "#f5f5f5", padding: "4px 12px", borderRadius: 20, display: "inline-block" }}>
                      Non assigné
                    </span>
                  </td>
                  {weekDays.map((day, i) => {
                    const daySessions = getUnassignedForDay(day);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <td
                        key={i}
                        style={{
                          padding: "6px 4px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top",
                          background: isToday ? "#f0f7fb" : i >= 5 ? "#fafafa" : "transparent",
                        }}
                      >
                        {daySessions.map(s => renderSessionCard(s))}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session detail popup */}
      {selectedSession && (() => {
        const s = selectedSession;
        const plan = s.service_plans;
        const company = plan?.companies?.name ?? "—";
        const program = plan?.training_programs?.name ?? "";
        const learners = (s.training_session_learners ?? []).map(sl => sl.learners).filter(Boolean);
        const sc = statusLabels[sessionStatus] ?? statusLabels[s.status];
        const hourlyRate = Number(plan?.hourly_rate) || 0;
        const sessionAmount = (Number(s.duration_hours) || 0) * hourlyRate;

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) { stopRecording(); setSelectedSession(null); } }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
                    {s.session_type === "vt" ? "Visio Training" : "Journée"} — {format(new Date(s.session_date), "EEEE d MMMM yyyy", { locale: fr })}{s.session_time ? ` à ${String(s.session_time).slice(0, 5)}` : ""}
                  </h3>
                  <div style={{ fontSize: 13, color: "#5a6f80", marginTop: 2 }}>{company}{program ? ` · ${program}` : ""}</div>
                </div>
                <button onClick={() => { stopRecording(); setSelectedSession(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 20 }} className="space-y-4">
                {/* Info cards */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.text }}>{sc.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: s.session_type === "vt" ? "#e8f0fe" : "#fff3e0", color: s.session_type === "vt" ? "#1a6b9c" : "#FF6B35" }}>
                    {Number(s.duration_hours) || 0}h
                  </span>
                  {s.is_billable && hourlyRate > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#e8f5e9", color: "#2e7d32" }}>{fmt(sessionAmount)}</span>
                  )}
                  {!s.is_billable && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#f5f5f5", color: "#999" }}>Non facturable</span>
                  )}
                </div>

                {/* Trainers */}
                {s.trainers && s.trainers.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Expert(s)</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {s.trainers.map(t => {
                        const tc = TRAINER_COLORS[t] ?? { bg: "#f5f5f5", text: "#555" };
                        return <span key={t} style={{ fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 20, background: tc.bg, color: tc.text }}>{t}</span>;
                      })}
                    </div>
                  </div>
                )}

                {/* Learners */}
                {learners.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Apprenants</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {learners.map(l => (
                        <span
                          key={l!.id}
                          onClick={() => { openLearnerPopup(l!.id, l!.first_name, l!.last_name); }}
                          style={{ fontSize: 12, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                        >
                          {l!.first_name} {l!.last_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status change */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Statut</div>
                  {(() => {
                    const isFuture = new Date(s.session_date) > new Date(new Date().toISOString().split("T")[0]);
                    return (
                      <>
                        <select
                          value={sessionStatus}
                          onChange={(e) => setSessionStatus(e.target.value)}
                          style={{ height: 34, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, background: (statusLabels[sessionStatus] ?? sc).bg, color: (statusLabels[sessionStatus] ?? sc).text, cursor: "pointer" }}
                        >
                          <option value="planned">Planifié</option>
                          {!isFuture && <option value="done">Réalisé</option>}
                          <option value="cancelled">Annulé</option>
                        </select>
                        {isFuture && sessionStatus === "planned" && (
                          <p style={{ fontSize: 11, color: "#8399a9", marginTop: 4 }}>Cette session est dans le futur — seule l&apos;annulation est possible.</p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Notes */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Notes</div>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Écrire ou dicter vos notes..."
                    style={{ width: "100%", minHeight: 140, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => isRecording ? stopRecording() : startRecording()}
                      style={{
                        height: 38, width: 38, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: isRecording ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                        color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isRecording ? "0 0 0 4px rgba(231,76,60,0.2)" : "none",
                        animation: isRecording ? "pulse 1.5s infinite" : "none",
                      }}
                      title={isRecording ? "Arrêter" : "Dicter"}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <span style={{ fontSize: 12, color: isRecording ? "#e74c3c" : "#8399a9", fontWeight: isRecording ? 600 : 400 }}>
                      {isRecording ? "Enregistrement..." : "Dicter les notes"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button
                  onClick={() => router.push("/planning")}
                  style={{ fontSize: 12, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Voir dans Planification
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { stopRecording(); setSelectedSession(null); }}
                    style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveSession}
                    disabled={savingNotes}
                    style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: savingNotes ? 0.6 : 1 }}
                  >
                    {savingNotes ? "..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {viewLearner && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setViewLearner(null); }}>
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

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.4); }
          70% { box-shadow: 0 0 0 10px rgba(231,76,60,0); }
          100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
        }
      `}</style>
    </div>
  );
}
