"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, CalendarPlus, CheckCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

interface ProposedSession {
  session_type: "vt" | "journee";
  session_date: string;
  session_time: string;
  duration_hours: number;
  trainer_name: string;
  session_location: string | null;
  warning?: string;
}

interface PlanificateurResult {
  success: boolean;
  proposedSessions: ProposedSession[];
  selectedTrainer: {
    name: string; firstName: string; score: number; hasExpertise: boolean;
    sameRegion: boolean; budgetOk: boolean; tjm: number; totalHT: number;
    availabilityPct: number; coveredSessions: number; totalSessions: number;
  };
  alternativeTrainers: { name: string; coveredSessions: number; totalSessions: number }[];
  warnings: string[];
  error?: string;
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
}

const LOADING_MESSAGES = [
  "Analyse des experts disponibles...",
  "Scan des agendas Google Calendar...",
  "Vérification des disponibilités...",
  "Génération du planning optimal...",
];

export function PlanificateurModal({ open, onClose, planId, prefill, learnerIds = [] }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "loading" | "results">("form");
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<PlanificateurResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientAvailableDays: [] as string[],
    vtRhythm: "1x/semaine",
    vtTimeSlot: "09:00",
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

  function toggleSession(idx: number) {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleGenerate() {
    setStep("loading");
    setLoadingMsg(0);
    const interval = setInterval(() => {
      setLoadingMsg(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);

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
          vtTimeSlot: form.vtTimeSlot,
          vtDuration: form.vtDuration,
          vtCount: form.vtCount,
          journeeRhythm: form.journeeRhythm,
          journeeLocation: form.journeeLocation,
          daysCount: form.daysCount,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      const data: PlanificateurResult = await res.json();
      setResult(data);
      if (data.success) {
        setSelectedIndices(new Set(data.proposedSessions.map((_, i) => i)));
      }
      setStep("results");
    } catch {
      setResult({ success: false, error: "Erreur réseau", proposedSessions: [], selectedTrainer: {} as any, alternativeTrainers: [], warnings: [] });
      setStep("results");
    } finally {
      clearInterval(interval);
    }
  }

  async function handleValidate() {
    if (!result || !planId) return;
    setSaving(true);
    const supabase = createClient();
    const sessions = result.proposedSessions.filter((_, i) => selectedIndices.has(i));

    for (const session of sessions) {
      const { data: newSession } = await supabase.from("training_sessions").insert({
        service_plan_id: planId,
        session_type: session.session_type,
        session_date: session.session_date,
        session_time: session.session_time,
        duration_hours: session.duration_hours,
        session_location: session.session_location || null,
        trainers: [session.trainer_name],
        is_billable: true,
        status: "planned",
      }).select("id").single();

      if (newSession && learnerIds.length > 0) {
        await supabase.from("training_session_learners").insert(
          learnerIds.map(lid => ({ training_session_id: newSession.id, learner_id: lid }))
        );
      }

      if (newSession) {
        fetch("/api/gcal/sync-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: newSession.id }),
        }).catch(() => {});
      }
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  if (!open) return null;

  const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  const fmtDate = (d: string) => {
    try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); }
    catch { return d; }
  };
  const formationRegion = CITY_REGION[form.city] ?? "";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 900, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarPlus style={{ width: 18, height: 18, color: "#1a6b9c" }} />
            Planificateur intelligent
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Step 1: Form */}
        {step === "form" && (
          <div style={{ padding: 24 }} className="space-y-5">
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
              <div className="grid grid-cols-4 gap-4">
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
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80" }}>Heure préférée</label>
                  <input type="time" value={form.vtTimeSlot} onChange={(e) => setForm({ ...form, vtTimeSlot: e.target.value })}
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
              <button onClick={onClose} style={{ height: 40, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 20px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button
                onClick={handleGenerate}
                disabled={!form.startDate || !form.endDate || (!(parseInt(form.vtCount) > 0) && !(parseInt(form.daysCount) > 0))}
                style={{
                  height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                  background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: (!form.startDate || !form.endDate || (!(parseInt(form.vtCount) > 0) && !(parseInt(form.daysCount) > 0))) ? 0.5 : 1,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CalendarPlus style={{ width: 14, height: 14 }} /> Générer le planning
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Loading */}
        {step === "loading" && (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <Loader2 style={{ width: 40, height: 40, color: "#1a6b9c", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 8 }}>
              {LOADING_MESSAGES[loadingMsg]}
            </p>
            <p style={{ fontSize: 12, color: "#8399a9" }}>
              Cela peut prendre quelques secondes...
            </p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && result && (
          <div style={{ padding: 24 }} className="space-y-5">
            {!result.success ? (
              <div style={{ padding: 20, textAlign: "center", color: "#e74c3c" }}>
                <AlertTriangle style={{ width: 32, height: 32, margin: "0 auto 12px" }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>{result.error || "Erreur lors de la génération"}</p>
                <button onClick={() => setStep("form")} style={{ marginTop: 16, height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 20px", border: "none", cursor: "pointer" }}>
                  Retour au formulaire
                </button>
              </div>
            ) : (
              <>
                {/* Trainer recommendation */}
                <div style={{ padding: 16, borderRadius: 10, background: "linear-gradient(135deg, #e8f5e9 0%, #f0f7fb 100%)", border: "1px solid #c8e6c9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <CheckCircle style={{ width: 18, height: 18, color: "#2e7d32" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#2e7d32" }}>Expert recommandé</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1a2a3a" }}>
                    {result.selectedTrainer.name} — Score : {result.selectedTrainer.score}/3 — Coût : {fmtE(result.selectedTrainer.totalHT)}
                  </div>
                  <div style={{ fontSize: 12, color: "#5a6f80", marginTop: 4 }}>
                    Disponibilité : {result.selectedTrainer.availabilityPct}% ({result.selectedTrainer.coveredSessions}/{result.selectedTrainer.totalSessions} sessions)
                    {result.selectedTrainer.hasExpertise && " · Expertise ✓"}
                    {result.selectedTrainer.sameRegion && " · Même région ✓"}
                    {result.selectedTrainer.budgetOk && " · Budget OK ✓"}
                  </div>
                </div>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div style={{ padding: 12, borderRadius: 8, background: "#fff8e1", borderLeft: "4px solid #f59e0b" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e65100", marginBottom: 4 }}>Points d&apos;attention</div>
                    {result.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#e65100", marginBottom: 2 }}>• {w}</div>
                    ))}
                  </div>
                )}

                {/* Sessions table */}
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a6b9c", borderBottom: "1px solid #dce8f0", paddingBottom: 4 }}>
                  Planning proposé ({result.proposedSessions.length} sessions)
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fbfd" }}>
                        <th style={{ padding: "8px 6px", textAlign: "center", width: 30 }}>
                          <input
                            type="checkbox"
                            checked={selectedIndices.size === result.proposedSessions.length}
                            onChange={() => {
                              if (selectedIndices.size === result.proposedSessions.length) {
                                setSelectedIndices(new Set());
                              } else {
                                setSelectedIndices(new Set(result.proposedSessions.map((_, i) => i)));
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Date</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Type</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Heure</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Durée</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Expert</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Lieu</th>
                        <th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.proposedSessions.map((s, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #e8ecf1", background: s.warning ? "#fff8e1" : "white" }}>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>
                            <input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleSession(i)} />
                          </td>
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
                          <td style={{ padding: "8px 10px", color: "#5a6f80", fontSize: 11 }}>{s.session_location || "Visio"}</td>
                          <td style={{ padding: "8px 6px", fontSize: 10, color: "#e65100" }}>{s.warning || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
                  <button onClick={() => setStep("form")} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                    Modifier les critères
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={saving || selectedIndices.size === 0 || !planId}
                    style={{
                      height: 40, borderRadius: 8, border: "none", padding: "0 24px",
                      background: saving ? "#8399a9" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer",
                    }}
                  >
                    {saving ? "Création en cours..." : `Valider et créer ${selectedIndices.size} session${selectedIndices.size > 1 ? "s" : ""}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
