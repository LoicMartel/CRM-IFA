"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentMember } from "@/lib/use-current-member";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { RichNotes } from "@/components/ui/rich-notes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User, Mail, MailPlus, Phone, Building2, Edit, ArrowLeft, Trash2,
  GraduationCap, Calendar, BookOpen, ClipboardList, Activity, PlusCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { PlanPopup } from "@/components/production/plan-popup";
import { formatPhone, fmtDuration } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Ref { id: string; name: string; }

interface LearnerData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  company_id: string | null;
  program_id: string | null;
  training_type_id: string | null;
  expert_id: string | null;
  notes: string | null;
  created_at: string;
  companies: { id: string; name: string } | null;
  training_programs: { id: string; name: string } | null;
  training_types: { id: string; name: string } | null;
  team_members: { id: string; first_name: string; last_name: string } | null;
}

interface SessionData {
  id: string;
  service_plan_id: string;
  session_type: "vt" | "journee";
  session_date: string;
  session_time: string | null;
  duration_hours: number | null;
  status: "planned" | "done" | "cancelled" | "no_show";
  trainers: string[] | null;
  is_billable: boolean;
  notes: string | null;
  service_plans: {
    id: string;
    company_id: string;
    budget: number | null;
    budget_remaining: number | null;
    companies: { name: string } | null;
    training_programs: { name: string } | null;
    training_types: { name: string } | null;
  } | null;
}

interface ServicePlanData {
  id: string;
  company_id: string;
  budget: number | null;
  budget_remaining: number | null;
  vt_planned: number | null;
  days_planned: number | null;
  hourly_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  companies: { name: string } | null;
  training_programs: { name: string } | null;
  training_types: { name: string } | null;
  training_sessions: { id: string; session_type: string; duration_hours: number | null; status: string }[];
}

interface ActivityData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  task_deadline?: string | null;
  is_completed: boolean;
  created_at: string;
  team_members: { first_name: string; last_name: string } | null;
}

const activityTypeLabels: Record<string, string> = {
  "tâche": "Tâche",
  note: "Note",
  appel: "Appel",
  email: "Email",
  relance: "Relance",
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  actuel: { bg: "#e8f8f0", text: "#27ae60", label: "Actuel" },
  ancien: { bg: "#f0f0f0", text: "#666", label: "Ancien" },
  futur: { bg: "#e6f0f7", text: "#1E2A5A", label: "Futur" },
};

const sessionStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: "#e3f2fd", text: "#1565c0", label: "Planifie" },
  done: { bg: "#e8f5e9", text: "#2e7d32", label: "Effectue" },
  cancelled: { bg: "#fce4ec", text: "#c62828", label: "Annule" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " \u20ac";
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  try {
    return format(new Date(d), "dd MMM yyyy", { locale: fr });
  } catch {
    return "\u2014";
  }
}

export function LearnerDetailView({
  learner,
  sessions,
  servicePlans,
  activities,
  companies,
  programs,
  trainingTypes,
  experts = [],
}: {
  learner: LearnerData;
  sessions: Record<string, unknown>[];
  servicePlans: Record<string, unknown>[];
  activities: ActivityData[];
  companies: Ref[];
  programs: Ref[];
  trainingTypes: Ref[];
  experts?: { id: string; first_name: string; last_name: string }[];
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const { isRestrictedExterne, isReadOnly, firstName: currentFirstName } = useCurrentRoles();
  const typedSessions = sessions as unknown as SessionData[];
  const typedPlans = servicePlans as unknown as ServicePlanData[];

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const sortedActivities = [...activities].sort((a, b) =>
    (b.due_date ?? b.created_at).localeCompare(a.due_date ?? a.created_at),
  );

  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({
    type: "tâche" as string,
    title: "",
    description: "",
    due_date: "",
    task_deadline: "",
  });
  const [form, setForm] = useState({
    first_name: learner.first_name,
    last_name: learner.last_name,
    email: learner.email ?? "",
    phone: learner.phone ?? "",
    position: learner.position ?? "",
    company_id: learner.company_id ?? "",
    status: learner.status,
    program_id: learner.program_id ?? "",
    training_type_id: learner.training_type_id ?? "",
    expert_id: learner.expert_id ?? "",
    notes: learner.notes ?? "",
  });
  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));
  const activityVoice = useVoiceDictation(() => activityForm.description, (t) => setActivityForm((f) => ({ ...f, description: t })));

  // Email state
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [senderInfo, setSenderInfo] = useState<{ first_name: string; last_name: string; email: string; phone: string | null; email_signature: string | null } | null>(null);
  const emailBodyVoice = useVoiceDictation(() => emailForm.body, (t) => setEmailForm((f) => ({ ...f, body: t })));

  // Load sender info
  useState(() => {
    if (!currentMemberId) return;
    const supabase = createClient();
    supabase.from("team_members").select("first_name, last_name, email, phone, email_signature").eq("id", currentMemberId).single().then(({ data }) => {
      if (data) setSenderInfo(data as any);
    });
  });

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("learners").update({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      position: form.position || null,
      company_id: form.company_id || null,
      status: form.status,
      program_id: form.program_id || null,
      training_type_id: form.training_type_id || null,
      expert_id: form.expert_id || null,
      notes: form.notes || null,
    }).eq("id", learner.id);
    if (error) {
      alert("Erreur: " + error.message);
      console.error(error);
    }
    setSaving(false);
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const supabase = createClient();
    await supabase.from("learners").delete().eq("id", learner.id);
    router.push("/learners");
  }

  async function handleLogActivity() {
    setSaving(true);
    const supabase = createClient();

    const payload: Record<string, any> = {
      type: activityForm.type,
      title: activityForm.title,
      description: activityForm.description || null,
      due_date: activityForm.due_date || null,
      task_deadline: activityForm.type === "tâche" && activityForm.task_deadline ? activityForm.task_deadline : null,
      learner_id: learner.id,
    };

    if (activityForm.type === "tâche") {
      payload.team_member_id = currentMemberId || null;
    }

    if (editingActivityId) {
      await supabase.from("activities").update(payload).eq("id", editingActivityId);
      // Sync task to Google Calendar on update
      if (activityForm.type === "tâche" && activityForm.due_date) {
        try {
          await fetch("/api/tasks/sync-gcal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: editingActivityId }),
          });
        } catch {}
      }
    } else {
      const { data: newActivity } = await supabase.from("activities").insert(payload).select("id").single();

      // Sync task to Google Calendar
      if (newActivity?.id && activityForm.type === "tâche" && activityForm.due_date) {
        try {
          const notifyRes = await fetch("/api/tasks/sync-gcal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: newActivity.id }),
          });
          const notifyData = await notifyRes.json();
          if (notifyData.result) {
            alert(`Tâche créée ✅\n\nGoogle Calendar: ${notifyData.result}`);
          }
        } catch {}
      }
    }

    setSaving(false);
    setActivityOpen(false);
    setEditingActivityId(null);
    setActivityForm({ type: "tâche", title: "", description: "", due_date: "", task_deadline: "" });
    router.refresh();
  }

  function openEditActivity(a: ActivityData) {
    setEditingActivityId(a.id);
    setActivityForm({
      type: a.type,
      title: a.title,
      description: a.description ?? "",
      due_date: a.due_date ? a.due_date.slice(0, 16) : "",
      task_deadline: a.task_deadline ?? "",
    });
    setActivityOpen(true);
  }

  async function handleDeleteActivity(id: string) {
    const supabase = createClient();
    await supabase.from("activities").delete().eq("id", id);
    router.refresh();
  }

  async function handleCompleteTask(id: string) {
    const supabase = createClient();
    await supabase.from("activities").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("id", id);
    router.refresh();
  }

  const sc = statusColors[learner.status] ?? { bg: "#f0f0f0", text: "#666", label: learner.status };
  const initials = `${learner.first_name.charAt(0)}${learner.last_name.charAt(0)}`.toUpperCase();

  // Compute hours consumed per service plan
  function getPlanProgress(plan: ServicePlanData) {
    const doneSessions = (plan.training_sessions ?? []).filter((s) => s.status === "done");
    const hoursConsumed = doneSessions.reduce((sum, s) => sum + (s.duration_hours ?? 0), 0);
    const totalSessions = plan.training_sessions?.length ?? 0;
    const doneSessCount = doneSessions.length;
    const budget = plan.budget ?? 0;
    const remaining = plan.budget_remaining ?? budget;
    const consumed = budget - remaining;
    const pct = budget > 0 ? Math.min(100, Math.round((consumed / budget) * 100)) : 0;
    return { hoursConsumed, totalSessions, doneSessCount, budget, remaining, consumed, pct };
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => router.push("/learners")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux apprenants
        </Button>
        <div className="flex gap-2">
          {learner.email && (
            <Button variant="outline" size="sm" onClick={() => { setEmailForm({ subject: "", body: "" }); setEmailOpen(true); }}>
              <MailPlus className="h-4 w-4 mr-1" /> Envoyer email
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setEditingActivityId(null); setActivityForm({ type: "tâche", title: "", description: "", due_date: "", task_deadline: "" }); setActivityOpen(true); }}>
            <PlusCircle className="h-4 w-4 mr-1" /> Activité
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Learner info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer cet apprenant ? Cette action est irreversible.")) {
                      handleDelete();
                    }
                  }}
                  style={{ color: "#e74c3c" }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1E2A5A, #161f45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "#1a2a3a" }}>
                    {learner.first_name} {learner.last_name.toUpperCase()}
                  </h2>
                  {learner.position && (
                    <span className="text-sm text-muted-foreground">{learner.position}</span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex gap-2 flex-wrap">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: sc.bg, color: sc.text }}
                >
                  {sc.label}
                </span>
              </div>

              <Separator />

              {learner.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Email</span>
                    <a href={`mailto:${learner.email}`} className="text-sm underline">{learner.email}</a>
                  </div>
                </div>
              )}

              {learner.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Telephone</span>
                    <a href={`tel:${learner.phone}`} className="text-sm">{formatPhone(learner.phone)}</a>
                  </div>
                </div>
              )}

              {learner.companies && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Entreprise</span>
                    <button
                      className="text-sm underline text-left"
                      style={{ color: "#1E2A5A" }}
                      onClick={() => router.push(`/clients/${learner.companies!.id}`)}
                    >
                      {learner.companies.name}
                    </button>
                  </div>
                </div>
              )}

              {learner.training_programs && (
                <div className="flex items-start gap-3">
                  <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Parcours</span>
                    <span className="text-sm">{learner.training_programs.name}</span>
                  </div>
                </div>
              )}

              {learner.training_types && (
                <div className="flex items-start gap-3">
                  <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Type de formation</span>
                    <span className="text-sm">{learner.training_types.name}</span>
                  </div>
                </div>
              )}

              {learner.team_members && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Expert assigné</span>
                    <span className="text-sm" style={{ color: "#1E2A5A", fontWeight: 600 }}>{learner.team_members.first_name} {learner.team_members.last_name}</span>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <span className="text-xs text-muted-foreground block mb-1">Cree le</span>
                <span className="text-sm">{formatDate(learner.created_at)}</span>
              </div>

              {learner.notes && (
                <>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Notes</span>
                    <RichNotes value={learner.notes} onChange={() => {}} readOnly />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">
                <Activity className="h-4 w-4 mr-1" /> Vue d&apos;ensemble
              </TabsTrigger>
              <TabsTrigger value="plans">
                <ClipboardList className="h-4 w-4 mr-1" /> Plan de formation ({typedPlans.length})
              </TabsTrigger>
              <TabsTrigger value="sessions">
                <Calendar className="h-4 w-4 mr-1" /> Sessions ({typedSessions.length})
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <ClipboardList className="h-4 w-4 mr-1" /> Tâches ({sortedActivities.filter(a => a.type === "tâche").length})
              </TabsTrigger>
            </TabsList>

            {/* Vue d'ensemble */}
            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {/* Key info cards */}
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="lca-card" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Entreprise</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>
                      {learner.companies ? (
                        <button
                          onClick={() => router.push(`/clients/${learner.companies!.id}`)}
                          style={{ color: "#1E2A5A", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 700 }}
                        >
                          {learner.companies.name}
                        </button>
                      ) : "\u2014"}
                    </div>
                  </div>
                  <div className="lca-card" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Parcours</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>
                      {learner.training_programs?.name ?? "\u2014"}
                    </div>
                  </div>
                  <div className="lca-card" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Statut</div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ background: sc.bg, color: sc.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  <div className="lca-card" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Type formation</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>
                      {learner.training_types?.name ?? "\u2014"}
                    </div>
                  </div>
                </div>

                {/* Last 3 sessions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" style={{ color: "#1E2A5A" }} /> Dernieres sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {typedSessions.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#8399a9" }}>Aucune session associee</p>
                    ) : (
                      <div className="space-y-2">
                        {typedSessions.slice(0, 3).map((s) => {
                          const ssc = sessionStatusColors[s.status] ?? { bg: "#f0f0f0", text: "#666", label: s.status };
                          return (
                            <div key={s.id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid #e6f0f7" }}>
                              <div className="flex items-center gap-3">
                                <span style={{ fontSize: 11, color: "#8399a9", width: 80, flexShrink: 0 }}>{formatDate(s.session_date)}</span>
                                <span style={{
                                  background: s.session_type === "vt" ? "#e6f0f7" : "#fff3e0",
                                  color: s.session_type === "vt" ? "#1E2A5A" : "#e65100",
                                  padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                                }}>
                                  {s.session_type === "vt" ? "VT" : "Journee"}
                                </span>
                                <span style={{ background: ssc.bg, color: ssc.text, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                                  {ssc.label}
                                </span>
                                {s.service_plan_id ? (
                                  <button onClick={() => setOpenPlanId(s.service_plan_id)} style={{ fontSize: 12, color: "#1E2A5A", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", padding: 0 }}>
                                    {s.service_plans?.companies?.name ?? ""}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 12, color: "#1a2a3a" }}>{s.service_plans?.companies?.name ?? ""}</span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: "#8399a9" }}>
                                {fmtDuration(s.duration_hours)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Service plans summary */}
                {typedPlans.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" style={{ color: "#E8732A" }} /> Plans de formation ({typedPlans.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {typedPlans.map((plan) => {
                          const prog = getPlanProgress(plan);
                          return (
                            <div key={plan.id} style={{ padding: "8px 0", borderBottom: "1px solid #e6f0f7" }}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <button onClick={() => setOpenPlanId(plan.id)} style={{ fontSize: 13, fontWeight: 600, color: "#1E2A5A", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", padding: 0 }}>
                                    {plan.companies?.name ?? "\u2014"}
                                  </button>
                                  {plan.training_programs?.name && (
                                    <span style={{ fontSize: 11, color: "#8399a9", marginLeft: 8 }}>
                                      {plan.training_programs.name}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#27ae60" }}>
                                  {prog.budget > 0 ? fmt(prog.budget) : "\u2014"}
                                </span>
                              </div>
                              {prog.budget > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8399a9", marginBottom: 2 }}>
                                    <span>{prog.doneSessCount}/{prog.totalSessions} sessions</span>
                                    <span>{prog.pct}%</span>
                                  </div>
                                  <div style={{ height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
                                    <div style={{ height: "100%", borderRadius: 3, background: prog.pct >= 80 ? "#e74c3c" : prog.pct >= 50 ? "#E8732A" : "#27ae60", width: `${prog.pct}%`, transition: "width 0.3s" }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Plan de formation */}
            <TabsContent value="plans" className="mt-4">
              {typedPlans.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center" style={{ color: "#8399a9" }}>
                    Aucun plan de formation associe
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {typedPlans.map((plan) => {
                    const prog = getPlanProgress(plan);
                    return (
                      <Card key={plan.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4" style={{ color: "#E8732A" }} />
                              <span>{plan.companies?.name ?? "\u2014"}</span>
                              {plan.training_programs?.name && (
                                <span style={{ fontSize: 11, color: "#8399a9", fontWeight: 400 }}>
                                  — {plan.training_programs.name}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setOpenPlanId(plan.id)}
                              style={{ fontSize: 11, color: "#1E2A5A" }}
                            >
                              Ouvrir le plan
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-4">
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Budget</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a" }}>{prog.budget > 0 ? fmt(prog.budget) : "\u2014"}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Consomme</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#E8732A" }}>{fmt(prog.consumed)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Restant</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#27ae60" }}>{fmt(prog.remaining)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Heures</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E2A5A" }}>{prog.hoursConsumed}h</div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8399a9", marginBottom: 4 }}>
                              <span>{prog.doneSessCount} sessions effectuees / {prog.totalSessions} total</span>
                              <span>{prog.pct}% du budget</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "#f0f0f0", overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                borderRadius: 4,
                                background: prog.pct >= 80 ? "#e74c3c" : prog.pct >= 50 ? "#E8732A" : "#27ae60",
                                width: `${prog.pct}%`,
                                transition: "width 0.3s",
                              }} />
                            </div>
                          </div>

                          {/* Date range */}
                          <div style={{ fontSize: 12, color: "#8399a9" }}>
                            {plan.start_date || plan.end_date ? (
                              <>Du {formatDate(plan.start_date)} au {formatDate(plan.end_date)}</>
                            ) : "Dates non definies"}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Sessions */}
            <TabsContent value="sessions" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Formateurs</TableHead>
                          <TableHead>Duree</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead style={{ textAlign: "center" }}>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typedSessions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              Aucune session associee
                            </TableCell>
                          </TableRow>
                        ) : (
                          typedSessions.map((s) => {
                            const ssc = sessionStatusColors[s.status] ?? { bg: "#f0f0f0", text: "#666", label: s.status };
                            return (
                              <TableRow key={s.id}>
                                <TableCell style={{ fontSize: 13 }}>{formatDate(s.session_date)}</TableCell>
                                <TableCell>
                                  <span style={{
                                    background: s.session_type === "vt" ? "#e6f0f7" : "#fff3e0",
                                    color: s.session_type === "vt" ? "#1E2A5A" : "#e65100",
                                    padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                                  }}>
                                    {s.session_type === "vt" ? "VT" : "Journee"}
                                  </span>
                                </TableCell>
                                <TableCell style={{ fontSize: 12 }}>
                                  {s.trainers && s.trainers.length > 0 ? s.trainers.join(", ") : "\u2014"}
                                </TableCell>
                                <TableCell style={{ fontSize: 13 }}>
                                  {fmtDuration(s.duration_hours)}
                                </TableCell>
                                <TableCell>
                                  <select
                                    defaultValue={s.status}
                                    onChange={async (e) => {
                                      const newStatus = e.target.value;
                                      const sb = createClient();
                                      await sb.from("training_sessions").update({ status: newStatus }).eq("id", s.id);
                                      if (newStatus === "cancelled") {
                                        try {
                                          await fetch("/api/gcal/cancel-session", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ sessionId: s.id, cancelledBy: currentFirstName ?? "" }),
                                          });
                                        } catch {}
                                        try {
                                          const companyName = s.service_plans?.companies?.name ?? "—";
                                          const sessionDate = s.session_date ? new Date(s.session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
                                          const sessionType = s.session_type === "journee" ? "Journée" : "VT";
                                          const duration = s.duration_hours ? fmtDuration(s.duration_hours) : "";
                                          const trainers = (s.trainers ?? []).join(", ");
                                          await fetch("/api/slack/notify-cancelled", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ companyName, sessionDate, sessionType, duration, trainers, notes: s.notes ?? "" }),
                                          });
                                        } catch {}
                                      }
                                      try { await fetch("/api/sessions/sync-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingSessionId: s.id }) }); } catch {}
                                      router.refresh();
                                    }}
                                    style={{ height: 26, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 6px", fontSize: 11, fontWeight: 600, background: ssc.bg, color: ssc.text, cursor: "pointer" }}
                                  >
                                    <option value="planned">Planifié</option>
                                    <option value="done">Réalisé</option>
                                    <option value="cancelled">Annulé</option>
                                    <option value="no_show">No show</option>
                                  </select>
                                </TableCell>
                                <TableCell style={{ fontSize: 12 }}>
                                  {s.service_plans?.companies?.name ?? "\u2014"}
                                </TableCell>
                                <TableCell style={{ fontSize: 12, color: "#8399a9", maxWidth: 150 }}>
                                  <span className="truncate block">{s.notes ?? "\u2014"}</span>
                                </TableCell>
                                <TableCell style={{ textAlign: "center" }}>
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm("Supprimer cette session ?")) return;
                                      const sb = createClient();
                                      await sb.from("training_session_learners").delete().eq("training_session_id", s.id);
                                      await sb.from("training_sessions").delete().eq("id", s.id);
                                      router.refresh();
                                    }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2" style={{ fontSize: 15 }}>
                    <ClipboardList className="h-4 w-4" style={{ color: "#c62828" }} /> Tâches ({sortedActivities.filter(a => a.type === "tâche").length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => { setEditingActivityId(null); setActivityForm({ type: "tâche", title: "", description: "", due_date: "", task_deadline: "" }); setActivityOpen(true); }}>
                    <PlusCircle className="h-4 w-4 mr-1" /> Nouvelle tâche
                  </Button>
                </CardHeader>
                <CardContent className="pt-2">
                  {sortedActivities.filter(a => a.type === "tâche").length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune tâche</p>
                  ) : (
                    <div className="space-y-3">
                      {sortedActivities.filter(a => a.type === "tâche").map((a) => {
                        const deadline = a.task_deadline as string | null;
                        const isOverdue = deadline && !a.is_completed && new Date(deadline) < new Date();
                        return (
                          <div key={a.id} style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${a.is_completed ? "#e8f5e9" : isOverdue ? "#fde8e8" : "#fce4ec"}`, background: a.is_completed ? "#f8fbf8" : isOverdue ? "#fff5f5" : "#fff9fb" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: a.is_completed ? "#8399a9" : "#1a2a3a", textDecoration: a.is_completed ? "line-through" : "none" }}>
                                    {a.title}
                                  </span>
                                  {a.is_completed && (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#e8f5e9", color: "#2e7d32" }}>Terminée</span>
                                  )}
                                  {isOverdue && (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#fde8e8", color: "#e74c3c" }}>En retard</span>
                                  )}
                                </div>
                                {a.description && <p style={{ fontSize: 12, color: "#5a6f80", marginBottom: 4 }}>{a.description}</p>}
                                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#8399a9" }}>
                                  {a.due_date && <span>📅 {formatDate(a.due_date)}</span>}
                                  {deadline && <span>⏰ Échéance : {(() => { try { return format(new Date(deadline), "d MMM yyyy", { locale: fr }); } catch { return ""; } })()}</span>}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                {!a.is_completed && (
                                  <button onClick={() => handleCompleteTask(a.id)}
                                    style={{ height: 28, borderRadius: 6, background: "#27ae60", color: "white", border: "none", cursor: "pointer", padding: "0 10px", fontSize: 11, fontWeight: 700 }}>
                                    ✅ Accomplie
                                  </button>
                                )}
                                <button onClick={() => openEditActivity(a)}
                                  style={{ color: "#1E2A5A", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer cette tâche ?")) handleDeleteActivity(a.id); }}
                                  style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Activity popup */}
      {activityOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setActivityOpen(false); setEditingActivityId(null); setActivityForm({ type: "tâche", title: "", description: "", due_date: "", task_deadline: "" }); } }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>{editingActivityId ? "Modifier l\u0027activité" : "Nouvelle activité"}</h3>
              <button onClick={() => { setActivityOpen(false); setEditingActivityId(null); setActivityForm({ type: "tâche", title: "", description: "", due_date: "", task_deadline: "" }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>&times;</button>
            </div>
            <div style={{ padding: 24 }} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={activityForm.type}
                  onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                >
                  {Object.entries(activityTypeLabels).map(([key, val]) => (
                    <option key={key} value={key}>{val}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date &amp; Heure</Label>
                <Input
                  type="datetime-local"
                  value={activityForm.due_date}
                  onChange={(e) => setActivityForm({ ...activityForm, due_date: e.target.value })}
                />
              </div>
              {activityForm.type === "tâche" && (
                <div className="space-y-2">
                  <Label>Échéance de la tâche</Label>
                  <Input
                    type="date"
                    value={activityForm.task_deadline}
                    onChange={(e) => setActivityForm({ ...activityForm, task_deadline: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                />
                <VoiceButton isRecording={activityVoice.isRecording} isFormatting={activityVoice.isFormatting} onClick={activityVoice.toggleRecording} tone={activityVoice.tone} onToneChange={activityVoice.setTone} />
              </div>
              <Button
                onClick={handleLogActivity}
                disabled={saving || !activityForm.title.trim()}
                className="w-full"
                style={{ background: "#E8732A", color: "white" }}
              >
                {saving ? "Enregistrement..." : (editingActivityId ? "Sauvegarder" : "Enregistrer l\u0027activité")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit popup */}
      {editOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Modifier l&apos;apprenant</h3>
              <button onClick={() => setEditOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>&times;</button>
            </div>
            <div style={{ padding: 24 }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenom *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telephone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Poste</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Entreprise</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                  <option value="">Selectionner</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="actuel">Actuel</option>
                  <option value="ancien">Ancien</option>
                  <option value="futur">Futur</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Parcours</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
                  <option value="">Selectionner</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Type de formation</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.training_type_id} onChange={(e) => setForm({ ...form, training_type_id: e.target.value })}>
                  <option value="">Selectionner</option>
                  {trainingTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Expert assigné</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.expert_id} onChange={(e) => setForm({ ...form, expert_id: e.target.value })}>
                  <option value="">Sélectionner</option>
                  {experts.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <RichNotes value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} storageFolder="learners" />
                <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} tone={notesVoice.tone} onToneChange={notesVoice.setTone} />
              </div>
              <Button onClick={handleSave} disabled={saving || (!form.first_name.trim() && !form.last_name.trim())} className="w-full" style={{ background: "#E8732A", color: "white" }}>
                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {openPlanId && <PlanPopup planId={openPlanId} onClose={() => setOpenPlanId(null)} />}

      {/* Email popup */}
      {emailOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEmailOpen(false); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MailPlus className="h-4 w-4" style={{ color: "white" }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "white" }}>Nouvel email</span>
              </div>
              <button onClick={() => setEmailOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4, fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }} className="space-y-3">
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5a6f80", padding: "8px 12px", background: "#f8fbfd", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#8399a9", minWidth: 30 }}>De :</span>
                <span style={{ fontWeight: 600, color: "#1a2a3a" }}>
                  {senderInfo ? `${senderInfo.first_name} ${senderInfo.last_name} <${senderInfo.email}>` : "Chargement..."}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5a6f80", padding: "8px 12px", background: "#f8fbfd", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#8399a9", minWidth: 30 }}>À :</span>
                <span style={{ fontWeight: 600, color: "#1a2a3a" }}>
                  {learner.first_name} {learner.last_name} &lt;{learner.email}&gt;
                </span>
              </div>
              <input
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Objet"
                style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a", outline: "none" }}
              />
              <textarea
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                placeholder="Écrivez votre message..."
                style={{ width: "100%", minHeight: 200, borderRadius: 8, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", lineHeight: 1.6, resize: "vertical", outline: "none" }}
              />
              <VoiceButton isRecording={emailBodyVoice.isRecording} isFormatting={emailBodyVoice.isFormatting} onClick={emailBodyVoice.toggleRecording} tone={emailBodyVoice.tone} onToneChange={emailBodyVoice.setTone} />
              {senderInfo && (
                <div style={{ padding: 12, background: "#f8fbfd", borderRadius: 8, overflow: "auto" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#8399a9", textTransform: "uppercase", marginBottom: 8 }}>Signature</div>
                  {senderInfo.email_signature ? (
                    <div dangerouslySetInnerHTML={{ __html: senderInfo.email_signature }} style={{ transform: "scale(0.7)", transformOrigin: "top left" }} />
                  ) : (
                    <div style={{ fontSize: 12, color: "#5a6f80" }}>
                      <strong style={{ color: "#1a2a3a" }}>{senderInfo.first_name} {senderInfo.last_name}</strong><br />
                      IFA Formatio ®<br />
                      {senderInfo.phone && <>📞 {senderInfo.phone}<br /></>}
                      ✉️ {senderInfo.email}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
              <button onClick={() => setEmailOpen(false)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!emailForm.subject.trim() || !emailForm.body.trim() || !learner.email) return;
                  setSendingEmail(true);
                  try {
                    const res = await fetch("/api/email/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: learner.email,
                        subject: emailForm.subject,
                        body: emailForm.body,
                        memberId: currentMemberId,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setEmailOpen(false);
                      setEmailForm({ subject: "", body: "" });
                    } else {
                      alert(data.error || "Erreur lors de l'envoi");
                    }
                  } catch {
                    alert("Erreur réseau");
                  }
                  setSendingEmail(false);
                }}
                disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim()}
                style={{
                  height: 36, borderRadius: 8, border: "none", padding: "0 24px",
                  background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim() ? 0.5 : 1,
                }}
              >
                {sendingEmail ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
