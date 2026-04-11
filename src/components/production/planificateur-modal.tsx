"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CalendarPlus, CheckCircle, AlertTriangle, Users, Star, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { DayTimeline } from "./day-timeline";

const DAYS_OF_WEEK = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
const VT_RHYTHMS = ["1x/semaine", "2x/semaine", "1x/2 semaines", "1x/mois"];
const JOURNEE_RHYTHMS = ["1x/mois", "2x/mois", "1x/2 mois"];
const VT_DURATIONS = [{ value: "1", label: "1h" }, { value: "1.5", label: "1h30" }, { value: "2", label: "2h" }];
const ALL_EXP = ["Inbound", "Outbound", "Stratégie", "Management", "Financements", "Fidélisation", "Pilotage", "Time Management", "Objections"];

const CITY_REGION: Record<string, string> = {
  Paris: "Île-de-France", Mérignac: "Nouvelle-Aquitaine", Bordeaux: "Nouvelle-Aquitaine",
  Montpellier: "Occitanie", Toulouse: "Occitanie", Lyon: "Auvergne-Rhône-Alpes",
  Marseille: "Provence-Alpes-Côte d'Azur", Nantes: "Pays de la Loire", Lille: "Hauts-de-France",
  Strasbourg: "Grand Est", Rennes: "Bretagne", Nice: "Provence-Alpes-Côte d'Azur",
  Rouen: "Normandie", Dijon: "Bourgogne-Franche-Comté",
  Grenoble: "Auvergne-Rhône-Alpes", Angers: "Pays de la Loire",
  Toulon: "Provence-Alpes-Côte d'Azur", Brest: "Bretagne",
};

interface ExpertData {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  expertises: string[];
  city: string;
  region: string;
  tjm: number;
  score: number;
  hasExpertise: boolean;
  sameRegion: boolean;
  budgetOk: boolean;
  costTjm: number;
  prepa: number;
  deplacement: number;
  totalHT: number;
  marge: number;
  hasCalendar: boolean;
}

interface PlanOption {
  id: string;
  companyName: string;
  vtPlanned: number;
  daysPlanned: number;
  startDate: string;
  endDate: string;
  city: string;
  budget: number;
  address: string;
  format: string;
  learnerIds: string[];
}

interface SessionMeta {
  index: number;
  total: number;
  session_type: "vt" | "journee";
  duration_hours: number;
  session_location: string | null;
}

interface Proposal {
  session_date: string;
  session_time: string;
  duration_hours: number;
  trainer_name: string;
  trainer_id: string;
  warning?: string;
}

interface TrainerCalendar {
  trainerName: string;
  trainerId: string;
  events: { start: string; end: string; summary?: string }[];
}

interface ConfirmedSession {
  sessionId: string;
  index: number;
  session_type: "vt" | "journee";
  session_date: string;
  session_time: string;
  duration_hours: number;
  trainer_name: string;
}

interface AllSessionSummary {
  index: number;
  session_type: "vt" | "journee";
  duration_hours: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  planId?: string | null;
  prefill?: {
    startDate?: string; endDate?: string; vtCount?: number; daysCount?: number;
    city?: string; budget?: number; journeeLocation?: string;
  };
  learnerIds?: string[];
  onSessionsCreated?: () => void;
  plans?: PlanOption[];
}

export function PlanificateurModal({ open, onClose, planId: initialPlanId, prefill, learnerIds: initialLearnerIds = [], onSessionsCreated, plans = [] }: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId ?? null);
  const planId = selectedPlanId || initialPlanId;
  const selectedPlan = plans.find(p => p.id === planId);
  const learnerIds = selectedPlan?.learnerIds ?? initialLearnerIds;
  const [step, setStep] = useState<"form" | "experts" | "scheduling">("form");

  // Expert selection state
  const [expertLoading, setExpertLoading] = useState(false);
  const [recommendedExperts, setRecommendedExperts] = useState<ExpertData[]>([]);
  const [otherExperts, setOtherExperts] = useState<ExpertData[]>([]);
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<Set<string>>(new Set());
  const [existingExpertInfo, setExistingExpertInfo] = useState<{ name: string; id: string } | null>(null);
  const [hasJournees, setHasJournees] = useState(false);
  const [dismissedExpertAlert, setDismissedExpertAlert] = useState(false);

  // Scheduling state
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [trainerCalendars, setTrainerCalendars] = useState<TrainerCalendar[]>([]);
  const [confirmedSessions, setConfirmedSessions] = useState<ConfirmedSession[]>([]);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState<number | null>(null);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [allSessions, setAllSessions] = useState<AllSessionSummary[]>([]);
  const [schedulingDone, setSchedulingDone] = useState(false);

  const [form, setForm] = useState({
    clientAvailableDays: [] as string[],
    vtRhythm: "1x/semaine",
    vtTimeFrom: "09:00",
    vtTimeTo: "12:00",
    vtDuration: "1",
    vtCount: String(prefill?.vtCount ?? ""),
    journeeRhythm: "1x/mois",
    journeeLocation: prefill?.journeeLocation ?? "",
    daysCount: String(prefill?.daysCount ?? ""),
    expertise: "",
    city: prefill?.city ?? "",
    budget: prefill?.budget ? String(prefill.budget) : "",
    startDate: prefill?.startDate ?? "",
    endDate: prefill?.endDate ?? "",
  });

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      clientAvailableDays: f.clientAvailableDays.includes(day)
        ? f.clientAvailableDays.filter(d => d !== day)
        : [...f.clientAvailableDays, day],
    }));
  }

  function toggleTrainer(id: string) {
    setSelectedTrainerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Step 1 → Step 2: Analyze experts
  async function handleAnalyzeExperts() {
    setExpertLoading(true);
    try {
      const res = await fetch("/api/planificateur/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertise: form.expertise,
          city: form.city,
          budget: form.budget,
          daysCount: form.daysCount,
          planId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommendedExperts(data.recommended);
        setOtherExperts(data.others);
        setExistingExpertInfo(data.existingExpertInfo || null);
        setHasJournees(data.hasJournees ?? (parseInt(form.daysCount) > 0));
        setDismissedExpertAlert(false);
        const preSelected = new Set<string>(data.recommended.map((e: ExpertData) => e.id));
        // If existing expert found, pre-select them
        if (data.existingExpertInfo) {
          preSelected.add(data.existingExpertInfo.id);
        }
        setSelectedTrainerIds(preSelected);
        setStep("experts");
      }
    } catch {
      // fallback
    } finally {
      setExpertLoading(false);
    }
  }

  // Step 2 → Step 3: Start scheduling
  async function handleStartScheduling() {
    setStep("scheduling");
    setCurrentSessionIndex(0);
    setConfirmedSessions([]);
    setSchedulingDone(false);
    await fetchProposals(0);
  }

  // Fetch proposals for a given session index
  async function fetchProposals(sessionIdx: number) {
    setLoadingProposals(true);
    setSelectedProposalIndex(null);
    setProposals([]);
    setTrainerCalendars([]);
    setSessionMeta(null);

    try {
      const res = await fetch("/api/planificateur/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          expertise: form.expertise,
          city: form.city,
          budget: form.budget,
          clientAvailableDays: form.clientAvailableDays,
          vtRhythm: form.vtRhythm,
          vtTimeSlot: `${form.vtTimeFrom}-${form.vtTimeTo}`,
          vtDuration: form.vtDuration,
          vtCount: form.vtCount,
          journeeRhythm: form.journeeRhythm,
          journeeLocation: form.journeeLocation,
          daysCount: form.daysCount,
          startDate: form.startDate,
          endDate: form.endDate,
          selectedTrainerIds: Array.from(selectedTrainerIds),
          sessionIndex: sessionIdx,
          alreadyBooked: confirmedSessions.map(s => ({
            session_date: s.session_date,
            session_time: s.session_time,
            duration_hours: s.duration_hours,
            session_type: s.session_type,
            trainer_name: s.trainer_name,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.done) {
          setSchedulingDone(true);
        } else {
          setSessionMeta(data.sessionMeta);
          setProposals(data.proposals);
          setTrainerCalendars(data.trainerCalendars);
          if (data.allSessions) setAllSessions(data.allSessions);
        }
      }
    } catch {
      // network error
    } finally {
      setLoadingProposals(false);
    }
  }

  // Validate selected proposal → save session
  async function handleConfirmSession() {
    if (selectedProposalIndex === null || !sessionMeta) return;
    const proposal = proposals[selectedProposalIndex];
    if (!proposal || !planId) return;

    setSavingSession(true);
    try {
      const res = await fetch("/api/planificateur/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_plan_id: planId,
          session_type: sessionMeta.session_type,
          session_date: proposal.session_date,
          session_time: proposal.session_time,
          duration_hours: sessionMeta.duration_hours,
          session_location: sessionMeta.session_location,
          trainer_name: proposal.trainer_name,
          learner_ids: learnerIds,
          is_billable: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const confirmed: ConfirmedSession = {
          sessionId: data.sessionId,
          index: currentSessionIndex,
          session_type: sessionMeta.session_type,
          session_date: proposal.session_date,
          session_time: proposal.session_time,
          duration_hours: sessionMeta.duration_hours,
          trainer_name: proposal.trainer_name,
        };
        const newConfirmed = [...confirmedSessions, confirmed];
        setConfirmedSessions(newConfirmed);

        // Move to next session
        const nextIndex = currentSessionIndex + 1;
        setCurrentSessionIndex(nextIndex);
        // Need to pass updated confirmed list for the next fetch
        await fetchProposalsWithConfirmed(nextIndex, newConfirmed);
      }
    } catch {
      // error handling
    } finally {
      setSavingSession(false);
    }
  }

  // Fetch proposals with explicit confirmed list (needed because state update is async)
  async function fetchProposalsWithConfirmed(sessionIdx: number, confirmed: ConfirmedSession[]) {
    setLoadingProposals(true);
    setSelectedProposalIndex(null);
    setProposals([]);
    setTrainerCalendars([]);
    setSessionMeta(null);

    try {
      const res = await fetch("/api/planificateur/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          expertise: form.expertise,
          city: form.city,
          budget: form.budget,
          clientAvailableDays: form.clientAvailableDays,
          vtRhythm: form.vtRhythm,
          vtTimeSlot: `${form.vtTimeFrom}-${form.vtTimeTo}`,
          vtDuration: form.vtDuration,
          vtCount: form.vtCount,
          journeeRhythm: form.journeeRhythm,
          journeeLocation: form.journeeLocation,
          daysCount: form.daysCount,
          startDate: form.startDate,
          endDate: form.endDate,
          selectedTrainerIds: Array.from(selectedTrainerIds),
          sessionIndex: sessionIdx,
          alreadyBooked: confirmed.map(s => ({
            session_date: s.session_date,
            session_time: s.session_time,
            duration_hours: s.duration_hours,
            session_type: s.session_type,
            trainer_name: s.trainer_name,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.done) {
          setSchedulingDone(true);
        } else {
          setSessionMeta(data.sessionMeta);
          setProposals(data.proposals);
          setTrainerCalendars(data.trainerCalendars);
          if (data.allSessions) setAllSessions(data.allSessions);
        }
      }
    } catch {
      // network error
    } finally {
      setLoadingProposals(false);
    }
  }

  // Skip current session
  async function handleSkipSession() {
    const nextIndex = currentSessionIndex + 1;
    setCurrentSessionIndex(nextIndex);
    await fetchProposalsWithConfirmed(nextIndex, confirmedSessions);
  }

  // Close with confirmation if sessions remain
  function handleClose() {
    if (confirmedSessions.length > 0) {
      onSessionsCreated?.();
    }
    onClose();
  }

  if (!open) return null;

  const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  const fmtDate = (d: string) => {
    try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); }
    catch { return d; }
  };
  const formationRegion = CITY_REGION[form.city] ?? "";
  const totalSessions = sessionMeta?.total ?? allSessions.length;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: step === "scheduling" ? 1100 : 900, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto", transition: "max-width 0.3s ease" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarPlus style={{ width: 18, height: 18, color: "#1a6b9c" }} />
            Planificateur intelligent
            {step === "experts" && <span style={{ fontSize: 12, fontWeight: 500, color: "#8399a9" }}> — Sélection des formateurs</span>}
            {step === "scheduling" && <span style={{ fontSize: 12, fontWeight: 500, color: "#8399a9" }}> — Planification des sessions</span>}
          </h3>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* ═══════════ Step 1: Form ═══════════ */}
        {step === "form" && (
          <div style={{ padding: 24 }} className="space-y-5">
            {/* Plan selector */}
            {plans.length > 0 && !initialPlanId && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
                  Client / Plan de formation
                </div>
                <select
                  value={selectedPlanId || ""}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedPlanId(pid || null);
                    const p = plans.find(pl => pl.id === pid);
                    if (p) {
                      setForm(f => ({
                        ...f,
                        vtCount: String(p.vtPlanned || ""),
                        daysCount: String(p.daysPlanned || ""),
                        startDate: p.startDate || f.startDate,
                        endDate: p.endDate || f.endDate,
                        city: p.city || f.city,
                        budget: p.budget ? String(p.budget) : f.budget,
                        journeeLocation: p.address || f.journeeLocation,
                      }));
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">S&eacute;lectionner un plan</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.companyName} — VT: {p.vtPlanned} / J: {p.daysPlanned}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Jours disponibles */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
                Disponibilités du client
              </div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 6 }}>Jours disponibles</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: form.clientAvailableDays.includes(day) ? "2px solid #1a6b9c" : "1px solid #dce8f0",
                      background: form.clientAvailableDays.includes(day) ? "#e8f0fe" : "white",
                      color: form.clientAvailableDays.includes(day) ? "#1a6b9c" : "#5a6f80",
                      textTransform: "capitalize",
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* VT config */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
                Visio Training (VT)
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Nb de VT</label>
                  <input type="number" value={form.vtCount} onChange={(e) => setForm({ ...form, vtCount: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="6" />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Rythme</label>
                  <select value={form.vtRhythm} onChange={(e) => setForm({ ...form, vtRhythm: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {VT_RHYTHMS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Plage horaire (de)</label>
                  <input type="time" value={form.vtTimeFrom} onChange={(e) => setForm({ ...form, vtTimeFrom: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Plage horaire (à)</label>
                  <input type="time" value={form.vtTimeTo} onChange={(e) => setForm({ ...form, vtTimeTo: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Durée</label>
                  <select value={form.vtDuration} onChange={(e) => setForm({ ...form, vtDuration: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {VT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Journée config */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
                Journées présentielles
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Nb de journées</label>
                  <input type="number" value={form.daysCount} onChange={(e) => setForm({ ...form, daysCount: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="2" />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Rythme</label>
                  <select value={form.journeeRhythm} onChange={(e) => setForm({ ...form, journeeRhythm: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {JOURNEE_RHYTHMS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Lieu</label>
                  <input value={form.journeeLocation} onChange={(e) => setForm({ ...form, journeeLocation: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="Ex: 224 Cour Lafayette, Lyon" />
                </div>
              </div>
            </div>

            {/* Critères expert */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
                Critères de sélection expert
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Expertise</label>
                  <select value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">Toutes</option>
                    {ALL_EXP.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Ville</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    list="planificateur-city-list"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="Ex: Lyon" />
                  <datalist id="planificateur-city-list">
                    {Object.keys(CITY_REGION).map(c => <option key={c} value={c} />)}
                  </datalist>
                  {formationRegion && <p style={{ fontSize: 10, color: "#8399a9", margin: "2px 0 0" }}>{formationRegion}</p>}
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Budget HT</label>
                  <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="4000" />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Nb jours (coût)</label>
                  <input type="number" value={form.daysCount} onChange={(e) => setForm({ ...form, daysCount: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="2" />
                </div>
              </div>
            </div>

            {/* Période */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12 }}>
                Période de formation
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Date de début</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Date de fin</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
              </div>
            </div>

            {/* Generate button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
              <button onClick={handleClose} style={{ height: 40, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 20px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button
                onClick={handleAnalyzeExperts}
                disabled={expertLoading || !form.startDate || !form.endDate || (!(parseInt(form.vtCount) > 0) && !(parseInt(form.daysCount) > 0))}
                style={{
                  height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                  background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: (expertLoading || !form.startDate || !form.endDate || (!(parseInt(form.vtCount) > 0) && !(parseInt(form.daysCount) > 0))) ? 0.5 : 1,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {expertLoading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Users style={{ width: 14, height: 14 }} />}
                  {expertLoading ? "Analyse en cours..." : "Analyser les formateurs"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Step 2: Expert Selection ═══════════ */}
        {step === "experts" && (
          <div style={{ padding: 24 }} className="space-y-5">
            {/* Existing expert alert */}
            {existingExpertInfo && !dismissedExpertAlert && (
              <div style={{ padding: 14, borderRadius: 10, background: "#fff3e0", border: "1px solid #ffb74d" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#e65100" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#e65100" }}>
                    Expert déjà assigné : {existingExpertInfo.name}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#5a6f80", margin: "0 0 10px" }}>
                  Ce client ou ses apprenants travaillent déjà avec <strong>{existingExpertInfo.name}</strong>.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      // Auto-select only this expert
                      setSelectedTrainerIds(new Set([existingExpertInfo!.id]));
                      setDismissedExpertAlert(true);
                    }}
                    style={{ height: 30, borderRadius: 6, border: "2px solid #e65100", background: "white", color: "#e65100", fontSize: 11, fontWeight: 700, padding: "0 14px", cursor: "pointer" }}
                  >
                    Garder {existingExpertInfo.name}
                  </button>
                  <button
                    onClick={() => setDismissedExpertAlert(true)}
                    style={{ height: 30, borderRadius: 6, border: "1px solid #dce8f0", background: "white", color: "#5a6f80", fontSize: 11, fontWeight: 600, padding: "0 14px", cursor: "pointer" }}
                  >
                    Choisir un autre expert
                  </button>
                </div>
              </div>
            )}

            {/* Recommended experts */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#2e7d32", borderBottom: "1px solid #c8e6c9", paddingBottom: 4, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Star style={{ width: 13, height: 13 }} />
                Formateurs recommandés par l&apos;IA
              </div>
              {recommendedExperts.length === 0 ? (
                <p style={{ fontSize: 12, color: "#8399a9" }}>Aucun formateur trouvé correspondant aux critères.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recommendedExperts.map((expert, idx) => (
                    <ExpertCard
                      key={expert.id}
                      expert={expert}
                      rank={idx + 1}
                      isRecommended
                      isSelected={selectedTrainerIds.has(expert.id)}
                      onToggle={() => toggleTrainer(expert.id)}
                      showRegion={hasJournees}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Other experts */}
            {otherExperts.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5a6f80", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Users style={{ width: 13, height: 13 }} />
                  Autres formateurs disponibles
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {otherExperts.map(expert => (
                    <ExpertCard
                      key={expert.id}
                      expert={expert}
                      isRecommended={false}
                      isSelected={selectedTrainerIds.has(expert.id)}
                      onToggle={() => toggleTrainer(expert.id)}
                      showRegion={hasJournees}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Selection summary & actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #e8ecf1" }}>
              <button onClick={() => setStep("form")} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <ChevronLeft style={{ width: 14, height: 14 }} /> Modifier les critères
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#5a6f80" }}>
                  {selectedTrainerIds.size} formateur{selectedTrainerIds.size > 1 ? "s" : ""} sélectionné{selectedTrainerIds.size > 1 ? "s" : ""}
                </span>
                <button
                  onClick={handleStartScheduling}
                  disabled={selectedTrainerIds.size === 0}
                  style={{
                    height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                    background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                    color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    opacity: selectedTrainerIds.size === 0 ? 0.5 : 1,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CalendarPlus style={{ width: 14, height: 14 }} /> Planifier les sessions
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ Step 3: Session-by-Session Scheduling ═══════════ */}
        {step === "scheduling" && (
          <div style={{ padding: 24 }}>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            {/* Completion screen */}
            {schedulingDone && (
              <div className="space-y-5">
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <CheckCircle style={{ width: 48, height: 48, color: "#2e7d32", margin: "0 auto 16px" }} />
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", margin: "0 0 8px" }}>
                    Planification terminée
                  </h4>
                  <p style={{ fontSize: 13, color: "#5a6f80" }}>
                    {confirmedSessions.length} session{confirmedSessions.length > 1 ? "s" : ""} planifiée{confirmedSessions.length > 1 ? "s" : ""} avec succès.
                  </p>
                </div>

                {/* Summary table */}
                {confirmedSessions.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f8fbfd" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>#</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Date</th>
                          <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Type</th>
                          <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Heure</th>
                          <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Durée</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Expert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmedSessions.map((s, i) => (
                          <tr key={i} style={{ borderTop: "1px solid #e8ecf1" }}>
                            <td style={{ padding: "8px 10px", color: "#8399a9" }}>{i + 1}</td>
                            <td style={{ padding: "8px 10px", fontWeight: 600 }}>{fmtDate(s.session_date)}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                                background: s.session_type === "vt" ? "#e8f0fe" : "#fff3e0",
                                color: s.session_type === "vt" ? "#1a6b9c" : "#e65100",
                              }}>
                                {s.session_type === "vt" ? "VT" : "Journée"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.session_time}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.duration_hours}h</td>
                            <td style={{ padding: "8px 10px", fontWeight: 600 }}>{s.trainer_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                  <button
                    onClick={handleClose}
                    style={{
                      height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                      background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}

            {/* Active scheduling */}
            {!schedulingDone && (
              <div className="space-y-5">
                {/* Progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a" }}>
                        Session {currentSessionIndex + 1}/{totalSessions}
                      </span>
                      {sessionMeta && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                          background: sessionMeta.session_type === "vt" ? "#e8f0fe" : "#fff3e0",
                          color: sessionMeta.session_type === "vt" ? "#1a6b9c" : "#e65100",
                        }}>
                          {sessionMeta.session_type === "vt" ? `VT (${sessionMeta.duration_hours}h)` : "Journée (8h)"}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "#8399a9" }}>
                      {confirmedSessions.length} validée{confirmedSessions.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#e8ecf1", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      background: "linear-gradient(90deg, #1a6b9c, #2e7d32)",
                      width: totalSessions > 0 ? `${(confirmedSessions.length / totalSessions) * 100}%` : "0%",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  {/* Session mini-dots */}
                  {allSessions.length > 0 && allSessions.length <= 20 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      {allSessions.map((s, i) => {
                        const isConfirmed = confirmedSessions.some(c => c.index === i);
                        const isCurrent = i === currentSessionIndex && !schedulingDone;
                        return (
                          <div key={i} style={{
                            width: 24, height: 24, borderRadius: 6, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700,
                            background: isConfirmed ? "#e8f5e9" : isCurrent ? "#e8f0fe" : "#f5f5f5",
                            border: isCurrent ? "2px solid #1a6b9c" : isConfirmed ? "1px solid #c8e6c9" : "1px solid #e8ecf1",
                            color: isConfirmed ? "#2e7d32" : isCurrent ? "#1a6b9c" : "#8399a9",
                          }}>
                            {isConfirmed ? "✓" : s.session_type === "vt" ? "V" : "J"}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Loading state */}
                {loadingProposals && (
                  <div style={{ padding: "40px 24px", textAlign: "center" }}>
                    <Loader2 style={{ width: 32, height: 32, color: "#1a6b9c", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>Recherche des créneaux disponibles...</p>
                  </div>
                )}

                {/* Proposals + Calendar */}
                {!loadingProposals && proposals.length > 0 && sessionMeta && (
                  <div style={{ display: "flex", gap: 20 }}>
                    {/* Calendar view */}
                    <div style={{ flex: "1 1 55%", minWidth: 0 }}>
                      {/* Show timeline for each unique proposal date */}
                      {[...new Set(proposals.map(p => p.session_date))].map(date => (
                        <div key={date} style={{ marginBottom: 16 }}>
                          <DayTimeline
                            date={date}
                            trainers={trainerCalendars.map(tc => ({
                              name: tc.trainerName,
                              events: tc.events,
                            }))}
                            proposals={proposals.map((p, idx) => ({
                              time: p.session_time,
                              duration: p.duration_hours,
                              trainerName: p.trainer_name,
                              isSelected: selectedProposalIndex === idx,
                            })).filter(p => {
                              const proposalForDate = proposals.find(pr => pr.session_date === date && pr.session_time === p.time && pr.trainer_name === p.trainerName);
                              return !!proposalForDate;
                            })}
                            onSelectProposal={(localIdx) => {
                              // Map local index back to global proposal index
                              const dateProposals = proposals
                                .map((p, idx) => ({ ...p, globalIdx: idx }))
                                .filter(p => p.session_date === date);
                              if (dateProposals[localIdx]) {
                                setSelectedProposalIndex(dateProposals[localIdx].globalIdx);
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Proposal cards */}
                    <div style={{ flex: "1 1 45%", minWidth: 280 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", marginBottom: 12 }}>
                        Créneaux proposés
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {proposals.map((p, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedProposalIndex(idx)}
                            style={{
                              padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                              border: selectedProposalIndex === idx ? "2px solid #2e7d32" : "1px solid #dce8f0",
                              background: selectedProposalIndex === idx ? "#f1f8f1" : "white",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", textTransform: "capitalize" }}>
                                  {fmtDate(p.session_date)}
                                </div>
                                <div style={{ fontSize: 13, color: "#5a6f80", marginTop: 2 }}>
                                  {p.session_time} — {p.duration_hours}h
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a6b9c" }}>
                                  {p.trainer_name}
                                </div>
                                {p.warning && (
                                  <div style={{ fontSize: 10, color: "#e65100", marginTop: 2 }}>
                                    {p.warning}
                                  </div>
                                )}
                              </div>
                            </div>
                            {selectedProposalIndex === idx && (
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e8ecf1", display: "flex", alignItems: "center", gap: 6 }}>
                                <CheckCircle style={{ width: 14, height: 14, color: "#2e7d32" }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#2e7d32" }}>Sélectionné</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* No proposals */}
                {!loadingProposals && proposals.length === 0 && !schedulingDone && sessionMeta && (
                  <div style={{ padding: 20, textAlign: "center", color: "#e65100" }}>
                    <AlertTriangle style={{ width: 32, height: 32, margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 14, fontWeight: 600 }}>Aucun créneau disponible pour cette session.</p>
                    <p style={{ fontSize: 12, color: "#5a6f80", marginTop: 4 }}>
                      Essayez de modifier les critères ou la période de formation.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                {!loadingProposals && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #e8ecf1" }}>
                    <button
                      onClick={() => {
                        if (confirmedSessions.length === 0) {
                          setStep("experts");
                        }
                      }}
                      disabled={confirmedSessions.length > 0}
                      style={{
                        height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80",
                        fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none",
                        cursor: confirmedSessions.length > 0 ? "not-allowed" : "pointer",
                        opacity: confirmedSessions.length > 0 ? 0.4 : 1,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <ChevronLeft style={{ width: 14, height: 14 }} /> Changer les formateurs
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      {sessionMeta && (
                        <button
                          onClick={handleSkipSession}
                          style={{
                            height: 40, borderRadius: 8, border: "1px solid #dce8f0",
                            background: "white", color: "#5a6f80", fontSize: 13, fontWeight: 600,
                            padding: "0 18px", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                          }}
                        >
                          <SkipForward style={{ width: 14, height: 14 }} /> Passer
                        </button>
                      )}
                      <button
                        onClick={handleConfirmSession}
                        disabled={selectedProposalIndex === null || savingSession}
                        style={{
                          height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                          background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                          color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                          opacity: (selectedProposalIndex === null || savingSession) ? 0.5 : 1,
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {savingSession ? (
                          <>
                            <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                            Enregistrement...
                          </>
                        ) : (
                          <>
                            <CheckCircle style={{ width: 14, height: 14 }} />
                            {currentSessionIndex + 1 >= totalSessions ? "Valider et terminer" : "Valider et suivante"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────── Expert Card Component ────────── */

function ExpertCard({ expert, rank, isRecommended, isSelected, onToggle, showRegion = true }: {
  expert: ExpertData;
  rank?: number;
  isRecommended: boolean;
  isSelected: boolean;
  onToggle: () => void;
  showRegion?: boolean;
}) {
  const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";

  return (
    <div
      onClick={onToggle}
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        border: isSelected
          ? (isRecommended ? "2px solid #2e7d32" : "2px solid #1a6b9c")
          : "1px solid #dce8f0",
        background: isSelected
          ? (isRecommended ? "#f1f8f1" : "#f0f7fb")
          : "white",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 16, height: 16, accentColor: isRecommended ? "#2e7d32" : "#1a6b9c" }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isRecommended && rank && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                  background: rank === 1 ? "#2e7d32" : "#4caf50", color: "white",
                }}>
                  #{rank}
                </span>
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a" }}>{expert.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                background: expert.score >= 2 ? "#e8f5e9" : expert.score === 1 ? "#fff8e1" : "#fce4ec",
                color: expert.score >= 2 ? "#2e7d32" : expert.score === 1 ? "#e65100" : "#c62828",
              }}>
                Score : {expert.score}/{showRegion ? 3 : 2}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#5a6f80", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {expert.hasExpertise && <span style={{ color: "#2e7d32" }}>Expertise {"✓"}</span>}
              {showRegion && expert.sameRegion && <span style={{ color: "#2e7d32" }}>Même région {"✓"}</span>}
              {expert.budgetOk && <span style={{ color: "#2e7d32" }}>Budget OK {"✓"}</span>}
              {expert.city && <span>{expert.city} ({expert.region})</span>}
              {!expert.hasCalendar && <span style={{ color: "#e65100" }}>Pas de calendrier lié</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>{fmtE(expert.totalHT)}</div>
          <div style={{ fontSize: 10, color: "#8399a9" }}>TJM : {fmtE(expert.tjm)}</div>
          {expert.marge > 0 && (
            <div style={{ fontSize: 10, color: "#2e7d32", fontWeight: 600 }}>Marge : {fmtE(expert.marge)}</div>
          )}
          {expert.marge < 0 && (
            <div style={{ fontSize: 10, color: "#e74c3c", fontWeight: 600 }}>Dépassement : {fmtE(Math.abs(expert.marge))}</div>
          )}
        </div>
      </div>
      {isRecommended && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e8ecf1", display: "flex", gap: 16, fontSize: 10, color: "#8399a9" }}>
          <span>Coût TJM : {fmtE(expert.costTjm)}</span>
          <span>Prépa : {fmtE(expert.prepa)}</span>
          <span>Déplacement : {fmtE(expert.deplacement)}</span>
          <span>Expertises : {expert.expertises.length > 0 ? expert.expertises.join(", ") : "N/A"}</span>
        </div>
      )}
    </div>
  );
}
