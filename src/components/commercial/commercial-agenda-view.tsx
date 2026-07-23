"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Mic, MicOff, X, Phone, Video, User, Building2, MapPin, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  task_deadline: string | null;
  is_completed: boolean;
  contact_id: string | null;
  team_member_id: string | null;
  contacts: { id: string; first_name: string; last_name: string } | null;
  companies: { id: string; name: string } | null;
}

interface Meeting {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  assigned_to: string | null;
  meeting_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_mode: string;
  notes: string | null;
  outcome: string | null;
  next_step: string | null;
  contacts: { id: string; first_name: string; last_name: string } | null;
  companies: { id: string; name: string } | null;
  team_members: { id: string; first_name: string; last_name: string } | null;
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  R0: "R0 — Qualification",
  R1: "R1 — Découverte",
  R2: "R2 — Solution",
  R3: "R3 — Négociation",
};

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

export function CommercialAgendaView({ meetings, teamMembers, tasks = [] }: { meetings: Meeting[]; teamMembers: TeamMember[]; tasks?: Task[] }) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly, onlyOwnData, memberId: currentMemberId } = useCurrentRoles();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", due_date: "", task_deadline: "" });
  const [taskSaving, setTaskSaving] = useState(false);
  const [rdvForm, setRdvForm] = useState({
    meeting_type: "R0", status: "booked", duration_minutes: "60", meeting_mode: "visio",
    notes: "", outcome: "", rdv_result: "" as "" | "signed" | "not_signed" | "quote_to_send" | "opportunity_detected",
  });
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTarget, setRecordTarget] = useState<"notes" | "outcome">("notes");
  const recognitionRef = useRef<any>(null);
  const [filterMember, setFilterMember] = useState("");

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 5);
  const weekFilterEnd = addDays(weekStart, 6); // Sunday 00:00 — so Saturday tasks are included

  const weekMeetings = meetings.filter(m => {
    const d = new Date(m.scheduled_at);
    return d >= weekStart && d < weekFilterEnd;
  });

  function getMeetingsForDayAndMember(day: Date, memberId: string) {
    return weekMeetings.filter(m => {
      const d = new Date(m.scheduled_at);
      return isSameDay(d, day) && m.assigned_to === memberId;
    }).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }

  function getUnassignedForDay(day: Date) {
    return weekMeetings.filter(m => {
      const d = new Date(m.scheduled_at);
      return isSameDay(d, day) && !m.assigned_to;
    });
  }

  function getEffectiveTaskDate(t: Task): string | null {
    return t.task_deadline || t.due_date || null;
  }

  const weekTasks = tasks.filter(t => {
    const effective = getEffectiveTaskDate(t);
    if (!effective || t.is_completed) return false;
    const d = new Date(effective);
    return d >= weekStart && d < weekFilterEnd;
  });

  function getTasksForDayAndMember(day: Date, memberId: string) {
    return weekTasks.filter(t => {
      const effective = getEffectiveTaskDate(t)!;
      const d = new Date(effective);
      return isSameDay(d, day) && t.team_member_id === memberId;
    }).sort((a, b) => new Date(getEffectiveTaskDate(a)!).getTime() - new Date(getEffectiveTaskDate(b)!).getTime());
  }

  function getUnassignedTasksForDay(day: Date) {
    return weekTasks.filter(t => {
      const effective = getEffectiveTaskDate(t)!;
      const d = new Date(effective);
      return isSameDay(d, day) && !t.team_member_id;
    });
  }

  async function handleCompleteTask(taskId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const supabase = createClient();
    await supabase.from("activities").update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    }).eq("id", taskId);
    setSelectedTask(null);
    router.refresh();
  }

  function openTask(t: Task) {
    setSelectedTask(t);
    setTaskForm({
      title: t.title,
      description: t.description ?? "",
      due_date: t.due_date ? new Date(t.due_date).toISOString().slice(0, 16) : (t.task_deadline ? `${t.task_deadline}T09:00` : ""),
      task_deadline: t.task_deadline ?? "",
    });
  }

  async function handleSaveTask() {
    if (!selectedTask) return;
    setTaskSaving(true);
    const supabase = createClient();
    await supabase.from("activities").update({
      title: taskForm.title,
      description: taskForm.description || null,
      due_date: taskForm.due_date || null,
      task_deadline: taskForm.task_deadline || null,
    }).eq("id", selectedTask.id);
    setTaskSaving(false);
    setSelectedTask(null);
    router.refresh();
  }

  async function handleDeleteTask() {
    if (!selectedTask) return;
    if (!confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer cette tâche ?")) return;
    const supabase = createClient();
    await supabase.from("activities").delete().eq("id", selectedTask.id);
    setSelectedTask(null);
    router.refresh();
  }

  const displayMembers = onlyOwnData && currentMemberId
    ? teamMembers.filter(t => t.id === currentMemberId)
    : filterMember ? teamMembers.filter(t => t.id === filterMember) : teamMembers;
  const hasUnassigned = weekDays.some(d => getUnassignedForDay(d).length > 0 || getUnassignedTasksForDay(d).length > 0);

  // Member colors (cycle)
  const memberColors = ["#1a6b9c", "#FF6B35", "#8e44ad", "#27ae60", "#e74c3c", "#f39c12"];
  function getMemberColor(idx: number) {
    const c = memberColors[idx % memberColors.length];
    return { text: c, bg: c + "18", border: c };
  }

  function openMeeting(m: Meeting) {
    setSelectedMeeting(m);
    setRdvForm({
      meeting_type: m.meeting_type,
      status: m.status,
      duration_minutes: String(m.duration_minutes),
      meeting_mode: m.meeting_mode,
      notes: m.notes ?? "",
      outcome: m.outcome ?? "",
      rdv_result: "",
    });
  }

  async function handleSaveRdv() {
    if (!selectedMeeting) return;
    setSaving(true);
    const supabase = createClient();
    const m = selectedMeeting;

    // Build outcome
    let outcomeText = rdvForm.outcome || "";
    if (rdvForm.status === "done" && rdvForm.rdv_result) {
      const labels: Record<string, string> = { signed: "Signed", not_signed: "Not signed", quote_to_send: "Devis à envoyer", opportunity_detected: "Opportunité détectée" };
      outcomeText = labels[rdvForm.rdv_result] || rdvForm.rdv_result;
    }

    const originalStatus = m.status;
    const newStatus = rdvForm.status;

    if (originalStatus === "booked" && (newStatus === "done" || newStatus === "no_show" || newStatus === "cancelled")) {
      // Status changed: create result entry + mark original as completed
      await supabase.from("meetings").insert({
        meeting_type: rdvForm.meeting_type,
        status: newStatus,
        scheduled_at: new Date().toISOString(),
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
        contact_id: m.contact_id,
        company_id: m.company_id,
        assigned_to: m.assigned_to,
      });
      await supabase.from("meetings").update({ next_step: "completed" }).eq("id", m.id);

      // Update contact + company status
      if (m.contact_id) {
        if (newStatus === "done" && rdvForm.rdv_result === "signed") {
          await supabase.from("contacts").update({ lead_status: "signed", lifecycle_stage: "customer", is_client: true }).eq("id", m.contact_id);
          if (m.company_id) {
            await supabase.from("companies").update({ lifecycle_stage: "customer" }).eq("id", m.company_id);
            await supabase.from("contacts").update({ is_client: true }).eq("company_id", m.company_id);
          }
        } else if (newStatus === "done") {
          await supabase.from("contacts").update({ lead_status: "rdv_done" }).eq("id", m.contact_id);
        }
      }

      // Create deal if opportunity detected or quote_to_send
      if (newStatus === "done" && (rdvForm.rdv_result === "opportunity_detected" || rdvForm.rdv_result === "quote_to_send")) {
        const dealStage = rdvForm.rdv_result === "quote_to_send" ? "quote_to_send" : "opportunities";
        // Check if a deal already exists for this contact
        const { data: existingDeal } = await supabase.from("deals").select("id").eq("contact_id", m.contact_id).limit(1).maybeSingle();
        if (existingDeal) {
          setSaving(false);
          setSelectedMeeting(null);
          stopRecording();
          router.push(`/deals?edit=${existingDeal.id}`);
          return;
        }
        const contactName = m.contacts ? `${m.contacts.first_name} ${m.contacts.last_name}` : "Deal";
        const companyName = m.companies?.name ? ` - ${m.companies.name}` : "";
        const { data: newDeal, error: dealError } = await supabase.from("deals").insert({
          name: `${contactName}${companyName}`,
          contact_id: m.contact_id,
          company_id: m.company_id,
          owner_id: m.assigned_to,
          stage: dealStage,
          probability: dealStage === "quote_to_send" ? 40 : 20,
        }).select("id").single();
        if (newDeal && !dealError) {
          setSaving(false);
          setSelectedMeeting(null);
          stopRecording();
          router.push(`/deals?edit=${newDeal.id}`);
          return;
        }
        if (dealError) {
          alert("Erreur lors de la création du deal : " + dealError.message);
        }
      }
    } else {
      // Simple edit (notes, mode, duration, etc.)
      await supabase.from("meetings").update({
        meeting_type: rdvForm.meeting_type,
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
      }).eq("id", m.id);
    }

    setSaving(false);
    setSelectedMeeting(null);
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

  function startRecording(target: "notes" | "outcome") {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée."); return; }
    stopRecording();
    setRecordTarget(target);
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = target === "notes" ? rdvForm.notes : rdvForm.outcome;
    const field = target === "notes" ? "notes" : "outcome";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const punctuated = autoPunctuate(transcript);
          if (punctuated.startsWith("\n")) {
            finalTranscript = finalTranscript.trimEnd() + punctuated;
          } else {
            if (finalTranscript && !/[.!?:;\n]\s*$/.test(finalTranscript)) finalTranscript += ". ";
            else if (finalTranscript && !/[\s\n]$/.test(finalTranscript)) finalTranscript += " ";
            finalTranscript += punctuated;
          }
        } else { interim = transcript; }
      }
      setRdvForm(prev => ({ ...prev, [field]: finalTranscript + (interim ? " " + interim : "") }));
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

  function renderMeetingCard(m: Meeting) {
    const tc = MEETING_TYPE_COLORS[m.meeting_type] ?? { bg: "#f5f5f5", text: "#555", border: "#999" };
    const sc = STATUS_LABELS[m.status] ?? STATUS_LABELS.booked;
    const time = format(new Date(m.scheduled_at), "HH:mm");
    const ModeIcon = MODE_ICONS[m.meeting_mode]?.icon ?? Video;

    return (
      <div
        key={m.id}
        onClick={() => openMeeting(m)}
        style={{
          padding: "8px 10px", borderRadius: 8, cursor: "pointer",
          background: tc.bg, borderLeft: `3px solid ${tc.border}`,
          fontSize: 12, marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <ModeIcon className="h-3 w-3" style={{ color: tc.text }} />
          <span style={{ fontWeight: 700, color: tc.text, fontSize: 11 }}>{time} · {m.meeting_type}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
            <button onClick={(e) => { e.stopPropagation(); openMeeting(m); }}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
              title="Modifier">
              ✏️
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!window.confirm("Supprimer ce RDV ?")) return;
                const sb = createClient();
                await sb.from("meetings").delete().eq("id", m.id);
                router.refresh();
              }}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, width: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", fontSize: 11, padding: 0 }}
              title="Supprimer">
              🗑
            </button>
          </div>
        </div>
        {m.contacts && (
          <div style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 12 }}>{m.contacts.first_name} {m.contacts.last_name}</div>
        )}
        {m.companies && (
          <div style={{ fontSize: 10, color: "#8399a9" }}>{m.companies.name}</div>
        )}
        <div style={{ fontSize: 10, color: "#5a6f80", marginTop: 1 }}>{m.duration_minutes} min</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.text }}>{sc.label}</span>
          {m.status === "booked" && (
            <button onClick={(e) => { e.stopPropagation(); openMeeting(m); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px" }}>
              📋 Suivi rdv
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderTaskCard(t: Task) {
    const tc = { bg: "#fff8e1", text: "#e65100", border: "#f57f17" };
    const time = t.due_date && t.due_date.includes("T") ? format(new Date(t.due_date), "HH:mm") : "";

    return (
      <div
        key={t.id}
        onClick={() => openTask(t)}
        style={{
          padding: "6px 9px", borderRadius: 7, cursor: "pointer",
          background: tc.bg, borderLeft: `3px solid ${tc.border}`,
          fontSize: 11, marginBottom: 3,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={(e) => handleCompleteTask(t.id, e)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
            title="Marquer comme terminée"
          >
            <Square className="h-3 w-3" style={{ color: tc.text }} />
          </button>
          <span style={{ fontWeight: 700, color: tc.text, fontSize: 10 }}>
            {time ? `${time} · ` : ""}📋
          </span>
          <span style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.title}</span>
        </div>
      </div>
    );
  }

  // Week KPIs
  const weekBooked = weekMeetings.filter(m => m.status === "booked").length;
  const weekDone = weekMeetings.filter(m => m.status === "done").length;
  const weekNoShow = weekMeetings.filter(m => m.status === "no_show").length;
  const weekR0 = weekMeetings.filter(m => m.meeting_type === "R0").length;
  const weekR1 = weekMeetings.filter(m => m.meeting_type === "R1").length;
  const weekR2 = weekMeetings.filter(m => m.meeting_type === "R2").length;
  const weekR3 = weekMeetings.filter(m => m.meeting_type === "R3").length;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} style={{ height: 36, width: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft className="h-4 w-4" style={{ color: "#1a2a3a" }} />
          </button>
          <h2 style={{ fontWeight: 800, fontSize: 18, color: "#1a2a3a", minWidth: 280, textAlign: "center" }}>
            Semaine du {format(weekStart, "d MMMM", { locale: fr })} au {format(weekEnd, "d MMMM yyyy", { locale: fr })}
          </h2>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} style={{ height: 36, width: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight className="h-4 w-4" style={{ color: "#1a2a3a" }} />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", padding: "0 14px", fontSize: 13, fontWeight: 600, color: "#1a6b9c", cursor: "pointer" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#8399a9", fontWeight: 600 }}>Filtrer :</span>
          <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} style={{ height: 34, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
            <option value="">Tous les commerciaux</option>
            {teamMembers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-7">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>RDV cette semaine</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{weekMeetings.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Planifiés</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{weekBooked}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Effectués</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{weekDone}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R0 Qualif.</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#7c4dff" }}>{weekR0}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R1 Découverte</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e74c3c" }}>{weekR1}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R2 Solution</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1565c0" }}>{weekR2}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R3 Négo.</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#2e7d32" }}>{weekR3}</div>
        </div>
      </div>

      {/* Grid: members × days */}
      <div className="lca-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 140, padding: "12px 10px", fontSize: 12, fontWeight: 700, color: "#8399a9", textAlign: "left", borderBottom: "2px solid #e8ecf1", background: "#f8fbfd" }}>
                  Commercial
                </th>
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th key={i} style={{
                      padding: "10px 6px", fontSize: 11, fontWeight: 700, textAlign: "center",
                      borderBottom: "2px solid #e8ecf1",
                      background: isToday ? "#e8f0fe" : i >= 5 ? "#fafafa" : "#f8fbfd",
                      color: isToday ? "#1a6b9c" : "#1a2a3a",
                    }}>
                      <div style={{ textTransform: "capitalize" }}>{format(day, "EEE", { locale: fr })}</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{format(day, "d MMM", { locale: fr })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayMembers.map((member, mIdx) => {
                const mc = getMemberColor(mIdx);
                return (
                  <tr key={member.id}>
                    <td style={{ padding: "10px 10px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: mc.text, background: mc.bg, padding: "4px 12px", borderRadius: 20, display: "inline-block" }}>
                        {member.first_name}
                      </span>
                    </td>
                    {weekDays.map((day, i) => {
                      const daySessions = getMeetingsForDayAndMember(day, member.id);
                      const dayTasks = getTasksForDayAndMember(day, member.id);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <td key={i} style={{
                          padding: "6px 4px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top",
                          background: isToday ? "#f0f7fb" : i >= 5 ? "#fafafa" : "transparent",
                        }}>
                          {daySessions.map(m => renderMeetingCard(m))}
                          {dayTasks.map(t => renderTaskCard(t))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {hasUnassigned && !filterMember && (
                <tr>
                  <td style={{ padding: "10px 10px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#999", background: "#f5f5f5", padding: "4px 12px", borderRadius: 20, display: "inline-block" }}>Non assigné</span>
                  </td>
                  {weekDays.map((day, i) => {
                    const daySessions = getUnassignedForDay(day);
                    const dayTasks = getUnassignedTasksForDay(day);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <td key={i} style={{
                        padding: "6px 4px", borderBottom: "1px solid #e8ecf1", verticalAlign: "top",
                        background: isToday ? "#f0f7fb" : i >= 5 ? "#fafafa" : "transparent",
                      }}>
                        {daySessions.map(m => renderMeetingCard(m))}
                        {dayTasks.map(t => renderTaskCard(t))}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suivi du RDV popup */}
      {selectedMeeting && (() => {
        const m = selectedMeeting;
        const tc = MEETING_TYPE_COLORS[rdvForm.meeting_type] ?? MEETING_TYPE_COLORS.R0;
        const sc = STATUS_LABELS[m.status] ?? STATUS_LABELS.booked;
        const modeInfo = MODE_ICONS[rdvForm.meeting_mode];
        const ModeIcon = modeInfo?.icon ?? Video;
        const isFuture = new Date(m.scheduled_at) > new Date();

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) { stopRecording(); setSelectedMeeting(null); } }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Suivi du RDV</h3>
                  <div style={{ fontSize: 13, color: "#5a6f80", marginTop: 2 }}>
                    {format(new Date(m.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </div>
                </div>
                <button onClick={() => { stopRecording(); setSelectedMeeting(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 20 }} className="space-y-4">
                {/* Contact & Company */}
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                  {m.contacts && (
                    <div className="flex items-center gap-2">
                      <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setSelectedMeeting(null); router.push(`/contacts/${m.contact_id}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                        {m.contacts.first_name} {m.contacts.last_name}
                      </span>
                    </div>
                  )}
                  {m.companies && (
                    <div className="flex items-center gap-2">
                      <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setSelectedMeeting(null); router.push(`/clients/${m.company_id}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                        {m.companies.name}
                      </span>
                    </div>
                  )}
                  {m.team_members && (
                    <div className="flex items-center gap-2">
                      <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: "#8399a9" }}>Propriétaire : {m.team_members.first_name} {m.team_members.last_name}</span>
                    </div>
                  )}
                  {m.location && (
                    <div className="flex items-center gap-2">
                      <MapPin style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: "#5a6f80" }}>{m.location}</span>
                    </div>
                  )}
                </div>

                {/* Type + Mode + Duration */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Type</div>
                    <select value={rdvForm.meeting_type} onChange={(e) => setRdvForm({ ...rdvForm, meeting_type: e.target.value })}
                      style={{ height: 34, width: "100%", borderRadius: 8, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 13, fontWeight: 600, background: tc.bg, color: tc.text, cursor: "pointer" }}>
                      <option value="R0">R0 — Qualif.</option>
                      <option value="R1">R1 — Découverte</option>
                      <option value="R2">R2 — Solution</option>
                      <option value="R3">R3 — Négo.</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Mode</div>
                    <select value={rdvForm.meeting_mode} onChange={(e) => setRdvForm({ ...rdvForm, meeting_mode: e.target.value })}
                      style={{ height: 34, width: "100%", borderRadius: 8, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 13, color: "#1a2a3a", cursor: "pointer" }}>
                      <option value="visio">Visio</option>
                      <option value="phone">Téléphone</option>
                      <option value="in_person">En personne</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Durée</div>
                    <select value={rdvForm.duration_minutes} onChange={(e) => setRdvForm({ ...rdvForm, duration_minutes: e.target.value })}
                      style={{ height: 34, width: "100%", borderRadius: 8, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 13, color: "#1a2a3a", cursor: "pointer" }}>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1h</option>
                      <option value="90">1h30</option>
                      <option value="120">2h</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Notes du RDV</div>
                    <button
                      onClick={() => isRecording && recordTarget === "notes" ? stopRecording() : startRecording("notes")}
                      style={{
                        height: 30, width: 30, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: isRecording && recordTarget === "notes" ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                        color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                        animation: isRecording && recordTarget === "notes" ? "pulse 1.5s infinite" : "none",
                      }}
                    >
                      {isRecording && recordTarget === "notes" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <textarea
                    value={rdvForm.notes}
                    onChange={(e) => setRdvForm({ ...rdvForm, notes: e.target.value })}
                    placeholder="Écrivez ou dictez vos notes de RDV..."
                    style={{ width: "100%", minHeight: 100, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                  />
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Résumé / Outcome</div>
                    <button
                      onClick={() => isRecording && recordTarget === "outcome" ? stopRecording() : startRecording("outcome")}
                      style={{
                        height: 30, width: 30, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: isRecording && recordTarget === "outcome" ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                        color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                        animation: isRecording && recordTarget === "outcome" ? "pulse 1.5s infinite" : "none",
                      }}
                    >
                      {isRecording && recordTarget === "outcome" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <textarea
                    value={rdvForm.outcome}
                    onChange={(e) => setRdvForm({ ...rdvForm, outcome: e.target.value })}
                    placeholder="Résumé du RDV, prochaine étape..."
                    style={{ width: "100%", minHeight: 70, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button
                  onClick={() => { setSelectedMeeting(null); if (m.contact_id) router.push(`/contacts/${m.contact_id}`); }}
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
                    disabled={saving}
                    style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? "..." : "Sauvegarder le suivi"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Task popup */}
      {selectedTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}>
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
              {(selectedTask.contacts || selectedTask.companies) && (
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                  {selectedTask.contacts && (
                    <div className="flex items-center gap-2">
                      <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 13, color: "#1a6b9c" }}>{selectedTask.contacts.first_name} {selectedTask.contacts.last_name}</span>
                    </div>
                  )}
                  {selectedTask.companies && (
                    <div className="flex items-center gap-2">
                      <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 13, color: "#5a6f80" }}>{selectedTask.companies.name}</span>
                    </div>
                  )}
                </div>
              )}

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
                🗑️ Supprimer
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => handleCompleteTask(selectedTask.id)}
                  style={{ height: 36, borderRadius: 8, background: "#27ae60", color: "white", fontSize: 13, fontWeight: 700, padding: "0 18px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  ✅ Accomplie
                </button>
                <button onClick={handleSaveTask} disabled={taskSaving || !taskForm.title.trim()}
                  style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: taskSaving || !taskForm.title.trim() ? 0.5 : 1 }}>
                  {taskSaving ? "..." : "Enregistrer"}
                </button>
              </div>
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
