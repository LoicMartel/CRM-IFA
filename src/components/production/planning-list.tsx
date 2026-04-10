"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, ChevronDown, ChevronRight, User, Phone, Mail, CalendarPlus, Trash2, Video, Building2, Pencil, X, HelpCircle, ArrowUpDown } from "lucide-react";
type PlanImportRow = Record<string, any>;
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { formatPhone } from "@/lib/utils";
import { PlanificateurModal } from "@/components/production/planificateur-modal";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type R = Record<string, unknown>;

interface SessionLearnerJoin {
  learner_id: string;
  learners: { id: string; first_name: string; last_name: string } | null;
}

interface TrainingSession {
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
  training_session_learners?: SessionLearnerJoin[];
}

const TRAINER_LIST_FALLBACK = ["Alexandre", "Rafi", "Iman", "Guillaume", "Loïc"];

interface LearnerNested {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: "ancien" | "actuel" | "futur";
}

interface ServicePlanLearnerJoin {
  learner_id: string;
  learners: LearnerNested | null;
}

interface ServicePlanRow {
  id: string;
  company_id: string;
  deal_id: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  program_id: string | null;
  training_type_id: string | null;
  format: string | null;
  mode: string | null;
  vt_planned: number | null;
  days_planned: number | null;
  hourly_rate: number | null;
  budget: number | null;
  budget_remaining: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  companies: { name: string; address?: string; city?: string } | null;
  training_programs: { name: string } | null;
  training_types: { name: string } | null;
  service_plan_learners: ServicePlanLearnerJoin[];
  training_sessions: TrainingSession[];
}

interface Program { id: string; name: string; }
interface TrainingType { id: string; name: string; }
interface CompanyContact { first_name: string; last_name: string; phone: string | null; email: string | null; }
interface CompanyRef { id: string; name: string; primary_contact_id: string | null; contacts: CompanyContact | CompanyContact[] | null; }
interface WonDeal { id: string; company_id: string; amount: number | null; name: string | null; }

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy", { locale: fr });
}

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
const formatColors: Record<string, { bg: string; text: string }> = {
  individuel: { bg: "#e8f0fe", text: "#0d4f7a" },
  collectif: { bg: "#f3e5f5", text: "#6a1b9a" },
  individuel_collectif: { bg: "#ede7f6", text: "#4a148c" },
};
const modeColors: Record<string, { bg: string; text: string }> = {
  presentiel: { bg: "#e8f5e9", text: "#2e7d32" },
  distanciel: { bg: "#fff3e0", text: "#e65100" },
  mixte: { bg: "#fce4ec", text: "#c62828" },
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: "#e8f0fe", text: "#0d4f7a", label: "Planifié" },
  done: { bg: "#e8f5e9", text: "#2e7d32", label: "Réalisé" },
  cancelled: { bg: "#fce4ec", text: "#c62828", label: "Annulé" },
  no_show: { bg: "#fff3e0", text: "#e65100", label: "No show" },
};

export function PlanningList({
  servicePlans,
  allLearners,
  programs,
  trainingTypes,
  companies,
  wonDeals,
  expertNames,
  expertMembers = [],
}: {
  servicePlans: ServicePlanRow[];
  allLearners: R[];
  programs: Program[];
  trainingTypes: TrainingType[];
  companies: CompanyRef[];
  wonDeals: WonDeal[];
  expertNames?: string[];
  expertMembers?: R[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly, onlyOwnData, firstName: currentFirstName, lastName: currentLastName, isAdmin } = useCurrentRoles();
  const canDeletePlan = isAdmin || (currentFirstName === "Iman" && currentLastName === "KHARBA");
  const TRAINER_LIST = expertNames && expertNames.length > 0 ? expertNames : TRAINER_LIST_FALLBACK;
  const [search, setSearch] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterTrainer, setFilterTrainer] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncPopup, setSyncPopup] = useState<{ sessionId: string; syncData: any } | null>(null);
  const [syncCopied, setSyncCopied] = useState(false);
  const [viewLearner, setViewLearner] = useState<{ id: string; first_name: string; last_name: string; email?: string; phone?: string; position?: string; status?: string; company_name?: string } | null>(null);
  const [loadingLearner, setLoadingLearner] = useState(false);

  async function openLearnerPopup(learnerId: string, firstName: string, lastName: string) {
    setViewLearner({ id: learnerId, first_name: firstName, last_name: lastName });
    setLoadingLearner(true);
    const supabase = createClient();
    const { data } = await supabase.from("learners").select("*, companies(name)").eq("id", learnerId).single();
    if (data) {
      setViewLearner({
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        position: data.position ?? undefined,
        status: data.status ?? undefined,
        company_name: (data.companies as any)?.name ?? undefined,
      });
    }
    setLoadingLearner(false);
  }
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);

  // Session add state
  const [sessionPlanId, setSessionPlanId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({ session_type: "vt" as "vt" | "journee", session_date: "", session_time: "09:00", duration_hours: "1", session_location: "", trainers: [] as string[], is_billable: true, notes: "", learner_ids: [] as string[] });
  const [savingSession, setSavingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const importQueue: PlanImportRow[] = [];
  const importIndex = 0;

  function getPrimaryContact(companyId: string): CompanyContact | null {
    const company = companies.find(c => c.id === companyId);
    if (!company?.contacts) return null;
    const ct = Array.isArray(company.contacts) ? company.contacts[0] : company.contacts;
    return ct ?? null;
  }

  function getCompanyLearners(companyId: string) {
    return allLearners.filter(l => l.company_id === companyId) as Array<{ id: string; first_name: string; last_name: string; status: string }>;
  }

  // Get won deals for a company that are NOT already linked to a plan (except the plan being edited)
  function getAvailableDeals(companyId: string, currentPlanId?: string | null) {
    const usedDealIds = new Set(servicePlans.filter(p => p.deal_id && p.id !== currentPlanId).map(p => p.deal_id));
    return wonDeals.filter(d => d.company_id === companyId && !usedDealIds.has(d.id));
  }

  const emptyForm = {
    company_id: "", deal_id: "",
    program_id: "", training_type_id: "", format: "individuel", mode: "distanciel",
    vt_planned: "", days_planned: "", hourly_rate: "",
    budget: "", start_date: "", end_date: "", notes: "",
  };

  function matchLearnersForCompany(learnerNames: string[], companyId: string): string[] {
    const companyLearners = getCompanyLearners(companyId);
    if (companyLearners.length === 0 || learnerNames.length === 0) return [];

    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-_,;]/g, " ").replace(/\s+/g, " ").trim();
    const words = (s: string) => norm(s).split(" ").filter(w => w.length > 1);
    const matched: string[] = [];

    for (const rawName of learnerNames) {
      const excelWords = words(rawName);
      if (excelWords.length === 0) continue;

      const match = companyLearners.find((l) => {
        const learnerWords = words(`${l.first_name} ${l.last_name}`);
        if (learnerWords.length === 0) return false;

        // Word-based matching: each word from Excel name must be found in learner words (or vice versa)
        const excelMatchesLearner = excelWords.every(ew => learnerWords.some(lw => lw === ew || lw.includes(ew) || ew.includes(lw)));
        const learnerMatchesExcel = learnerWords.every(lw => excelWords.some(ew => ew === lw || ew.includes(lw) || lw.includes(ew)));

        return excelMatchesLearner || learnerMatchesExcel;
      });

      if (match && !matched.includes(match.id)) {
        matched.push(match.id);
      }
    }

    return matched;
  }

  function prefillFormFromImport(plan: PlanImportRow, allPlans: PlanImportRow[]) {
    const companyId = plan.companyId ?? "";
    const deals = companyId ? getAvailableDeals(companyId) : [];
    const dealId = deals.length === 1 ? deals[0].id : "";
    const budget = dealId ? String(Number(deals.find(d => d.id === dealId)?.amount) || 0) : "";
    setForm({
      company_id: companyId,
      deal_id: dealId,
      program_id: "",
      training_type_id: "",
      format: plan.format,
      mode: plan.mode,
      vt_planned: String(plan.vtCount),
      days_planned: String(plan.journeeCount),
      hourly_rate: "",
      budget,
      start_date: plan.startDate ?? "",
      end_date: plan.endDate ?? "",
      notes: "",
    });
    // Collect learner names from ALL plans that map to the same company
    const allNamesForCompany = new Set<string>();
    for (const p of allPlans) {
      if (p.companyId === companyId) {
        (p.learnerNames as string[] ?? []).forEach((n: string) => allNamesForCompany.add(n));
      }
    }
    const matchedIds = companyId ? matchLearnersForCompany(Array.from(allNamesForCompany), companyId) : [];
    setSelectedLearnerIds(matchedIds);
    setEditingPlanId(null);
    setOpen(true);
  }

  function mergePlansByCompany(plans: PlanImportRow[]): PlanImportRow[] {
    const byCompany = new Map<string, PlanImportRow>();
    for (const p of plans) {
      const key = p.companyId ?? p.entreprise;
      if (!key) continue;
      const existing = byCompany.get(key);
      if (!existing) {
        byCompany.set(key, { ...p, learnerNames: [...p.learnerNames], matchedLearnerIds: [...p.matchedLearnerIds], formateurs: [...p.formateurs] });
      } else {
        // Merge sessions counts
        existing.sessionCount += p.sessionCount;
        existing.vtCount += p.vtCount;
        existing.journeeCount += p.journeeCount;
        existing.totalHours += p.totalHours;
        // Merge learner names (deduplicate)
        for (const n of p.learnerNames) {
          if (!existing.learnerNames.includes(n)) existing.learnerNames.push(n);
        }
        for (const id of p.matchedLearnerIds) {
          if (!existing.matchedLearnerIds.includes(id)) existing.matchedLearnerIds.push(id);
        }
        // Merge formateurs
        for (const f of p.formateurs) {
          if (!existing.formateurs.includes(f)) existing.formateurs.push(f);
        }
        // Extend date range
        if (p.startDate && (!existing.startDate || p.startDate < existing.startDate)) existing.startDate = p.startDate;
        if (p.endDate && (!existing.endDate || p.endDate > existing.endDate)) existing.endDate = p.endDate;
        // Update mode if mixed
        if (existing.vtCount > 0 && existing.journeeCount > 0) existing.mode = "mixte";
        // Update format
        if (existing.learnerNames.length > 1) existing.format = "collectif";
      }
    }
    return Array.from(byCompany.values());
  }

  function handleStartImport(_plans: PlanImportRow[]) {
    // Import functionality removed
  }
  const [form, setForm] = useState(emptyForm);
  const planNotesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));
  // Aide à la décision
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ expertise: "", city: "", days: "", budget: "" });

  // Planificateur
  const [planificateurOpen, setPlanificateurOpen] = useState(false);
  const [planificateurPlanId, setPlanificateurPlanId] = useState<string | null>(null);
  const [planificateurPrefill, setPlanificateurPrefill] = useState<any>(null);
  const [planificateurLearnerIds, setPlanificateurLearnerIds] = useState<string[]>([]);

  // Extract unique trainer names from all training sessions
  const allTrainerNames = Array.from(
    new Set(
      servicePlans.flatMap((p) =>
        (p.training_sessions ?? []).flatMap((s) => s.trainers ?? [])
      )
    )
  ).sort((a, b) => a.localeCompare(b, "fr"));

  // Extract unique company names for the company filter dropdown
  const allCompanyNames = Array.from(
    new Set(servicePlans.map((p) => p.companies?.name ?? "").filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "fr"));

  const filtered = servicePlans.filter((p) => {
    // Externes restreints : ne voir que les plans où ils sont impliqués
    if (onlyOwnData && currentFirstName) {
      const isInvolved = (p.training_sessions ?? []).some(
        (s) => (s.trainers ?? []).includes(currentFirstName)
      );
      if (!isInvolved) return false;
    }
    const companyName = p.companies?.name ?? "";
    if (search && !companyName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProgram && p.program_id !== filterProgram) return false;
    if (filterType && p.training_type_id !== filterType) return false;
    // Filter by trainer/expert
    if (filterTrainer) {
      const hasTrainer = (p.training_sessions ?? []).some(
        (s) => (s.trainers ?? []).includes(filterTrainer)
      );
      if (!hasTrainer) return false;
    }
    // Filter by company (exact match from dropdown)
    if (filterCompany && companyName !== filterCompany) return false;
    return true;
  }).sort((a, b) => {
    const nameA = (a.companies?.name ?? "").toLowerCase();
    const nameB = (b.companies?.name ?? "").toLowerCase();
    const cmp = nameA.localeCompare(nameB, "fr");
    return sortDirection === "asc" ? cmp : -cmp;
  });

  // KPIs based on filtered plans
  const filteredSessions = filtered.flatMap((p) => p.training_sessions ?? []);
  const kpiPlansCount = filtered.length;
  const kpiVtDone = filteredSessions.filter((s) => s.session_type === "vt" && (s.status === "done" || s.status === "no_show")).length;
  const kpiVtTotal = filtered.reduce((s, p) => s + (Number(p.vt_planned) || 0), 0);
  const kpiDaysDone = filteredSessions.filter((s) => s.session_type === "journee" && (s.status === "done" || s.status === "no_show")).length;
  const kpiDaysTotal = filtered.reduce((s, p) => s + (Number(p.days_planned) || 0), 0);
  const kpiLearners = new Set(
    filtered.flatMap((p) => (p.service_plan_learners ?? []).map((spl) => spl.learner_id))
  ).size;
  const trainerMemberId = filterTrainer ? (expertMembers.find((m) => (m as any).first_name === filterTrainer) as any)?.id ?? null : null;
  const kpiLearnersActuel = allLearners.filter((l) =>
    l.status === "actuel" && (!trainerMemberId || l.expert_id === trainerMemberId)
  ).length;
  const kpiBudget = filtered.reduce((s, p) => s + (Number(p.budget) || 0), 0);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openEditPlan(plan: ServicePlanRow) {
    setEditingPlanId(plan.id);
    const existingLearnerIds = (plan.service_plan_learners ?? []).map(spl => spl.learner_id);
    setSelectedLearnerIds(existingLearnerIds);
    setForm({
      company_id: plan.company_id,
      deal_id: plan.deal_id ?? "",
      program_id: plan.program_id ?? "",
      training_type_id: plan.training_type_id ?? "",
      format: plan.format ?? "individuel",
      mode: plan.mode ?? "distanciel",
      vt_planned: String(plan.vt_planned ?? 0),
      days_planned: String(plan.days_planned ?? 0),
      hourly_rate: plan.hourly_rate != null ? String(plan.hourly_rate) : "",
      budget: plan.budget != null ? String(plan.budget) : "",
      start_date: plan.start_date ?? "",
      end_date: plan.end_date ?? "",
      notes: plan.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const pc = getPrimaryContact(form.company_id);
    const payload = {
      company_id: form.company_id,
      deal_id: form.deal_id || null,
      manager_name: pc ? `${pc.first_name} ${pc.last_name}` : null,
      manager_phone: pc?.phone || null,
      manager_email: pc?.email || null,
      program_id: form.program_id || null,
      training_type_id: form.training_type_id || null,
      format: form.format || "individuel",
      mode: form.mode || "distanciel",
      vt_planned: form.vt_planned ? parseInt(form.vt_planned) : 0,
      days_planned: form.days_planned ? parseInt(form.days_planned) : 0,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate.replace(",", ".")) : 0,
      budget: form.budget ? parseFloat(form.budget.replace(",", ".")) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
    };

    let planId = editingPlanId;
    if (editingPlanId) {
      await supabase.from("service_plans").update(payload).eq("id", editingPlanId);
    } else {
      const { data: newPlan } = await supabase.from("service_plans").insert(payload).select("id").single();
      planId = newPlan?.id ?? null;
    }

    // Sync learner assignments
    if (planId) {
      await supabase.from("service_plan_learners").delete().eq("service_plan_id", planId);
      if (selectedLearnerIds.length > 0) {
        await supabase.from("service_plan_learners").insert(
          selectedLearnerIds.map(lid => ({ service_plan_id: planId!, learner_id: lid }))
        );
      }
    }

    setSaving(false);


    setOpen(false);
    setEditingPlanId(null);
    setSelectedLearnerIds([]);
    setForm(emptyForm);
    router.refresh();
  }

  async function handleAddSession() {
    if (!sessionPlanId || !sessionForm.session_date) return;
    setSavingSession(true);
    const supabase = createClient();

    const payload = {
      service_plan_id: sessionPlanId,
      session_type: sessionForm.session_type,
      session_date: sessionForm.session_date,
      session_time: sessionForm.session_time,
      session_location: sessionForm.session_type === "journee" ? (sessionForm.session_location || null) : null,
      duration_hours: sessionForm.duration_hours ? parseFloat(sessionForm.duration_hours) : 1,
      trainers: sessionForm.trainers.length > 0 ? sessionForm.trainers : null,
      is_billable: sessionForm.is_billable,
      notes: sessionForm.notes || null,
    };

    if (editingSessionId) {
      // Update existing session
      await supabase.from("training_sessions").update(payload).eq("id", editingSessionId);
      // Sync learners
      await supabase.from("training_session_learners").delete().eq("training_session_id", editingSessionId);
      if (sessionForm.learner_ids.length > 0) {
        await supabase.from("training_session_learners").insert(
          sessionForm.learner_ids.map(lid => ({ training_session_id: editingSessionId!, learner_id: lid }))
        );
      }
      // Sync: update Google Calendar + notify expert & learners
      try {
        const notifyRes = await fetch("/api/gcal/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: editingSessionId, isUpdate: true }),
        });
        const notifyData = await notifyRes.json();
        if (notifyData.success) {
          setSyncPopup({ sessionId: editingSessionId, syncData: { title: notifyData.title, results: notifyData.results } });
        }
      } catch (e) { /* silently fail */ }
    } else {
      // Insert new session
      const { data: newSession } = await supabase.from("training_sessions").insert({
        ...payload,
        status: "planned",
      }).select("id").single();

      if (newSession && sessionForm.learner_ids.length > 0) {
        await supabase.from("training_session_learners").insert(
          sessionForm.learner_ids.map(lid => ({ training_session_id: newSession.id, learner_id: lid }))
        );
      }

      // Auto-sync: Google Calendar + Slack + Email
      if (newSession) {
        try {
          const notifyRes = await fetch("/api/gcal/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: newSession.id }),
          });
          const notifyData = await notifyRes.json();
          if (notifyData.success) {
            setSyncPopup({ sessionId: newSession.id, syncData: { title: notifyData.title, results: notifyData.results } });
          }
        } catch (e) { /* silently fail */ }
      }
    }

    setSavingSession(false);
    setSessionPlanId(null);
    setEditingSessionId(null);
    setSessionForm({ session_type: "vt", session_date: "", session_time: "09:00", duration_hours: "1", session_location: "", trainers: [] as string[], is_billable: true, notes: "", learner_ids: [] });
    router.refresh();
  }

  function openEditSession(s: TrainingSession, planId: string) {
    setSessionPlanId(planId);
    setEditingSessionId(s.id);
    const existingLearnerIds = (s.training_session_learners ?? []).map(sl => sl.learner_id);
    setSessionForm({
      session_type: s.session_type,
      session_date: s.session_date,
      session_time: (s as any).session_time ? String((s as any).session_time).slice(0, 5) : "09:00",
      session_location: (s as any).session_location ?? "",
      duration_hours: String(Number(s.duration_hours) || 1),
      trainers: s.trainers ?? [],
      is_billable: s.is_billable ?? true,
      notes: s.notes ?? "",
      learner_ids: existingLearnerIds,
    });
  }

  // Notes popup state
  const [notesPopup, setNotesPopup] = useState<{ sessionId: string; notes: string } | null>(null);
  const sessionNotesVoice = useVoiceDictation(
    () => notesPopup?.notes ?? "",
    (t) => setNotesPopup(prev => prev ? { ...prev, notes: t } : null),
  );

  function openNotesPopup(s: TrainingSession) {
    setNotesPopup({ sessionId: s.id, notes: s.notes ?? "" });
  }

  async function saveNotes() {
    if (!notesPopup) return;
    const supabase = createClient();
    await supabase.from("training_sessions").update({ notes: notesPopup.notes || null }).eq("id", notesPopup.sessionId);
    setNotesPopup(null);
    sessionNotesVoice.stopRecording();
    router.refresh();
  }

  function stopRecording() {
    sessionNotesVoice.stopRecording();
  }

  async function handleSessionStatus(sessionId: string, newStatus: string) {
    // Update local state immediately so the select reflects the change
    setLocalStatuses(prev => ({ ...prev, [sessionId]: newStatus }));
    const supabase = createClient();
    await supabase.from("training_sessions").update({ status: newStatus }).eq("id", sessionId);

    // Check if all sessions of this plan are done → company becomes "former_customer"
    if (newStatus === "done") {
      // Find which plan this session belongs to
      const session = servicePlans.flatMap(p =>
        (p.training_sessions ?? []).map((s: any) => ({ ...s, plan: p }))
      ).find((s: any) => s.id === sessionId);

      if (session) {
        const plan = session.plan;
        const allSessions = (plan.training_sessions ?? []) as any[];
        // Check if all non-cancelled sessions are now done (the current one is being set to done)
        const allDone = allSessions.every((s: any) =>
          s.id === sessionId ? true : s.status === "done" || s.status === "cancelled"
        );
        if (allDone && allSessions.filter((s: any) => s.status !== "cancelled" || s.id === sessionId).length > 0) {
          const companyId = plan.company_id;
          if (companyId) {
            // Check if the company has other active plans with remaining sessions
            const otherPlans = servicePlans.filter(p => p.company_id === companyId && p.id !== plan.id);
            const hasActivePlan = otherPlans.some(p => {
              const pSessions = (p.training_sessions ?? []) as any[];
              return pSessions.some((s: any) => s.status === "planned");
            });
            if (!hasActivePlan) {
              await supabase.from("companies").update({ lifecycle_stage: "former_customer" }).eq("id", companyId);
              // Uncheck is_client + pass contacts to former_customer
              await supabase.from("contacts").update({ is_client: false, lifecycle_stage: "former_customer" }).eq("company_id", companyId);
            }
          }
        }
      }
    }

    // Notify Iman on Slack when a session is cancelled
    if (newStatus === "cancelled") {
      try {
        const session = servicePlans.flatMap(p =>
          (p.training_sessions ?? []).map((s: any) => ({ ...s, plan: p }))
        ).find((s: any) => s.id === sessionId);
        if (session) {
          const companyName = session.plan?.companies?.name ?? "—";
          const sessionDate = session.session_date ? new Date(session.session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
          const sessionType = session.session_type === "journee" ? "Journée" : "VT";
          const duration = session.duration_hours ? `${Number(session.duration_hours).toFixed(0)}h` : "";
          const trainers = (session.trainers ?? []).join(", ");
          await fetch("/api/slack/notify-cancelled", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, sessionDate, sessionType, duration, trainers, notes: session.notes ?? "" }),
          });
        }
      } catch {}
    }

    // Sync learner statuses (futur → actuel, actuel → ancien)
    try { await fetch("/api/learners/sync-status"); } catch {}
    // Sync to delivery sessions table
    try { await fetch("/api/sessions/sync-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingSessionId: sessionId }) }); } catch {}

    router.refresh();
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer cette session ?")) return;
    const supabase = createClient();
    await supabase.from("training_sessions").delete().eq("id", sessionId);
    router.refresh();
  }

  function fmtEuro(n: number) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  }

  return (
    <>
      {/* KPI cards */}
      <div className="grid gap-3 md:grid-cols-5" style={{ marginBottom: 16 }}>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Plans de formation</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{kpiPlansCount}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>VT (réalisées / total)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{kpiVtDone} / {kpiVtTotal}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Journées (réalisées / total)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{kpiDaysDone} / {kpiDaysTotal}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Apprenants actuels</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#2ecc71" }}>{kpiLearnersActuel}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Budget total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmtEuro(kpiBudget)}</div>
        </div>
      </div>

      {/* Filters + new plan button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div className="relative" style={{ flex: "0 1 240px", minWidth: 180 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#8399a9" }} />
          <input
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", paddingLeft: 36, paddingRight: 12, fontSize: 13, width: "100%", color: "#1a2a3a" }}
          />
        </div>
        <select
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
          value={filterProgram}
          onChange={(e) => setFilterProgram(e.target.value)}
        >
          <option value="">Tous les parcours</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Tous les types</option>
          {trainingTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
          value={filterTrainer}
          onChange={(e) => setFilterTrainer(e.target.value)}
        >
          <option value="">Tous les experts</option>
          {allTrainerNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
        >
          <option value="">Toutes les entreprises</option>
          {allCompanyNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button
          onClick={() => setSortDirection((d) => d === "asc" ? "desc" : "asc")}
          title={sortDirection === "asc" ? "Tri A → Z" : "Tri Z → A"}
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortDirection === "asc" ? "A → Z" : "Z → A"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setDecisionOpen(true)}
          style={{ height: 38, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, border: "2px solid #1a6b9c", cursor: "pointer", background: "white", color: "#1a6b9c", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <HelpCircle className="h-4 w-4" />
          Aide Décision
        </button>
        <button
          onClick={() => { setPlanificateurPlanId(null); setPlanificateurPrefill(null); setPlanificateurLearnerIds([]); setPlanificateurOpen(true); }}
          style={{ height: 38, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, border: "2px solid #27ae60", cursor: "pointer", background: "white", color: "#27ae60", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <CalendarPlus className="h-4 w-4" />
          Planificateur
        </button>
        <button
          onClick={() => { setEditingPlanId(null); setForm(emptyForm); setSelectedLearnerIds([]); setOpen(true); }}
          style={{ height: 38, borderRadius: 8, background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 14px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <Plus className="h-4 w-4" />
          Nouveau plan de formation
        </button>
      </div>

      <div style={{ fontSize: 13, color: "#8399a9" }}>
        {filtered.length} plan{filtered.length > 1 ? "s" : ""} sur {servicePlans.length}
      </div>

      {/* Plans list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8399a9", padding: 32 }}>Aucun plan de formation trouvé</div>
        ) : filtered.map((plan) => {
          const isExpanded = expandedIds.has(plan.id);
          const planLearners = (plan.service_plan_learners ?? []).map((spl) => spl.learners).filter(Boolean) as LearnerNested[];
          const sessions = (plan.training_sessions ?? []) as TrainingSession[];

          const vtDone = sessions.filter(s => s.session_type === "vt" && (s.status === "done" || s.status === "no_show")).length;
          const vtPlanned = sessions.filter(s => s.session_type === "vt" && s.status === "planned").length;
          const vtTotal = plan.vt_planned ?? 0;
          const vtRemaining = Math.max(0, vtTotal - vtDone - vtPlanned);

          const daysDone = sessions.filter(s => s.session_type === "journee" && (s.status === "done" || s.status === "no_show")).length;
          const daysPlannedCount = sessions.filter(s => s.session_type === "journee" && s.status === "planned").length;
          const daysTotal = plan.days_planned ?? 0;
          const daysRemaining = Math.max(0, daysTotal - daysDone - daysPlannedCount);

          const vtPct = vtTotal > 0 ? Math.round((vtDone / vtTotal) * 100) : 0;
          const daysPct = daysTotal > 0 ? Math.round((daysDone / daysTotal) * 100) : 0;

          const hourlyRate = Number(plan.hourly_rate) || 0;
          const billableDone = sessions.filter(s => (s.status === "done" || s.status === "no_show") && s.is_billable !== false);
          const billablePlanned = sessions.filter(s => s.status === "planned" && s.is_billable !== false);
          const totalHoursDone = billableDone.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0);
          const totalHoursPlanned = billablePlanned.reduce((s, sess) => s + (Number(sess.duration_hours) || 0), 0);
          const consumedAmount = totalHoursDone * hourlyRate;
          const plannedAmount = totalHoursPlanned * hourlyRate;
          const budgetInitial = Number(plan.budget) || 0;
          const budgetRemaining = budgetInitial - consumedAmount;

          const fmtColor = formatColors[plan.format ?? ""] ?? { bg: "#f0f0f0", text: "#555" };
          const mdColor = modeColors[plan.mode ?? ""] ?? { bg: "#f0f0f0", text: "#555" };

          return (
            <div key={plan.id} className="lca-card" style={{ overflow: "hidden" }}>
              {/* Header */}
              <div
                className="cursor-pointer"
                onClick={() => toggleExpand(plan.id)}
                style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {isExpanded ? <ChevronDown className="h-5 w-5" style={{ color: "#8399a9" }} /> : <ChevronRight className="h-5 w-5" style={{ color: "#8399a9" }} />}
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#1a2a3a" }}>{plan.companies?.name ?? "—"}</span>
                  {plan.training_programs?.name && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#e8f0fe", color: "#0d4f7a" }}>{plan.training_programs.name}</span>
                  )}
                  {plan.training_types?.name && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#f5f5f5", color: "#555" }}>{plan.training_types.name}</span>
                  )}
                  <span style={{ ...fmtColor, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: fmtColor.bg, color: fmtColor.text }}>
                    {formatLabels[plan.format ?? ""] ?? "—"}
                  </span>
                  <span style={{ ...mdColor, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: mdColor.bg, color: mdColor.text }}>
                    {modeLabels[plan.mode ?? ""] ?? "—"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#5a6f80" }}>
                  <span>{planLearners.length} apprenant{planLearners.length > 1 ? "s" : ""}</span>
                  <span style={{ fontWeight: 700, color: "#1a6b9c" }}>VT {vtDone}/{vtTotal}</span>
                  <span style={{ fontWeight: 700, color: "#FF6B35" }}>J {daysDone}/{daysTotal}</span>
                  {plan.budget != null && <span style={{ fontWeight: 700, color: "#1a2a3a" }}>{fmt(Number(plan.budget))}</span>}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid #e8ecf1", padding: "16px 18px" }} className="space-y-5">
                  {/* Edit button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    {canDeletePlan && <button
                      onClick={async () => {
                        if (!window.confirm(`Supprimer le plan de formation de ${plan.companies?.name ?? "cette entreprise"} et toutes ses sessions ? Cette action est irréversible.`)) return;
                        const supabase = createClient();
                        await supabase.from("training_session_learners").delete().in("training_session_id", (plan.training_sessions ?? []).map(s => s.id));
                        await supabase.from("training_sessions").delete().eq("service_plan_id", plan.id);
                        await supabase.from("service_plan_learners").delete().eq("service_plan_id", plan.id);
                        await supabase.from("service_plans").delete().eq("id", plan.id);
                        router.refresh();
                      }}
                      style={{ height: 32, borderRadius: 6, background: "#fde8e8", color: "#c62828", fontSize: 12, fontWeight: 600, padding: "0 14px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer le plan
                    </button>}
                    {!isRestrictedExterne && !isReadOnly && <button
                      onClick={() => openEditPlan(plan)}
                      style={{ height: 32, borderRadius: 6, background: "#e8f0fe", color: "#0d4f7a", fontSize: 12, fontWeight: 600, padding: "0 14px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Modifier le plan
                    </button>}
                  </div>

                  {/* Counters */}
                  <div className="grid gap-3 md:grid-cols-2">
                    {/* VT Counter */}
                    <div style={{ background: "#f8fbfd", borderRadius: 10, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Video className="h-4 w-4" style={{ color: "#1a6b9c" }} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#1a2a3a" }}>Visio Training (VT)</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 16, color: "#1a6b9c" }}>{vtDone} / {vtTotal}</span>
                      </div>
                      <div style={{ height: 8, background: "#e8ecf1", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${vtPct}%`, background: "#1a6b9c", borderRadius: 4, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#5a6f80" }}>
                        <span>Réalisées : <strong style={{ color: "#2ecc71" }}>{vtDone}</strong></span>
                        <span>Planifiées : <strong style={{ color: "#1a6b9c" }}>{vtPlanned}</strong></span>
                        <span>Restantes : <strong style={{ color: vtRemaining > 0 ? "#e74c3c" : "#2ecc71" }}>{vtRemaining}</strong></span>
                      </div>
                    </div>

                    {/* Days Counter */}
                    <div style={{ background: "#fdf8f5", borderRadius: 10, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Building2 className="h-4 w-4" style={{ color: "#FF6B35" }} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#1a2a3a" }}>Journées</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 16, color: "#FF6B35" }}>{daysDone} / {daysTotal}</span>
                      </div>
                      <div style={{ height: 8, background: "#e8ecf1", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${daysPct}%`, background: "#FF6B35", borderRadius: 4, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#5a6f80" }}>
                        <span>Réalisées : <strong style={{ color: "#2ecc71" }}>{daysDone}</strong></span>
                        <span>Planifiées : <strong style={{ color: "#FF6B35" }}>{daysPlannedCount}</strong></span>
                        <span>Restantes : <strong style={{ color: daysRemaining > 0 ? "#e74c3c" : "#2ecc71" }}>{daysRemaining}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Contact principal</div>
                      {(() => {
                        const pc = getPrimaryContact(plan.company_id);
                        if (pc) return (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a2a3a" }}><User className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{pc.first_name} {pc.last_name}</div>
                            {pc.phone && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#5a6f80" }}><Phone className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{formatPhone(pc.phone)}</div>}
                            {pc.email && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#5a6f80" }}><Mail className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{pc.email}</div>}
                          </>
                        );
                        // Fallback to stored manager data
                        if (plan.manager_name) return (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a2a3a" }}><User className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{plan.manager_name}</div>
                            {plan.manager_phone && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#5a6f80" }}><Phone className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{formatPhone(plan.manager_phone)}</div>}
                            {plan.manager_email && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#5a6f80" }}><Mail className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{plan.manager_email}</div>}
                          </>
                        );
                        return <div style={{ color: "#8399a9" }}>—</div>;
                      })()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Budget</div>
                      <div style={{ fontWeight: 800, color: "#27ae60", fontSize: 16 }}>{plan.budget != null ? fmt(Number(plan.budget)) : "—"}</div>
                      {(() => {
                        const deal = plan.deal_id ? wonDeals.find(d => d.id === plan.deal_id) : null;
                        return deal ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: "#5a6f80" }}>Deal : {deal.name || "—"}</div>
                        ) : null;
                      })()}
                      {hourlyRate > 0 && (
                        <div style={{ marginTop: 6, fontSize: 13, color: "#1a2a3a" }}>
                          Taux horaire : <strong>{hourlyRate.toFixed(2)} €/h</strong>
                        </div>
                      )}
                    </div>
                    {/* Budget restant */}
                    {budgetInitial > 0 && hourlyRate > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Budget restant</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: budgetRemaining >= 0 ? "#27ae60" : "#e74c3c" }}>
                          {fmt(budgetRemaining)}
                        </div>
                        <div style={{ fontSize: 12, color: "#5a6f80", marginTop: 4 }}>
                          <div>Consommé : <strong style={{ color: "#1a2a3a" }}>{fmt(consumedAmount)}</strong> ({totalHoursDone}h réalisées)</div>
                          <div>Engagé : <strong style={{ color: "#FF6B35" }}>{fmt(plannedAmount)}</strong> ({totalHoursPlanned}h planifiées)</div>
                          <div style={{ marginTop: 4, borderTop: "1px solid #e8ecf1", paddingTop: 4 }}>
                            Après planifié : <strong style={{ color: (budgetRemaining - plannedAmount) >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(budgetRemaining - plannedAmount)}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: "#8399a9", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Période</div>
                      <div style={{ color: "#1a2a3a" }}>Du {formatDate(plan.start_date)} au {formatDate(plan.end_date)}</div>
                      {plan.notes && <div style={{ color: "#8399a9", marginTop: 4, fontStyle: "italic" }}>{plan.notes}</div>}
                    </div>
                  </div>

                  {/* Sessions */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 14 }}>Sessions planifiées</span>
                      {!isRestrictedExterne && !isReadOnly && (<>
                      <button
                        onClick={() => { setSessionPlanId(plan.id); setEditingSessionId(null); setSessionForm({ session_type: "vt", session_date: "", session_time: "09:00", duration_hours: "1", session_location: "", trainers: [] as string[], is_billable: true, notes: "", learner_ids: [] }); }}
                        style={{ height: 32, borderRadius: 6, background: "#1a6b9c", color: "white", fontSize: 12, fontWeight: 600, padding: "0 14px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" /> Ajouter une session
                      </button>
                      </>)}
                    </div>

                    {/* Session form is now rendered as a popup modal outside the plan loop */}
                    {false && sessionPlanId === plan.id && (
                      <div style={{ background: "#f8fbfd", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Type</div>
                            <select
                              value={sessionForm.session_type}
                              onChange={(e) => {
                                const t = e.target.value as "vt" | "journee";
                                const compAddr = plan.companies ? [plan.companies.address, plan.companies.city].filter(Boolean).join(", ") : "";
                                setSessionForm({ ...sessionForm, session_type: t, duration_hours: t === "journee" ? "8" : "1", session_time: t === "journee" ? "09:00" : "09:00", session_location: t === "journee" ? compAddr : "" });
                              }}
                              style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
                            >
                              <option value="vt">Visio Training (VT)</option>
                              <option value="journee">Journée</option>
                            </select>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Date</div>
                            <input
                              type="date"
                              value={sessionForm.session_date}
                              onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })}
                              style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Heure</div>
                            <input
                              type="time"
                              value={sessionForm.session_time}
                              onChange={(e) => setSessionForm({ ...sessionForm, session_time: e.target.value })}
                              style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Durée</div>
                            {sessionForm.session_type === "journee" ? (
                              <div style={{ height: 34, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#1a2a3a", padding: "0 10px", background: "#f0f0f0", borderRadius: 6, border: "1px solid #dce8f0" }}>
                                8h (journée)
                              </div>
                            ) : (
                              <select
                                value={sessionForm.duration_hours}
                                onChange={(e) => setSessionForm({ ...sessionForm, duration_hours: e.target.value })}
                                style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
                              >
                                <option value="1">1h</option>
                                <option value="1.5">1h30</option>
                                <option value="2">2h</option>
                                <option value="3">3h</option>
                              </select>
                            )}
                          </div>
                        </div>
                        {sessionForm.session_type === "journee" && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>📍 Adresse du lieu de formation</div>
                            <input
                              type="text"
                              value={sessionForm.session_location}
                              onChange={(e) => setSessionForm({ ...sessionForm, session_location: e.target.value })}
                              placeholder="Ex: 6 rue Elisée Reclus, Merignac"
                              style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", width: "100%" }}
                            />
                          </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 10 }}>
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Notes</div>
                            <input
                              type="text"
                              value={sessionForm.notes}
                              onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                              placeholder="Notes (optionnel)"
                              style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", width: "100%" }}
                            />
                          </div>
                        </div>
                        {/* Learner selection */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 6 }}>Apprenants</div>
                          {planLearners.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {planLearners.map(l => {
                                const checked = sessionForm.learner_ids.includes(l.id);
                                return (
                                  <label
                                    key={l.id}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
                                      padding: "4px 10px", borderRadius: 6,
                                      background: checked ? "#e8f0fe" : "white",
                                      border: `1px solid ${checked ? "#1a6b9c" : "#dce8f0"}`,
                                      color: checked ? "#0d4f7a" : "#5a6f80",
                                      fontWeight: checked ? 600 : 400,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const ids = e.target.checked
                                          ? [...sessionForm.learner_ids, l.id]
                                          : sessionForm.learner_ids.filter(id => id !== l.id);
                                        setSessionForm({ ...sessionForm, learner_ids: ids });
                                      }}
                                      style={{ accentColor: "#1a6b9c" }}
                                    />
                                    {l.first_name} {l.last_name}
                                  </label>
                                );
                              })}
                              <button
                                onClick={() => {
                                  const allIds = planLearners.map(l => l.id);
                                  const allSelected = allIds.every(id => sessionForm.learner_ids.includes(id));
                                  setSessionForm({ ...sessionForm, learner_ids: allSelected ? [] : allIds });
                                }}
                                style={{ fontSize: 11, fontWeight: 600, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: "4px 6px" }}
                              >
                                {planLearners.every(l => sessionForm.learner_ids.includes(l.id)) ? "Tout désélectionner" : "Tout sélectionner"}
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#e65100", fontStyle: "italic" }}>Aucun apprenant assigné à ce plan</div>
                          )}
                        </div>
                        {/* Trainer selection */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 6 }}>Expert(s)</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {TRAINER_LIST.map(t => {
                              const checked = sessionForm.trainers.includes(t);
                              return (
                                <label
                                  key={t}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
                                    padding: "4px 10px", borderRadius: 6,
                                    background: checked ? "#fff3e0" : "white",
                                    border: `1px solid ${checked ? "#FF6B35" : "#dce8f0"}`,
                                    color: checked ? "#e65100" : "#5a6f80",
                                    fontWeight: checked ? 600 : 400,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const trainers = e.target.checked
                                        ? [...sessionForm.trainers, t]
                                        : sessionForm.trainers.filter(x => x !== t);
                                      setSessionForm({ ...sessionForm, trainers });
                                    }}
                                    style={{ accentColor: "#FF6B35" }}
                                  />
                                  {t}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        {/* Billable toggle */}
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={sessionForm.is_billable}
                              onChange={(e) => setSessionForm({ ...sessionForm, is_billable: e.target.checked })}
                              style={{ accentColor: "#27ae60" }}
                            />
                            <span style={{ fontWeight: sessionForm.is_billable ? 600 : 400, color: sessionForm.is_billable ? "#27ae60" : "#8399a9" }}>
                              {sessionForm.is_billable ? "Facturable" : "Non facturable"}
                            </span>
                          </label>
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                          <button
                            onClick={handleAddSession}
                            disabled={savingSession || !sessionForm.session_date}
                            style={{ height: 34, borderRadius: 6, background: editingSessionId ? "#1a6b9c" : "#2ecc71", color: "white", fontSize: 12, fontWeight: 700, padding: "0 16px", border: "none", cursor: "pointer", opacity: savingSession || !sessionForm.session_date ? 0.5 : 1 }}
                          >
                            {savingSession ? "..." : editingSessionId ? "Mettre à jour" : "Ajouter"}
                          </button>
                          <button
                            onClick={() => setSessionPlanId(null)}
                            style={{ height: 34, borderRadius: 6, background: "#e8ecf1", color: "#5a6f80", fontSize: 12, fontWeight: 600, padding: "0 14px", border: "none", cursor: "pointer" }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}

                    {sessions.length > 0 ? (
                      <div style={{ borderRadius: 8, border: "1px solid #e8ecf1", overflowX: "auto" }}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Type</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Durée</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Expert(s)</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Apprenants</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Statut</TableHead>
                              {hourlyRate > 0 && <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>}
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, maxWidth: 150 }}>Notes</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sessions
                              .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
                              .map((s) => {
                                const effectiveStatus = localStatuses[s.id] ?? s.status;
                                const sc = statusColors[effectiveStatus] ?? statusColors.planned;
                                return (
                                  <TableRow key={s.id}>
                                    <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>{(() => {
                                      const d = new Date(s.session_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                                      if (!s.session_time) return d;
                                      const t = String(s.session_time).slice(0, 5);
                                      const [h, m] = t.split(":");
                                      return `${d} à ${h}h${m === "00" ? "" : m}`;
                                    })()}</TableCell>
                                    <TableCell>
                                      <span style={{
                                        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                                        background: s.session_type === "vt" ? "#e8f0fe" : "#fff3e0",
                                        color: s.session_type === "vt" ? "#1a6b9c" : "#FF6B35",
                                      }}>
                                        {s.session_type === "vt" ? "VT" : "Journée"}
                                      </span>
                                    </TableCell>
                                    <TableCell style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{Number(s.duration_hours) || 0}h</TableCell>
                                    <TableCell style={{ fontSize: 12 }}>
                                      {(s.trainers && s.trainers.length > 0) ? (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                          {s.trainers.map(t => (
                                            <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10, background: "#fff3e0", color: "#e65100" }}>{t}</span>
                                          ))}
                                        </div>
                                      ) : <span style={{ color: "#ccc" }}>—</span>}
                                    </TableCell>
                                    <TableCell style={{ fontSize: 12 }}>
                                      {(() => {
                                        const sLearners = (s.training_session_learners ?? []).map(sl => sl.learners).filter(Boolean);
                                        if (sLearners.length === 0) return <span style={{ color: "#ccc" }}>—</span>;
                                        return (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {sLearners.map(l => (
                                              <span
                                                key={l!.id}
                                                onClick={(e) => { e.stopPropagation(); openLearnerPopup(l!.id, l!.first_name, l!.last_name); }}
                                                style={{ fontSize: 12, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                                              >
                                                {l!.first_name} {l!.last_name}
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </TableCell>
                                    <TableCell>
                                      <select
                                        value={effectiveStatus}
                                        onChange={(e) => handleSessionStatus(s.id, e.target.value)}
                                        style={{
                                          height: 28, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px",
                                          fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.text, cursor: "pointer",
                                        }}
                                      >
                                        <option value="planned">Planifié</option>
                                        <option value="done">Réalisé</option>
                                        <option value="cancelled">Annulé</option>
                                        <option value="no_show">No show</option>
                                      </select>
                                    </TableCell>
                                    {hourlyRate > 0 && (
                                      <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: s.is_billable === false ? "#ccc" : s.status === "done" ? "#1a2a3a" : "#8399a9" }}>
                                        {s.is_billable === false ? (
                                          <span style={{ fontWeight: 400, fontStyle: "italic", color: "#999" }}>Non fact.</span>
                                        ) : fmt((Number(s.duration_hours) || 0) * hourlyRate)}
                                      </TableCell>
                                    )}
                                    <TableCell
                                      onClick={() => openNotesPopup(s)}
                                      style={{ color: "#5a6f80", fontSize: 12, cursor: "pointer", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}
                                      title={s.notes || "Cliquer pour éditer les notes"}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 150 }}>
                                        {!s.is_billable && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: "#f5f5f5", color: "#999", flexShrink: 0 }}>NF</span>}
                                        <span style={{ borderBottom: "1px dashed #ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.notes || "Ajouter une note..."}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                          {!isRestrictedExterne && !isReadOnly && <>
                                          <button
                                          onClick={() => openEditSession(s, plan.id)}
                                          style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }}
                                          title="Modifier"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSession(s.id)}
                                          style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}
                                          title="Supprimer"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                          </>}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", color: "#8399a9", padding: 16, fontStyle: "italic", fontSize: 13 }}>
                        Aucune session planifiée
                      </div>
                    )}
                  </div>

                  {/* Learners */}
                  {planLearners.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 14, marginBottom: 10 }}>Apprenants assignés</div>
                      <div style={{ borderRadius: 8, border: "1px solid #e8ecf1", overflowX: "auto" }}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Nom</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Email</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Téléphone</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Poste</TableHead>
                              <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {planLearners.map((l) => (
                              <TableRow key={l.id}>
                                <TableCell>
                                  <span
                                    onClick={() => openLearnerPopup(l.id, l.first_name, l.last_name)}
                                    style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                                  >
                                    {l.first_name} {l.last_name}
                                  </span>
                                </TableCell>
                                <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{l.email ?? "—"}</TableCell>
                                <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{formatPhone(l.phone)}</TableCell>
                                <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{l.position ?? "—"}</TableCell>
                                <TableCell>
                                  <span style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                                    background: l.status === "actuel" ? "#e8f5e9" : l.status === "futur" ? "#e8f0fe" : "#f5f5f5",
                                    color: l.status === "actuel" ? "#2e7d32" : l.status === "futur" ? "#0d4f7a" : "#777",
                                  }}>
                                    {l.status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sheet: Nouveau plan de formation */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingPlanId ? "Modifier le plan de formation" : importQueue.length > 0
                ? `Import plan ${importIndex + 1} / ${importQueue.length} — ${importQueue[importIndex]?.entreprise ?? ""}`
                : "Nouveau plan de formation"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 pb-4">
            {/* Client */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.company_id}
                onChange={(e) => {
                  const cid = e.target.value;
                  const deals = getAvailableDeals(cid);
                  if (deals.length === 1) {
                    setForm({ ...form, company_id: cid, deal_id: deals[0].id, budget: String(Number(deals[0].amount) || 0) });
                  } else {
                    setForm({ ...form, company_id: cid, deal_id: "", budget: "" });
                  }
                }}
              >
                <option value="">Sélectionner un client</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Formation details */}
            <div style={{ background: "#f8fbfd", borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 13, marginBottom: 10 }}>Détails de la formation</div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Parcours</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.program_id}
                    onChange={(e) => setForm({ ...form, program_id: e.target.value })}
                  >
                    <option value="">Sélectionner</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Type de formation</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.training_type_id}
                    onChange={(e) => setForm({ ...form, training_type_id: e.target.value })}
                  >
                    <option value="">Sélectionner</option>
                    {trainingTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={form.format === "individuel" || form.format === "individuel_collectif"}
                          onChange={(e) => {
                            const hasCollectif = form.format === "collectif" || form.format === "individuel_collectif";
                            if (e.target.checked) {
                              setForm({ ...form, format: hasCollectif ? "individuel_collectif" : "individuel" });
                            } else {
                              setForm({ ...form, format: hasCollectif ? "collectif" : "individuel" });
                            }
                          }}
                          style={{ accentColor: "#1a6b9c" }}
                        />
                        Individuel
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={form.format === "collectif" || form.format === "individuel_collectif"}
                          onChange={(e) => {
                            const hasIndividuel = form.format === "individuel" || form.format === "individuel_collectif";
                            if (e.target.checked) {
                              setForm({ ...form, format: hasIndividuel ? "individuel_collectif" : "collectif" });
                            } else {
                              setForm({ ...form, format: hasIndividuel ? "individuel" : "collectif" });
                            }
                          }}
                          style={{ accentColor: "#1a6b9c" }}
                        />
                        Collectif
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={form.mode}
                      onChange={(e) => setForm({ ...form, mode: e.target.value })}
                    >
                      <option value="distanciel">Distanciel</option>
                      <option value="presentiel">Présentiel</option>
                      <option value="mixte">Mixte</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* VT & Journées */}
            <div style={{ background: "#fdf8f5", borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 13, marginBottom: 10 }}>Sessions prévues</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de VT prévues</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.vt_planned}
                    onChange={(e) => setForm({ ...form, vt_planned: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de journées prévues</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.days_planned}
                    onChange={(e) => setForm({ ...form, days_planned: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Taux horaire (€/h)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                  placeholder="250.27"
                />
              </div>
            </div>

            {/* Responsable (auto from primary contact) */}
            {form.company_id && (() => {
              const pc = getPrimaryContact(form.company_id);
              return pc ? (
                <div style={{ background: "#f0f7fb", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 13, marginBottom: 8 }}>Contact principal (auto)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a2a3a" }}><User className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{pc.first_name} {pc.last_name}</div>
                    {pc.phone && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#5a6f80" }}><Phone className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{formatPhone(pc.phone)}</div>}
                    {pc.email && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#5a6f80" }}><Mail className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />{pc.email}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ background: "#fff8e1", borderRadius: 8, padding: 14, fontSize: 13, color: "#e65100" }}>
                  Aucun contact principal défini pour cette entreprise
                </div>
              );
            })()}

            {/* Deal gagné → Budget */}
            {form.company_id && (() => {
              const deals = getAvailableDeals(form.company_id, editingPlanId);
              // If editing and current deal is already linked, include it
              const currentDeal = editingPlanId ? wonDeals.find(d => d.id === form.deal_id) : null;
              const allOptions = currentDeal && !deals.find(d => d.id === currentDeal.id) ? [currentDeal, ...deals] : deals;

              return (
                <div style={{ background: "#f0f7fb", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 13, marginBottom: 8 }}>Deal associé</div>
                  {allOptions.length > 0 ? (
                    <>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={form.deal_id}
                        onChange={(e) => {
                          const did = e.target.value;
                          const deal = wonDeals.find(d => d.id === did);
                          setForm({ ...form, deal_id: did, budget: deal ? String(Number(deal.amount) || 0) : "" });
                        }}
                      >
                        <option value="">Sélectionner un deal</option>
                        {allOptions.map(d => (
                          <option key={d.id} value={d.id}>{d.name || "Deal sans nom"} — {fmt(Number(d.amount) || 0)}</option>
                        ))}
                      </select>
                      {form.deal_id && (
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#5a6f80" }}>Budget prévu</span>
                          <span style={{ fontWeight: 800, color: "#27ae60", fontSize: 16 }}>{form.budget ? fmt(Number(form.budget)) : "—"}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#e65100" }}>Aucun deal gagné disponible pour cette entreprise</div>
                  )}
                </div>
              );
            })()}

            {/* Apprenants */}
            {form.company_id && (() => {
              const compLearners = getCompanyLearners(form.company_id);
              return (
                <div style={{ background: "#f8fbfd", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 13, marginBottom: 8 }}>Apprenants concernés</div>
                  {compLearners.length > 0 ? (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {compLearners.map(l => {
                          const checked = selectedLearnerIds.includes(l.id);
                          return (
                            <label
                              key={l.id}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer",
                                padding: "6px 10px", borderRadius: 6,
                                background: checked ? "#e8f0fe" : "white",
                                border: `1px solid ${checked ? "#1a6b9c" : "#dce8f0"}`,
                                color: checked ? "#0d4f7a" : "#5a6f80",
                                fontWeight: checked ? 600 : 400,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedLearnerIds(e.target.checked
                                    ? [...selectedLearnerIds, l.id]
                                    : selectedLearnerIds.filter(id => id !== l.id)
                                  );
                                }}
                                style={{ accentColor: "#1a6b9c" }}
                              />
                              {l.first_name} {l.last_name}
                              <span style={{
                                marginLeft: "auto", fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10,
                                background: l.status === "actuel" ? "#e8f5e9" : l.status === "futur" ? "#e8f0fe" : "#f5f5f5",
                                color: l.status === "actuel" ? "#2e7d32" : l.status === "futur" ? "#0d4f7a" : "#777",
                              }}>
                                {l.status}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = compLearners.map(l => l.id);
                          const allSelected = allIds.every(id => selectedLearnerIds.includes(id));
                          setSelectedLearnerIds(allSelected ? [] : allIds);
                        }}
                        style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        {compLearners.every(l => selectedLearnerIds.includes(l.id)) ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#e65100" }}>Aucun apprenant enregistré pour cette entreprise</div>
                  )}
                </div>
              );
            })()}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date début</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <VoiceButton isRecording={planNotesVoice.isRecording} isFormatting={planNotesVoice.isFormatting} onClick={planNotesVoice.toggleRecording} tone={planNotesVoice.tone} onToneChange={planNotesVoice.setTone} />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !form.company_id}
              className="w-full"
              style={{ background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white" }}
            >
              {saving ? "Enregistrement..." : editingPlanId ? "Mettre à jour" : importQueue.length > 0
                ? (importIndex + 1 < importQueue.length ? `Enregistrer et passer au suivant (${importIndex + 2}/${importQueue.length})` : "Enregistrer et terminer l'import")
                : "Enregistrer le plan de formation"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Session Edit/Add Popup */}
      {sessionPlanId && (() => {
        const currentPlan = servicePlans.find(p => p.id === sessionPlanId);
        const popupLearners = currentPlan ? ((currentPlan.service_plan_learners ?? []).map((spl: any) => spl.learners).filter(Boolean) as LearnerNested[]) : [];
        const compAddr = currentPlan?.companies ? [currentPlan.companies.address, currentPlan.companies.city].filter(Boolean).join(", ") : "";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setSessionPlanId(null); }}>
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
                  {editingSessionId ? "Modifier la session" : "Nouvelle session"} — {currentPlan?.companies?.name ?? ""}
                </h3>
                <button onClick={() => setSessionPlanId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 18 }}>×</button>
              </div>
              <div style={{ padding: 20 }} className="space-y-4">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Type</div>
                    <select value={sessionForm.session_type} onChange={(e) => { const t = e.target.value as "vt" | "journee"; setSessionForm({ ...sessionForm, session_type: t, duration_hours: t === "journee" ? "8" : "1", session_location: t === "journee" ? compAddr : "" }); }} style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }}>
                      <option value="vt">Visio Training (VT)</option>
                      <option value="journee">Journée</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Date</div>
                    <input type="date" value={sessionForm.session_date} onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })} style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Heure</div>
                    <input type="time" value={sessionForm.session_time} onChange={(e) => setSessionForm({ ...sessionForm, session_time: e.target.value })} style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Durée</div>
                    {sessionForm.session_type === "journee" ? (
                      <div style={{ height: 34, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, padding: "0 10px", background: "#f0f0f0", borderRadius: 6, border: "1px solid #dce8f0" }}>8h</div>
                    ) : (
                      <select value={sessionForm.duration_hours} onChange={(e) => setSessionForm({ ...sessionForm, duration_hours: e.target.value })} style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }}>
                        <option value="1">1h</option><option value="1.5">1h30</option><option value="2">2h</option><option value="3">3h</option>
                      </select>
                    )}
                  </div>
                </div>
                {sessionForm.session_type === "journee" && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Adresse</div>
                    <input type="text" value={sessionForm.session_location} onChange={(e) => setSessionForm({ ...sessionForm, session_location: e.target.value })} placeholder="Adresse du lieu" style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, width: "100%" }} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 4 }}>Notes</div>
                  <input type="text" value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} placeholder="Notes (optionnel)" style={{ height: 34, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, width: "100%" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 6 }}>Apprenants</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {popupLearners.map(l => {
                      const checked = sessionForm.learner_ids.includes(l.id);
                      return (
                        <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "4px 10px", borderRadius: 6, background: checked ? "#e8f0fe" : "white", border: `1px solid ${checked ? "#1a6b9c" : "#dce8f0"}`, color: checked ? "#0d4f7a" : "#5a6f80", fontWeight: checked ? 600 : 400 }}>
                          <input type="checkbox" checked={checked} onChange={(e) => { const ids = e.target.checked ? [...sessionForm.learner_ids, l.id] : sessionForm.learner_ids.filter(id => id !== l.id); setSessionForm({ ...sessionForm, learner_ids: ids }); }} style={{ accentColor: "#1a6b9c" }} />
                          {l.first_name} {l.last_name}
                        </label>
                      );
                    })}
                    {popupLearners.length > 1 && (
                      <button onClick={() => { const allIds = popupLearners.map(l => l.id); const allSelected = allIds.every(id => sessionForm.learner_ids.includes(id)); setSessionForm({ ...sessionForm, learner_ids: allSelected ? [] : allIds }); }} style={{ fontSize: 11, fontWeight: 600, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        {popupLearners.every(l => sessionForm.learner_ids.includes(l.id)) ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8399a9", marginBottom: 6 }}>Expert(s)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {TRAINER_LIST.map(t => {
                      const checked = sessionForm.trainers.includes(t);
                      return (
                        <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "4px 10px", borderRadius: 6, background: checked ? "#fff3e0" : "white", border: `1px solid ${checked ? "#FF6B35" : "#dce8f0"}`, color: checked ? "#e65100" : "#5a6f80", fontWeight: checked ? 600 : 400 }}>
                          <input type="checkbox" checked={checked} onChange={(e) => { const trainers = e.target.checked ? [...sessionForm.trainers, t] : sessionForm.trainers.filter(x => x !== t); setSessionForm({ ...sessionForm, trainers }); }} style={{ accentColor: "#FF6B35" }} />
                          {t}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={sessionForm.is_billable} onChange={(e) => setSessionForm({ ...sessionForm, is_billable: e.target.checked })} style={{ accentColor: "#27ae60" }} />
                  <span style={{ fontWeight: sessionForm.is_billable ? 600 : 400, color: sessionForm.is_billable ? "#27ae60" : "#8399a9" }}>{sessionForm.is_billable ? "Facturable" : "Non facturable"}</span>
                </label>
              </div>
              <div style={{ padding: "14px 20px", borderTop: "1px solid #e8ecf1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setSessionPlanId(null)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>Annuler</button>
                <button onClick={handleAddSession} disabled={savingSession || !sessionForm.session_date} style={{ height: 36, borderRadius: 8, background: editingSessionId ? "#1a6b9c" : "#2ecc71", color: "white", fontSize: 13, fontWeight: 700, padding: "0 18px", border: "none", cursor: "pointer", opacity: savingSession || !sessionForm.session_date ? 0.5 : 1 }}>
                  {savingSession ? "..." : editingSessionId ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Notes Popup */}
      {notesPopup && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { stopRecording(); setNotesPopup(null); } }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e8ecf1" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Notes de session</h3>
              <button
                onClick={() => { stopRecording(); setNotesPopup(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20 }}>
              <textarea
                value={notesPopup.notes}
                onChange={(e) => setNotesPopup({ ...notesPopup, notes: e.target.value })}
                placeholder="Écrire ou dicter vos notes..."
                style={{
                  width: "100%", minHeight: 180, borderRadius: 10, border: "1px solid #dce8f0",
                  padding: 14, fontSize: 14, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6,
                  outline: "none",
                }}
              />

              <VoiceButton isRecording={sessionNotesVoice.isRecording} isFormatting={sessionNotesVoice.isFormatting} onClick={sessionNotesVoice.toggleRecording} tone={sessionNotesVoice.tone} onToneChange={sessionNotesVoice.setTone} />
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
              <button
                onClick={() => { stopRecording(); setNotesPopup(null); }}
                style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                onClick={saveNotes}
                style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer" }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learner popup */}
      {viewLearner && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewLearner(null); }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>{viewLearner.first_name} {viewLearner.last_name}</h3>
              <button onClick={() => setViewLearner(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 20 }} className="space-y-3">
              {loadingLearner ? (
                <div style={{ textAlign: "center", color: "#8399a9", padding: 20 }}>Chargement...</div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {viewLearner.status && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                        background: viewLearner.status === "actuel" ? "#e8f5e9" : viewLearner.status === "futur" ? "#e8f0fe" : "#f5f5f5",
                        color: viewLearner.status === "actuel" ? "#2e7d32" : viewLearner.status === "futur" ? "#0d4f7a" : "#777",
                      }}>
                        {viewLearner.status}
                      </span>
                    )}
                    {viewLearner.company_name && (
                      <span style={{ fontSize: 12, color: "#8399a9" }}>{viewLearner.company_name}</span>
                    )}
                  </div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>✉️</span>
                      <span style={{ fontSize: 13, color: viewLearner.email ? "#1a2a3a" : "#ccc" }}>{viewLearner.email || "Non renseigné"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>📞</span>
                      <span style={{ fontSize: 13, color: viewLearner.phone ? "#1a2a3a" : "#ccc" }}>{viewLearner.phone ? formatPhone(viewLearner.phone) : "Non renseigné"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>💼</span>
                      <span style={{ fontSize: 13, color: viewLearner.position ? "#1a2a3a" : "#ccc" }}>{viewLearner.position || "Non renseigné"}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setViewLearner(null)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync result popup */}
      {syncPopup && (() => {
        const sd = syncPopup.syncData;
        const results = sd.results ?? [];

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setSyncPopup(null); }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1" }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>✅ Session créée et synchronisée</h3>
              </div>

              <div style={{ padding: 20 }} className="space-y-3">
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2a3a" }}>{sd.title}</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  {results.map((r: any, i: number) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {r.gcal && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: r.gcal === "created" ? "#e8f5e9" : "#fce4ec", borderRadius: 8 }}>
                          <span style={{ fontSize: 14 }}>📅</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: r.gcal === "created" ? "#2e7d32" : "#c62828" }}>
                            Google Calendar {r.trainer} — {r.gcal === "created" ? "ajouté" : r.gcal}
                          </span>
                        </div>
                      )}
                      {r.slack && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: r.slack === "sent" ? "#e8f5e9" : "#fce4ec", borderRadius: 8 }}>
                          <span style={{ fontSize: 14 }}>💬</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: r.slack === "sent" ? "#2e7d32" : "#c62828" }}>
                            Slack {r.trainer} — {r.slack === "sent" ? "envoyé" : r.slack}
                          </span>
                        </div>
                      )}
                      {r.email && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: r.email === "sent" ? "#e8f5e9" : "#fff3e0", borderRadius: 8 }}>
                          <span style={{ fontSize: 14 }}>📧</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: r.email === "sent" ? "#2e7d32" : "#e65100" }}>
                            Email {r.trainer} — {r.email === "sent" ? "envoyé" : r.email}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {results.length === 0 && (
                    <div style={{ fontSize: 13, color: "#8399a9", fontStyle: "italic" }}>Aucun expert assigné à notifier</div>
                  )}
                </div>
              </div>

              <div style={{ padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setSyncPopup(null)} style={{ height: 38, borderRadius: 8, background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer" }}>
                  OK
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.4); }
          70% { box-shadow: 0 0 0 10px rgba(231,76,60,0); }
          100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
        }
      `}</style>

      {/* Planificateur modal */}
      <PlanificateurModal
        open={planificateurOpen}
        onClose={() => setPlanificateurOpen(false)}
        planId={planificateurPlanId}
        prefill={planificateurPrefill}
        learnerIds={planificateurLearnerIds}
        plans={servicePlans.map(p => ({
          id: p.id,
          companyName: p.companies?.name ?? "Sans entreprise",
          vtPlanned: p.vt_planned ?? 0,
          daysPlanned: p.days_planned ?? 0,
          startDate: p.start_date ?? "",
          endDate: p.end_date ?? "",
          city: (p.companies as any)?.city ?? "",
          budget: p.budget ?? 0,
          address: (p.companies as any)?.address ? `${(p.companies as any).address}${(p.companies as any).city ? ", " + (p.companies as any).city : ""}` : "",
          format: p.format ?? "individuel",
          learnerIds: (p.service_plan_learners ?? []).map((spl: any) => spl.learner_id),
        }))}
        onCreateSession={(session, pid) => {
          setSessionPlanId(pid);
          setEditingSessionId(null);
          setSessionForm({
            session_type: session.session_type,
            session_date: session.session_date,
            session_time: session.session_time,
            duration_hours: String(session.duration_hours),
            session_location: session.session_location || "",
            trainers: [session.trainer_name],
            is_billable: true,
            notes: "",
            learner_ids: planificateurLearnerIds,
          });
        }}
      />

      {/* Aide à la décision popup */}
      {decisionOpen && (() => {
        const CITY_REGION: Record<string, string> = {
          "Paris": "Île-de-France", "Mérignac": "Nouvelle-Aquitaine", "Bordeaux": "Nouvelle-Aquitaine",
          "Montpellier": "Occitanie", "Toulouse": "Occitanie", "Lyon": "Auvergne-Rhône-Alpes",
          "Marseille": "Provence-Alpes-Côte d'Azur", "Nantes": "Pays de la Loire", "Lille": "Hauts-de-France",
          "Strasbourg": "Grand Est", "Rennes": "Bretagne", "Nice": "Provence-Alpes-Côte d'Azur",
          "Rouen": "Normandie", "Dijon": "Bourgogne-Franche-Comté", "Clermont-Ferrand": "Auvergne-Rhône-Alpes",
          "La Rochelle": "Nouvelle-Aquitaine", "Limoges": "Nouvelle-Aquitaine", "Poitiers": "Nouvelle-Aquitaine",
          "Orléans": "Centre-Val de Loire", "Tours": "Centre-Val de Loire", "Reims": "Grand Est",
          "Amiens": "Hauts-de-France", "Caen": "Normandie", "Angers": "Pays de la Loire",
          "Grenoble": "Auvergne-Rhône-Alpes", "Saint-Étienne": "Auvergne-Rhône-Alpes",
          "Toulon": "Provence-Alpes-Côte d'Azur", "Aix-en-Provence": "Provence-Alpes-Côte d'Azur",
          "Brest": "Bretagne", "Perpignan": "Occitanie", "Nîmes": "Occitanie", "Pau": "Nouvelle-Aquitaine",
          "Bayonne": "Nouvelle-Aquitaine", "Metz": "Grand Est", "Nancy": "Grand Est",
        };
        const ALL_EXP = ["Inbound", "Outbound", "Stratégie", "Management", "Financements", "Fidélisation", "Pilotage", "Time Management", "Objections"];

        // Include all experts (active + pending, internal + external) that have a TJM
        const experts = expertMembers.filter((m: R) => m.tjm);

        const formationRegion = CITY_REGION[decisionForm.city] ?? "";
        const nbDays = parseFloat(decisionForm.days) || 0;
        const budgetHT = parseFloat(decisionForm.budget) || 0;

        const analysis = experts.map((m: R) => {
          const exps = (m.expertises as string[]) ?? [];
          const hasExpertise = decisionForm.expertise ? exps.includes(decisionForm.expertise) : false;
          const expertRegion = (m.region as string) || "";
          const sameRegion = !!(formationRegion && expertRegion && expertRegion === formationRegion);
          const tjm = Number(m.tjm) || 0;
          const costTjm = tjm * nbDays;
          const prepa = tjm * 0.5;
          const deplacement = sameRegion ? 0 : tjm * 0.5;
          const totalHT = costTjm + prepa + deplacement;
          const budgetOk = budgetHT > 0 ? totalHT <= budgetHT : true;
          const score = (hasExpertise ? 1 : 0) + (sameRegion ? 1 : 0) + (budgetOk ? 1 : 0);
          const marge = budgetHT > 0 ? budgetHT - totalHT : 0;
          return {
            name: `${m.first_name} ${m.last_name}`,
            hasExpertise, sameRegion, budgetOk, score,
            city: (m.city as string) || "—", region: expertRegion || "—",
            tjm, costTjm, prepa, deplacement, totalHT, marge,
          };
        }).sort((a, b) => b.score - a.score || a.totalHT - b.totalHT);

        const best = analysis[0];
        const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setDecisionOpen(false); }}>
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 950, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Aide à la Décision — Choix de l'expert</h3>
                <button onClick={() => setDecisionOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>✕</button>
              </div>

              <div style={{ padding: 24 }} className="space-y-5">
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4 }}>
                  Critères du besoin client
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Expertise recherchée</label>
                    <select value={decisionForm.expertise} onChange={(e) => setDecisionForm({ ...decisionForm, expertise: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                      <option value="">Sélectionner</option>
                      {ALL_EXP.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Ville de formation</label>
                    <input value={decisionForm.city} onChange={(e) => setDecisionForm({ ...decisionForm, city: e.target.value })}
                      list="decision-city-list2"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="Ex: Lyon" />
                    <datalist id="decision-city-list2">
                      {Object.keys(CITY_REGION).map(c => <option key={c} value={c} />)}
                    </datalist>
                    {formationRegion && <p style={{ fontSize: 10, color: "#8399a9" }}>{formationRegion}</p>}
                  </div>
                  <div className="space-y-1">
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Nb jours</label>
                    <input type="number" value={decisionForm.days} onChange={(e) => setDecisionForm({ ...decisionForm, days: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="2" />
                  </div>
                  <div className="space-y-1">
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Budget HT (EUR)</label>
                    <input type="number" value={decisionForm.budget} onChange={(e) => setDecisionForm({ ...decisionForm, budget: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="4000" />
                  </div>
                </div>

                {nbDays > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4 }}>
                      Analyse des experts
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f8fbfd" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Expert</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Expertise</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Ville</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Même région</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>TJM</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Coût TJM</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Prépa</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Déplac.</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Total HT</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Budget OK</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Score</th>
                            {budgetHT > 0 && <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Marge</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.map((a, i) => (
                            <tr key={a.name} style={{ borderTop: "1px solid #e8ecf1", background: i === 0 ? "#f0f7fb" : "white" }}>
                              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{a.name}</td>
                              <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                <span style={{ color: a.hasExpertise ? "#27ae60" : "#e74c3c", fontWeight: 700 }}>{a.hasExpertise ? "OUI ✓" : "NON ✗"}</span>
                              </td>
                              <td style={{ padding: "8px 10px", color: "#5a6f80" }}>{a.city}</td>
                              <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                <span style={{ color: a.sameRegion ? "#27ae60" : "#e74c3c", fontWeight: 700 }}>{a.sameRegion ? "OUI ✓" : "NON ✗"}</span>
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right" }}>{fmtE(a.tjm)}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right" }}>{fmtE(a.costTjm)}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right" }}>{fmtE(a.prepa)}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right" }}>{fmtE(a.deplacement)}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>{fmtE(a.totalHT)}</td>
                              <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                <span style={{ color: a.budgetOk ? "#27ae60" : "#e74c3c", fontWeight: 700 }}>{a.budgetOk ? "OUI ✓" : "NON ✗"}</span>
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 28, height: 28, borderRadius: "50%", fontWeight: 800, fontSize: 13,
                                  background: a.score === 3 ? "#e8f5e9" : a.score === 2 ? "#fff3e0" : "#fce4ec",
                                  color: a.score === 3 ? "#27ae60" : a.score === 2 ? "#e65100" : "#c62828",
                                }}>{a.score}/3</span>
                              </td>
                              {budgetHT > 0 && (
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: a.marge >= 0 ? "#27ae60" : "#e74c3c" }}>
                                  {fmtE(a.marge)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {best && (
                      <div style={{ padding: 16, borderRadius: 10, background: "linear-gradient(135deg, #e8f5e9 0%, #f0f7fb 100%)", border: "1px solid #c8e6c9" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#2e7d32", marginBottom: 6 }}>Recommandation</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#1a2a3a" }}>
                          Meilleur choix : {best.name} — Score : {best.score}/3 — Coût estimé : {fmtE(best.totalHT)}
                        </div>
                        {budgetHT > 0 && best.marge > 0 && (
                          <div style={{ fontSize: 13, color: "#27ae60", fontWeight: 600, marginTop: 4 }}>
                            Marge dégagée : {fmtE(best.marge)}
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: "#5a6f80", marginTop: 8 }}>
                          Si plusieurs experts ont le même score, le classement privilégie le coût total le plus bas.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
