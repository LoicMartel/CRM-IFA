"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, CheckSquare, CheckCircle, AlertTriangle, Video, MapPin, TrendingUp, X, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";

type R = Record<string, unknown>;

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const MEETING_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  R0: { bg: "#ede7f6", text: "#4a148c", border: "#7c4dff" },
  R1: { bg: "#fce4ec", text: "#c62828", border: "#e74c3c" },
  R2: { bg: "#e3f2fd", text: "#1565c0", border: "#1a6b9c" },
  R3: { bg: "#e8f5e9", text: "#2e7d32", border: "#27ae60" },
};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  booked: { label: "Planifié", bg: "#e8f0fe", text: "#0d4f7a" },
  done: { label: "Effectué", bg: "#e8f5e9", text: "#2e7d32" },
  no_show: { label: "No show", bg: "#fce4ec", text: "#c62828" },
  cancelled: { label: "Annulé", bg: "#f5f5f5", text: "#999" },
};

const MODE_ICONS: Record<string, { icon: typeof Video; label: string }> = {
  visio: { icon: Video, label: "Visio" },
  phone: { icon: Phone, label: "Téléphone" },
  in_person: { icon: MapPin, label: "Présentiel" },
};

const MOTIVATIONAL_PHRASES = [
  "cartonne tout aujourd'hui !",
  "crois en toi, tu vas déchirer aujourd'hui !",
  "chaque appel te rapproche du succès !",
  "aujourd'hui est une nouvelle opportunité de briller !",
  "fais de cette journée une journée exceptionnelle !",
  "ta détermination fait la différence !",
  "le succès t'attend, fonce !",
  "donne le meilleur de toi-même aujourd'hui !",
  "chaque effort compte, continue comme ça !",
  "tu es plus proche de tes objectifs que tu ne le penses !",
  "reste focus, les résultats suivront !",
  "la persévérance paie toujours !",
  "ton énergie est contagieuse, partage-la !",
  "aujourd'hui, chaque conversation est une chance !",
  "tu as tout ce qu'il faut pour réussir !",
  "sois audacieux, sois toi-même !",
  "la confiance est ta meilleure arme !",
  "transforme chaque défi en opportunité !",
  "un pas de plus vers la victoire !",
  "fais vibrer tes prospects aujourd'hui !",
  "le closing c'est un art, et tu es un artiste !",
  "rappelle-toi pourquoi tu fais ça, et fonce !",
  "la magie opère quand tu sors de ta zone de confort !",
  "ton sourire au téléphone ça s'entend, souris !",
  "pas de pression, juste de la progression !",
  "chaque non te rapproche du prochain oui !",
  "tu es là pour une raison, prouve-le !",
  "écoute, comprends, propose, tu gères !",
  "aujourd'hui quelqu'un a besoin de toi !",
  "vends comme tu es, c'est ta force !",
  "la clé c'est l'écoute, le reste suit !",
  "ta valeur ne dépend pas d'un résultat, mais de ton engagement !",
  "chaque matin est un nouveau départ, profites-en !",
  "les champions ne lâchent jamais, et toi non plus !",
  "ton attitude détermine ton altitude !",
  "fais ce que les autres ne font pas, récolte ce qu'ils n'ont pas !",
  "l'excellence n'est pas un acte, c'est une habitude !",
  "aujourd'hui tu plantes les graines de demain !",
  "ta passion est ton super-pouvoir !",
  "ne compte pas les jours, fais que les jours comptent !",
  "le meilleur moment pour agir c'est maintenant !",
  "tu n'as pas besoin d'être parfait, juste déterminé !",
  "chaque client est une histoire à écrire ensemble !",
  "ta régularité fera la différence sur le long terme !",
  "inspire confiance, inspire l'action !",
  "les obstacles sont des tremplins déguisés !",
  "ton prochain appel pourrait tout changer !",
  "la réussite aime ceux qui osent !",
  "sois la raison pour laquelle quelqu'un avance aujourd'hui !",
  "l'énergie que tu dégages attire les bonnes opportunités !",
  "concentre-toi sur la solution, jamais sur le problème !",
  "chaque interaction est une chance de créer de la valeur !",
  "ta discipline d'aujourd'hui construit ta liberté de demain !",
  "le talent ouvre des portes, le travail les défonce !",
  "reste curieux, reste affamé, reste humble !",
  "ton enthousiasme est ta meilleure carte de visite !",
  "les grands résultats commencent par de petites actions !",
  "n'attends pas la motivation, crée-la !",
  "chaque prospect mérite ton meilleur toi !",
  "la différence entre rêver et réussir c'est l'action !",
  "aujourd'hui est le jour idéal pour battre tes records !",
  "fais confiance au processus, les résultats viendront !",
  "ton authenticité est ce qui te rend unique !",
  "la constance bat le talent quand le talent ne travaille pas !",
  "chaque jour est une chance de progresser, saisis-la !",
  "ta positivité est contagieuse, répands-la !",
  "le succès est un escalier, pas un ascenseur !",
  "aujourd'hui tu es un peu meilleur qu'hier, c'est ça la clé !",
  "les limites n'existent que dans ta tête, dépasse-les !",
  "fais de chaque appel un moment d'exception !",
];

// Pseudo-random shuffle based on day number for consistent daily order
function getDailyPhrase(phrases: string[]): string {
  const dayNum = Math.floor(new Date().getTime() / 86400000);
  // Simple seeded shuffle using day number
  const shuffled = [...phrases];
  let seed = dayNum;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled[dayNum % shuffled.length];
}

export function HomeView({
  memberFirstName, currentMemberId, salesTargets, wonDeals, todayMeetings, todaySessions, todayTasks,
  upcomingMeetings, upcomingSessions, overdueTasks, allProgressSessions = [],
}: {
  memberFirstName?: string;
  currentMemberId?: string | null;
  salesTargets: R[];
  wonDeals: R[];
  todayMeetings: R[];
  todaySessions: R[];
  todayTasks: R[];
  upcomingMeetings: R[];
  upcomingSessions: R[];
  overdueTasks: R[];
  allProgressSessions?: { id: string; service_plan_id: string; session_type: string; status: string; session_date: string }[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const today = new Date();
  const todayLabel = format(today, "EEEE d MMMM yyyy", { locale: fr });

  // ===== Meeting popup state =====
  const [selectedMeeting, setSelectedMeeting] = useState<R | null>(null);
  const [rdvForm, setRdvForm] = useState({
    meeting_type: "R0", status: "booked", duration_minutes: "60", meeting_mode: "visio",
    notes: "", outcome: "", rdv_result: "" as "" | "signed" | "not_signed" | "quote_to_send" | "opportunity_detected",
  });
  const [savingRdv, setSavingRdv] = useState(false);

  // ===== Session popup state =====
  const [selectedSession, setSelectedSession] = useState<R | null>(null);
  const [sessionForm, setSessionForm] = useState({ status: "planned", notes: "" });
  const [savingSession, setSavingSession] = useState(false);

  // ===== Task popup state =====
  const [selectedTask, setSelectedTask] = useState<R | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", due_date: "", task_deadline: "" });
  const [savingTask, setSavingTask] = useState(false);

  // ===== Session progression (e.g. "VT 2/12", "Journée 3/5") =====
  function getSessionProgress(servicePlanId: string | undefined, sessionType: string): { done: number; total: number } | null {
    if (!servicePlanId || allProgressSessions.length === 0) return null;
    const planSessions = allProgressSessions.filter(s => s.service_plan_id === servicePlanId && s.session_type === sessionType);
    if (planSessions.length <= 1) return null;
    const done = planSessions.filter(s => s.status === "done").length;
    return { done, total: planSessions.length };
  }

  // ===== Collect names for voice recognition =====
  const allNames = Array.from(new Set([
    ...todayMeetings.map((m: R) => { const c = m.contacts as { first_name: string; last_name: string } | null; return c ? `${c.first_name} ${c.last_name}` : ""; }),
    ...todaySessions.flatMap((s: R) => ((s as any).training_session_learners ?? []).map((sl: any) => sl.learners ? `${sl.learners.first_name} ${sl.learners.last_name}` : "")),
    ...todayMeetings.map((m: R) => { const c = m.companies as { name: string } | null; return c?.name ?? ""; }),
  ].filter(Boolean)));

  // ===== Voice dictation =====
  const rdvNotesVoice = useVoiceDictation(() => rdvForm.notes, (t) => setRdvForm(f => ({ ...f, notes: t })), { names: allNames });
  const rdvOutcomeVoice = useVoiceDictation(() => rdvForm.outcome, (t) => setRdvForm(f => ({ ...f, outcome: t })), { names: allNames });
  const sessionNotesVoice = useVoiceDictation(() => sessionForm.notes, (t) => setSessionForm(f => ({ ...f, notes: t })), { names: allNames });

  function stopRecording() {
    rdvNotesVoice.stopRecording();
    rdvOutcomeVoice.stopRecording();
    sessionNotesVoice.stopRecording();
  }

  function openMeeting(m: R) {
    setSelectedMeeting(m);
    setRdvForm({
      meeting_type: (m.meeting_type as string) || "R0",
      status: (m.status as string) || "booked",
      duration_minutes: String((m.duration_minutes as number) ?? 60),
      meeting_mode: (m.meeting_mode as string) || "visio",
      notes: (m.notes as string) ?? "",
      outcome: (m.outcome as string) ?? "",
      rdv_result: "",
    });
  }

  async function handleSaveRdv() {
    if (!selectedMeeting) return;
    setSavingRdv(true);
    const supabase = createClient();
    const m = selectedMeeting;

    let outcomeText = rdvForm.outcome || "";
    if (rdvForm.status === "done" && rdvForm.rdv_result) {
      const labels: Record<string, string> = { signed: "Signed", not_signed: "Not signed", quote_to_send: "Devis à envoyer", opportunity_detected: "Opportunité détectée" };
      outcomeText = labels[rdvForm.rdv_result] || rdvForm.rdv_result;
    }

    const originalStatus = m.status as string;
    const newStatus = rdvForm.status;

    if (originalStatus === "booked" && (newStatus === "done" || newStatus === "no_show" || newStatus === "cancelled")) {
      await supabase.from("meetings").update({
        meeting_type: rdvForm.meeting_type,
        status: newStatus,
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
      }).eq("id", m.id as string);

      if (m.contact_id) {
        if (newStatus === "done" && rdvForm.rdv_result === "signed") {
          await supabase.from("contacts").update({ lead_status: "signed", lifecycle_stage: "customer", is_client: true }).eq("id", m.contact_id as string);
          if (m.company_id) {
            await supabase.from("companies").update({ lifecycle_stage: "customer" }).eq("id", m.company_id as string);
            await supabase.from("contacts").update({ is_client: true }).eq("company_id", m.company_id as string);
          }
        } else if (newStatus === "done") {
          await supabase.from("contacts").update({ lead_status: "rdv_done" }).eq("id", m.contact_id as string);
        }
      }

      if (newStatus === "done" && (rdvForm.rdv_result === "opportunity_detected" || rdvForm.rdv_result === "quote_to_send")) {
        const dealStage = rdvForm.rdv_result === "quote_to_send" ? "quote_to_send" : "opportunities";
        const contact = m.contacts as { first_name: string; last_name: string } | null;
        const company = m.companies as { name: string } | null;
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Deal";
        const companyName = company?.name ? ` - ${company.name}` : "";
        await supabase.from("deals").insert({
          name: `${contactName}${companyName}`,
          contact_id: m.contact_id,
          company_id: m.company_id,
          owner_id: m.assigned_to || currentMemberId,
          stage: dealStage,
          probability: dealStage === "quote_to_send" ? 40 : 20,
        });
      }

      if (newStatus === "done" && rdvForm.rdv_result === "signed") {
        const contact = m.contacts as { first_name: string; last_name: string } | null;
        const company = m.companies as { name: string } | null;
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Deal";
        const companyName = company?.name ? ` - ${company.name}` : "";
        await supabase.from("deals").insert({
          name: `${contactName}${companyName}`,
          contact_id: m.contact_id,
          company_id: m.company_id,
          owner_id: m.assigned_to || currentMemberId,
          stage: "closed_won",
          probability: 100,
        });
      }
    } else {
      await supabase.from("meetings").update({
        meeting_type: rdvForm.meeting_type,
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
      }).eq("id", m.id as string);
    }

    setSavingRdv(false);
    setSelectedMeeting(null);
    stopRecording();
    router.refresh();
  }

  function openSession(s: R) {
    setSelectedSession(s);
    setSessionForm({
      status: (s.status as string) || "planned",
      notes: (s.notes as string) ?? "",
    });
  }

  async function handleSaveSession() {
    if (!selectedSession) return;
    setSavingSession(true);
    const supabase = createClient();
    await supabase.from("training_sessions").update({
      status: sessionForm.status,
      notes: sessionForm.notes || null,
    }).eq("id", selectedSession.id as string);
    // Sync delivery + learner statuses
    fetch("/api/learners/sync-status").catch(() => {});
    try { await fetch("/api/sessions/sync-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingSessionId: selectedSession.id as string }) }); } catch {}
    setSavingSession(false);
    setSelectedSession(null);
    stopRecording();
    router.refresh();
  }

  function openTask(t: R) {
    setSelectedTask(t);
    setTaskForm({
      title: (t.title as string) || "",
      description: (t.description as string) ?? "",
      due_date: t.due_date ? new Date(t.due_date as string).toISOString().slice(0, 16) : "",
      task_deadline: (t.task_deadline as string) ?? "",
    });
  }

  async function handleSaveTask() {
    if (!selectedTask) return;
    setSavingTask(true);
    const supabase = createClient();
    await supabase.from("activities").update({
      title: taskForm.title,
      description: taskForm.description || null,
      due_date: taskForm.due_date || null,
      task_deadline: taskForm.task_deadline || null,
    }).eq("id", selectedTask.id as string);
    setSavingTask(false);
    setSelectedTask(null);
    router.refresh();
  }

  async function handleCompleteTask() {
    if (!selectedTask) return;
    const supabase = createClient();
    await supabase.from("activities").update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    }).eq("id", selectedTask.id as string);
    setSelectedTask(null);
    router.refresh();
  }

  async function handleDeleteTask() {
    if (!selectedTask) return;
    if (!confirm("Supprimer cette tâche ?")) return;
    const supabase = createClient();
    await supabase.from("activities").delete().eq("id", selectedTask.id as string);
    setSelectedTask(null);
    router.refresh();
  }

  // ===== CA Progress (monthly) =====
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const monthlyCA = wonDeals.filter(d => ((d.close_date || d.created_at) as string ?? "").startsWith(currentMonthStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const lastTarget = salesTargets.find(t => (t.month as string ?? "").startsWith(currentMonthStr)) ?? salesTargets[salesTargets.length - 1];
  const monthTarget = Number(lastTarget?.target_amount) || 80000;
  const caPct = monthTarget > 0 ? (monthlyCA / monthTarget) * 100 : 0;

  const MEETING_COLORS: Record<string, { bg: string; text: string }> = {
    R0: { bg: "#ede7f6", text: "#4a148c" }, R1: { bg: "#fce4ec", text: "#c62828" },
    R2: { bg: "#e3f2fd", text: "#1565c0" }, R3: { bg: "#e8f5e9", text: "#2e7d32" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a2a3a", fontFamily: "var(--font-caveat), 'Caveat', cursive" }}>
          Bonjour{memberFirstName ? ` ${memberFirstName}` : ""}, {getDailyPhrase(MOTIVATIONAL_PHRASES)} 👋
        </h1>
        <p style={{ fontSize: 14, color: "#8399a9", textTransform: "capitalize", marginTop: 4 }}>{todayLabel}</p>
      </div>

      {/* ===== CA Progress Bar ===== */}
      {!isRestrictedExterne && !isReadOnly && <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="lca-bar-gradient-hot" />
        <div style={{ padding: 20 }}>
          <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
            <div>
              <div className="lca-label" style={{ textTransform: "capitalize" }}>Progression du mois — {currentMonthLabel}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{fmt(monthlyCA)}</span>
                <span style={{ fontSize: 13, color: "#8399a9" }}>/ {fmt(monthTarget)}</span>
              </div>
            </div>
            <div className="lca-big-pct">{caPct.toFixed(1)}%</div>
          </div>
          <div className="lca-progress-wrapper">
            <div className="lca-progress-track">
              <div
                className="lca-progress-fill"
                style={{
                  width: `${Math.min(caPct, 100)}%`,
                  background: caPct > 100
                    ? "linear-gradient(90deg, #0a3d5f 0%, #1a6b9c 25%, #FF6B35 60%, #e74c3c 100%)"
                    : "linear-gradient(90deg, #0a3d5f 0%, #1a6b9c 40%, #1a6b9c 70%, #FF6B35 100%)",
                }}
              />
            </div>
            <div className="lca-progress-badge" style={{ left: `clamp(0px, calc(${Math.min(caPct, 100)}% - 20px), calc(100% - 40px))` }}>
              {Math.round(caPct)}%
            </div>
          </div>
          <div className="flex justify-between" style={{ marginTop: 10, fontSize: 12 }}>
            <span style={{ color: "#8399a9" }}>0 €</span>
            <span style={{ color: "#FF6B35", fontWeight: 700 }}>{fmt(monthlyCA)}</span>
            <span style={{ color: "#8399a9" }}>{fmt(monthTarget)}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {caPct >= 100 ? (
              <span className="lca-badge-green"><CheckCircle style={{ width: 14, height: 14 }} /> Objectif atteint !</span>
            ) : (
              <span className="lca-badge-orange">{caPct.toFixed(0)}% de l&apos;objectif — Reste {fmt(Math.max(0, monthTarget - monthlyCA))}</span>
            )}
          </div>
        </div>
      </div>}

      {/* ===== Alertes ===== */}
      {overdueTasks.length > 0 && (
        <div style={{ padding: "12px 16px", background: "#fde8e8", borderRadius: 10, borderLeft: "4px solid #e74c3c", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle className="h-4 w-4" style={{ color: "#e74c3c", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#c62828", fontWeight: 600 }}>
            {overdueTasks.length} tâche{overdueTasks.length > 1 ? "s" : ""} en retard
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
            {overdueTasks.slice(0, 3).map((t: R) => (
              <span key={t.id as string} style={{ fontSize: 11, background: "white", padding: "2px 8px", borderRadius: 20, color: "#e74c3c", fontWeight: 600 }}>
                {t.title as string}
              </span>
            ))}
            {overdueTasks.length > 3 && <span style={{ fontSize: 11, color: "#e74c3c" }}>+{overdueTasks.length - 3}</span>}
          </div>
        </div>
      )}

      {/* ===== Vue d'ensemble de la journée ===== */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>RDV aujourd&apos;hui</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{todayMeetings.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sessions aujourd&apos;hui</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{todaySessions.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Tâches du jour</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{todayTasks.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Tâches en retard</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{overdueTasks.length}</div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* ===== RDV du jour ===== */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#1a6b9c" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar className="h-4 w-4" style={{ color: "#1a6b9c" }} /> RDV du jour
            </h3>
            {todayMeetings.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8399a9", textAlign: "center", padding: 20 }}>Aucun RDV aujourd&apos;hui</p>
            ) : (
              <div className="space-y-2">
                {todayMeetings.map((m: R) => {
                  const mc = MEETING_COLORS[(m.meeting_type as string)] ?? { bg: "#f0f0f0", text: "#666" };
                  const contact = m.contacts as { first_name: string; last_name: string } | null;
                  const company = m.companies as { name: string } | null;
                  const time = (() => { try { return format(new Date(m.scheduled_at as string), "HH:mm"); } catch { return ""; } })();
                  return (
                    <div key={m.id as string} onClick={() => openMeeting(m)} style={{ padding: "10px 12px", borderRadius: 8, background: mc.bg, borderLeft: `3px solid ${mc.text}`, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: mc.text }}>{time} · {m.meeting_type as string}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                          <button onClick={(e) => { e.stopPropagation(); openMeeting(m); }}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
                            title="Modifier">
                            ✏️
                          </button>
                          <button onClick={async (e) => { e.stopPropagation(); if (!window.confirm("Supprimer ce RDV ?")) return; const sb = createClient(); await sb.from("meetings").delete().eq("id", m.id as string); router.refresh(); }}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
                            title="Supprimer">
                            🗑
                          </button>
                        </div>
                      </div>
                      {contact && <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{contact.first_name} {contact.last_name}</div>}
                      {company && <div style={{ fontSize: 11, color: "#5a6f80" }}>{company.name}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                        {(() => { const sc = STATUS_LABELS[m.status as string] ?? STATUS_LABELS.booked; return <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.text }}>{sc.label}</span>; })()}
                        {(m.status as string) === "booked" && (
                          <button onClick={(e) => { e.stopPropagation(); openMeeting(m); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px" }}>
                            📋 Suivi rdv
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== Sessions du jour ===== */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#27ae60" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Video className="h-4 w-4" style={{ color: "#27ae60" }} /> Sessions du jour
            </h3>
            {todaySessions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8399a9", textAlign: "center", padding: 20 }}>Aucune session aujourd&apos;hui</p>
            ) : (
              <div className="space-y-2">
                {todaySessions.map((s: R) => {
                  const isJournee = s.session_type === "journee";
                  const time = s.session_time ? String(s.session_time).slice(0, 5) : "";
                  const plan = s.service_plans as { companies: { name: string } | null; training_programs: { name: string } | null } | null;
                  const trainers = (s.trainers as string[]) ?? [];
                  return (
                    <div key={s.id as string} onClick={() => openSession(s)} style={{ padding: "10px 12px", borderRadius: 8, background: isJournee ? "#fff3e0" : "#e8f0fe", borderLeft: `3px solid ${isJournee ? "#e65100" : "#1a6b9c"}`, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isJournee ? "#e65100" : "#1a6b9c" }}>
                          {time ? `${time} · ` : ""}{(() => { const p = getSessionProgress((s as any).service_plan_id, s.session_type as string); const label = isJournee ? "Journée" : "VT"; return p ? `${label} ${p.done}/${p.total}` : label; })()}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                          <button onClick={(e) => { e.stopPropagation(); openSession(s); }}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
                            title="Modifier">
                            ✏️
                          </button>
                          <button onClick={async (e) => { e.stopPropagation(); if (!window.confirm("Supprimer cette session ?")) return; const sb = createClient(); await sb.from("training_session_learners").delete().eq("training_session_id", s.id as string); await sb.from("training_sessions").delete().eq("id", s.id as string); router.refresh(); }}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
                            title="Supprimer">
                            🗑
                          </button>
                        </div>
                      </div>
                      {plan?.companies && <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{plan.companies.name}</div>}
                      {trainers.length > 0 && <div style={{ fontSize: 11, color: "#5a6f80" }}>{trainers.join(", ")}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                        {(() => { const sessionStatusLabels: Record<string, { bg: string; text: string; label: string }> = { planned: { bg: "#e8f0fe", text: "#0d4f7a", label: "Planifié" }, done: { bg: "#e8f5e9", text: "#2e7d32", label: "Réalisé" }, cancelled: { bg: "#f5f5f5", text: "#999", label: "Annulé" }, no_show: { bg: "#fce4ec", text: "#c62828", label: "No show" } }; const sc = sessionStatusLabels[s.status as string] ?? sessionStatusLabels.planned; return <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.text }}>{sc.label}</span>; })()}
                        {(s.status as string) === "planned" && (
                          <button onClick={(e) => { e.stopPropagation(); openSession(s); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px" }}>
                            📋 Suivi session
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== Tâches du jour ===== */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#FF6B35" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckSquare className="h-4 w-4" style={{ color: "#FF6B35" }} /> Tâches du jour
            </h3>
            {todayTasks.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8399a9", textAlign: "center", padding: 20 }}>Aucune tâche aujourd&apos;hui</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((t: R) => {
                  const contact = t.contacts as { first_name: string; last_name: string } | null;
                  const learner = t.learners as { first_name: string; last_name: string } | null;
                  const who = contact ? `${contact.first_name} ${contact.last_name}` : learner ? `${learner.first_name} ${learner.last_name}` : "";
                  const time = t.due_date ? (() => { try { const raw = t.due_date as string; return raw.includes("T") ? raw.slice(11, 16) : ""; } catch { return ""; } })() : "";
                  return (
                    <div key={t.id as string} onClick={() => openTask(t)} style={{ padding: "10px 12px", borderRadius: 8, background: "#fce4ec", borderLeft: "3px solid #e74c3c", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#c62828" }}>{time ? `${time} · ` : ""}Tâche</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{t.title as string}</div>
                      {who && <div style={{ fontSize: 11, color: "#5a6f80" }}>{who}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== Tâches en retard ===== */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#e74c3c" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle className="h-4 w-4" style={{ color: "#e74c3c" }} /> Tâches en retard
            </h3>
            {overdueTasks.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8399a9", textAlign: "center", padding: 20 }}>Aucune tâche en retard</p>
            ) : (
              <div className="space-y-2">
                {overdueTasks.map((t: R) => {
                  const contact = t.contacts as { first_name: string; last_name: string } | null;
                  const learner = t.learners as { first_name: string; last_name: string } | null;
                  const who = contact ? `${contact.first_name} ${contact.last_name}` : learner ? `${learner.first_name} ${learner.last_name}` : "";
                  const deadline = t.task_deadline as string | null;
                  const diffDays = deadline ? Math.floor((new Date().getTime() - new Date(deadline).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                    <div key={t.id as string} onClick={() => openTask(t)} style={{ padding: "10px 12px", borderRadius: 8, background: "#fff5f5", borderLeft: "3px solid #e74c3c", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#e74c3c" }}>{t.title as string}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: "#fde8e8", color: "#e74c3c", marginLeft: "auto" }}>
                          {diffDays}j de retard
                        </span>
                      </div>
                      {who && <div style={{ fontSize: 11, color: "#5a6f80" }}>{who}</div>}
                      {deadline && <div style={{ fontSize: 10, color: "#e74c3c" }}>Échéance : {(() => { try { return format(new Date(deadline), "d MMM yyyy", { locale: fr }); } catch { return ""; } })()}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== À venir ===== */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#0d4f7a" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp className="h-4 w-4" style={{ color: "#0d4f7a" }} /> Prochains RDV
            </h3>
            {upcomingMeetings.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8399a9", textAlign: "center", padding: 20 }}>Aucun RDV à venir</p>
            ) : (
              <div className="space-y-2">
                {upcomingMeetings.map((m: R) => {
                  const contact = m.contacts as { first_name: string; last_name: string } | null;
                  const dateLabel = (() => { try { return format(new Date(m.scheduled_at as string), "EEE d MMM 'à' HH:mm", { locale: fr }); } catch { return ""; } })();
                  return (
                    <div key={m.id as string} onClick={() => router.push("/agenda-commercial")} style={{ padding: "8px 12px", borderRadius: 8, background: "#f8fbfd", borderLeft: "3px solid #1a6b9c", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1a2a3a" }}>{m.meeting_type as string} — {contact ? `${contact.first_name} ${contact.last_name}` : "—"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#8399a9" }}>{dateLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#2e7d32" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock className="h-4 w-4" style={{ color: "#2e7d32" }} /> Prochaines sessions
            </h3>
            {upcomingSessions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8399a9", textAlign: "center", padding: 20 }}>Aucune session à venir</p>
            ) : (
              <div className="space-y-2">
                {upcomingSessions.map((s: R) => {
                  const isJournee = s.session_type === "journee";
                  const plan = s.service_plans as { companies: { name: string } | null } | null;
                  const dateLabel = (() => { try { return format(new Date(s.session_date as string), "EEE d MMM", { locale: fr }); } catch { return ""; } })();
                  return (
                    <div key={s.id as string} onClick={() => router.push("/planning")} style={{ padding: "8px 12px", borderRadius: 8, background: "#f8fbfd", borderLeft: `3px solid ${isJournee ? "#e65100" : "#27ae60"}`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1a2a3a" }}>{(() => { const p = getSessionProgress((s as any).service_plan_id, s.session_type as string); const label = isJournee ? "Journée" : "VT"; return p ? `${label} ${p.done}/${p.total}` : label; })()} — {plan?.companies?.name ?? "—"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#8399a9" }}>{dateLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ===== POPUP: Suivi du RDV ===== */}
      {/* ===================================================================== */}
      {selectedMeeting && (() => {
        const m = selectedMeeting;
        const tc = MEETING_TYPE_COLORS[rdvForm.meeting_type] ?? MEETING_TYPE_COLORS.R0;
        const sc = STATUS_LABELS[m.status as string] ?? STATUS_LABELS.booked;
        const modeInfo = MODE_ICONS[rdvForm.meeting_mode];
        const ModeIcon = modeInfo?.icon ?? Video;
        const isFuture = new Date(m.scheduled_at as string) > new Date();
        const contact = m.contacts as { first_name: string; last_name: string } | null;
        const company = m.companies as { name: string } | null;
        const teamMember = m.team_members as { first_name: string; last_name: string } | null;

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) { stopRecording(); setSelectedMeeting(null); } }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Suivi du RDV</h3>
                </div>
                <button onClick={() => { stopRecording(); setSelectedMeeting(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 20 }} className="space-y-4">
                {/* Type de RDV */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4 }}>Type de RDV *</div>
                  <select value={rdvForm.meeting_type} onChange={(e) => setRdvForm({ ...rdvForm, meeting_type: e.target.value })}
                    style={{ height: 36, width: "100%", borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, background: tc.bg, color: tc.text, cursor: "pointer" }}>
                    <option value="R0">R0 — Qualif.</option>
                    <option value="R1">R1 — Découverte</option>
                    <option value="R2">R2 — Solution</option>
                    <option value="R3">R3 — Négo.</option>
                  </select>
                </div>

                {/* Date & Heure de l'action */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4 }}>Date & Heure de l&apos;action</div>
                  <div style={{ fontSize: 13, color: "#1a2a3a", padding: "8px 12px", background: "#f5f7fa", borderRadius: 8 }}>
                    {(() => { try { return format(new Date((m.created_at ?? m.scheduled_at) as string), "dd/MM/yyyy HH:mm", { locale: fr }); } catch { return "—"; } })()}
                  </div>
                  <div style={{ fontSize: 11, color: "#8399a9", marginTop: 2 }}>Quand cette action a été effectuée</div>
                </div>

                {/* Date & Heure du RDV planifié */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4 }}>Date & Heure du RDV planifié *</div>
                  <div style={{ fontSize: 13, color: "#1a2a3a", padding: "8px 12px", background: "#f5f7fa", borderRadius: 8 }}>
                    {(() => { try { return format(new Date(m.scheduled_at as string), "dd/MM/yyyy HH:mm", { locale: fr }); } catch { return "—"; } })()}
                  </div>
                  <div style={{ fontSize: 11, color: "#8399a9", marginTop: 2 }}>Quand le RDV aura lieu</div>
                </div>

                {/* Durée + Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4 }}>Durée</div>
                    <select value={rdvForm.duration_minutes} onChange={(e) => setRdvForm({ ...rdvForm, duration_minutes: e.target.value })}
                      style={{ height: 36, width: "100%", borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a", cursor: "pointer" }}>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1h</option>
                      <option value="90">1h30</option>
                      <option value="120">2h</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4 }}>Mode</div>
                    <select value={rdvForm.meeting_mode} onChange={(e) => setRdvForm({ ...rdvForm, meeting_mode: e.target.value })}
                      style={{ height: 36, width: "100%", borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a", cursor: "pointer" }}>
                      <option value="visio">Visio</option>
                      <option value="phone">Téléphone</option>
                      <option value="in_person">En personne</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4 }}>Notes du RDV</div>
                  <textarea
                    value={rdvForm.notes}
                    onChange={(e) => setRdvForm({ ...rdvForm, notes: e.target.value })}
                    placeholder="Écrivez ou dictez vos notes de RDV..."
                    style={{ width: "100%", minHeight: 100, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                  />
                  <VoiceButton isRecording={rdvNotesVoice.isRecording} isFormatting={rdvNotesVoice.isFormatting} onClick={rdvNotesVoice.toggleRecording} tone={rdvNotesVoice.tone} onToneChange={rdvNotesVoice.setTone} />
                </div>

                {/* Statut du RDV */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Statut du RDV</div>
                  <select
                    value={rdvForm.status}
                    onChange={(e) => setRdvForm({ ...rdvForm, status: e.target.value, rdv_result: "" })}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, background: (STATUS_LABELS[rdvForm.status] ?? sc).bg, color: (STATUS_LABELS[rdvForm.status] ?? sc).text, cursor: "pointer" }}
                  >
                    <option value="booked">Planifié</option>
                    {!isFuture && <option value="done">Effectué (Done)</option>}
                    {!isFuture && <option value="no_show">No show</option>}
                    <option value="cancelled">Annulé</option>
                  </select>
                  {isFuture && rdvForm.status === "booked" && (
                    <p style={{ fontSize: 11, color: "#8399a9", marginTop: 4 }}>Ce RDV est dans le futur — seule l&apos;annulation est possible.</p>
                  )}
                </div>

                {/* Résultat du RDV (si done) */}
                {rdvForm.status === "done" && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Résultat du RDV</div>
                    <select
                      value={rdvForm.rdv_result}
                      onChange={(e) => setRdvForm({ ...rdvForm, rdv_result: e.target.value as typeof rdvForm.rdv_result })}
                      style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, color: "#1a2a3a", cursor: "pointer" }}
                    >
                      <option value="">Sélectionner...</option>
                      <option value="opportunity_detected">Opportunité détectée</option>
                      <option value="quote_to_send">Devis à envoyer</option>
                      <option value="signed">Signed</option>
                      <option value="not_signed">Not signed</option>
                    </select>
                  </div>
                )}

                {/* Result messages */}
                {rdvForm.status === "done" && rdvForm.rdv_result === "signed" && (
                  <div style={{ padding: "10px 14px", background: "#e8f8f0", borderRadius: 8, borderLeft: "4px solid #2ecc71", fontSize: 13, color: "#27ae60", fontWeight: 500 }}>
                    Le contact passera en statut &quot;Signed&quot; et en cycle &quot;Client&quot;.
                  </div>
                )}
                {rdvForm.status === "done" && rdvForm.rdv_result === "opportunity_detected" && (
                  <div style={{ padding: "10px 14px", background: "#e3f2fd", borderRadius: 8, borderLeft: "4px solid #1a6b9c", fontSize: 13, color: "#0d4f7a", fontWeight: 500 }}>
                    Un deal &quot;Opportunité&quot; sera créé automatiquement.
                  </div>
                )}
                {rdvForm.status === "done" && rdvForm.rdv_result === "quote_to_send" && (
                  <div style={{ padding: "10px 14px", background: "#fff3e0", borderRadius: 8, borderLeft: "4px solid #FF6B35", fontSize: 13, color: "#e65100", fontWeight: 500 }}>
                    Un deal &quot;Devis à envoyer&quot; sera créé automatiquement.
                  </div>
                )}
                {rdvForm.status === "no_show" && (
                  <div style={{ padding: "10px 14px", background: "#fde8e8", borderRadius: 8, borderLeft: "4px solid #e74c3c", fontSize: 13, color: "#c62828", fontWeight: 500 }}>
                    Le prospect ne s&apos;est pas présenté au rendez-vous.
                  </div>
                )}

                {/* Outcome (résumé) */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Résumé / Outcome</div>
                  <textarea
                    value={rdvForm.outcome}
                    onChange={(e) => setRdvForm({ ...rdvForm, outcome: e.target.value })}
                    placeholder="Résumé du RDV, prochaine étape..."
                    style={{ width: "100%", minHeight: 70, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                  />
                  <VoiceButton isRecording={rdvOutcomeVoice.isRecording} isFormatting={rdvOutcomeVoice.isFormatting} onClick={rdvOutcomeVoice.toggleRecording} tone={rdvOutcomeVoice.tone} onToneChange={rdvOutcomeVoice.setTone} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button
                  onClick={() => { stopRecording(); setSelectedMeeting(null); if (m.contact_id) router.push(`/contacts/${m.contact_id}`); }}
                  style={{ fontSize: 12, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Voir la fiche contact
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { stopRecording(); setSelectedMeeting(null); }} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveRdv}
                    disabled={savingRdv}
                    style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: savingRdv ? 0.6 : 1 }}
                  >
                    {savingRdv ? "..." : "Sauvegarder le suivi"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* ===== POPUP: Session edit ===== */}
      {/* ===================================================================== */}
      {selectedSession && (() => {
        const s = selectedSession;
        const isJournee = s.session_type === "journee";
        const plan = s.service_plans as { hourly_rate?: number; companies: { name: string } | null; training_programs: { name: string } | null } | null;
        const company = plan?.companies?.name ?? "—";
        const program = plan?.training_programs?.name ?? "";
        const time = s.session_time ? String(s.session_time).slice(0, 5) : "";
        const dateLabel = (() => { try { return format(new Date(s.session_date as string), "EEEE d MMMM yyyy", { locale: fr }); } catch { return ""; } })();
        const hourlyRate = Number(plan?.hourly_rate) || 0;
        const sessionAmount = (Number(s.duration_hours) || 0) * hourlyRate;
        const trainers = (s.trainers as string[]) ?? [];
        const learners = ((s as any).training_session_learners ?? []).map((sl: any) => sl.learners).filter(Boolean) as { id: string; first_name: string; last_name: string }[];
        const statusColors: Record<string, { bg: string; text: string; label: string }> = {
          planned: { bg: "#e8f0fe", text: "#0d4f7a", label: "Planifié" },
          done: { bg: "#e8f5e9", text: "#2e7d32", label: "Réalisé" },
          no_show: { bg: "#fce4ec", text: "#c62828", label: "No show" },
          cancelled: { bg: "#f5f5f5", text: "#999", label: "Annulé" },
        };
        const sc = statusColors[sessionForm.status] ?? statusColors.planned;

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) { stopRecording(); setSelectedSession(null); } }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
                    {isJournee ? "Journée" : "Visio Training"} — {dateLabel}{time ? ` à ${time}` : ""}
                  </h3>
                  <div style={{ fontSize: 13, color: "#5a6f80", marginTop: 2 }}>{company}{program ? ` · ${program}` : ""}</div>
                </div>
                <button onClick={() => { stopRecording(); setSelectedSession(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 20 }} className="space-y-4">
                {/* Info badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.text }}>{sc.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: isJournee ? "#fff3e0" : "#e8f0fe", color: isJournee ? "#FF6B35" : "#1a6b9c" }}>
                    {Number(s.duration_hours) || 0}h
                  </span>
                  {s.is_billable !== false && hourlyRate > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#e8f5e9", color: "#2e7d32" }}>{fmt(sessionAmount)}</span>
                  )}
                  {s.is_billable === false && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#f5f5f5", color: "#999" }}>Non facturable</span>
                  )}
                </div>

                {/* Experts */}
                {trainers.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Expert(s)</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {trainers.map(t => (
                        <span key={t} style={{ fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 20, background: "#e8f0fe", color: "#1a6b9c" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apprenants */}
                {learners.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Apprenants</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {learners.map(l => (
                        <span key={l.id} onClick={() => router.push(`/learners/${l.id}`)} style={{ fontSize: 12, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                          {l.first_name} {l.last_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Statut</div>
                  {(() => {
                    const isFuture = selectedSession ? new Date(selectedSession.session_date as string) > new Date(new Date().toISOString().split("T")[0]) : false;
                    return (
                      <>
                        <select
                          value={sessionForm.status}
                          onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value })}
                          style={{ height: 34, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, background: sc.bg, color: sc.text, cursor: "pointer" }}
                        >
                          <option value="planned">Planifié</option>
                          {!isFuture && <option value="done">Réalisé</option>}
                          {!isFuture && <option value="no_show">No show</option>}
                          <option value="cancelled">Annulé</option>
                        </select>
                        {isFuture && sessionForm.status === "planned" && (
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
                    value={sessionForm.notes}
                    onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                    placeholder="Écrire ou dicter vos notes..."
                    style={{ width: "100%", minHeight: 140, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                  />
                  <VoiceButton isRecording={sessionNotesVoice.isRecording} isFormatting={sessionNotesVoice.isFormatting} onClick={sessionNotesVoice.toggleRecording} tone={sessionNotesVoice.tone} onToneChange={sessionNotesVoice.setTone} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button onClick={() => { stopRecording(); router.push("/planning"); }} style={{ fontSize: 12, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Voir dans Planification
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { stopRecording(); setSelectedSession(null); }} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveSession}
                    disabled={savingSession}
                    style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: savingSession ? 0.6 : 1 }}
                  >
                    {savingSession ? "..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* ===== POPUP: Task detail ===== */}
      {/* ===================================================================== */}
      {selectedTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#c62828", background: "#fce4ec", padding: "2px 10px", borderRadius: 20 }}>Tâche</span>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Détail de la tâche</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20 }} className="space-y-4">
              {/* Contact info */}
              {(selectedTask.contacts || selectedTask.learners) ? (
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                  {selectedTask.contacts ? (() => {
                    const c = selectedTask.contacts as { first_name: string; last_name: string };
                    return (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 13, color: "#1a6b9c" }}>{c.first_name} {c.last_name}</span>
                      </div>
                    );
                  })() : null}
                  {selectedTask.learners ? (() => {
                    const l = selectedTask.learners as { first_name: string; last_name: string };
                    return (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 13, color: "#5a6f80" }}>{l.first_name} {l.last_name}</span>
                      </div>
                    );
                  })() : null}
                </div>
              ) : null}

              {/* Title */}
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Titre *</label>
                <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>

              {/* Date & Heure */}
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Date & Heure de l&apos;action</label>
                <input type="datetime-local" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>

              {/* Échéance */}
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Échéance de la tâche</label>
                <input type="date" value={taskForm.task_deadline} onChange={(e) => setTaskForm({ ...taskForm, task_deadline: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Description</label>
                <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Détails de la tâche..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" style={{ resize: "vertical" }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
              <button onClick={handleDeleteTask}
                style={{ fontSize: 12, color: "#e74c3c", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                Supprimer
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleCompleteTask}
                  style={{ height: 36, borderRadius: 8, background: "#27ae60", color: "white", fontSize: 13, fontWeight: 700, padding: "0 18px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  Accomplie
                </button>
                <button onClick={handleSaveTask} disabled={savingTask || !taskForm.title.trim()}
                  style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: savingTask || !taskForm.title.trim() ? 0.5 : 1 }}>
                  {savingTask ? "..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.4); } 70% { box-shadow: 0 0 0 10px rgba(231,76,60,0); } 100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); } }`}</style>
    </div>
  );
}
