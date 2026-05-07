"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  User, Mail, Phone, Building2, Edit, Briefcase, Calendar,
  Activity, ArrowLeft, ExternalLink, Linkedin, PhoneCall,
  MailPlus, CalendarPlus, PlusCircle, Trash2, ClipboardList, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { PlanPopup } from "@/components/production/plan-popup";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CompanyRef {
  id: string;
  name: string;
}

interface ContactData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  company_id: string | null;
  is_client: boolean;
  notes: string | null;
  lifecycle_stage: string | null;
  lead_status: string | null;
  last_contacted_at: string | null;
  linkedin_url: string | null;
  owner_id: string | null;
  source_id: string | null;
  created_at: string;
  companies: { id: string; name: string } | null;
  team_members: { id: string; first_name: string; last_name: string } | null;
}

interface TeamMemberRef {
  id: string;
  first_name: string;
  last_name: string;
  roles?: string[];
}

interface DealData {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  expected_close_date: string | null;
  company_id: string | null;
  companies: { name: string } | null;
}

interface ActivityData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
  team_members: { first_name: string; last_name: string } | null;
}

interface MeetingData {
  id: string;
  meeting_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  meeting_mode: string | null;
  notes: string | null;
  outcome: string | null;
  next_step: string | null;
  team_members: { first_name: string; last_name: string } | null;
}

const lifecycleColors: Record<string, { bg: string; text: string; label: string }> = {
  prospect: { bg: "#e3f2fd", text: "#1565c0", label: "Prospect" },
  lead_marketing: { bg: "#fff3e0", text: "#e65100", label: "Lead Marketing" },
  customer: { bg: "#e8f5e9", text: "#2e7d32", label: "Client" },
  former_customer: { bg: "#f0f0f0", text: "#666", label: "Ancien client" },
};

const leadStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  lead: { bg: "#f0f0f0", text: "#666", label: "New Not Contacted" },
  contacted: { bg: "#e3f2fd", text: "#1565c0", label: "Contacted" },
  booked: { bg: "#fff3e0", text: "#e65100", label: "Booked" },
  rdv_done: { bg: "#f3e5f5", text: "#6a1b9a", label: "RDV Done" },
  signed: { bg: "#e8f5e9", text: "#2e7d32", label: "Signed" },
  not_interested: { bg: "#f3e5f5", text: "#6a1b9a", label: "Pas intéressé" },
};

const dealStageColors: Record<string, { bg: string; text: string; label: string }> = {
  opportunities: { bg: "#e3f2fd", text: "#1565c0", label: "Opportunités" },
  quote_to_send: { bg: "#fff3e0", text: "#e65100", label: "Devis à envoyer" },
  quote_sent: { bg: "#f3e5f5", text: "#6a1b9a", label: "Devis envoyé" },
  opco_deposit: { bg: "#e8f0fe", text: "#0d4f7a", label: "Dépôt OPCO" },
  ordered: { bg: "#e8f5e9", text: "#2e7d32", label: "Commandé" },
  closed_won: { bg: "#e8f5e9", text: "#2e7d32", label: "Gagné" },
  closed_lost: { bg: "#fce4ec", text: "#c62828", label: "Perdu" },
};

const meetingTypeColors: Record<string, { bg: string; text: string }> = {
  R0: { bg: "#e3f2fd", text: "#1565c0" },
  "R0+R1": { bg: "#e8f5e9", text: "#2e7d32" },
  R1: { bg: "#fff3e0", text: "#e65100" },
  R2: { bg: "#f3e5f5", text: "#6a1b9a" },
  R3: { bg: "#fce4ec", text: "#c62828" },
};

const meetingStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  booked: { bg: "#e3f2fd", text: "#1565c0", label: "Planifié" },
  done: { bg: "#e8f5e9", text: "#2e7d32", label: "Effectué" },
  no_show: { bg: "#fce4ec", text: "#c62828", label: "No show" },
  cancelled: { bg: "#f0f0f0", text: "#666", label: "Annulé" },
};

const activityTypeLabels: Record<string, string> = {
  appel: "Appel",
  email: "Email",
  "réunion": "Réunion",
  note: "Note",
  "tâche": "Tâche",
  relance: "Relance",
};

const activityTypeColors: Record<string, { bg: string; text: string }> = {
  appel: { bg: "#e3f2fd", text: "#1565c0" },
  email: { bg: "#fff3e0", text: "#e65100" },
  "réunion": { bg: "#f3e5f5", text: "#6a1b9a" },
  note: { bg: "#e8f5e9", text: "#2e7d32" },
  "tâche": { bg: "#fce4ec", text: "#c62828" },
  relance: { bg: "#fff8e1", text: "#f57c00" },
};

const callResultBadges: { match: string; label: string; bg: string; text: string }[] = [
  { match: "Contacté → Booké", label: "Booké", bg: "#e8f5e9", text: "#2e7d32" },
  { match: "Contacté → Non booké", label: "Non booké", bg: "#fff3e0", text: "#e65100" },
  { match: "Contacté", label: "Contacté", bg: "#e3f2fd", text: "#1565c0" },
  { match: "Message vocal laissé", label: "Message vocal", bg: "#fff8e1", text: "#f57c00" },
  { match: "Pas de réponse", label: "Pas de réponse", bg: "#fce4ec", text: "#c62828" },
  { match: "Pas intéressé", label: "Pas intéressé", bg: "#f3e5f5", text: "#6a1b9a" },
];

function getCallResultBadge(description: string | null) {
  if (!description) return null;
  for (const b of callResultBadges) {
    if (description.includes(b.match)) return b;
  }
  return null;
}

function TruncatedText({ text, lines = 2, style }: { text: string; lines?: number; style?: React.CSSProperties }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <p
      onClick={() => setExpanded(!expanded)}
      style={{
        ...style,
        cursor: "pointer",
        ...(expanded ? {} : {
          display: "-webkit-box",
          WebkitLineClamp: lines,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }),
      }}
    >
      {text}
    </p>
  );
}

interface SourceRef { id: string; name: string; }

interface CompanyDealData extends DealData {
  contacts?: { first_name: string; last_name: string } | null;
}

export function ContactDetail({
  contact,
  deals,
  companyDeals = [],
  activities,
  meetings,
  companies,
  teamMembers,
  sources = [],
  learnerSessions = [],
  quotations = [],
}: {
  contact: ContactData;
  deals: DealData[];
  companyDeals?: CompanyDealData[];
  activities: ActivityData[];
  meetings: MeetingData[];
  companies: CompanyRef[];
  teamMembers: TeamMemberRef[];
  sources?: SourceRef[];
  learnerSessions?: Record<string, unknown>[];
  quotations?: Record<string, any>[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromLeads = searchParams.get("from") === "leads";
  const leadsBackParams = new URLSearchParams();
  if (cameFromLeads) {
    const source = searchParams.get("source");
    const q = searchParams.get("q");
    if (source) leadsBackParams.set("source", source);
    if (q) leadsBackParams.set("q", q);
  }
  const backUrl = cameFromLeads
    ? `/marketing/leads${leadsBackParams.toString() ? `?${leadsBackParams.toString()}` : ""}`
    : "/contacts";
  const backLabel = cameFromLeads ? "Retour aux leads" : "Retour aux contacts";
  const currentMemberId = useCurrentMember();
  const isInbound = (contact as any).contact_type === "inbound";
  const defaultMeetingType = isInbound ? "R1" : "R0";
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const [editOpen, setEditOpen] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Email composer
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [senderInfo, setSenderInfo] = useState<{ first_name: string; last_name: string; email: string; phone: string; email_signature: string | null } | null>(null);
  const [emailPreview, setEmailPreview] = useState<{ title: string; description: string } | null>(null);

  const [form, setForm] = useState({
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    position: contact.position ?? "",
    company_id: contact.company_id ?? "",
    is_client: contact.is_client,
    is_learner: (contact as any).is_learner ?? false,
    is_qualified: (contact as unknown as Record<string, unknown>).is_qualified as boolean ?? false,
    notes: contact.notes ?? "",
    lifecycle_stage: contact.lifecycle_stage ?? "prospect",
    lead_status: contact.lead_status ?? "lead",
    contact_type: (contact as any).contact_type ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    owner_id: contact.owner_id ?? "",
    source_id: (contact as any).source_id ?? "",
  });

  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));
  const activityVoice = useVoiceDictation(() => activityForm.description, (t) => setActivityForm((f) => ({ ...f, description: t })));
  const rdvNotesVoice = useVoiceDictation(() => rdvForm.notes, (t) => setRdvForm((f) => ({ ...f, notes: t })));
  const emailBodyVoice = useVoiceDictation(() => emailForm.body, (t) => setEmailForm((f) => ({ ...f, body: t })));

  // Load sender info for email composer
  useEffect(() => {
    if (!currentMemberId) return;
    const supabase = createClient();
    supabase.from("team_members").select("first_name, last_name, email, phone, email_signature").eq("id", currentMemberId).single()
      .then(({ data }) => { if (data) setSenderInfo(data as any); });
  }, [currentMemberId]);

  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({
    type: "appel" as string,
    title: "",
    description: "",
    due_date: "",
    task_deadline: "",
    call_result: "" as "" | "no_answer" | "voicemail" | "contacted" | "not_interested",
    call_outcome: "" as "" | "not_booked" | "booked",
    rdv_date: "",
  });

  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [rdvForm, setRdvForm] = useState({
    meeting_type: defaultMeetingType as string,
    scheduled_at: "",
    duration_minutes: "60",
    meeting_mode: "visio" as string,
    notes: "",
    status: "booked" as string,
    outcome: "" as string,
    rdv_result: "" as "" | "signed" | "not_signed" | "quote_to_send" | "opportunity_detected",
    action_date: "",
  });

  // Multi-participant state
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([contact.id]);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>(currentMemberId ? [currentMemberId] : []);
  const [companyContacts, setCompanyContacts] = useState<{ id: string; first_name: string; last_name: string; email: string | null }[]>([]);

  // Init selectedManagerIds once currentMemberId loads
  useEffect(() => {
    if (currentMemberId && selectedManagerIds.length === 0) {
      setSelectedManagerIds([currentMemberId]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMemberId]);

  // Fetch same-company contacts when RDV dialog opens
  useEffect(() => {
    if (!rdvOpen || !contact.company_id) { setCompanyContacts([]); return; }
    const supabase = createClient();
    supabase.from("contacts")
      .select("id, first_name, last_name, email")
      .eq("company_id", contact.company_id)
      .neq("id", contact.id)
      .order("last_name")
      .then(({ data }) => { setCompanyContacts(data ?? []); });
  }, [rdvOpen, contact.company_id, contact.id]);

  async function handleDelete() {
    const supabase = createClient();
    await supabase.from("contacts").delete().eq("id", contact.id);
    router.push(backUrl);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const wasLearner = (contact as any).is_learner ?? false;
    const { error } = await supabase.from("contacts").update({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      position: form.position || null,
      company_id: form.company_id || null,
      is_client: form.is_client,
      is_learner: form.is_learner,
      is_qualified: form.is_qualified,
      notes: form.notes || null,
      lifecycle_stage: form.lifecycle_stage || "prospect",
      lead_status: form.lead_status || "lead",
      contact_type: form.contact_type || null,
      linkedin_url: form.linkedin_url || null,
      owner_id: form.owner_id || null,
      source_id: form.source_id || null,
    }).eq("id", contact.id);
    if (error) { alert("Erreur: " + error.message); console.error(error); }

    // Sync deals company_id when contact's company changes
    if (form.company_id && form.company_id !== (contact.company_id ?? "")) {
      await supabase.from("deals").update({ company_id: form.company_id }).eq("contact_id", contact.id);
    }

    // Sync learner entry
    if (form.is_learner && !wasLearner) {
      // Check if learner already linked
      const { data: existing } = await supabase.from("learners").select("id").eq("contact_id", contact.id).maybeSingle();
      if (!existing) {
        await supabase.from("learners").insert({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          position: form.position || null,
          company_id: form.company_id || null,
          status: "actuel",
          contact_id: contact.id,
        });
      }
    } else if (!form.is_learner && wasLearner) {
      // Remove linked learner
      await supabase.from("learners").delete().eq("contact_id", contact.id);
    } else if (form.is_learner && wasLearner) {
      // Update linked learner with latest info
      await supabase.from("learners").update({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        position: form.position || null,
        company_id: form.company_id || null,
      }).eq("contact_id", contact.id);
    }

    setSaving(false);
    setEditOpen(false);
    router.refresh();
  }

  async function handleLogActivity() {
    setSaving(true);
    const supabase = createClient();

    // Build description with call result if applicable
    let fullDescription = activityForm.description || "";
    if (activityForm.type === "appel" && activityForm.call_result) {
      const resultLabels: Record<string, string> = { no_answer: "Pas de réponse", voicemail: "Message vocal laissé", contacted: "Contacté", not_interested: "Pas intéressé" };
      const outcomeLabels: Record<string, string> = { not_booked: "Non booké", booked: "Booké" };
      let resultText = resultLabels[activityForm.call_result] || "";
      if (activityForm.call_result === "contacted" && activityForm.call_outcome) {
        resultText += " → " + (outcomeLabels[activityForm.call_outcome] || "");
      }
      fullDescription = resultText + (fullDescription ? "\n" + fullDescription : "");
    }

    const payload: Record<string, any> = {
      type: activityForm.type,
      title: activityForm.title,
      description: fullDescription || null,
      due_date: activityForm.due_date || null,
      task_deadline: activityForm.type === "tâche" && activityForm.task_deadline ? activityForm.task_deadline : null,
      contact_id: contact.id,
      company_id: contact.company_id || null,
      team_member_id: currentMemberId || null,
    };

    const hasTaskDate = activityForm.due_date || (activityForm.type === "tâche" && activityForm.task_deadline);

    if (editingActivityId) {
      await supabase.from("activities").update(payload).eq("id", editingActivityId);
      // Sync task to Google Calendar on update
      if (activityForm.type === "tâche" && hasTaskDate) {
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
      if (newActivity?.id && activityForm.type === "tâche" && hasTaskDate) {
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

    // Update contact lead_status based on call result
    if (!editingActivityId && activityForm.type === "appel") {
      if (activityForm.call_result === "not_interested") {
        await supabase.from("contacts").update({
          last_contacted_at: new Date().toISOString(),
          lead_status: "not_interested",
          lifecycle_stage: "prospect",
        }).eq("id", contact.id);
      } else if (activityForm.call_result === "contacted") {
        const callUpdate: Record<string, string> = {
          last_contacted_at: new Date().toISOString(),
          lead_status: activityForm.call_outcome === "booked" ? "booked" : "contacted",
        };
        if (activityForm.call_outcome === "booked") {
          callUpdate.lifecycle_stage = "prospect";
        }
        await supabase.from("contacts").update(callUpdate).eq("id", contact.id);
      } else {
        await supabase.from("contacts").update({
          last_contacted_at: new Date().toISOString(),
        }).eq("id", contact.id);
      }
    } else {
      await supabase.from("contacts").update({
        last_contacted_at: new Date().toISOString(),
      }).eq("id", contact.id);
    }

    const shouldOpenRdv = !editingActivityId && activityForm.type === "appel" && activityForm.call_result === "contacted" && activityForm.call_outcome === "booked";
    const rdvDateForForm = activityForm.rdv_date || "";

    setSaving(false);
    setActivityOpen(false);
    setEditingActivityId(null);
    setActivityForm({ type: "appel", title: "", description: "", due_date: "", call_result: "", call_outcome: "", rdv_date: "", task_deadline: "" });

    if (shouldOpenRdv) {
      // Open RDV creation form with the scheduled date from the activity
      const fallbackNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditingMeetingId(null);
      setRdvForm({ meeting_type: defaultMeetingType, scheduled_at: rdvDateForForm || fallbackNow, duration_minutes: "60", meeting_mode: "visio", notes: "", status: "booked", outcome: "", rdv_result: "", action_date: fallbackNow });
      setSelectedContactIds([contact.id]);
      setSelectedManagerIds(currentMemberId ? [currentMemberId] : []);
      setRdvOpen(true);
    }

    router.refresh();
  }

  function openEditActivity(a: ActivityData) {
    setEditingActivityId(a.id);
    setActivityForm({
      type: a.type,
      title: a.title,
      description: a.description ?? "",
      due_date: a.due_date ? a.due_date.slice(0, 16) : "",
      task_deadline: (a as any).task_deadline ?? "",
      call_result: "",
      call_outcome: "",
      rdv_date: "",
    });
    setActivityOpen(true);
  }

  async function recalculateContactStatus() {
    const supabase = createClient();
    // Fetch remaining activities and meetings for this contact
    const [{ data: remainingActivities }, { data: remainingMeetings }] = await Promise.all([
      supabase.from("activities").select("type, description").eq("contact_id", contact.id),
      supabase.from("meetings").select("status, outcome, next_step, meeting_type").eq("contact_id", contact.id),
    ]);

    const acts = remainingActivities ?? [];
    const mtgs = remainingMeetings ?? [];

    // Determine the highest status based on what's left
    // Priority: signed > rdv_done > booked > contacted > lead
    const hasSigned = mtgs.some(m => m.outcome && m.outcome.includes("Signed") && !m.outcome.includes("Not signed"));
    if (hasSigned) {
      await supabase.from("contacts").update({ lead_status: "signed", lifecycle_stage: "customer" }).eq("id", contact.id);
      return;
    }

    const hasDoneRdv = mtgs.some(m => m.status === "done");
    if (hasDoneRdv) {
      await supabase.from("contacts").update({ lead_status: "rdv_done" }).eq("id", contact.id);
      return;
    }

    const hasBookedRdv = mtgs.some(m => m.status === "booked");
    if (hasBookedRdv) {
      const updateData: Record<string, string> = { lead_status: "booked" };
      // Lead marketing → prospect uniquement si R1 ou supérieur est booked
      if (contact.lifecycle_stage === "lead_marketing") {
        const hasR1Plus = mtgs.some(m => m.status === "booked" && ["R0+R1", "R1", "R2", "R3", "Signed"].includes(m.meeting_type));
        if (hasR1Plus) updateData.lifecycle_stage = "prospect";
      }
      await supabase.from("contacts").update(updateData).eq("id", contact.id);
      return;
    }

    const hasContactedActivity = acts.some(a => a.description && a.description.includes("Contacté"));
    const hasAnyActivity = acts.length > 0;
    if (hasContactedActivity || hasAnyActivity) {
      await supabase.from("contacts").update({ lead_status: "contacted" }).eq("id", contact.id);
      return;
    }

    // Nothing left → back to lead
    await supabase.from("contacts").update({ lead_status: "lead" }).eq("id", contact.id);
  }

  async function handleDeleteActivity(id: string) {
    const supabase = createClient();
    await supabase.from("activities").delete().eq("id", id);
    await recalculateContactStatus();
    router.refresh();
  }

  async function handleCompleteTask(id: string) {
    const supabase = createClient();
    await supabase.from("activities").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("id", id);
    router.refresh();
  }

  function resetRdvState() {
    setRdvForm({ meeting_type: defaultMeetingType, scheduled_at: "", duration_minutes: "60", meeting_mode: "visio", notes: "", status: "booked", outcome: "", rdv_result: "", action_date: "" });
    setSelectedContactIds([contact.id]);
    setSelectedManagerIds(currentMemberId ? [currentMemberId] : []);
  }

  async function handleSaveRdv() {
    setSaving(true);
    const supabase = createClient();

    // Build outcome text
    let outcomeText = rdvForm.outcome || "";
    if (rdvForm.status === "done" && rdvForm.rdv_result) {
      const resultLabels: Record<string, string> = { signed: "Signed", not_signed: "Not signed", quote_to_send: "Devis à envoyer", opportunity_detected: "Opportunité détectée" };
      outcomeText = resultLabels[rdvForm.rdv_result] || rdvForm.rdv_result;
    }

    const now = new Date().toISOString();
    // Stats attribution: if multiple managers, attribute to the creator; if single, attribute to that manager
    const primaryManagerId = selectedManagerIds.length === 1
      ? selectedManagerIds[0]
      : (currentMemberId || selectedManagerIds[0] || null);

    // Helper: insert junction table rows for a meeting
    async function insertParticipants(meetingId: string) {
      if (selectedContactIds.length > 0) {
        await supabase.from("meeting_contacts").insert(
          selectedContactIds.map(cid => ({ meeting_id: meetingId, contact_id: cid, is_primary: cid === contact.id }))
        );
      }
      if (selectedManagerIds.length > 0) {
        await supabase.from("meeting_managers").insert(
          selectedManagerIds.map(mid => ({ meeting_id: meetingId, team_member_id: mid, is_primary: mid === primaryManagerId }))
        );
      }
    }

    // Helper: update all selected contacts
    async function updateAllContacts(updateData: Record<string, string>) {
      for (const cid of selectedContactIds) {
        await supabase.from("contacts").update(updateData).eq("id", cid);
      }
    }

    if (editingMeetingId && (rdvForm.status === "done" || rdvForm.status === "no_show" || rdvForm.status === "cancelled")) {
      // Status changed from booked → done/no_show/cancelled
      // Create a NEW entry with the result
      const { data: resultMeeting, error } = await supabase.from("meetings").insert({
        meeting_type: rdvForm.meeting_type,
        status: rdvForm.status,
        scheduled_at: now,
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
        contact_id: contact.id,
        company_id: contact.company_id || null,
        assigned_to: primaryManagerId,
      }).select("id").single();
      if (error) { alert("Erreur: " + error.message); }

      // Insert participants for the result meeting
      if (resultMeeting?.id) await insertParticipants(resultMeeting.id);

      // Mark original as completed
      await supabase.from("meetings").update({ next_step: "completed" }).eq("id", editingMeetingId);

      // Update ALL selected contacts status
      if (rdvForm.status === "done" && rdvForm.rdv_result === "signed") {
        await updateAllContacts({ lead_status: "signed", lifecycle_stage: "customer" });
      } else if (rdvForm.status === "done") {
        await updateAllContacts({ lead_status: "rdv_done" });
      }
    } else if (editingMeetingId) {
      // Simple edit (notes, date, etc.) without status change
      const { error } = await supabase.from("meetings").update({
        meeting_type: rdvForm.meeting_type,
        scheduled_at: localToUtc(rdvForm.scheduled_at),
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
      }).eq("id", editingMeetingId);
      if (error) { alert("Erreur: " + error.message); }

      // Update junction tables: remove old, insert new
      await supabase.from("meeting_contacts").delete().eq("meeting_id", editingMeetingId);
      await supabase.from("meeting_managers").delete().eq("meeting_id", editingMeetingId);
      await insertParticipants(editingMeetingId);
    } else {
      // New meeting creation
      const { data: newMeeting, error } = await supabase.from("meetings").insert({
        meeting_type: rdvForm.meeting_type,
        status: rdvForm.status,
        scheduled_at: localToUtc(rdvForm.scheduled_at),
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null,
        outcome: outcomeText || null,
        contact_id: contact.id,
        company_id: contact.company_id || null,
        assigned_to: primaryManagerId,
      }).select("id").single();
      if (error) { alert("Erreur: " + error.message); }

      // Insert participants
      if (newMeeting?.id) await insertParticipants(newMeeting.id);

      // Update lead_status for ALL selected contacts
      if (rdvForm.status === "booked") {
        for (const cid of selectedContactIds) {
          const updateData: Record<string, string> = { lead_status: "booked" };
          // Lead marketing → prospect uniquement si R1 ou supérieur
          if (contact.lifecycle_stage === "lead_marketing" && ["R0+R1", "R1", "R2", "R3", "Signed"].includes(rdvForm.meeting_type)) {
            updateData.lifecycle_stage = "prospect";
          }
          await supabase.from("contacts").update(updateData).eq("id", cid);
        }
      }

      // Auto-notify: Google Calendar + Slack/Email for ALL participants
      if (newMeeting?.id && rdvForm.status === "booked") {
        try {
          const notifyRes = await fetch("/api/meetings/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meetingId: newMeeting.id,
              contactIds: selectedContactIds,
              managerIds: selectedManagerIds,
            }),
          });
          const notifyData = await notifyRes.json();
          if (notifyData.results?.length > 0) {
            const summary = notifyData.results.map((r: any) => `${r.action}: ${r.status}`).join(", ");
            alert(`RDV créé ✅\n\nSync: ${summary}`);
          }
        } catch {}
      }
    }

    // If opportunity detected or quote_to_send → create deal and redirect
    const shouldCreateDeal = rdvForm.status === "done" && (rdvForm.rdv_result === "opportunity_detected" || rdvForm.rdv_result === "quote_to_send");
    const dealStage = rdvForm.rdv_result === "quote_to_send" ? "quote_to_send" : "opportunities";

    if (shouldCreateDeal) {
      const supabase2 = createClient();
      const dealName = `${contact.first_name} ${contact.last_name}${contact.companies ? " - " + contact.companies.name : ""}`;
      const { data: newDeal, error: dealError } = await supabase2.from("deals").insert({
        name: dealName,
        contact_id: contact.id,
        company_id: contact.company_id || null,
        stage: dealStage,
        probability: dealStage === "quote_to_send" ? 40 : 20,
      }).select("id").single();

      setSaving(false);
      setRdvOpen(false);
      setEditingMeetingId(null);
      resetRdvState();

      if (newDeal && !dealError) {
        router.push(`/deals?edit=${newDeal.id}`);
        return;
      }
    }

    setSaving(false);
    setRdvOpen(false);
    setEditingMeetingId(null);
    resetRdvState();
    router.refresh();
  }

  // Convert UTC timestamp to local datetime-local format
  function utcToLocal(utc: string): string {
    if (!utc) return "";
    const d = new Date(utc);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  // Convert local datetime-local to UTC ISO string
  function localToUtc(local: string): string {
    if (!local) return new Date().toISOString();
    return new Date(local).toISOString();
  }

  function openEditMeeting(m: MeetingData) {
    setEditingMeetingId(m.id);
    setRdvForm({
      meeting_type: m.meeting_type,
      scheduled_at: m.scheduled_at ? utcToLocal(m.scheduled_at) : "",
      duration_minutes: String(m.duration_minutes || 60),
      meeting_mode: m.meeting_mode ?? "visio",
      notes: m.notes ?? "",
      status: m.status === "booked" ? "booked" : m.status,
      outcome: m.outcome ?? "",
      rdv_result: "",
      action_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    });
    setRdvOpen(true);
  }

  async function handleDeleteMeeting(id: string) {
    const supabase = createClient();
    await supabase.from("meetings").delete().eq("id", id);
    await recalculateContactStatus();
    router.refresh();
  }

  function formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd MMM yyyy", { locale: fr });
    } catch {
      return "—";
    }
  }

  function formatDateTime(d: string | null | undefined): string {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr });
    } catch {
      return "—";
    }
  }

  function formatRevenue(amount: number | null): string {
    if (amount == null) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
  }

  const lc = lifecycleColors[contact.lifecycle_stage ?? ""] ?? null;

  // Compute dynamic lead status badge based on latest action
  const dynamicLeadStatus = (() => {
    // Collect all events with timestamps
    const events: { date: string; status: string }[] = [];

    // Activities (calls → contacted)
    activities.forEach(a => {
      if (a.type === "appel" && a.description) {
        const d = a.due_date || a.created_at;
        if (d) {
          if (String(a.description).includes("Contacté → Booké") || String(a.description).includes("Booked")) {
            events.push({ date: d, status: "booked" });
          } else if (String(a.description).includes("Contacté")) {
            events.push({ date: d, status: "contacted" });
          }
        }
      }
    });

    // Meetings
    meetings.forEach(m => {
      const d = m.scheduled_at;
      if (!d) return;
      if (m.status === "booked" && m.next_step !== "completed") {
        events.push({ date: d, status: "booked" });
      }
      if (m.status === "done") {
        if (m.outcome && (m.outcome.includes("Signed") && !m.outcome.includes("Not signed"))) {
          events.push({ date: d, status: "signed" });
        } else {
          events.push({ date: d, status: "rdv_done" });
        }
      }
    });

    // Sort by date descending, take the latest
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events.length > 0 ? events[0].status : (contact.lead_status ?? "lead");
  })();

  const ls = leadStatusColors[dynamicLeadStatus] ?? leadStatusColors[contact.lead_status ?? ""] ?? null;

  // Build meeting progression
  const hasSomeSigned = meetings.some(m => m.status === "done" && m.outcome && m.outcome.includes("Signed") && !m.outcome.includes("Not signed")) || contact.lead_status === "signed";
  const meetingTypes = ["R0", "R1", "R2", "R3", "Signed"];
  const meetingProgression = meetingTypes.map((type) => {
    if (type === "Signed") {
      return { type, done: hasSomeSigned, date: null };
    }
    // R0+R1 counts as both R0 done and R1 done
    const m = meetings.find((mt) => {
      if (mt.status !== "done") return false;
      if (mt.meeting_type === type) return true;
      if (mt.meeting_type === "R0+R1" && (type === "R0" || type === "R1")) return true;
      return false;
    });
    return { type, done: !!m, date: m?.scheduled_at ?? null };
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => router.push(backUrl)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {backLabel}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16); setEditingActivityId(null); setActivityForm({ type: "appel", title: "Appel", description: "", due_date: now, call_result: "", call_outcome: "", rdv_date: "", task_deadline: "" }); setActivityOpen(true); }}>
            <PhoneCall className="h-4 w-4 mr-1" /> Log appel
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEmailForm({ subject: "", body: "" }); setEmailOpen(true); }}>
            <MailPlus className="h-4 w-4 mr-1" /> Envoyer email
          </Button>
          <Button variant="outline" size="sm" onClick={() => { const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16); setEditingMeetingId(null); setRdvForm({ meeting_type: defaultMeetingType, scheduled_at: now, duration_minutes: "60", meeting_mode: "visio", notes: "", status: "booked", outcome: "", rdv_result: "", action_date: now }); setSelectedContactIds([contact.id]); setSelectedManagerIds(currentMemberId ? [currentMemberId] : []); setRdvOpen(true); }}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Créer RDV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditingActivityId(null); setActivityForm({ type: "note", title: "", description: "", due_date: "", call_result: "", call_outcome: "", rdv_date: "", task_deadline: "" }); setActivityOpen(true); }}>
            <PlusCircle className="h-4 w-4 mr-1" /> Activité
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Contact info */}
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
                    if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ce contact ? Cette action est irréversible.")) {
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
              <div>
                <h2 className="text-xl font-bold">{contact.first_name} {contact.last_name}</h2>
                {contact.position && (
                  <span className="text-sm text-muted-foreground">{contact.position}</span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {lc && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: lc.bg, color: lc.text }}
                  >
                    {lc.label}
                  </span>
                )}
                {ls && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: ls.bg, color: ls.text }}
                  >
                    {ls.label}
                  </span>
                )}
                {(contact as any).is_learner && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "#e8f0fe", color: "#0d4f7a" }}
                  >
                    Apprenant
                  </span>
                )}
                {(contact as any).contact_type === "inbound" && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
                  >
                    Inbound
                  </span>
                )}
                {(contact as any).contact_type === "outbound" && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "#fff3e0", color: "#e65100" }}
                  >
                    Outbound
                  </span>
                )}
              </div>

              <Separator />

              {contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Email</span>
                    <a href={`mailto:${contact.email}`} className="text-sm underline">{contact.email}</a>
                  </div>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Téléphone</span>
                    <a href={`tel:${contact.phone}`} className="text-sm">{formatPhone(contact.phone)}</a>
                  </div>
                </div>
              )}

              {contact.companies && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Entreprise</span>
                    <button
                      className="text-sm underline text-left"
                      onClick={() => router.push(`/clients/${contact.companies!.id}`)}
                    >
                      {contact.companies.name}
                    </button>
                  </div>
                </div>
              )}

              {contact.linkedin_url && (
                <div className="flex items-start gap-3">
                  <Linkedin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">LinkedIn</span>
                    <a
                      href={contact.linkedin_url.startsWith("http") ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm underline flex items-center gap-1"
                    >
                      Voir le profil <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <span className="text-xs text-muted-foreground block mb-1">Dernier contact</span>
                <span className="text-sm">{formatDate(contact.last_contacted_at)}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-1">Créé le</span>
                <span className="text-sm">{formatDate(contact.created_at)}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-1">Propriétaire</span>
                <span className="text-sm font-medium">
                  {contact.team_members
                    ? `${contact.team_members.first_name} ${contact.team_members.last_name}`
                    : <span style={{ color: "#8399a9" }}>Non assigné</span>
                  }
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-1">Source</span>
                <span className="text-sm font-medium">
                  {contact.source_id
                    ? sources.find((s: any) => s.id === contact.source_id)?.name ?? "—"
                    : <span style={{ color: "#8399a9" }}>Non renseignée</span>
                  }
                </span>
              </div>

              {contact.notes && (
                <>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Notes</span>
                    <RichNotes value={contact.notes} onChange={() => {}} readOnly />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Meeting progression card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Progression RDV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2">
                {meetingProgression.map((mp, i) => {
                  const mtc = mp.type === "Signed" ? { bg: "#e8f5e9", text: "#2e7d32" } : meetingTypeColors[mp.type];
                  return (
                    <div key={mp.type} className="flex items-center gap-2">
                      <div className="text-center">
                        <span
                          className="inline-flex items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            width: mp.type === "Signed" ? 48 : 40,
                            height: mp.type === "Signed" ? 48 : 40,
                            backgroundColor: mp.done ? (mtc?.bg ?? "#f0f0f0") : "#f8f8f8",
                            color: mp.done ? (mtc?.text ?? "#666") : "#ccc",
                            border: mp.done ? "none" : "2px dashed #ddd",
                            fontSize: mp.type === "Signed" ? 9 : 12,
                          }}
                        >
                          {mp.type === "Signed" ? "✓ Signed" : mp.type}
                        </span>
                        {mp.date && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {formatDate(mp.date)}
                          </div>
                        )}
                      </div>
                      {i < meetingProgression.length - 1 && (
                        <div
                          className="w-6 h-0.5"
                          style={{ backgroundColor: mp.done ? "#2e7d32" : "#ddd" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
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
              <TabsTrigger value="deals">
                <Briefcase className="h-4 w-4 mr-1" /> Deals ({deals.length + companyDeals.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                <PhoneCall className="h-4 w-4 mr-1" /> Activités ({activities.length})
              </TabsTrigger>
              <TabsTrigger value="meetings">
                <Calendar className="h-4 w-4 mr-1" /> RDV ({meetings.length})
              </TabsTrigger>
              {quotations.length > 0 && (
                <TabsTrigger value="quotations">
                  Cotations ({quotations.length})
                </TabsTrigger>
              )}
              {learnerSessions.length > 0 && (
                <TabsTrigger value="sessions">
                  <GraduationCap className="h-4 w-4 mr-1" /> Sessions ({learnerSessions.length})
                </TabsTrigger>
              )}
              <TabsTrigger value="tasks">
                <ClipboardList className="h-4 w-4 mr-1" /> Tâches ({activities.filter(a => a.type === "tâche").length})
              </TabsTrigger>
            </TabsList>

            {/* Vue d'ensemble */}
            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {/* Prochain RDV */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" style={{ color: "#1a6b9c" }} /> Prochain RDV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const nextMeeting = meetings.find((m) => m.status === "booked" && m.next_step !== "completed");
                      if (!nextMeeting) return <p style={{ fontSize: 13, color: "#8399a9" }}>Aucun RDV planifié</p>;
                      const mt = meetingTypeColors[nextMeeting.meeting_type] ?? { bg: "#f0f0f0", text: "#666" };
                      return (
                        <div style={{ border: "1px solid #e6f0f7", borderRadius: 10, padding: 14, borderLeft: `4px solid ${mt.text}` }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span style={{ background: mt.bg, color: mt.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{nextMeeting.meeting_type}</span>
                              <span style={{ background: "#e3f2fd", color: "#1565c0", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Planifié</span>
                              {nextMeeting.meeting_mode && (() => {
                                const modeLabels: Record<string, { icon: string; label: string; bg: string; text: string }> = {
                                  visio: { icon: "📹", label: "Visio", bg: "#e3f2fd", text: "#1565c0" },
                                  phone: { icon: "📞", label: "Téléphone", bg: "#fff3e0", text: "#e65100" },
                                  in_person: { icon: "📍", label: "Présentiel", bg: "#e8f5e9", text: "#2e7d32" },
                                };
                                const mode = modeLabels[nextMeeting.meeting_mode ?? ""] ?? null;
                                if (!mode) return null;
                                return (
                                  <span style={{ background: mode.bg, color: mode.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                                    {mode.icon} {mode.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: "#1a2a3a", fontWeight: 600, marginTop: 6 }}>
                            RDV prévu le {formatDateTime(nextMeeting.scheduled_at)} — {nextMeeting.duration_minutes || 60} min
                          </div>
                          {nextMeeting.notes && <p style={{ fontSize: 12, color: "#8399a9", marginTop: 4 }}>{nextMeeting.notes}</p>}
                          <button onClick={() => openEditMeeting(nextMeeting)} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px" }}>
                            📋 Suivi rdv
                          </button>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Dernier RDV effectué */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CalendarPlus className="h-4 w-4" style={{ color: "#27ae60" }} /> Dernier RDV effectué
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const lastDone = meetings.find((m) => m.status === "done");
                      if (!lastDone) return <p style={{ fontSize: 13, color: "#8399a9" }}>Aucun RDV effectué</p>;
                      const mt = meetingTypeColors[lastDone.meeting_type] ?? { bg: "#f0f0f0", text: "#666" };
                      return (
                        <div style={{ border: "1px solid #e6f0f7", borderRadius: 10, padding: 12, borderLeft: "4px solid #27ae60" }}>
                          <div className="flex items-center gap-2">
                            <span style={{ background: mt.bg, color: mt.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{lastDone.meeting_type}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{formatDateTime(lastDone.scheduled_at)}</span>
                          </div>
                          {lastDone.outcome && <p style={{ fontSize: 12, color: "#0d4f7a", marginTop: 4, fontWeight: 500 }}>Résultat : {lastDone.outcome}</p>}
                          {lastDone.notes && <TruncatedText text={lastDone.notes} style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }} />}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Deals */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Briefcase className="h-4 w-4" style={{ color: "#FF6B35" }} /> Deals ({deals.length + companyDeals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {deals.length === 0 && companyDeals.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#8399a9" }}>Aucun deal associé</p>
                    ) : (
                      <div className="space-y-2">
                        {[...deals.slice(0, 3), ...companyDeals.slice(0, Math.max(0, 3 - deals.length))].map((d) => {
                          const ds = dealStageColors[d.stage] ?? { bg: "#f0f0f0", text: "#666" };
                          const isCompanyDeal = companyDeals.some((cd) => cd.id === d.id);
                          return (
                            <div key={d.id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid #e6f0f7" }}>
                              <div>
                                <span onClick={() => router.push(`/deals?edit=${d.id}`)} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{d.name}</span>
                                <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                                  <span style={{ background: ds.bg, color: ds.text, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                                    {(dealStageColors[d.stage] ?? { label: d.stage }).label}
                                  </span>
                                  {isCompanyDeal && (
                                    <span style={{ background: "#f0f4f8", color: "#5a7d9a", padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                                      Entreprise
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#27ae60" }}>
                                {d.amount ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(d.amount)) + " €" : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Résumé activités récentes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" style={{ color: "#1565c0" }} /> Dernières activités
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activities.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#8399a9" }}>Aucune activité</p>
                    ) : (
                      <div className="space-y-2">
                        {activities.slice(0, 3).map((a) => {
                          const atc = activityTypeColors[a.type] ?? { bg: "#f0f0f0", text: "#666" };
                          return (
                            <div key={a.id} className="flex items-center gap-3" style={{ padding: "6px 0", borderBottom: "1px solid #e6f0f7" }}>
                              <span style={{ fontSize: 11, color: "#8399a9", width: 70, flexShrink: 0 }}>{formatDate(a.due_date || a.created_at)}</span>
                              <span style={{ background: atc.bg, color: atc.text, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                                {activityTypeLabels[a.type] ?? a.type}
                              </span>
                              {a.type === "appel" && (() => {
                                const crb = getCallResultBadge(a.description);
                                return crb ? (
                                  <span style={{ background: crb.bg, color: crb.text, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                                    {crb.label}
                                  </span>
                                ) : null;
                              })()}
                              <span style={{ fontSize: 12, color: "#1a2a3a" }}>{a.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="deals" className="mt-4 space-y-4">
              {/* Deals directs du contact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Deals du contact ({deals.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Étape</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead className="text-right">Probabilité</TableHead>
                          <TableHead>Clôture prévue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deals.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Aucun deal direct
                            </TableCell>
                          </TableRow>
                        ) : (
                          deals.map((d) => {
                            const ds = dealStageColors[d.stage] ?? null;
                            return (
                              <TableRow key={d.id}>
                                <TableCell className="font-medium"><span onClick={() => router.push(`/deals?edit=${d.id}`)} style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{d.name}</span></TableCell>
                                <TableCell>
                                  {d.companies && d.company_id ? (
                                    <span
                                      onClick={() => router.push(`/clients/${d.company_id}`)}
                                      style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                                    >
                                      {d.companies.name}
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  {ds ? (
                                    <span
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                      style={{ backgroundColor: ds.bg, color: ds.text }}
                                    >
                                      {ds.label}
                                    </span>
                                  ) : d.stage}
                                </TableCell>
                                <TableCell className="text-right">{formatRevenue(d.amount)}</TableCell>
                                <TableCell className="text-right">{d.probability != null ? `${d.probability}%` : "—"}</TableCell>
                                <TableCell>{formatDate(d.expected_close_date)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Deals de l'entreprise (autres contacts) */}
              {contact.companies && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" style={{ color: "#2d7dd2" }} />
                      Autres deals de {contact.companies.name} ({companyDeals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Étape</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                            <TableHead className="text-right">Probabilité</TableHead>
                            <TableHead>Clôture prévue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyDeals.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Aucun autre deal pour cette entreprise
                              </TableCell>
                            </TableRow>
                          ) : (
                            companyDeals.map((d) => {
                              const ds = dealStageColors[d.stage] ?? null;
                              const dealContact = d.contacts as { first_name: string; last_name: string } | null;
                              return (
                                <TableRow key={d.id}>
                                  <TableCell className="font-medium"><span onClick={() => router.push(`/deals?edit=${d.id}`)} style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{d.name}</span></TableCell>
                                  <TableCell>{dealContact ? `${dealContact.first_name} ${dealContact.last_name}` : "—"}</TableCell>
                                  <TableCell>
                                    {ds ? (
                                      <span
                                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                        style={{ backgroundColor: ds.bg, color: ds.text }}
                                      >
                                        {ds.label}
                                      </span>
                                    ) : d.stage}
                                  </TableCell>
                                  <TableCell className="text-right">{formatRevenue(d.amount)}</TableCell>
                                  <TableCell className="text-right">{d.probability != null ? `${d.probability}%` : "—"}</TableCell>
                                  <TableCell>{formatDate(d.expected_close_date)}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activities" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {activities.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune activité</p>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((a) => (
                        <div key={a.id} className="flex gap-4 pb-4 border-b last:border-0">
                          <div className="flex-shrink-0 w-28">
                            <span className="text-xs text-muted-foreground">{formatDate(a.due_date || a.created_at)}</span>
                            {a.due_date && (
                              <span className="text-xs text-muted-foreground block">
                                {(() => { try { const m = (a.due_date as string).match(/T(\d{2}:\d{2})/); return m ? m[1] : ""; } catch { return ""; } })()}
                              </span>
                            )}
                            {a.team_members && (
                              <div
                                title={`${a.team_members.first_name} ${a.team_members.last_name}`}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: 24, height: 24, borderRadius: "50%",
                                  background: "#0d4f7a", color: "white",
                                  fontSize: 9, fontWeight: 700, marginTop: 4,
                                }}
                              >
                                {a.team_members.first_name[0]}{a.team_members.last_name[0]}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: (activityTypeColors[a.type] ?? { bg: "#f0f0f0" }).bg, color: (activityTypeColors[a.type] ?? { text: "#666" }).text }}
                              >
                                {activityTypeLabels[a.type] ?? a.type}
                              </span>
                              {a.type === "appel" && (() => {
                                const crb = getCallResultBadge(a.description);
                                return crb ? (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: crb.bg, color: crb.text }}>
                                    {crb.label}
                                  </span>
                                ) : null;
                              })()}
                              {a.is_completed && (
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
                                >
                                  Terminé
                                </span>
                              )}
                              {a.type === "tâche" && (a as any).task_deadline && !a.is_completed && (
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ backgroundColor: new Date((a as any).task_deadline) < new Date() ? "#fde8e8" : "#fff3e0", color: new Date((a as any).task_deadline) < new Date() ? "#e74c3c" : "#e65100" }}
                                >
                                  ⏰ Échéance : {(() => { try { return format(new Date((a as any).task_deadline), "d MMM yyyy", { locale: fr }); } catch { return ""; } })()}
                                </span>
                              )}
                            </div>
                            {a.type === "email" ? (
                              <p className="text-sm font-medium" style={{ color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                                onClick={() => setEmailPreview({ title: a.title, description: a.description ?? "" })}>
                                {a.title}
                              </p>
                            ) : (
                              <p className="text-sm font-medium">{a.title}</p>
                            )}
                            {a.description && a.type !== "email" && <TruncatedText text={a.description} style={{ fontSize: 14, color: "#64748b", marginTop: 4 }} />}
                            {a.description && a.type === "email" && (
                              <p className="text-sm text-muted-foreground mt-1" style={{ cursor: "pointer" }} onClick={() => setEmailPreview({ title: a.title, description: a.description ?? "" })}>
                                {a.description.replace(/__EMAIL_HTML__[\s\S]*?__END_HTML__\n\n/, "").slice(0, 80)}...
                              </p>
                            )}
                          </div>
                          <div className="flex items-start gap-1 flex-shrink-0">
                            {a.type === "tâche" && !a.is_completed && (
                              <button
                                onClick={() => handleCompleteTask(a.id)}
                                style={{ background: "#27ae60", color: "white", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}
                              >
                                ✅ Accomplie
                              </button>
                            )}
                            <button
                              onClick={() => openEditActivity(a)}
                              style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer cette activité ?")) handleDeleteActivity(a.id);
                              }}
                              style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meetings" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  {meetings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucun rendez-vous</p>
                  ) : (
                    <div className="space-y-3">
                      {meetings.map((m) => {
                        const mt = meetingTypeColors[m.meeting_type] ?? { bg: "#f0f0f0", text: "#666" };
                        const ms = meetingStatusColors[m.status] ?? { bg: "#f0f0f0", text: "#666", label: m.status };
                        return (
                          <div key={m.id} style={{ border: "1px solid #e6f0f7", borderRadius: 10, padding: 14, borderLeft: `4px solid ${mt.text}` }}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span style={{ background: mt.bg, color: mt.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                                  {m.meeting_type}
                                </span>
                                <span style={{ background: ms.bg, color: ms.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                                  {ms.label}
                                </span>
                                {m.meeting_mode && (() => {
                                  const modeLabels: Record<string, { icon: string; label: string; bg: string; text: string }> = {
                                    visio: { icon: "📹", label: "Visio", bg: "#e3f2fd", text: "#1565c0" },
                                    phone: { icon: "📞", label: "Téléphone", bg: "#fff3e0", text: "#e65100" },
                                    in_person: { icon: "📍", label: "Présentiel", bg: "#e8f5e9", text: "#2e7d32" },
                                  };
                                  const mode = modeLabels[m.meeting_mode ?? ""] ?? null;
                                  if (!mode) return null;
                                  return (
                                    <span style={{ background: mode.bg, color: mode.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                                      {mode.icon} {mode.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditMeeting(m)} style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ce RDV ?")) handleDeleteMeeting(m.id); }} style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, color: "#1a2a3a", fontWeight: 600, marginTop: 6 }}>
                              {m.status === "booked"
                                ? <>RDV prévu le {formatDateTime(m.scheduled_at)} — {m.duration_minutes || 60} min</>
                                : <>{formatDateTime(m.scheduled_at)} — {m.duration_minutes || 60} min</>
                              }
                            </div>
                            {m.notes && <TruncatedText text={m.notes} style={{ fontSize: 12, color: "#8399a9", marginTop: 4 }} />}
                            {m.outcome && <p style={{ fontSize: 12, color: "#0d4f7a", marginTop: 4, fontWeight: 500 }}>Résultat : {m.outcome}</p>}
                            {m.status === "booked" && m.next_step !== "completed" && (
                              <button
                                onClick={() => openEditMeeting(m)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px" }}
                              >
                                📋 Suivi rdv
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cotations */}
            {quotations.length > 0 && (
              <TabsContent value="quotations" className="mt-4">
                <div style={{ borderRadius: 12, border: "1px solid #e8ecf1", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fbfd" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Date</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Entreprise</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Apprenants</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Présentiel</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>VT</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotations.map((q) => (
                        <tr key={q.id} style={{ borderTop: "1px solid #e8ecf1" }}>
                          <td style={{ padding: "10px 14px", color: "#5a6f80" }}>
                            {new Date(q.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td style={{ padding: "10px 14px" }}>{q.company_name || "—"}</td>
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.nb_learners}</td>
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.total_presentiel_days ?? 0}j</td>
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.total_vt_sessions ?? 0}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#27ae60" }}>
                            {q.total_ht != null ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(q.total_ht)) + " €" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}

            {/* Sessions de formation */}
            {learnerSessions.length > 0 && (
              <TabsContent value="sessions" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    <div style={{ fontSize: 13, marginBottom: 12, color: "#5a6f80" }}>
                      <strong>{learnerSessions.length}</strong> session{learnerSessions.length > 1 ? "s" : ""} de formation
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Programme</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Durée</TableHead>
                          <TableHead>Trainer</TableHead>
                          <TableHead style={{ textAlign: "center" }}>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(learnerSessions as Record<string, any>[])
                          .sort((a, b) => String(b.session_date ?? "").localeCompare(String(a.session_date ?? "")))
                          .map((sess) => {
                            const sp = sess.service_plans as Record<string, any> | null;
                            const company = sp?.companies as { name: string } | null;
                            const program = sp?.training_programs as { name: string } | null;
                            const trainers = (sess.trainers as string[] ?? []).join(", ");
                            const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                              done: { bg: "#e8f5e9", text: "#2e7d32", label: "Fait" },
                              planned: { bg: "#fff3e0", text: "#e65100", label: "Planifié" },
                              cancelled: { bg: "#fce4ec", text: "#c62828", label: "Annulé" },
                            };
                            const sc = statusColors[String(sess.status)] ?? statusColors.planned;
                            return (
                              <TableRow key={String(sess.id)}>
                                <TableCell style={{ fontWeight: 600 }}>
                                  {sess.session_date ? new Date(String(sess.session_date)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                </TableCell>
                                <TableCell>
                                  <span style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                                    background: sess.session_type === "journee" ? "#fff3e0" : "#e8f0fe",
                                    color: sess.session_type === "journee" ? "#FF6B35" : "#1a6b9c",
                                  }}>
                                    {sess.session_type === "journee" ? "Journée" : "VT"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {sp?.id ? (
                                    <button onClick={() => setOpenPlanId(String(sp.id))} style={{ fontSize: 13, color: "#1a6b9c", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", padding: 0 }}>
                                      {company?.name ?? "—"}
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 13, color: "#1a6b9c", fontWeight: 600 }}>{company?.name ?? "—"}</span>
                                  )}
                                </TableCell>
                                <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{program?.name ?? "—"}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const allStatuses = [
                                      { value: "planned", bg: "#fff3e0", text: "#e65100", label: "Planifié" },
                                      { value: "done", bg: "#e8f5e9", text: "#2e7d32", label: "Réalisé" },
                                      { value: "cancelled", bg: "#fce4ec", text: "#c62828", label: "Annulé" },
                                      { value: "no_show", bg: "#fff3e0", text: "#e65100", label: "No show" },
                                    ];
                                    const cur = allStatuses.find(o => o.value === String(sess.status)) ?? allStatuses[0];
                                    return (
                                      <select
                                        defaultValue={String(sess.status)}
                                        onChange={async (e) => {
                                          const sb = createClient();
                                          await sb.from("training_sessions").update({ status: e.target.value }).eq("id", String(sess.id));
                                          try { await fetch("/api/sessions/sync-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingSessionId: String(sess.id) }) }); } catch {}
                                          router.refresh();
                                        }}
                                        style={{ height: 26, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 6px", fontSize: 11, fontWeight: 600, background: cur.bg, color: cur.text, cursor: "pointer" }}
                                      >
                                        {allStatuses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                      </select>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="text-right" style={{ fontWeight: 600 }}>{sess.duration_hours ? `${Number(sess.duration_hours).toFixed(0)}h` : "—"}</TableCell>
                                <TableCell style={{ fontSize: 12, color: "#7a8bab" }}>{trainers || "—"}</TableCell>
                                <TableCell style={{ textAlign: "center" }}>
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm("Supprimer cette session ?")) return;
                                      const sb = createClient();
                                      await sb.from("training_session_learners").delete().eq("training_session_id", String(sess.id));
                                      await sb.from("training_sessions").delete().eq("id", String(sess.id));
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
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="tasks" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2" style={{ fontSize: 15 }}>
                    <ClipboardList className="h-4 w-4" style={{ color: "#c62828" }} /> Tâches ({activities.filter(a => a.type === "tâche").length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => { setEditingActivityId(null); setActivityForm({ type: "tâche", title: "", description: "", due_date: "", task_deadline: "", call_result: "", call_outcome: "", rdv_date: "" }); setActivityOpen(true); }}>
                    <PlusCircle className="h-4 w-4 mr-1" /> Nouvelle tâche
                  </Button>
                </CardHeader>
                <CardContent className="pt-2">
                  {activities.filter(a => a.type === "tâche").length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune tâche</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.filter(a => a.type === "tâche").map((a) => {
                        const deadline = (a as any).task_deadline as string | null;
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
                                  style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
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

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Modifier le contact</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
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
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.company_id}
                onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Propriétaire</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              >
                <option value="">Non assigné</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Type de contact *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.contact_type}
                onChange={(e) => setForm({ ...form, contact_type: e.target.value })}
              >
                <option value="">Sélectionner</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.source_id}
                onChange={(e) => setForm({ ...form, source_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cycle de vie</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.lifecycle_stage}
                  onChange={(e) => setForm({ ...form, lifecycle_stage: e.target.value })}
                >
                  {Object.entries(lifecycleColors).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Statut lead</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.lead_status}
                  onChange={(e) => setForm({ ...form, lead_status: e.target.value })}
                >
                  {Object.entries(leadStatusColors).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_client}
                onChange={(e) => setForm({ ...form, is_client: e.target.checked })}
                className="rounded border"
              />
              Client actif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_learner}
                onChange={(e) => setForm({ ...form, is_learner: e.target.checked })}
                className="rounded border"
              />
              Apprenant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_qualified}
                onChange={(e) => setForm({ ...form, is_qualified: e.target.checked })}
                className="rounded border"
              />
              Cible qualifiée
            </label>
            <div className="space-y-2">
              <Label>Notes</Label>
              <RichNotes value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} storageFolder={`contacts/${contact.id}`} />
              <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} tone={notesVoice.tone} onToneChange={notesVoice.setTone} />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || (!form.first_name.trim() && !form.last_name.trim())}
              className="w-full"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Log Activity Sheet */}
      <Sheet open={activityOpen} onOpenChange={(open) => {
        setActivityOpen(open);
        if (!open) { setEditingActivityId(null); setActivityForm({ type: "appel", title: "", description: "", due_date: "", call_result: "", call_outcome: "", rdv_date: "", task_deadline: "" }); }
      }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingActivityId ? "Modifier l'activité" : "Nouvelle activité"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
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
              <Label>Date & Heure de l&apos;action</Label>
              <Input
                type="datetime-local"
                value={activityForm.due_date}
                onChange={(e) => setActivityForm({ ...activityForm, due_date: e.target.value })}
              />
            </div>

            {/* Task deadline - only for "tâche" type */}
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

            {/* Call result fields - only for "appel" type */}
            {activityForm.type === "appel" && (
              <div className="space-y-2">
                <Label>Résultat de l&apos;appel</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={activityForm.call_result}
                  onChange={(e) => setActivityForm({ ...activityForm, call_result: e.target.value as typeof activityForm.call_result, call_outcome: "" })}
                >
                  <option value="">Sélectionner...</option>
                  <option value="no_answer">Pas de réponse</option>
                  <option value="voicemail">Message vocal laissé</option>
                  <option value="contacted">Contacté</option>
                  <option value="not_interested">Pas intéressé</option>
                </select>
              </div>
            )}

            {activityForm.type === "appel" && activityForm.call_result === "contacted" && (
              <div className="space-y-2">
                <Label>Issue</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={activityForm.call_outcome}
                  onChange={(e) => setActivityForm({ ...activityForm, call_outcome: e.target.value as typeof activityForm.call_outcome })}
                >
                  <option value="">Sélectionner...</option>
                  <option value="not_booked">Not booked</option>
                  <option value="booked">Booked</option>
                </select>
              </div>
            )}

            {activityForm.type === "appel" && activityForm.call_result === "contacted" && activityForm.call_outcome === "booked" && (
              <>
                <div className="space-y-2">
                  <Label>Date & Heure du RDV planifié</Label>
                  <Input
                    type="datetime-local"
                    value={activityForm.rdv_date ?? ""}
                    onChange={(e) => setActivityForm({ ...activityForm, rdv_date: e.target.value })}
                  />
                </div>
                <div style={{ padding: "10px 14px", background: "#e8f8f0", borderRadius: 8, borderLeft: "4px solid #2ecc71", fontSize: 13, color: "#27ae60", fontWeight: 500 }}>
                  Après enregistrement, vous serez redirigé vers la création du RDV.
                </div>
              </>
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
              style={{ background: "#FF6B35", color: "white" }}
            >
              {saving ? "Enregistrement..." : (editingActivityId ? "Sauvegarder" : "Enregistrer l'activité")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* RDV Sheet (Create + Edit) */}
      <Sheet open={rdvOpen} onOpenChange={(open) => {
        setRdvOpen(open);
        if (!open) { setEditingMeetingId(null); resetRdvState(); }
      }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingMeetingId ? "Modifier le RDV" : "Créer un RDV"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            <div className="space-y-2">
              <Label>Type de RDV *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={rdvForm.meeting_type}
                onChange={(e) => setRdvForm({ ...rdvForm, meeting_type: e.target.value })}
              >
                <option value="R0">R0 — Qualification</option>
                <option value="R0+R1">R0 + R1 — Qualification + Découverte</option>
                <option value="R1">R1 — Découverte</option>
                <option value="R2">R2 — Solution</option>
                <option value="R3">R3 — Négociation</option>
              </select>
            </div>

            {/* Multi-select: Contacts participants (same company) */}
            <div className="space-y-2">
              <Label>Contacts participants</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                <span style={{ background: "#e3f2fd", color: "#1a6b9c", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                  {contact.first_name} {contact.last_name} (principal)
                </span>
                {selectedContactIds.filter(id => id !== contact.id).map(id => {
                  const c = companyContacts.find(cc => cc.id === id);
                  if (!c) return null;
                  return (
                    <span key={id} style={{ background: "#f0f4f8", color: "#333", padding: "2px 10px", borderRadius: 999, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      {c.first_name} {c.last_name}
                      <button type="button" onClick={() => setSelectedContactIds(prev => prev.filter(x => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontWeight: 700, fontSize: 14, lineHeight: 1 }}>&times;</button>
                    </span>
                  );
                })}
              </div>
              {contact.company_id ? (
                companyContacts.length > 0 ? (
                  <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }}>
                    {companyContacts.map(c => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", cursor: "pointer", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedContactIds(prev => [...prev, c.id]);
                            else setSelectedContactIds(prev => prev.filter(x => x !== c.id));
                          }}
                        />
                        {c.first_name} {c.last_name}
                        {c.email && <span style={{ color: "#8399a9", fontSize: 11 }}>({c.email})</span>}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: "#8399a9" }}>Aucun autre contact dans cette entreprise.</p>
                )
              ) : (
                <p style={{ fontSize: 11, color: "#8399a9" }}>Assignez une entreprise au contact pour ajouter des participants.</p>
              )}
            </div>

            {/* Multi-select: Account managers */}
            <div className="space-y-2">
              <Label>Account managers</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {selectedManagerIds.map(id => {
                  const m = teamMembers.find(tm => tm.id === id);
                  if (!m) return null;
                  return (
                    <span key={id} style={{ background: "#f3e8ff", color: "#7c3aed", padding: "2px 10px", borderRadius: 999, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      {m.first_name} {m.last_name}
                      <button type="button" onClick={() => setSelectedManagerIds(prev => prev.filter(x => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontWeight: 700, fontSize: 14, lineHeight: 1 }}>&times;</button>
                    </span>
                  );
                })}
              </div>
              <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }}>
                {teamMembers.filter(m => !selectedManagerIds.includes(m.id) && m.roles?.includes("Account Manager")).map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => setSelectedManagerIds(prev => [...prev, m.id])}
                    />
                    {m.first_name} {m.last_name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date & Heure de l&apos;action</Label>
              <Input
                type="datetime-local"
                value={rdvForm.action_date}
                onChange={(e) => setRdvForm({ ...rdvForm, action_date: e.target.value })}
              />
              <p style={{ fontSize: 11, color: "#8399a9" }}>Quand cette action a été effectuée</p>
            </div>
            <div className="space-y-2">
              <Label>Date & Heure du RDV planifié *</Label>
              <Input
                type="datetime-local"
                value={rdvForm.scheduled_at}
                onChange={(e) => setRdvForm({ ...rdvForm, scheduled_at: e.target.value })}
              />
              <p style={{ fontSize: 11, color: "#8399a9" }}>Quand le RDV aura lieu</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durée</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={rdvForm.duration_minutes} onChange={(e) => setRdvForm({ ...rdvForm, duration_minutes: e.target.value })}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1h</option>
                  <option value="90">1h30</option>
                  <option value="120">2h</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={rdvForm.meeting_mode} onChange={(e) => setRdvForm({ ...rdvForm, meeting_mode: e.target.value })}>
                  <option value="visio">Visio</option>
                  <option value="phone">Téléphone</option>
                  <option value="in_person">En personne</option>
                </select>
              </div>
            </div>

            {/* Notes - always visible, especially for writing during/after RDV */}
            <div className="space-y-2">
              <Label>Notes du RDV</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={rdvForm.notes}
                onChange={(e) => setRdvForm({ ...rdvForm, notes: e.target.value })}
                placeholder={editingMeetingId ? "Écrivez vos notes de RDV ici..." : "Objectifs du RDV, points clés..."}
              />
              <VoiceButton isRecording={rdvNotesVoice.isRecording} isFormatting={rdvNotesVoice.isFormatting} onClick={rdvNotesVoice.toggleRecording} tone={rdvNotesVoice.tone} onToneChange={rdvNotesVoice.setTone} />
            </div>

            {/* Status - key for post-RDV workflow */}
            <div className="space-y-2">
              <Label>Statut du RDV</Label>
              {(() => {
                const isFuture = rdvForm.scheduled_at ? new Date(rdvForm.scheduled_at) > new Date() : false;
                return (
                  <>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={rdvForm.status}
                      onChange={(e) => setRdvForm({ ...rdvForm, status: e.target.value, rdv_result: "" })}
                    >
                      <option value="booked">Planifié</option>
                      {!isFuture && <option value="done">Effectué (Done)</option>}
                      {!isFuture && <option value="no_show">No show</option>}
                      <option value="cancelled">Annulé</option>
                    </select>
                    {isFuture && rdvForm.status === "booked" && (
                      <p style={{ fontSize: 11, color: "#8399a9", marginTop: 4 }}>
                        Ce RDV est dans le futur — seule l&apos;annulation est possible.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* If done → show result: signed or not signed */}
            {rdvForm.status === "done" && (
              <div className="space-y-2">
                <Label>Résultat du RDV</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={rdvForm.rdv_result}
                  onChange={(e) => setRdvForm({ ...rdvForm, rdv_result: e.target.value as typeof rdvForm.rdv_result })}
                >
                  <option value="">Sélectionner...</option>
                  <option value="opportunity_detected">Opportunité détectée</option>
                  <option value="quote_to_send">Devis à envoyer</option>
                  <option value="signed">Signed</option>
                  <option value="not_signed">Not signed</option>
                </select>
              </div>
            )}

            {rdvForm.status === "done" && rdvForm.rdv_result === "signed" && (
              <div style={{ padding: "10px 14px", background: "#e8f8f0", borderRadius: 8, borderLeft: "4px solid #2ecc71", fontSize: 13, color: "#27ae60", fontWeight: 500 }}>
                Le contact passera en statut &quot;Signed&quot; et en cycle &quot;Client&quot;.
              </div>
            )}

            {rdvForm.status === "done" && rdvForm.rdv_result === "opportunity_detected" && (
              <div style={{ padding: "10px 14px", background: "#e3f2fd", borderRadius: 8, borderLeft: "4px solid #1a6b9c", fontSize: 13, color: "#0d4f7a", fontWeight: 500 }}>
                Un deal sera créé automatiquement et vous serez redirigé vers sa page.
              </div>
            )}

            {rdvForm.status === "done" && rdvForm.rdv_result === "quote_to_send" && (
              <div style={{ padding: "10px 14px", background: "#fff3e0", borderRadius: 8, borderLeft: "4px solid #FF6B35", fontSize: 13, color: "#e65100", fontWeight: 500 }}>
                Un deal &quot;Devis à envoyer&quot; sera créé et vous serez redirigé vers sa page.
              </div>
            )}

            {rdvForm.status === "no_show" && (
              <div style={{ padding: "10px 14px", background: "#fde8e8", borderRadius: 8, borderLeft: "4px solid #e74c3c", fontSize: 13, color: "#c62828", fontWeight: 500 }}>
                Le prospect ne s&apos;est pas présenté au rendez-vous.
              </div>
            )}

            {/* Outcome text (visible in edit mode) */}
            {editingMeetingId && (
              <div className="space-y-2">
                <Label>Résumé / Outcome</Label>
                <Input
                  value={rdvForm.outcome}
                  onChange={(e) => setRdvForm({ ...rdvForm, outcome: e.target.value })}
                  placeholder="Résumé du résultat..."
                />
              </div>
            )}

            <Button
              onClick={handleSaveRdv}
              disabled={saving || !rdvForm.scheduled_at}
              className="w-full"
              style={{ background: "#FF6B35", color: "white" }}
            >
              {saving ? "Enregistrement..." : (editingMeetingId ? "Sauvegarder le RDV" : "Créer le RDV")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Email preview popup */}
      {emailPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEmailPreview(null); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "80vh" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1a2a3a" }}>{emailPreview.title}</span>
              <button onClick={() => setEmailPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(80vh - 60px)" }}>
              {emailPreview.description.includes("__EMAIL_HTML__") ? (
                <div dangerouslySetInnerHTML={{
                  __html: emailPreview.description.match(/__EMAIL_HTML__([\s\S]*?)__END_HTML__/)?.[1] ?? ""
                }} />
              ) : (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Arial, sans-serif", fontSize: 13, color: "#1a2a3a", lineHeight: 1.6 }}>
                  {emailPreview.description}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email composer popup */}
      {emailOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEmailOpen(false); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MailPlus className="h-4 w-4" style={{ color: "white" }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "white" }}>Nouvel email</span>
              </div>
              <button onClick={() => setEmailOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4, fontSize: 18 }}>✕</button>
            </div>

            {/* Email form */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }} className="space-y-3">
              {/* From */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5a6f80", padding: "8px 12px", background: "#f8fbfd", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#8399a9", minWidth: 30 }}>De :</span>
                <span style={{ fontWeight: 600, color: "#1a2a3a" }}>
                  {senderInfo ? `${senderInfo.first_name} ${senderInfo.last_name} <${senderInfo.email}>` : "Chargement..."}
                </span>
              </div>

              {/* To */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5a6f80", padding: "8px 12px", background: "#f8fbfd", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#8399a9", minWidth: 30 }}>À :</span>
                <span style={{ fontWeight: 600, color: "#1a2a3a" }}>
                  {contact.first_name} {contact.last_name} &lt;{contact.email}&gt;
                </span>
              </div>

              {/* Subject */}
              <input
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Objet"
                style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a", outline: "none" }}
              />

              {/* Body */}
              <textarea
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                placeholder="Écrivez votre message..."
                style={{ width: "100%", minHeight: 200, borderRadius: 8, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", lineHeight: 1.6, resize: "vertical", outline: "none" }}
              />
              <VoiceButton isRecording={emailBodyVoice.isRecording} isFormatting={emailBodyVoice.isFormatting} onClick={emailBodyVoice.toggleRecording} tone={emailBodyVoice.tone} onToneChange={emailBodyVoice.setTone} />

              {/* Signature preview */}
              {senderInfo && (
                <div style={{ padding: 12, background: "#f8fbfd", borderRadius: 8, overflow: "auto" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#8399a9", textTransform: "uppercase", marginBottom: 8 }}>Signature</div>
                  {senderInfo.email_signature ? (
                    <div dangerouslySetInnerHTML={{ __html: senderInfo.email_signature }} style={{ transform: "scale(0.7)", transformOrigin: "top left" }} />
                  ) : (
                    <div style={{ fontSize: 12, color: "#5a6f80" }}>
                      <strong style={{ color: "#1a2a3a" }}>{senderInfo.first_name} {senderInfo.last_name}</strong><br />
                      La Closing Académie ®<br />
                      {senderInfo.phone && <>📞 {senderInfo.phone}<br /></>}
                      ✉️ {senderInfo.email}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
              <button onClick={() => setEmailOpen(false)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!emailForm.subject.trim() || !emailForm.body.trim() || !contact.email) return;
                  setSendingEmail(true);
                  try {
                    const res = await fetch("/api/email/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: contact.email,
                        subject: emailForm.subject,
                        body: emailForm.body,
                        memberId: currentMemberId,
                        contactId: contact.id,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setEmailOpen(false);
                      setEmailForm({ subject: "", body: "" });
                      router.refresh();
                    } else {
                      alert(data.error || "Erreur lors de l'envoi");
                    }
                  } catch {
                    alert("Erreur réseau");
                  }
                  setSendingEmail(false);
                }}
                disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim() || !contact.email}
                style={{
                  height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer",
                  background: sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim() ? "#dce8f0" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                  color: "white", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <MailPlus className="h-3.5 w-3.5" />
                {sendingEmail ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openPlanId && <PlanPopup planId={openPlanId} onClose={() => setOpenPlanId(null)} />}
    </div>
  );
}
