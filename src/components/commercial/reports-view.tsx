"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDefaultCustomFrom, getCurrentFiscalYearRange, getCurrentFiscalYearStart, getFiscalYearLabel } from "@/lib/fiscal-year";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, User, Building2, MapPin, Mic, MicOff } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

type R = Record<string, unknown>;

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const PIE_COLORS = ["#1a6b9c", "#2ecc71", "#FF6B35", "#8399a9", "#1abc9c", "#e74c3c", "#6C5CE7", "#f39c12"];
const BAR_COLORS = ["#1a6b9c", "#2ecc71", "#FF6B35", "#1abc9c"];

export function ReportsView({
  salesTargets, orders, deals, contacts, activities, meetings, companies, tasks = [],
}: {
  salesTargets: R[];
  orders: R[];
  deals: R[];
  contacts: R[];
  activities: R[];
  meetings: R[];
  companies: R[];
  tasks?: R[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const [selectedReport, setSelectedReport] = useState("general");
  const [inboundMode, setInboundMode] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [outboundMode, setOutboundMode] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [yearlyMode, setYearlyMode] = useState<"full" | "month" | "custom">("full");
  const [yearlyFrom, setYearlyFrom] = useState(() => getDefaultCustomFrom());
  const [yearlyTo, setYearlyTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [rdvOwnerFilter, setRdvOwnerFilter] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskPopup, setTaskPopup] = useState<R | null>(null);
  const [taskEditForm, setTaskEditForm] = useState({ title: "", description: "", due_date: "", task_deadline: "" });
  const [taskEditSaving, setTaskEditSaving] = useState(false);
  const [taskStatus, setTaskStatus] = useState<"all" | "todo" | "done">("all");
  const [taskPeriod, setTaskPeriod] = useState<"all" | "month" | "custom">("all");
  const [taskMonth, setTaskMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [taskFrom, setTaskFrom] = useState("");
  const [taskTo, setTaskTo] = useState("");
  const [nncPeriod, setNncPeriod] = useState<"all" | "month" | "custom">("all");
  const [nncMonth, setNncMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [nncFrom, setNncFrom] = useState("");
  const [nncTo, setNncTo] = useState("");
  const [nncOwner, setNncOwner] = useState("");
  // weekly inbound/outbound filters
  const [filterWeekInbound, setFilterWeekInbound] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  });
  const [filterWeekOutbound, setFilterWeekOutbound] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  });
  // not_booked filters
  const [nbPeriod, setNbPeriod] = useState<"all" | "month" | "custom">("all");
  const [nbMonth, setNbMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [nbFrom, setNbFrom] = useState("");
  const [nbTo, setNbTo] = useState("");
  const [nbOwner, setNbOwner] = useState("");
  const [niPeriod, setNiPeriod] = useState<"all" | "month" | "custom">("all");
  const [niMonth, setNiMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [niFrom, setNiFrom] = useState("");
  const [niTo, setNiTo] = useState("");
  const [niOwner, setNiOwner] = useState("");
  const [clPeriod, setClPeriod] = useState<"all" | "month" | "custom">("all");
  const [clMonth, setClMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [clFrom, setClFrom] = useState("");
  const [clTo, setClTo] = useState("");
  const [clOwner, setClOwner] = useState("");
  // old_contacted filters
  const [ocPeriod, setOcPeriod] = useState<"all" | "month" | "custom">("all");
  const [ocMonth, setOcMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [ocFrom, setOcFrom] = useState("");
  const [ocTo, setOcTo] = useState("");
  const [ocOwner, setOcOwner] = useState("");
  // anciens_clients filters
  const [acPeriod, setAcPeriod] = useState<"all" | "month" | "custom">("all");
  const [acMonth, setAcMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [acFrom, setAcFrom] = useState("");
  const [acTo, setAcTo] = useState("");
  const [acOwner, setAcOwner] = useState("");
  // rdv_non_ferme date filters
  const [rdvPeriod, setRdvPeriod] = useState<"all" | "month" | "custom">("all");
  const [rdvMonth, setRdvMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [rdvFrom, setRdvFrom] = useState("");
  const [rdvTo, setRdvTo] = useState("");
  const [selectedRdv, setSelectedRdv] = useState<R | null>(null);
  const [rdvForm, setRdvForm] = useState({ meeting_type: "R0", status: "booked", duration_minutes: "60", meeting_mode: "visio", notes: "", outcome: "", rdv_result: "" as "" | "signed" | "not_signed" | "quote_to_send" | "opportunity_detected" });
  const [rdvSaving, setRdvSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTarget, setRecordTarget] = useState<"notes" | "outcome">("notes");
  const recognitionRef = useRef<any>(null);
  const [drillDown, setDrillDown] = useState<{
    title: string;
    items: { label: string; sublabel?: string; href?: string; amount?: number }[];
  } | null>(null);

  // Inbound/Outbound filter for list reports
  const [filterContactType, setFilterContactType] = useState<"" | "inbound" | "outbound">("");

  const inboundContacts = contacts.filter((c: R) => (c as any).contact_type === "inbound");
  const outboundContacts = contacts.filter((c: R) => (c as any).contact_type === "outbound");
  const inboundContactIds = new Set(inboundContacts.map(c => c.id as string));
  const outboundContactIds = new Set(outboundContacts.map(c => c.id as string));

  // Helper : enrichit teamMembersSet et repContactIds via meeting.assigned_to
  // quand contact.owner_id est null (fallback)
  function enrichTeamMembersFromMeetings(set: Set<string>, mtgs: R[], validContactIds: Set<string>) {
    mtgs.forEach((m: R) => {
      if (!validContactIds.has(m.contact_id as string)) return;
      const tm = (m as any).team_members as { first_name: string; last_name: string } | null;
      if (tm) set.add(`${tm.first_name} ${tm.last_name}`);
    });
  }
  function enrichRepContactIdsFromMeetings(repIds: Set<string>, repName: string, mtgs: R[], validContactIds: Set<string>) {
    mtgs.forEach((m: R) => {
      const cid = m.contact_id as string;
      if (repIds.has(cid) || !validContactIds.has(cid)) return;
      const tm = (m as any).team_members as { first_name: string; last_name: string } | null;
      if (tm && `${tm.first_name} ${tm.last_name}` === repName) repIds.add(cid);
    });
  }

  function getTeamMemberName(record: R): string {
    const tm = (record as any).team_members as { first_name: string; last_name: string } | null;
    if (!tm) return "";
    return `${tm.first_name} ${tm.last_name}`;
  }

  function getContactNameFromRecord(record: R): string {
    const c = record.contacts as { id?: string; first_name?: string; last_name?: string } | null;
    return c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "—";
  }
  function getContactIdFromRecord(record: R): string | null {
    const c = record.contacts as { id?: string } | null;
    return c?.id ?? (record.contact_id as string | null);
  }

  function drillCell(
    value: number | string,
    style: React.CSSProperties,
    title: string,
    items: { label: string; sublabel?: string; href?: string; amount?: number }[],
  ) {
    const displayValue = typeof value === "number" && value === 0 ? "0" : value;
    const isZero = (typeof value === "number" && value === 0) || value === "0 €";
    if (!items || items.length === 0 || isZero) return <td style={style}>{displayValue}</td>;
    return (
      <td
        style={{ ...style, cursor: "pointer", textDecoration: "underline dotted" }}
        onClick={() => setDrillDown({ title, items })}
      >
        {displayValue}
      </td>
    );
  }

  // Contacts filtered by type dropdown
  const filteredByType = filterContactType
    ? contacts.filter((c: R) => (c as any).contact_type === filterContactType)
    : contacts;
  const filteredContactIds = new Set(filteredByType.map((c: R) => c.id as string));

  const typeFilterSelect = (
    <select
      value={filterContactType}
      onChange={(e) => setFilterContactType(e.target.value as "" | "inbound" | "outbound")}
      style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
    >
      <option value="">Tous les types</option>
      <option value="inbound">Inbound</option>
      <option value="outbound">Outbound</option>
    </select>
  );

  const RDV_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    R0: { bg: "#ede7f6", text: "#4a148c" }, R1: { bg: "#fce4ec", text: "#c62828" },
    R2: { bg: "#e3f2fd", text: "#1565c0" }, R3: { bg: "#e8f5e9", text: "#2e7d32" },
  };
  const RDV_STATUS_LABELS: Record<string, { bg: string; text: string }> = {
    booked: { bg: "#e8f0fe", text: "#0d4f7a" }, done: { bg: "#e8f5e9", text: "#2e7d32" },
    no_show: { bg: "#fce4ec", text: "#c62828" }, cancelled: { bg: "#f5f5f5", text: "#999" },
  };

  function openRdvPopup(m: R) {
    setSelectedRdv(m);
    setRdvForm({
      meeting_type: (m.meeting_type as string) || "R0",
      status: (m.status as string) || "booked",
      duration_minutes: String(m.duration_minutes ?? 60),
      meeting_mode: (m.meeting_mode as string) || "visio",
      notes: (m.notes as string) ?? "",
      outcome: (m.outcome as string) ?? "",
      rdv_result: "",
    });
  }

  async function handleSaveRdvReport() {
    if (!selectedRdv) return;
    setRdvSaving(true);
    const supabase = createClient();
    const m = selectedRdv;
    let outcomeText = rdvForm.outcome || "";
    if (rdvForm.status === "done" && rdvForm.rdv_result) {
      const labels: Record<string, string> = { signed: "Signed", not_signed: "Not signed", quote_to_send: "Devis à envoyer", opportunity_detected: "Opportunité détectée" };
      outcomeText = labels[rdvForm.rdv_result] || rdvForm.rdv_result;
    }
    const originalStatus = m.status as string;
    const newStatus = rdvForm.status;
    if (originalStatus === "booked" && (newStatus === "done" || newStatus === "no_show" || newStatus === "cancelled")) {
      await supabase.from("meetings").insert({
        meeting_type: rdvForm.meeting_type, status: newStatus, scheduled_at: new Date().toISOString(),
        duration_minutes: parseInt(rdvForm.duration_minutes) || 60, meeting_mode: rdvForm.meeting_mode,
        notes: rdvForm.notes || null, outcome: outcomeText || null,
        contact_id: m.contact_id || null, company_id: m.company_id || null, assigned_to: m.assigned_to || null,
      });
      await supabase.from("meetings").update({ next_step: "completed" }).eq("id", m.id as string);
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
        const c = m.contacts as any;
        const contactName = c ? `${c.first_name} ${c.last_name}` : "Deal";
        const companyName = (m.contacts as any)?.companies?.name ? ` - ${(m.contacts as any).companies.name}` : "";
        await supabase.from("deals").insert({
          name: `${contactName}${companyName}`, contact_id: m.contact_id || null, company_id: m.company_id || null,
          owner_id: m.assigned_to || null, stage: dealStage, probability: dealStage === "quote_to_send" ? 40 : 20,
        });
      }
    } else {
      await supabase.from("meetings").update({
        meeting_type: rdvForm.meeting_type, duration_minutes: parseInt(rdvForm.duration_minutes) || 60,
        meeting_mode: rdvForm.meeting_mode, notes: rdvForm.notes || null, outcome: outcomeText || null,
      }).eq("id", m.id as string);
    }
    setRdvSaving(false);
    setSelectedRdv(null);
    stopRdvRecording();
    router.refresh();
  }

  function startRdvRecording(target: "notes" | "outcome") {
    if (typeof window === "undefined") return;
    stopRdvRecording();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "fr-FR"; recognition.continuous = true; recognition.interimResults = true;
    let finalTranscript = target === "notes" ? rdvForm.notes : rdvForm.outcome;
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { finalTranscript += (finalTranscript ? " " : "") + e.results[i][0].transcript; }
        else { interim += e.results[i][0].transcript; }
      }
      setRdvForm(f => ({ ...f, [target]: finalTranscript + (interim ? " " + interim : "") }));
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setRecordTarget(target);
  }

  function stopRdvRecording() {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    setIsRecording(false);
  }

  function openTaskPopup(t: R) {
    setTaskPopup(t);
    setTaskEditForm({
      title: (t.title as string) || "",
      description: (t.description as string) || "",
      due_date: t.due_date ? (t.due_date as string).slice(0, 16) : "",
      task_deadline: (t.task_deadline as string) || "",
    });
  }

  async function handleSaveTaskEdit() {
    if (!taskPopup) return;
    setTaskEditSaving(true);
    const supabase = createClient();
    await supabase.from("activities").update({
      title: taskEditForm.title, description: taskEditForm.description || null,
      due_date: taskEditForm.due_date || null, task_deadline: taskEditForm.task_deadline || null,
    }).eq("id", taskPopup.id as string);
    setTaskEditSaving(false);
    setTaskPopup(null);
    router.refresh();
  }

  async function handleDeleteTaskEdit() {
    if (!taskPopup || !confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer cette tâche ?")) return;
    const supabase = createClient();
    await supabase.from("activities").delete().eq("id", taskPopup.id as string);
    setTaskPopup(null);
    router.refresh();
  }

  async function handleCompleteTaskEdit() {
    if (!taskPopup) return;
    const supabase = createClient();
    await supabase.from("activities").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("id", taskPopup.id as string);
    setTaskPopup(null);
    router.refresh();
  }

  // ===== Computed data =====
  const targets = salesTargets;
  const annualTarget = targets.reduce((s, t) => s + (Number(t.target_amount) || 0), 0) || 860000;

  // Won deals (orders prop now contains closed_won deals)
  const wonDeals = orders;

  // Cumulative data per month — réalisé from won deals
  const monthlyDetail = targets.filter(t => Number(t.target_amount) > 0).map((t, i, arr) => {
    const month = new Date(t.month as string).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
    const mStr = (t.month as string).slice(0, 7);
    const monthEnd = t.month as string;
    const objMensuel = Number(t.target_amount);
    const realise = wonDeals.filter(d => ((d.close_date || d.created_at) as string).startsWith(mStr)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const objCumule = arr.slice(0, i + 1).reduce((s, x) => s + Number(x.target_amount), 0);
    const dealsUpToMonth = wonDeals.filter(d => ((d.close_date || d.created_at) as string) <= monthEnd);
    const realiseCumule = dealsUpToMonth.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const taux = objCumule > 0 ? Math.round((realiseCumule / objCumule) * 100) : 0;
    return { month, objMensuel, realise, objCumule, realiseCumule, taux };
  });

  const totalOrders = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const annualPct = annualTarget > 0 ? (totalOrders / annualTarget) * 100 : 0;

  // Current month (last with actual > 0)
  // Current month based on actual date, not last month with CA
  const nowDate = new Date();
  const nowMonthEnd = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-31`;
  const currentIdx = targets.filter(t => Number(t.target_amount) >= 0 && (t.month as string) <= nowMonthEnd).length - 1;
  const currentMonth = currentIdx >= 0 ? monthlyDetail[currentIdx] : null;
  const objCumuleNow = targets
    .filter(t => (t.month as string) <= nowMonthEnd)
    .reduce((s, t) => s + (Number(t.target_amount) || 0), 0);
  const ecart = totalOrders - objCumuleNow;
  const ecartPct = objCumuleNow > 0 ? Math.round(Math.abs(ecart) / objCumuleNow * 100) : 0;

  // Source breakdown
  const sourceMap: Record<string, number> = {};
  orders.forEach((o) => {
    const src = (o.lead_sources as { name: string } | null)?.name ?? "Autre";
    // Normalize: "Renouvellement" → "Renew"
    const normalized = src === "Renouvellement" ? "Renew" : src;
    sourceMap[normalized] = (sourceMap[normalized] || 0) + (Number(o.amount) || 0);
  });
  const sourceData = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Consultant breakdown
  const trainerMap: Record<string, number> = {};
  orders.forEach((o) => {
    const tm = o.team_members as { first_name: string; last_name: string } | null;
    const name = tm ? tm.first_name : "Autre";
    trainerMap[name] = (trainerMap[name] || 0) + (Number(o.amount) || 0);
  });
  const trainerData = Object.entries(trainerMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Opportunities vs Pipe
  const oppDeals = deals.filter(d => d.stage === "opportunities");
  const pipeDeals = deals.filter(d => ["opportunities", "quote_to_send", "quote_sent", "opco_deposit", "quote_signed"].includes(d.stage as string));
  const oppAmount = oppDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const pipeAmount = pipeDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const oppPipeData = [
    { name: "Opportunités", montant: oppAmount, nombre: oppDeals.length },
    { name: "Pipe", montant: pipeAmount, nombre: pipeDeals.length },
  ];

  // Progress bar months labels
  const monthLabels = ["S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A"];

  return (
    <div className="p-6 space-y-5">
      {/* Report selector */}
      <div className="flex items-center gap-4">
        <select
          style={{
            height: 40, borderRadius: 10, border: "1px solid #dce8f0",
            background: "white", padding: "0 16px", fontSize: 14,
            fontWeight: 600, color: "#1a2a3a", minWidth: 250,
          }}
          value={selectedReport}
          onChange={(e) => setSelectedReport(e.target.value)}
        >
          <option value="general">Rapport Général</option>
          <option value="rdv_types">Activité Commerciale</option>
          <option value="new_not_contacted">New Not Contacted</option>
          <option value="not_booked">Contacted Not Booked</option>
          <option value="old_contacted">Old Contacted</option>
          <option value="anciens_clients">Anciens Clients</option>
          <option value="rdv_non_ferme">Rdvs non fermés</option>
          <option value="cancelled">Rdv annulés</option>
          <option value="rdv_planifies">RDV planifiés</option>
          <option value="taches">Tâches à faire</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="pas_interesse">Pas intéressé</option>
        </select>
      </div>

      {selectedReport === "general" && (
        <>
          {/* 4 KPIs */}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="lca-card">
              <div style={{ height: 4, background: "#1a6b9c" }} />
              <div style={{ padding: 14 }}>
                <div className="lca-label">Objectif annuel</div>
                <div className="lca-value">{fmt(annualTarget)}</div>
                <div className="lca-sub">Objectif cumulé</div>
              </div>
            </div>
            <div className="lca-card">
              <div style={{ height: 4, background: "#27ae60" }} />
              <div style={{ padding: 14 }}>
                <div className="lca-label">Commandes réalisées</div>
                <div className="lca-value">{fmt(totalOrders)}</div>
                <div className="lca-sub-green">{annualPct.toFixed(1)}% de l&apos;objectif</div>
              </div>
            </div>
            <div className="lca-card">
              <div style={{ height: 4, background: "#1a6b9c" }} />
              <div style={{ padding: 14 }}>
                <div className="lca-label">Obj. cumulé ({currentMonth?.month ?? "—"})</div>
                <div className="lca-value">{fmt(objCumuleNow)}</div>
                <div className="lca-sub">{currentIdx + 1} mois écoulés</div>
              </div>
            </div>
            <div className="lca-card">
              <div style={{ height: 4, background: ecart >= 0 ? "#27ae60" : "#e74c3c" }} />
              <div style={{ padding: 14 }}>
                <div className="lca-label">Écart vs objectif</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ecart >= 0 ? "#27ae60" : "#e74c3c" }}>{fmt(ecart)}</div>
                <span className={ecart >= 0 ? "lca-badge-green" : "lca-badge-red"}>
                  {ecart >= 0 ? `Avance ${ecartPct}%` : `Retard ${ecartPct}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Progression annuelle */}
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="lca-label">Progression annuelle {getFiscalYearLabel(getCurrentFiscalYearStart())}</div>
                  <div className="lca-sub">{fmt(totalOrders)} réalisés sur {fmt(annualTarget)}</div>
                </div>
                <div className="lca-big-pct">{annualPct.toFixed(1)}%</div>
              </div>
              {/* Progress bar */}
              <div className="lca-progress-wrapper">
                <div className="lca-progress-track">
                  <div
                    className="lca-progress-fill"
                    style={{
                      width: `${Math.min(annualPct, 100)}%`,
                      background: "linear-gradient(90deg, #0a3d5f 0%, #1a6b9c 40%, #1a6b9c 70%, #FF6B35 100%)",
                    }}
                  />
                </div>
                <div className="lca-progress-badge" style={{ left: `clamp(0px, calc(${Math.min(annualPct, 100)}% - 20px), calc(100% - 40px))` }}>
                  {Math.round(annualPct)}%
                </div>
              </div>
              <div className="flex justify-between" style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#8399a9" }}>0 €</span>
                <span style={{ fontSize: 12, color: "#FF6B35", fontWeight: 700 }}>{fmt(totalOrders)}</span>
                <span style={{ fontSize: 12, color: "#8399a9" }}>{fmt(annualTarget)}</span>
              </div>
              {/* Month labels */}
              <div className="flex justify-between" style={{ marginTop: 4, padding: "0 2%" }}>
                {monthLabels.map((m, i) => (
                  <span key={i} style={{ fontSize: 10, color: "#8399a9", fontWeight: 600 }}>{m}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Donut Source + Détail Mensuel */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Donut */}
            <div className="lca-card">
              <div style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 16 }}>Commandes par Source</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      dataKey="value"
                      stroke="none"
                      animationDuration={1200}
                      animationBegin={100}
                      animationEasing="ease-out"
                    >
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Détail Mensuel */}
            <div className="lca-card">
              <div style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 16 }}>Détail Mensuel</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>MOIS</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11, textAlign: "right" }}>OBJ MENSUEL</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11, textAlign: "right" }}>RÉALISÉ</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11, textAlign: "right" }}>OBJ CUMULÉ</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11, textAlign: "right" }}>RÉALISÉ CUMULÉ</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11, textAlign: "right" }}>TAUX</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyDetail.map((m, i) => {
                        const isLast = i === monthlyDetail.length - 1;
                        return (
                          <TableRow key={m.month} style={isLast ? { background: "#e6f0f7" } : {}}>
                            <TableCell style={{ fontWeight: 700, color: "#1a2a3a", textTransform: "capitalize" }}>{m.month}.</TableCell>
                            <TableCell style={{ textAlign: "right" }}>{fmt(m.objMensuel)}</TableCell>
                            <TableCell style={{ textAlign: "right" }}>{fmt(m.realise)}</TableCell>
                            <TableCell style={{ textAlign: "right", fontWeight: isLast ? 700 : 400 }}>{fmt(m.objCumule)}</TableCell>
                            <TableCell style={{ textAlign: "right", fontWeight: isLast ? 700 : 400 }}>{fmt(m.realiseCumule)}</TableCell>
                            <TableCell style={{ textAlign: "right", fontWeight: 700, color: m.taux >= 70 ? "#1a6b9c" : "#e74c3c" }}>{m.taux}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>

          {/* Bar Consultant + Opp vs Pipe */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Commandes par Consultant */}
            <div className="lca-card">
              <div style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 16 }}>Commandes par Consultant</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trainerData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "#8399a9", fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(v / 1000)}K €`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#1a2a3a", fontSize: 13, fontWeight: 600 }}
                      width={80}
                    />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={1000} animationBegin={200} animationEasing="ease-out">
                      {trainerData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Opportunités vs Pipe */}
            <div className="lca-card">
              <div style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 16 }}>Opportunités vs Pipe</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={oppPipeData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="name" tick={{ fill: "#1a2a3a", fontSize: 12, fontWeight: 600 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#8399a9", fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(v / 1000)}K €`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#8399a9", fontSize: 11 }}
                    />
                    <Tooltip formatter={(v, name) => [name === "montant" ? fmt(Number(v)) : v, name === "montant" ? "Montant (€)" : "Nombre"]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="montant" name="Montant (€)" fill="#FF6B35" radius={[6, 6, 0, 0]} animationDuration={1000} animationBegin={200} animationEasing="ease-out" />
                    <Bar yAxisId="right" dataKey="nombre" name="Nombre" fill="#1a6b9c" radius={[6, 6, 0, 0]} animationDuration={1200} animationBegin={400} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Report: New Not Contacted ===== */}
      {selectedReport === "new_not_contacted" && (() => {
        // All owners for filter
        const allOwners = new Map<string, string>();
        filteredByType.forEach((c: R) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) allOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const ownerList = Array.from(allOwners.keys()).sort();

        const newContacts = filteredByType.filter((c) => {
          if (c.lead_status !== "lead") return false;
          // Date filter on created_at
          const created = c.created_at as string | undefined;
          if (created && nncPeriod !== "all") {
            const dateOnly = created.split("T")[0];
            if (nncPeriod === "month" && !dateOnly.startsWith(nncMonth)) return false;
            if (nncPeriod === "custom") {
              if (nncFrom && dateOnly < nncFrom) return false;
              if (nncTo && dateOnly > nncTo) return false;
            }
          }
          // Owner filter
          if (nncOwner) {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            const name = tm ? `${tm.first_name} ${tm.last_name}` : "";
            if (name !== nncOwner) return false;
          }
          return true;
        });

        function fmtDate(d: string | null | undefined): string {
          if (!d) return "—";
          try { return format(new Date(d as string), "dd MMM yyyy", { locale: fr }); } catch { return "—"; }
        }

        return (
          <>
            {/* Filtres */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={nncPeriod} onChange={(e) => setNncPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {nncPeriod === "month" && (
                <input type="month" value={nncMonth} onChange={(e) => setNncMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {nncPeriod === "custom" && (
                <>
                  <input type="date" value={nncFrom} onChange={(e) => setNncFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={nncTo} onChange={(e) => setNncTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={nncOwner} onChange={(e) => setNncOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les Account Managers</option>
                {ownerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            {/* KPIs */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total New Not Contacted</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{newContacts.length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Avec entreprise</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{newContacts.filter(c => c.company_id).length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sans entreprise</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#8399a9" }}>{newContacts.filter(c => !c.company_id).length}</div>
                </div>
              </div>
            </div>

            {/* Par propriétaire */}
            {/* Full table */}
            <div className="lca-card">
              <div style={{ height: 4, background: "#e74c3c" }} />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Tous les contacts New Not Contacted</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>NOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>EMAIL</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>TÉLÉPHONE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>ENTREPRISE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PROPRIÉTAIRE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>CRÉÉ LE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newContacts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8" style={{ color: "#8399a9" }}>
                            Aucun contact New Not Contacted
                          </TableCell>
                        </TableRow>
                      ) : newContacts.map((c) => {
                        const tm = c.team_members as { first_name: string; last_name: string } | null;
                        const co = c.companies as { name: string } | null;
                        return (
                          <TableRow
                            key={c.id as string}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/contacts/${c.id}`)}
                          >
                            <TableCell className="font-medium">{c.first_name as string} {c.last_name as string}</TableCell>
                            <TableCell>{(c.email as string) ?? "—"}</TableCell>
                            <TableCell>{formatPhone(c.phone as string | null)}</TableCell>
                            <TableCell>{co?.name ?? "—"}</TableCell>
                            <TableCell>
                              {tm ? (
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#0d4f7a", color: "white", fontSize: 10, fontWeight: 700 }} title={`${tm.first_name} ${tm.last_name}`}>
                                  {tm.first_name[0]}{tm.last_name[0]}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{fmtDate(c.created_at as string)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Contacted Not Booked ===== */}
      {selectedReport === "not_booked" && (() => {
        // All owners for filter
        const nbAllOwners = new Map<string, string>();
        filteredByType.forEach((c: R) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) nbAllOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const nbOwnerList = Array.from(nbAllOwners.keys()).sort();

        const notBookedContacts = filteredByType.filter((c) => {
          if (c.lead_status !== "contacted") return false;
          // Date filter on created_at
          const created = c.created_at as string | undefined;
          if (created && nbPeriod !== "all") {
            const dateOnly = created.split("T")[0];
            if (nbPeriod === "month" && !dateOnly.startsWith(nbMonth)) return false;
            if (nbPeriod === "custom") {
              if (nbFrom && dateOnly < nbFrom) return false;
              if (nbTo && dateOnly > nbTo) return false;
            }
          }
          // Owner filter
          if (nbOwner) {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            const name = tm ? `${tm.first_name} ${tm.last_name}` : "";
            if (name !== nbOwner) return false;
          }
          return true;
        });

        function fmtDate(d: string | null | undefined): string {
          if (!d) return "—";
          try { return format(new Date(d as string), "dd MMM yyyy", { locale: fr }); } catch { return "—"; }
        }

        return (
          <>
            {/* Filtres */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={nbPeriod} onChange={(e) => setNbPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {nbPeriod === "month" && (
                <input type="month" value={nbMonth} onChange={(e) => setNbMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {nbPeriod === "custom" && (
                <>
                  <input type="date" value={nbFrom} onChange={(e) => setNbFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={nbTo} onChange={(e) => setNbTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={nbOwner} onChange={(e) => setNbOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les Account Managers</option>
                {nbOwnerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total Contacted Not Booked</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{notBookedContacts.length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Avec entreprise</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{notBookedContacts.filter(c => c.company_id).length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sans entreprise</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#8399a9" }}>{notBookedContacts.filter(c => !c.company_id).length}</div>
                </div>
              </div>
            </div>

            <div className="lca-card">
              <div style={{ height: 4, background: "#FF6B35" }} />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Tous les contacts Contactés mais Contacted Not Booked</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>NOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>EMAIL</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>TÉLÉPHONE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>ENTREPRISE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PROPRIÉTAIRE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>DERNIER CONTACT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notBookedContacts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8" style={{ color: "#8399a9" }}>
                            Aucun contact Contacted Not Booked
                          </TableCell>
                        </TableRow>
                      ) : notBookedContacts.map((c) => {
                        const tm = c.team_members as { first_name: string; last_name: string } | null;
                        const co = c.companies as { name: string } | null;
                        return (
                          <TableRow
                            key={c.id as string}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/contacts/${c.id}`)}
                          >
                            <TableCell className="font-medium">{c.first_name as string} {c.last_name as string}</TableCell>
                            <TableCell>{(c.email as string) ?? "—"}</TableCell>
                            <TableCell>{formatPhone(c.phone as string | null)}</TableCell>
                            <TableCell>{co?.name ?? "—"}</TableCell>
                            <TableCell>
                              {tm ? (
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#0d4f7a", color: "white", fontSize: 10, fontWeight: 700 }} title={`${tm.first_name} ${tm.last_name}`}>
                                  {tm.first_name[0]}{tm.last_name[0]}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{fmtDate(c.last_contacted_at as string)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Old Contacted ===== */}
      {selectedReport === "old_contacted" && (() => {
        // All owners for filter
        const ocAllOwners = new Map<string, string>();
        filteredByType.forEach((c: R) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) ocAllOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const ocOwnerList = Array.from(ocAllOwners.keys()).sort();

        // Build sets of contact IDs that have multiple activities or any meeting
        const activityCountByContact: Record<string, number> = {};
        activities.forEach((a) => {
          const cid = a.contact_id as string;
          if (cid) activityCountByContact[cid] = (activityCountByContact[cid] || 0) + 1;
        });
        const contactsWithMeeting = new Set(meetings.map((m) => m.contact_id as string).filter(Boolean));

        // Old contacted = status "contacted" AND (has >1 activity OR has had a meeting)
        const oldContacted = filteredByType.filter((c) => {
          if (c.lead_status !== "contacted") return false;
          const cid = c.id as string;
          const hasMultipleActivities = (activityCountByContact[cid] || 0) > 1;
          const hasMeeting = contactsWithMeeting.has(cid);
          if (!hasMultipleActivities && !hasMeeting) return false;
          // Date filter on created_at
          const created = c.created_at as string | undefined;
          if (created && ocPeriod !== "all") {
            const dateOnly = created.split("T")[0];
            if (ocPeriod === "month" && !dateOnly.startsWith(ocMonth)) return false;
            if (ocPeriod === "custom") {
              if (ocFrom && dateOnly < ocFrom) return false;
              if (ocTo && dateOnly > ocTo) return false;
            }
          }
          // Owner filter
          if (ocOwner) {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            const name = tm ? `${tm.first_name} ${tm.last_name}` : "";
            if (name !== ocOwner) return false;
          }
          return true;
        });

        function fmtDate(d: string | null | undefined): string {
          if (!d) return "—";
          try { return format(new Date(d as string), "dd MMM yyyy", { locale: fr }); } catch { return "—"; }
        }

        // Count how many activities/meetings per contact
        function getContactHistory(cid: string) {
          const nbActivities = activityCountByContact[cid] || 0;
          const contactMeetings = meetings.filter(m => m.contact_id === cid);
          const nbMeetings = contactMeetings.length;
          return { nbActivities, nbMeetings };
        }

        return (
          <>
            {/* Filtres */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={ocPeriod} onChange={(e) => setOcPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {ocPeriod === "month" && (
                <input type="month" value={ocMonth} onChange={(e) => setOcMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {ocPeriod === "custom" && (
                <>
                  <input type="date" value={ocFrom} onChange={(e) => setOcFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={ocTo} onChange={(e) => setOcTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={ocOwner} onChange={(e) => setOcOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les Account Managers</option>
                {ocOwnerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total Old Contacted</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#6a1b9a" }}>{oldContacted.length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Avec RDV passé</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{oldContacted.filter(c => contactsWithMeeting.has(c.id as string)).length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Multi-contactés (sans RDV)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{oldContacted.filter(c => !contactsWithMeeting.has(c.id as string)).length}</div>
                </div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Avec entreprise</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#8399a9" }}>{oldContacted.filter(c => c.company_id).length}</div>
                </div>
              </div>
            </div>

            <div className="lca-card">
              <div style={{ height: 4, background: "#6a1b9a" }} />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Tous les Old Contacted</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>NOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>EMAIL</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>TÉLÉPHONE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>ENTREPRISE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>ACTIVITÉS</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>RDV</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PROPRIÉTAIRE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>DERNIER CONTACT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oldContacted.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8" style={{ color: "#8399a9" }}>
                            Aucun contact Old Contacted
                          </TableCell>
                        </TableRow>
                      ) : oldContacted.map((c) => {
                        const tm = c.team_members as { first_name: string; last_name: string } | null;
                        const co = c.companies as { name: string } | null;
                        const h = getContactHistory(c.id as string);
                        return (
                          <TableRow
                            key={c.id as string}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/contacts/${c.id}`)}
                          >
                            <TableCell className="font-medium">{c.first_name as string} {c.last_name as string}</TableCell>
                            <TableCell>{(c.email as string) ?? "—"}</TableCell>
                            <TableCell>{formatPhone(c.phone as string | null)}</TableCell>
                            <TableCell>{co?.name ?? "—"}</TableCell>
                            <TableCell style={{ textAlign: "center" }}>
                              <span style={{ background: "#e3f2fd", color: "#1565c0", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{h.nbActivities}</span>
                            </TableCell>
                            <TableCell style={{ textAlign: "center" }}>
                              {h.nbMeetings > 0 ? (
                                <span style={{ background: "#f3e5f5", color: "#6a1b9a", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{h.nbMeetings}</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {tm ? (
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#0d4f7a", color: "white", fontSize: 10, fontWeight: 700 }} title={`${tm.first_name} ${tm.last_name}`}>
                                  {tm.first_name[0]}{tm.last_name[0]}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{fmtDate(c.last_contacted_at as string)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Monthly ===== */}
      {selectedReport === "inbound" && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["weekly", "monthly", "yearly"] as const).map(mode => (
            <button key={mode} onClick={() => setInboundMode(mode)}
              style={{ height: 32, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: inboundMode === mode ? 700 : 500, border: `1px solid ${inboundMode === mode ? "#1a6b9c" : "#dce8f0"}`, background: inboundMode === mode ? "#1a6b9c" : "white", color: inboundMode === mode ? "white" : "#5a6f80", cursor: "pointer" }}>
              {mode === "weekly" ? "Weekly" : mode === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      )}

      {selectedReport === "inbound" && inboundMode === "monthly" && (() => {
        // Filter by selected month
        const monthStart = `${selectedMonth}-01`;
        const monthEnd = (() => {
          const [y, m] = selectedMonth.split("-").map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          return `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
        })();

        function isInMonth(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= monthStart && d <= monthEnd;
        }

        const monthLabel = (() => {
          const [y, m] = selectedMonth.split("-").map(Number);
          return new Date(y, m - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        })();

        // Filter activities and meetings for this month
        const monthActivities = activities.filter(a => isInMonth(a.created_at as string));
        const monthMeetings = meetings.filter(m => isInMonth(m.scheduled_at as string));
        const monthOrders = orders.filter(o => isInMonth(((o.close_date || o.created_at) as string)));

        // Build per-sales-rep data from meeting assignees + activity performers + contact owners
        const teamMembersSet = new Set<string>();
        // From contact owners (for leads count)
        inboundContacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });
        // From meeting assignees (primary attribution)
        monthMeetings.forEach((m) => {
          if (!inboundContactIds.has(m.contact_id as string)) return;
          const name = getTeamMemberName(m);
          if (name) teamMembersSet.add(name);
        });
        // From activity performers
        monthActivities.forEach((a) => {
          if (!inboundContactIds.has(a.contact_id as string)) return;
          const name = getTeamMemberName(a);
          if (name) teamMembersSet.add(name);
        });

        const reps = Array.from(teamMembersSet).map((repName) => {
          // Contacts owned by this rep (for leads/contacts count)
          const repContacts = inboundContacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Meetings ASSIGNED TO this rep (on inbound contacts)
          const repMeetings = monthMeetings.filter((m) => {
            if (!inboundContactIds.has(m.contact_id as string)) return false;
            return getTeamMemberName(m) === repName;
          });

          // Activities PERFORMED BY this rep (on inbound contacts)
          const repActivities = monthActivities.filter((a) => {
            if (!inboundContactIds.has(a.contact_id as string)) return false;
            return getTeamMemberName(a) === repName;
          });

          // Build repContactIds from BOTH owned contacts + contacts from meetings/activities
          const repContactIds = new Set([
            ...repContacts.map(c => c.id as string),
            ...repMeetings.map(m => m.contact_id as string),
            ...repActivities.map(a => a.contact_id as string),
          ].filter(Boolean));

          // First-ever REAL contact date per contact (ALL reps, exclude unanswered calls)
          const firstInteraction: Record<string, string> = {};
          activities.forEach((a: R) => {
            const cid = a.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            if ((a.type as string) === "appel") {
              const desc = String((a as any).description ?? "");
              if (desc.includes("Pas de réponse") || desc.includes("Message vocal")) return;
            }
            const d = (a.created_at as string).slice(0, 10);
            if (!firstInteraction[cid] || d < firstInteraction[cid]) firstInteraction[cid] = d;
          });
          meetings.forEach((m: R) => {
            const cid = m.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            const d = (m.scheduled_at as string).slice(0, 10);
            if (!firstInteraction[cid] || d < firstInteraction[cid]) firstInteraction[cid] = d;
          });

          // Unique contacts actually reached this period by THIS rep (activities only, not meetings)
          const contactedThisPeriod = new Set<string>();
          repActivities.forEach((a: R) => {
            if (!a.contact_id) return;
            if (a.type === "appel") {
              const desc = String(a.description ?? "");
              if (desc.includes("Pas de réponse") || desc.includes("Message vocal")) return;
            }
            contactedThisPeriod.add(a.contact_id as string);
          });

          // New contacted = first-ever interaction is in this month
          const newCtedContacts = new Set([...contactedThisPeriod].filter(cid => {
            const f = firstInteraction[cid];
            return f && f >= monthStart && f <= monthEnd;
          }));
          const newCted = newCtedContacts.size;
          const oldCted = contactedThisPeriod.size - newCted;

          // First-ever meeting date per contact (ALL reps)
          const firstMeeting: Record<string, string> = {};
          meetings.forEach((m: R) => {
            const cid = m.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            const d = (m.scheduled_at as string).slice(0, 10);
            if (!firstMeeting[cid] || d < firstMeeting[cid]) firstMeeting[cid] = d;
          });

          // New booked = unique contacts whose first-ever meeting falls in this month
          const bookedThisMonth = new Set(repMeetings.map((m: R) => m.contact_id as string).filter(Boolean));
          const newBkdContacts = new Set([...bookedThisMonth].filter(cid => {
            const f = firstMeeting[cid];
            return f && f >= monthStart && f <= monthEnd;
          }));
          const newBkd = newBkdContacts.size;
          const oldBked = bookedThisMonth.size - newBkd;

          const doneMeetings = repMeetings.filter((m: R) => m.status === "done");
          const doneThisMonth = new Set(doneMeetings.map((m: R) => m.contact_id as string).filter(Boolean));
          const newDoneContacts = new Set([...doneThisMonth].filter(cid => {
            const f = firstMeeting[cid];
            return f && f >= monthStart && f <= monthEnd;
          }));
          const newDone = newDoneContacts.size;
          const oldDone = doneMeetings.length - newDone;

          const repOrders = monthOrders.filter((o) => {
            const tm = o.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          const repDeals = deals.filter((d) => {
            const tm = d.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          const pctBked = oldCted > 0 ? Math.round((oldBked / oldCted) * 100) : 0;

          const repContactsInPeriod = repContacts.filter(c => {
            const d = (c.created_at as string).slice(0, 10);
            return d >= monthStart && d <= monthEnd;
          });
          const monthlyLeads = repContactsInPeriod.length;
          const monthlyLeadsCted = newCted + oldCted;
          const pctCtedOn90 = monthlyLeads > 0 ? Math.round((monthlyLeadsCted / monthlyLeads) * 100) : 0;

          const diffNLeads = newCted;

          const pctNewCted = monthlyLeads > 0 ? Math.round((newCted / monthlyLeads) * 100) : 0;
          const pctNewBked = newCted > 0 ? Math.round((newBkd / newCted) * 100) : 0;

          const attendNew = repContacts.filter(c => c.lead_status === "lead").length;
          const pctAttend = monthlyLeads > 0 ? Math.round(((monthlyLeads - attendNew) / monthlyLeads) * 100) : 0;

          const totalDone = oldDone + newDone;
          const nSigned = repDeals.filter(d => d.stage === "closed_won" && isInMonth((d.close_date || d.created_at) as string)).length;
          const closingTotal = totalDone > 0 ? Math.round((nSigned / totalDone) * 100) : 0;
          const closingNew = newDone > 0 ? Math.round((nSigned / newDone) * 100) : 0;

          const caHT = repOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
          const nbOrders = repOrders.length;
          const avgPrice = nbOrders > 0 ? Math.round(caHT / nbOrders) : 0;
          const gainsPerCts = monthlyLeads > 0 ? Math.round(caHT / monthlyLeads) : caHT;

          const pctBking = monthlyLeads > 0 ? Math.round((oldBked / monthlyLeads) * 100) : 0;
          const pctAttendMkt = monthlyLeads > 0 ? Math.round((totalDone / monthlyLeads) * 100) : 0;
          const pctClosingMkt = monthlyLeads > 0 ? Math.round((nSigned / monthlyLeads) * 100) : 0;
          const pctGoalDone = 0;

          return {
            name: repName,
            oldCted, oldBked, pctBked, oldDone,
            monthlyLeads, monthlyLeadsCted, pctCtedOn90, diffNLeads,
            newCted, pctNewCted, newBkd, pctNewBked, newDone,
            attendNew, pctAttend, totalDone, nSigned,
            closingTotal, closingNew, caHT, avgPrice, gainsPerCts,
            pctBking, pctAttendMkt, pctClosingMkt, pctGoalDone,
            _repContacts: repContactsInPeriod,
            _repMeetings: repMeetings,
            _doneMeetings: doneMeetings,
            _repDeals: repDeals,
            _repOrders: repOrders,
            _newBkdContacts: newBkdContacts,
            _newCtedContacts: newCtedContacts,
            _newDoneContacts: newDoneContacts,
          };
        });

        // Grand total
        const gt = reps.reduce((acc, r) => ({
          oldCted: acc.oldCted + r.oldCted,
          oldBked: acc.oldBked + r.oldBked,
          oldDone: acc.oldDone + r.oldDone,
          monthlyLeads: acc.monthlyLeads + r.monthlyLeads,
          monthlyLeadsCted: acc.monthlyLeadsCted + r.monthlyLeadsCted,
          diffNLeads: acc.diffNLeads + r.diffNLeads,
          newCted: acc.newCted + r.newCted,
          newBkd: acc.newBkd + r.newBkd,
          newDone: acc.newDone + r.newDone,
          totalDone: acc.totalDone + r.totalDone,
          nSigned: acc.nSigned + r.nSigned,
          caHT: acc.caHT + r.caHT,
        }), { oldCted: 0, oldBked: 0, oldDone: 0, monthlyLeads: 0, monthlyLeadsCted: 0, diffNLeads: 0, newCted: 0, newBkd: 0, newDone: 0, totalDone: 0, nSigned: 0, caHT: 0 });

        function initials(name: string) {
          return name.split(" ").map(w => w[0]).join("").toUpperCase();
        }

        const th: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: "#1a6b9c", textAlign: "center", padding: "4px 2px", borderBottom: "2px solid #1a6b9c", lineHeight: 1.2, whiteSpace: "normal" };
        const thH: React.CSSProperties = { ...th, background: "#e6f0f7" };
        const td: React.CSSProperties = { fontSize: 11, textAlign: "center", padding: "5px 2px", borderBottom: "1px solid #e6f0f7" };
        const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "#1a2a3a" };
        const tdC: React.CSSProperties = { ...td, color: "#1a6b9c", fontWeight: 600 };
        const tdHL: React.CSSProperties = { ...td, background: "#e6f0f7" };
        const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: "#1a2a3a" };

        return (
          <>
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Monthly Inbound — <span style={{ textTransform: "capitalize" }}>{monthLabel}</span></h3>
                  <div className="flex gap-2 items-center">
                  <ExportButton onExport={(fmt: ExportFormat) => exportData(
                    reps.map((r) => ({ rep: r.name, old_contacted: r.oldCted, old_booked: r.oldBked, pct_booked: r.pctBked, old_done: r.oldDone, monthly_leads: r.monthlyLeads, new_contacted: r.newCted, pct_new_contacted: r.pctNewCted, new_booked: r.newBkd, pct_new_booked: r.pctNewBked, new_done: r.newDone, total_done: r.totalDone, n_signes: r.nSigned, ca_ht: r.caHT, prix_moyen: r.avgPrice })),
                    [{ key: "rep", label: "Commercial" }, { key: "old_contacted", label: "Old Contacted" }, { key: "old_booked", label: "Old Booked" }, { key: "pct_booked", label: "% Booked" }, { key: "old_done", label: "Old Done" }, { key: "monthly_leads", label: "Monthly Leads" }, { key: "new_contacted", label: "New Contacted" }, { key: "pct_new_contacted", label: "% New Contacted" }, { key: "new_booked", label: "New Booked" }, { key: "pct_new_booked", label: "% New Booked" }, { key: "new_done", label: "New Done" }, { key: "total_done", label: "Total Done" }, { key: "n_signes", label: "N° Signés" }, { key: "ca_ht", label: "CA HT" }, { key: "prix_moyen", label: "Prix Moyen" }],
                    `inbound_monthly_${selectedMonth}`, fmt
                  )} />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                  />
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left", width: 36 }}>Sales<br />Rep</th>
                      <th style={th}>Old<br />Cted</th>
                      <th style={th}>Old<br />Bked</th>
                      <th style={th}>%<br />Bked</th>
                      <th style={th}>Old<br />Done</th>
                      <th style={th}>Mthly<br />Leads</th>
                      <th style={thH}>New<br />Cted</th>
                      <th style={thH}>% New<br />Cted</th>
                      <th style={thH}>New<br />Bkd</th>
                      <th style={thH}>%<br />Bked</th>
                      <th style={thH}>New<br />Done</th>
                      <th style={th}>Attend<br />New</th>
                      <th style={th}>Total<br />Done</th>
                      <th style={th}>N°<br />Sign.</th>
                      <th style={th}>Clos.<br />Total</th>
                      <th style={th}>Clos.<br />New</th>
                      <th style={{ ...th, fontWeight: 800 }}>CA<br />HT</th>
                      <th style={th}>Prix<br />Moy.</th>
                      <th style={th}>Gains<br />/Cts</th>
                      <th style={th}>%<br />Bking</th>
                      <th style={th}>%<br />Attend</th>
                      <th style={th}>%<br />Clos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tdL, color: "#1a6b9c" }} title={r.name}>{initials(r.name)}</td>
                        {drillCell(r.oldCted, tdB, `Old Contacted — ${r.name}`, [...new Set([...(r._repMeetings as R[]).map((m: R) => m.contact_id as string)])].filter(cid => !r._newCtedContacts.has(cid)).map(cid => { const c = contacts.find((ct: R) => (ct.id as string) === cid); return c ? { label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` } : null; }).filter(Boolean) as any[])}
                        {drillCell(r.oldBked, tdB, `Old Booked — ${r.name}`, (r._repMeetings as R[]).filter((m: R) => !r._newBkdContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctBked}%</td>
                        {drillCell(r.oldDone, tdB, `Old Done — ${r.name}`, (r._doneMeetings as R[]).filter((m: R) => !r._newDoneContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        {drillCell(r.monthlyLeads, tdB, `Monthly Leads — ${r.name}`, (r._repContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.newCted, { ...tdHL, fontWeight: 700 }, `New Contacted — ${r.name}`, [...r._newCtedContacts].map(cid => { const c = contacts.find((ct: R) => (ct.id as string) === cid); return c ? { label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` } : null; }).filter(Boolean) as any[])}
                        <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{r.pctNewCted}%</td>
                        {drillCell(r.newBkd, { ...tdHL, fontWeight: 700 }, `New Booked — ${r.name}`, (r._repMeetings as R[]).filter((m: R) => r._newBkdContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{r.pctNewBked}%</td>
                        {drillCell(r.newDone, { ...tdHL, fontWeight: 700 }, `New Done — ${r.name}`, (r._doneMeetings as R[]).filter((m: R) => r._newDoneContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctAttend}%</td>
                        {drillCell(r.totalDone, tdB, `Total Done — ${r.name}`, (r._doneMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        {drillCell(r.nSigned, tdB, `Signés — ${r.name}`, (r._repDeals as R[]).filter((d: R) => (d.stage as string) === "closed_won").map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: ((d.close_date || d.created_at) as string).slice(0, 10), href: `/deals`, amount: Number(d.amount) || 0 })))}
                        <td style={tdC}>{r.closingTotal}%</td>
                        <td style={tdC}>{r.closingNew}%</td>
                        {drillCell(fmt(r.caHT), { ...tdB, color: "#27ae60" }, `CA HT — ${r.name}`, (r._repOrders as R[]).map((o: R) => ({ label: (o.name as string) ?? "Commande", sublabel: ((o.close_date || o.created_at) as string).slice(0, 10), amount: Number(o.amount) || 0 })))}
                        <td style={tdB}>{fmt(r.avgPrice)}</td>
                        <td style={tdB}>{fmt(r.gainsPerCts)}</td>
                        <td style={tdC}>{r.pctBking}%</td>
                        <td style={tdC}>{r.pctAttendMkt}%</td>
                        <td style={tdC}>{r.pctClosingMkt}%</td>
                      </tr>
                    ))}
                    {/* Grand Total */}
                    <tr style={{ background: "#e6f0f7", fontWeight: 700 }}>
                      <td style={{ ...tdL, fontWeight: 800 }}>Total</td>
                      <td style={tdB}>{gt.oldCted}</td>
                      <td style={tdB}>{gt.oldBked}</td>
                      <td style={tdC}>{gt.oldCted > 0 ? Math.round((gt.oldBked / gt.oldCted) * 100) : 0}%</td>
                      <td style={tdB}>{gt.oldDone}</td>
                      <td style={tdB}>{gt.monthlyLeads}</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newCted}</td>
                      <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{gt.monthlyLeads > 0 ? Math.round((gt.newCted / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newBkd}</td>
                      <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{gt.newCted > 0 ? Math.round((gt.newBkd / gt.newCted) * 100) : 0}%</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newDone}</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.monthlyLeadsCted / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdB}>{gt.totalDone}</td>
                      <td style={tdB}>{gt.nSigned}</td>
                      <td style={tdC}>{gt.totalDone > 0 ? Math.round((gt.nSigned / gt.totalDone) * 100) : 0}%</td>
                      <td style={tdC}>{gt.newDone > 0 ? Math.round((gt.nSigned / gt.newDone) * 100) : 0}%</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{fmt(gt.caHT)}</td>
                      <td style={tdB}>{gt.nSigned > 0 ? fmt(Math.round(gt.caHT / gt.nSigned)) : "—"}</td>
                      <td style={tdB}>{gt.monthlyLeads > 0 ? fmt(Math.round(gt.caHT / gt.monthlyLeads)) : (gt.caHT > 0 ? fmt(gt.caHT) : "—")}</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.oldBked / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.totalDone / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.nSigned / gt.monthlyLeads) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Weekly Inbound ===== */}
      {selectedReport === "inbound" && inboundMode === "weekly" && (() => {
        // Compute week bounds from filterWeekInbound (a Monday date string)
        const weekMonday = new Date(filterWeekInbound + "T00:00:00");
        const weekSunday = new Date(weekMonday);
        weekSunday.setDate(weekSunday.getDate() + 6);
        const weekStart = filterWeekInbound;
        const weekEnd = `${weekSunday.getFullYear()}-${String(weekSunday.getMonth() + 1).padStart(2, "0")}-${String(weekSunday.getDate()).padStart(2, "0")}`;

        function isInWeek(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= weekStart && d <= weekEnd;
        }

        const weekLabel = (() => {
          const dStart = weekMonday;
          const dEnd = weekSunday;
          const dayStart = dStart.getDate();
          const dayEnd = dEnd.getDate();
          const monthStart = dStart.toLocaleDateString("fr-FR", { month: "long" });
          const monthEnd = dEnd.toLocaleDateString("fr-FR", { month: "long" });
          const year = dEnd.getFullYear();
          if (monthStart === monthEnd) {
            return `Semaine du ${dayStart} au ${dayEnd} ${monthStart} ${year}`;
          }
          return `Semaine du ${dayStart} ${monthStart} au ${dayEnd} ${monthEnd} ${year}`;
        })();

        function shiftWeekInbound(offset: number) {
          const d = new Date(filterWeekInbound + "T00:00:00");
          d.setDate(d.getDate() + offset * 7);
          setFilterWeekInbound(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        }

        // Filter activities and meetings for this week
        const weekActivities = activities.filter(a => isInWeek(a.created_at as string));
        const weekMeetings = meetings.filter(m => isInWeek(m.scheduled_at as string));
        const weekOrders = orders.filter(o => isInWeek(((o.close_date || o.created_at) as string)));

        // Build per-sales-rep data from meeting assignees + activity performers + contact owners
        const teamMembersSet = new Set<string>();
        // From contact owners (for leads count)
        inboundContacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });
        // From meeting assignees (primary attribution)
        weekMeetings.forEach((m) => {
          if (!inboundContactIds.has(m.contact_id as string)) return;
          const name = getTeamMemberName(m);
          if (name) teamMembersSet.add(name);
        });
        // From activity performers
        weekActivities.forEach((a) => {
          if (!inboundContactIds.has(a.contact_id as string)) return;
          const name = getTeamMemberName(a);
          if (name) teamMembersSet.add(name);
        });

        const reps = Array.from(teamMembersSet).map((repName) => {
          // Contacts owned by this rep (for leads/contacts count)
          const repContacts = inboundContacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Meetings ASSIGNED TO this rep (on inbound contacts)
          const repMeetings = weekMeetings.filter((m) => {
            if (!inboundContactIds.has(m.contact_id as string)) return false;
            return getTeamMemberName(m) === repName;
          });

          // Activities PERFORMED BY this rep (on inbound contacts)
          const repActivities = weekActivities.filter((a) => {
            if (!inboundContactIds.has(a.contact_id as string)) return false;
            return getTeamMemberName(a) === repName;
          });

          // Build repContactIds from BOTH owned contacts + contacts from meetings/activities
          const repContactIds = new Set([
            ...repContacts.map(c => c.id as string),
            ...repMeetings.map(m => m.contact_id as string),
            ...repActivities.map(a => a.contact_id as string),
          ].filter(Boolean));

          // First-ever REAL contact date per contact (ALL reps, exclude unanswered calls)
          const firstInteraction: Record<string, string> = {};
          activities.forEach((a: R) => {
            const cid = a.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            if ((a.type as string) === "appel") {
              const desc = String((a as any).description ?? "");
              if (desc.includes("Pas de réponse") || desc.includes("Message vocal")) return;
            }
            const d = (a.created_at as string).slice(0, 10);
            if (!firstInteraction[cid] || d < firstInteraction[cid]) firstInteraction[cid] = d;
          });
          meetings.forEach((m: R) => {
            const cid = m.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            const d = (m.scheduled_at as string).slice(0, 10);
            if (!firstInteraction[cid] || d < firstInteraction[cid]) firstInteraction[cid] = d;
          });

          // Unique contacts contacted this week (via activities OR meetings by this rep)
          const contactedThisPeriod = new Set<string>();
          repActivities.forEach((a: R) => {
            if (!a.contact_id) return;
            if (a.type === "appel") {
              const desc = String(a.description ?? "");
              if (desc.includes("Pas de réponse") || desc.includes("Message vocal")) return;
            }
            contactedThisPeriod.add(a.contact_id as string);
          });

          const newCtedContacts = new Set([...contactedThisPeriod].filter(cid => {
            const f = firstInteraction[cid];
            return f && f >= weekStart && f <= weekEnd;
          }));
          const newCted = newCtedContacts.size;
          const oldCted = contactedThisPeriod.size - newCted;

          // First-ever meeting date per contact (ALL reps)
          const firstMeeting: Record<string, string> = {};
          meetings.forEach((m: R) => {
            const cid = m.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            const d = (m.scheduled_at as string).slice(0, 10);
            if (!firstMeeting[cid] || d < firstMeeting[cid]) firstMeeting[cid] = d;
          });

          const bookedThisWeek = new Set(repMeetings.map((m: R) => m.contact_id as string).filter(Boolean));
          const newBkdContacts = new Set([...bookedThisWeek].filter(cid => {
            const f = firstMeeting[cid];
            return f && f >= weekStart && f <= weekEnd;
          }));
          const newBkd = newBkdContacts.size;
          const oldBked = bookedThisWeek.size - newBkd;

          const doneMeetings = repMeetings.filter((m: R) => m.status === "done");
          const doneThisWeek = new Set(doneMeetings.map((m: R) => m.contact_id as string).filter(Boolean));
          const newDoneContacts = new Set([...doneThisWeek].filter(cid => {
            const f = firstMeeting[cid];
            return f && f >= weekStart && f <= weekEnd;
          }));
          const newDone = newDoneContacts.size;
          const oldDone = doneThisWeek.size - newDone;

          const repOrders = weekOrders.filter((o) => {
            const tm = o.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          const repDeals = deals.filter((d) => {
            const tm = d.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Signed deals in this week
          const weekSignedDeals = repDeals.filter(d => d.stage === "closed_won" && isInWeek((d.close_date || d.created_at) as string));

          const pctBked = oldCted > 0 ? Math.round((oldBked / oldCted) * 100) : 0;

          // Only count leads created during this week
          const repContactsInPeriod = repContacts.filter(c => isInWeek(c.created_at as string));
          const weeklyLeads = repContactsInPeriod.length;
          const monthlyLeads = weeklyLeads;
          const monthlyLeadsCted = newCted + oldCted;
          const pctCtedOn90 = monthlyLeads > 0 ? Math.round((monthlyLeadsCted / monthlyLeads) * 100) : 0;

          const diffNLeads = newCted;

          const pctNewCted = monthlyLeads > 0 ? Math.round((newCted / monthlyLeads) * 100) : 0;
          const pctNewBked = newCted > 0 ? Math.round((newBkd / newCted) * 100) : 0;

          const attendNew = repContacts.filter(c => isInWeek(c.created_at as string) && c.lead_status === "lead").length;
          const pctAttend = monthlyLeads > 0 ? Math.round(((monthlyLeads - attendNew) / monthlyLeads) * 100) : 0;

          const totalDone = oldDone + newDone;
          const nSigned = weekSignedDeals.length;
          const closingTotal = totalDone > 0 ? Math.round((nSigned / totalDone) * 100) : 0;
          const closingNew = newDone > 0 ? Math.round((nSigned / newDone) * 100) : 0;

          const caHT = repOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
          const nbOrders = repOrders.length;
          const avgPrice = nbOrders > 0 ? Math.round(caHT / nbOrders) : 0;
          const gainsPerCts = monthlyLeads > 0 ? Math.round(caHT / monthlyLeads) : caHT;

          const pctBking = monthlyLeads > 0 ? Math.round((oldBked / monthlyLeads) * 100) : 0;
          const pctAttendMkt = monthlyLeads > 0 ? Math.round((totalDone / monthlyLeads) * 100) : 0;
          const pctClosingMkt = monthlyLeads > 0 ? Math.round((nSigned / monthlyLeads) * 100) : 0;
          const pctGoalDone = 0;

          return {
            name: repName,
            oldCted, oldBked, pctBked, oldDone,
            monthlyLeads, monthlyLeadsCted, pctCtedOn90, diffNLeads,
            newCted, pctNewCted, newBkd, pctNewBked, newDone,
            attendNew, pctAttend, totalDone, nSigned,
            closingTotal, closingNew, caHT, avgPrice, gainsPerCts,
            pctBking, pctAttendMkt, pctClosingMkt, pctGoalDone,
            _repContacts: repContactsInPeriod,
            _repMeetings: repMeetings,
            _doneMeetings: doneMeetings,
            _repDeals: repDeals,
            _repOrders: repOrders,
            _newBkdContacts: newBkdContacts,
            _newCtedContacts: newCtedContacts,
            _newDoneContacts: newDoneContacts,
          };
        });

        // Grand total
        const gt = reps.reduce((acc, r) => ({
          oldCted: acc.oldCted + r.oldCted,
          oldBked: acc.oldBked + r.oldBked,
          oldDone: acc.oldDone + r.oldDone,
          monthlyLeads: acc.monthlyLeads + r.monthlyLeads,
          monthlyLeadsCted: acc.monthlyLeadsCted + r.monthlyLeadsCted,
          diffNLeads: acc.diffNLeads + r.diffNLeads,
          newCted: acc.newCted + r.newCted,
          newBkd: acc.newBkd + r.newBkd,
          newDone: acc.newDone + r.newDone,
          totalDone: acc.totalDone + r.totalDone,
          nSigned: acc.nSigned + r.nSigned,
          caHT: acc.caHT + r.caHT,
        }), { oldCted: 0, oldBked: 0, oldDone: 0, monthlyLeads: 0, monthlyLeadsCted: 0, diffNLeads: 0, newCted: 0, newBkd: 0, newDone: 0, totalDone: 0, nSigned: 0, caHT: 0 });

        function initials(name: string) {
          return name.split(" ").map(w => w[0]).join("").toUpperCase();
        }

        const th: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: "#1a6b9c", textAlign: "center", padding: "4px 2px", borderBottom: "2px solid #1a6b9c", lineHeight: 1.2, whiteSpace: "normal" };
        const thH: React.CSSProperties = { ...th, background: "#e6f0f7" };
        const td: React.CSSProperties = { fontSize: 11, textAlign: "center", padding: "5px 2px", borderBottom: "1px solid #e6f0f7" };
        const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "#1a2a3a" };
        const tdC: React.CSSProperties = { ...td, color: "#1a6b9c", fontWeight: 600 };
        const tdHL: React.CSSProperties = { ...td, background: "#e6f0f7" };
        const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: "#1a2a3a" };

        return (
          <>
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Weekly Inbound — <span style={{ textTransform: "capitalize" }}>{weekLabel}</span></h3>
                  <div className="flex items-center gap-2">
                    <ExportButton onExport={(fmt: ExportFormat) => exportData(
                      reps.map((r) => ({ rep: r.name, old_contacted: r.oldCted, old_booked: r.oldBked, old_done: r.oldDone, monthly_leads: r.monthlyLeads, new_contacted: r.newCted, new_booked: r.newBkd, new_done: r.newDone, total_done: r.totalDone, n_signes: r.nSigned, ca_ht: r.caHT, prix_moyen: r.avgPrice })),
                      [{ key: "rep", label: "Commercial" }, { key: "old_contacted", label: "Old Contacted" }, { key: "old_booked", label: "Old Booked" }, { key: "old_done", label: "Old Done" }, { key: "monthly_leads", label: "Weekly Leads" }, { key: "new_contacted", label: "New Contacted" }, { key: "new_booked", label: "New Booked" }, { key: "new_done", label: "New Done" }, { key: "total_done", label: "Total Done" }, { key: "n_signes", label: "N° Signés" }, { key: "ca_ht", label: "CA HT" }, { key: "prix_moyen", label: "Prix Moyen" }],
                      `inbound_weekly_${filterWeekInbound}`, fmt
                    )} />
                    <button onClick={() => shiftWeekInbound(-1)} style={{ height: 32, width: 32, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#1a2a3a" }}>&lt;</button>
                    <input
                      type="date"
                      value={filterWeekInbound}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const d = new Date(val + "T00:00:00");
                        const day = d.getDay();
                        const diff = day === 0 ? -6 : 1 - day;
                        d.setDate(d.getDate() + diff);
                        setFilterWeekInbound(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                      }}
                      style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                    />
                    <button onClick={() => shiftWeekInbound(1)} style={{ height: 32, width: 32, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#1a2a3a" }}>&gt;</button>
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left", width: 36 }}>Sales<br />Rep</th>
                      <th style={th}>Old<br />Cted</th>
                      <th style={th}>Old<br />Bked</th>
                      <th style={th}>%<br />Bked</th>
                      <th style={th}>Old<br />Done</th>
                      <th style={th}>Mthly<br />Leads</th>
                      <th style={thH}>New<br />Cted</th>
                      <th style={thH}>% New<br />Cted</th>
                      <th style={thH}>New<br />Bkd</th>
                      <th style={thH}>%<br />Bked</th>
                      <th style={thH}>New<br />Done</th>
                      <th style={th}>Attend<br />New</th>
                      <th style={th}>Total<br />Done</th>
                      <th style={th}>N°<br />Sign.</th>
                      <th style={th}>Clos.<br />Total</th>
                      <th style={th}>Clos.<br />New</th>
                      <th style={{ ...th, fontWeight: 800 }}>CA<br />HT</th>
                      <th style={th}>Prix<br />Moy.</th>
                      <th style={th}>Gains<br />/Cts</th>
                      <th style={th}>%<br />Bking</th>
                      <th style={th}>%<br />Attend</th>
                      <th style={th}>%<br />Clos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tdL, color: "#1a6b9c" }} title={r.name}>{initials(r.name)}</td>
                        {drillCell(r.oldCted, tdB, `Old Contacted — ${r.name}`, [...new Set([...(r._repMeetings as R[]).map((m: R) => m.contact_id as string)])].filter(cid => !r._newCtedContacts.has(cid)).map(cid => { const c = contacts.find((ct: R) => (ct.id as string) === cid); return c ? { label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` } : null; }).filter(Boolean) as any[])}
                        {drillCell(r.oldBked, tdB, `Old Booked — ${r.name}`, (r._repMeetings as R[]).filter((m: R) => !r._newBkdContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctBked}%</td>
                        {drillCell(r.oldDone, tdB, `Old Done — ${r.name}`, (r._doneMeetings as R[]).filter((m: R) => !r._newDoneContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        {drillCell(r.monthlyLeads, tdB, `Weekly Leads — ${r.name}`, (r._repContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.newCted, { ...tdHL, fontWeight: 700 }, `New Contacted — ${r.name}`, [...r._newCtedContacts].map(cid => { const c = contacts.find((ct: R) => (ct.id as string) === cid); return c ? { label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` } : null; }).filter(Boolean) as any[])}
                        <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{r.pctNewCted}%</td>
                        {drillCell(r.newBkd, { ...tdHL, fontWeight: 700 }, `New Booked — ${r.name}`, (r._repMeetings as R[]).filter((m: R) => r._newBkdContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{r.pctNewBked}%</td>
                        {drillCell(r.newDone, { ...tdHL, fontWeight: 700 }, `New Done — ${r.name}`, (r._doneMeetings as R[]).filter((m: R) => r._newDoneContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctAttend}%</td>
                        {drillCell(r.totalDone, tdB, `Total Done — ${r.name}`, (r._doneMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        {drillCell(r.nSigned, tdB, `Signés — ${r.name}`, (r._repDeals as R[]).filter((d: R) => (d.stage as string) === "closed_won").map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: ((d.close_date || d.created_at) as string).slice(0, 10), href: `/deals`, amount: Number(d.amount) || 0 })))}
                        <td style={tdC}>{r.closingTotal}%</td>
                        <td style={tdC}>{r.closingNew}%</td>
                        {drillCell(fmt(r.caHT), { ...tdB, color: "#27ae60" }, `CA HT — ${r.name}`, (r._repOrders as R[]).map((o: R) => ({ label: (o.name as string) ?? "Commande", sublabel: ((o.close_date || o.created_at) as string).slice(0, 10), amount: Number(o.amount) || 0 })))}
                        <td style={tdB}>{fmt(r.avgPrice)}</td>
                        <td style={tdB}>{fmt(r.gainsPerCts)}</td>
                        <td style={tdC}>{r.pctBking}%</td>
                        <td style={tdC}>{r.pctAttendMkt}%</td>
                        <td style={tdC}>{r.pctClosingMkt}%</td>
                      </tr>
                    ))}
                    {/* Grand Total */}
                    <tr style={{ background: "#e6f0f7", fontWeight: 700 }}>
                      <td style={{ ...tdL, fontWeight: 800 }}>Total</td>
                      <td style={tdB}>{gt.oldCted}</td>
                      <td style={tdB}>{gt.oldBked}</td>
                      <td style={tdC}>{gt.oldCted > 0 ? Math.round((gt.oldBked / gt.oldCted) * 100) : 0}%</td>
                      <td style={tdB}>{gt.oldDone}</td>
                      <td style={tdB}>{gt.monthlyLeads}</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newCted}</td>
                      <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{gt.monthlyLeads > 0 ? Math.round((gt.newCted / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newBkd}</td>
                      <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{gt.newCted > 0 ? Math.round((gt.newBkd / gt.newCted) * 100) : 0}%</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newDone}</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.monthlyLeadsCted / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdB}>{gt.totalDone}</td>
                      <td style={tdB}>{gt.nSigned}</td>
                      <td style={tdC}>{gt.totalDone > 0 ? Math.round((gt.nSigned / gt.totalDone) * 100) : 0}%</td>
                      <td style={tdC}>{gt.newDone > 0 ? Math.round((gt.nSigned / gt.newDone) * 100) : 0}%</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{fmt(gt.caHT)}</td>
                      <td style={tdB}>{gt.nSigned > 0 ? fmt(Math.round(gt.caHT / gt.nSigned)) : "—"}</td>
                      <td style={tdB}>{gt.monthlyLeads > 0 ? fmt(Math.round(gt.caHT / gt.monthlyLeads)) : (gt.caHT > 0 ? fmt(gt.caHT) : "—")}</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.oldBked / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.totalDone / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.nSigned / gt.monthlyLeads) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Yearly ===== */}
      {selectedReport === "inbound" && inboundMode === "yearly" && (() => {
        const fyRange = getCurrentFiscalYearRange();
        const periodStart = yearlyMode === "full" ? fyRange.from : yearlyFrom;
        const periodEnd = yearlyMode === "full" ? fyRange.to : yearlyTo;

        const periodLabel = yearlyMode === "full"
          ? `Année complète ${getFiscalYearLabel(getCurrentFiscalYearStart())}`
          : `Du ${new Date(periodStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} au ${new Date(periodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

        function isInPeriod(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= periodStart && d <= periodEnd;
        }

        const periodActivities = activities.filter(a => isInPeriod(a.created_at as string));
        const periodMeetings = meetings.filter(m => isInPeriod(m.scheduled_at as string));
        const periodOrders = orders.filter(o => isInPeriod(((o.close_date || o.created_at) as string)));

        function initials(name: string) {
          return name.split(" ").map(w => w[0]).join("").toUpperCase();
        }

        const teamMembersSet = new Set<string>();
        // From contact owners (for leads count)
        inboundContacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });
        // From meeting assignees (primary attribution)
        periodMeetings.forEach((m) => {
          if (!inboundContactIds.has(m.contact_id as string)) return;
          const name = getTeamMemberName(m);
          if (name) teamMembersSet.add(name);
        });
        // From activity performers
        periodActivities.forEach((a) => {
          if (!inboundContactIds.has(a.contact_id as string)) return;
          const name = getTeamMemberName(a);
          if (name) teamMembersSet.add(name);
        });

        const reps = Array.from(teamMembersSet).map((repName) => {
          // Contacts owned by this rep (for leads/contacts count)
          const repContacts = inboundContacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Meetings ASSIGNED TO this rep (on inbound contacts)
          const repMeetings = periodMeetings.filter((m) => {
            if (!inboundContactIds.has(m.contact_id as string)) return false;
            return getTeamMemberName(m) === repName;
          });

          // Activities PERFORMED BY this rep (on inbound contacts)
          const repActivities = periodActivities.filter((a) => {
            if (!inboundContactIds.has(a.contact_id as string)) return false;
            return getTeamMemberName(a) === repName;
          });

          // Build repContactIds from BOTH owned contacts + contacts from meetings/activities
          const repContactIds = new Set([
            ...repContacts.map(c => c.id as string),
            ...repMeetings.map(m => m.contact_id as string),
            ...repActivities.map(a => a.contact_id as string),
          ].filter(Boolean));

          // First-ever REAL contact date per contact (ALL reps, exclude unanswered calls)
          const firstInteraction: Record<string, string> = {};
          activities.forEach((a: R) => {
            const cid = a.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            if ((a.type as string) === "appel") {
              const desc = String((a as any).description ?? "");
              if (desc.includes("Pas de réponse") || desc.includes("Message vocal")) return;
            }
            const d = (a.created_at as string).slice(0, 10);
            if (!firstInteraction[cid] || d < firstInteraction[cid]) firstInteraction[cid] = d;
          });
          meetings.forEach((m: R) => {
            const cid = m.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            const d = (m.scheduled_at as string).slice(0, 10);
            if (!firstInteraction[cid] || d < firstInteraction[cid]) firstInteraction[cid] = d;
          });

          // Unique contacts contacted this period (via activities OR meetings by this rep)
          const contactedThisPeriod = new Set<string>();
          repActivities.forEach((a: R) => { if (a.contact_id) contactedThisPeriod.add(a.contact_id as string); });
          repMeetings.forEach((m: R) => { if (m.contact_id) contactedThisPeriod.add(m.contact_id as string); });

          const newCtedContacts = new Set([...contactedThisPeriod].filter(cid => {
            const f = firstInteraction[cid];
            return f && f >= periodStart && f <= periodEnd;
          }));
          const newCted = newCtedContacts.size;
          const oldCted = contactedThisPeriod.size - newCted;

          // First-ever meeting date per contact (ALL reps)
          const firstMtg: Record<string, string> = {};
          meetings.forEach((m: R) => {
            const cid = m.contact_id as string;
            if (!cid || !inboundContactIds.has(cid)) return;
            const d = (m.scheduled_at as string).slice(0, 10);
            if (!firstMtg[cid] || d < firstMtg[cid]) firstMtg[cid] = d;
          });

          const bookedThisPeriod = new Set(repMeetings.map((m: R) => m.contact_id as string).filter(Boolean));
          const newBkdContacts = new Set([...bookedThisPeriod].filter(cid => {
            const f = firstMtg[cid];
            return f && f >= periodStart && f <= periodEnd;
          }));
          const newBkd = newBkdContacts.size;
          const oldBked = bookedThisPeriod.size - newBkd;

          const doneMtgs = repMeetings.filter((m: R) => m.status === "done");
          const doneThisPeriod = new Set(doneMtgs.map((m: R) => m.contact_id as string).filter(Boolean));
          const newDoneContacts = new Set([...doneThisPeriod].filter(cid => {
            const f = firstMtg[cid];
            return f && f >= periodStart && f <= periodEnd;
          }));
          const newDone = newDoneContacts.size;
          const oldDone = doneThisPeriod.size - newDone;

          const repOrders = periodOrders.filter(o => {
            const tm = o.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });
          const repDeals = deals.filter(d => {
            const tm = d.team_members as { first_name: string; last_name: string } | null;
            if (tm) return `${tm.first_name} ${tm.last_name}` === repName;
            return d.contact_id ? repContactIds.has(d.contact_id as string) : false;
          });

          const pctBked = oldCted > 0 ? Math.round((oldBked / oldCted) * 100) : 0;
          const repContactsInPeriod = repContacts.filter(c => isInPeriod(c.created_at as string));
          const monthlyLeads = repContactsInPeriod.length;
          const pctNewCted = monthlyLeads > 0 ? Math.round((newCted / monthlyLeads) * 100) : 0;
          const pctNewBked = newCted > 0 ? Math.round((newBkd / newCted) * 100) : 0;
          const pctAttend = monthlyLeads > 0 ? Math.round(((newCted + oldCted) / monthlyLeads) * 100) : 0;
          const totalDone = oldDone + newDone;
          const nSigned = repDeals.filter(d => d.stage === "closed_won" && isInPeriod((d.close_date || d.created_at) as string)).length;
          const closingTotal = totalDone > 0 ? Math.round((nSigned / totalDone) * 100) : 0;
          const closingNew = newDone > 0 ? Math.round((nSigned / newDone) * 100) : 0;
          const caHT = repOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
          const nbOrders = repOrders.length;
          const avgPrice = nbOrders > 0 ? Math.round(caHT / nbOrders) : 0;
          const monthlyLeadsCted = newCted + oldCted;
          const gainsPerCts = monthlyLeads > 0 ? Math.round(caHT / monthlyLeads) : caHT;
          const pctBking = monthlyLeads > 0 ? Math.round((oldBked / monthlyLeads) * 100) : 0;
          const pctAttendMkt = monthlyLeads > 0 ? Math.round((totalDone / monthlyLeads) * 100) : 0;
          const pctClosingMkt = monthlyLeads > 0 ? Math.round((nSigned / monthlyLeads) * 100) : 0;

          return { name: repName, oldCted, oldBked, pctBked, oldDone, monthlyLeads, newCted, pctNewCted, newBkd, pctNewBked, newDone, pctAttend, totalDone, nSigned, closingTotal, closingNew, caHT, avgPrice, gainsPerCts, pctBking, pctAttendMkt, pctClosingMkt,
            _repContacts: repContacts,
            _repMeetings: repMeetings,
            _doneMeetings: doneMtgs,
            _repDeals: repDeals,
            _repOrders: repOrders,
            _newBkdContacts: newBkdContacts,
            _newCtedContacts: newCtedContacts,
            _newDoneContacts: newDoneContacts,
          };
        });

        const gt = reps.reduce((a, r) => ({
          oldCted: a.oldCted + r.oldCted, oldBked: a.oldBked + r.oldBked, oldDone: a.oldDone + r.oldDone,
          monthlyLeads: a.monthlyLeads + r.monthlyLeads, newCted: a.newCted + r.newCted,
          newBkd: a.newBkd + r.newBkd, newDone: a.newDone + r.newDone, totalDone: a.totalDone + r.totalDone,
          nSigned: a.nSigned + r.nSigned, caHT: a.caHT + r.caHT,
        }), { oldCted: 0, oldBked: 0, oldDone: 0, monthlyLeads: 0, newCted: 0, newBkd: 0, newDone: 0, totalDone: 0, nSigned: 0, caHT: 0 });

        const th: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: "#1a6b9c", textAlign: "center", padding: "4px 2px", borderBottom: "2px solid #1a6b9c", lineHeight: 1.2, whiteSpace: "normal" };
        const thH: React.CSSProperties = { ...th, background: "#e6f0f7" };
        const td: React.CSSProperties = { fontSize: 11, textAlign: "center", padding: "5px 2px", borderBottom: "1px solid #e6f0f7" };
        const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "#1a2a3a" };
        const tdC: React.CSSProperties = { ...td, color: "#1a6b9c", fontWeight: 600 };
        const tdHL: React.CSSProperties = { ...td, background: "#e6f0f7" };
        const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: "#1a2a3a" };

        return (
          <>
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Yearly Inbound — {periodLabel}</h3>
                  <div className="flex items-center gap-3">
                    <ExportButton onExport={(fmt: ExportFormat) => exportData(
                      reps.map((r) => ({ rep: r.name, old_contacted: r.oldCted, old_booked: r.oldBked, old_done: r.oldDone, monthly_leads: r.monthlyLeads, new_contacted: r.newCted, new_booked: r.newBkd, new_done: r.newDone, total_done: r.totalDone, n_signes: r.nSigned, ca_ht: r.caHT, prix_moyen: r.avgPrice })),
                      [{ key: "rep", label: "Commercial" }, { key: "old_contacted", label: "Old Contacted" }, { key: "old_booked", label: "Old Booked" }, { key: "old_done", label: "Old Done" }, { key: "monthly_leads", label: "Leads" }, { key: "new_contacted", label: "New Contacted" }, { key: "new_booked", label: "New Booked" }, { key: "new_done", label: "New Done" }, { key: "total_done", label: "Total Done" }, { key: "n_signes", label: "N° Signés" }, { key: "ca_ht", label: "CA HT" }, { key: "prix_moyen", label: "Prix Moyen" }],
                      "inbound_yearly", fmt
                    )} />
                    <select
                      style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                      value={yearlyMode}
                      onChange={(e) => setYearlyMode(e.target.value as "full" | "custom")}
                    >
                      <option value="full">Année complète</option>
                      <option value="custom">Période personnalisée</option>
                    </select>
                    {yearlyMode === "custom" && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 11, color: "#8399a9" }}>Du</span>
                          <input type="date" value={yearlyFrom} onChange={(e) => setYearlyFrom(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
                          <span style={{ fontSize: 11, color: "#8399a9" }}>au</span>
                          <input type="date" value={yearlyTo} onChange={(e) => setYearlyTo(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left", width: 36 }}>Sales<br />Rep</th>
                      <th style={th}>Old<br />Cted</th>
                      <th style={th}>Old<br />Bked</th>
                      <th style={th}>%<br />Bked</th>
                      <th style={th}>Old<br />Done</th>
                      <th style={th}>Total<br />Leads</th>
                      <th style={thH}>New<br />Cted</th>
                      <th style={thH}>% New<br />Cted</th>
                      <th style={thH}>New<br />Bkd</th>
                      <th style={thH}>%<br />Bked</th>
                      <th style={thH}>New<br />Done</th>
                      <th style={th}>Attend<br />New</th>
                      <th style={th}>Total<br />Done</th>
                      <th style={th}>N°<br />Sign.</th>
                      <th style={th}>Clos.<br />Total</th>
                      <th style={th}>Clos.<br />New</th>
                      <th style={{ ...th, fontWeight: 800 }}>CA<br />HT</th>
                      <th style={th}>Prix<br />Moy.</th>
                      <th style={th}>Gains<br />/Cts</th>
                      <th style={th}>%<br />Bking</th>
                      <th style={th}>%<br />Attend</th>
                      <th style={th}>%<br />Clos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tdL, color: "#1a6b9c" }} title={r.name}>{initials(r.name)}</td>
                        {drillCell(r.oldCted, tdB, `Old Contacted — ${r.name}`, [...new Set([...(r._repMeetings as R[]).map((m: R) => m.contact_id as string)])].filter(cid => !r._newCtedContacts.has(cid)).map(cid => { const c = contacts.find((ct: R) => (ct.id as string) === cid); return c ? { label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` } : null; }).filter(Boolean) as any[])}
                        {drillCell(r.oldBked, tdB, `Old Booked — ${r.name}`, (r._repMeetings as R[]).filter((m: R) => !r._newBkdContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctBked}%</td>
                        {drillCell(r.oldDone, tdB, `Old Done — ${r.name}`, (r._doneMeetings as R[]).filter((m: R) => !r._newDoneContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        {drillCell(r.monthlyLeads, tdB, `Total Leads — ${r.name}`, (r._repContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.newCted, { ...tdHL, fontWeight: 700 }, `New Contacted — ${r.name}`, [...r._newCtedContacts].map(cid => { const c = contacts.find((ct: R) => (ct.id as string) === cid); return c ? { label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` } : null; }).filter(Boolean) as any[])}
                        <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{r.pctNewCted}%</td>
                        {drillCell(r.newBkd, { ...tdHL, fontWeight: 700 }, `New Booked — ${r.name}`, (r._repMeetings as R[]).filter((m: R) => r._newBkdContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{r.pctNewBked}%</td>
                        {drillCell(r.newDone, { ...tdHL, fontWeight: 700 }, `New Done — ${r.name}`, (r._doneMeetings as R[]).filter((m: R) => r._newDoneContacts.has(m.contact_id as string)).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctAttend}%</td>
                        {drillCell(r.totalDone, tdB, `Total Done — ${r.name}`, (r._doneMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        {drillCell(r.nSigned, tdB, `Signés — ${r.name}`, (r._repDeals as R[]).filter((d: R) => (d.stage as string) === "closed_won").map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: ((d.close_date || d.created_at) as string).slice(0, 10), href: `/deals`, amount: Number(d.amount) || 0 })))}
                        <td style={tdC}>{r.closingTotal}%</td>
                        <td style={tdC}>{r.closingNew}%</td>
                        {drillCell(fmt(r.caHT), { ...tdB, color: "#27ae60" }, `CA HT — ${r.name}`, (r._repOrders as R[]).map((o: R) => ({ label: (o.name as string) ?? "Commande", sublabel: ((o.close_date || o.created_at) as string).slice(0, 10), amount: Number(o.amount) || 0 })))}
                        <td style={tdB}>{fmt(r.avgPrice)}</td>
                        <td style={tdB}>{fmt(r.gainsPerCts)}</td>
                        <td style={tdC}>{r.pctBking}%</td>
                        <td style={tdC}>{r.pctAttendMkt}%</td>
                        <td style={tdC}>{r.pctClosingMkt}%</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#e6f0f7", fontWeight: 700 }}>
                      <td style={{ ...tdL, fontWeight: 800 }}>Total</td>
                      <td style={tdB}>{gt.oldCted}</td>
                      <td style={tdB}>{gt.oldBked}</td>
                      <td style={tdC}>{gt.oldCted > 0 ? Math.round((gt.oldBked / gt.oldCted) * 100) : 0}%</td>
                      <td style={tdB}>{gt.oldDone}</td>
                      <td style={tdB}>{gt.monthlyLeads}</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newCted}</td>
                      <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{gt.monthlyLeads > 0 ? Math.round((gt.newCted / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newBkd}</td>
                      <td style={{ ...tdHL, color: "#1a6b9c", fontWeight: 600 }}>{gt.newCted > 0 ? Math.round((gt.newBkd / gt.newCted) * 100) : 0}%</td>
                      <td style={{ ...tdHL, fontWeight: 700 }}>{gt.newDone}</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round(((gt.monthlyLeads - (gt.monthlyLeads - gt.oldCted)) / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdB}>{gt.totalDone}</td>
                      <td style={tdB}>{gt.nSigned}</td>
                      <td style={tdC}>{gt.totalDone > 0 ? Math.round((gt.nSigned / gt.totalDone) * 100) : 0}%</td>
                      <td style={tdC}>{gt.newDone > 0 ? Math.round((gt.nSigned / gt.newDone) * 100) : 0}%</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{fmt(gt.caHT)}</td>
                      <td style={tdB}>{gt.nSigned > 0 ? fmt(Math.round(gt.caHT / gt.nSigned)) : "—"}</td>
                      <td style={tdB}>{gt.monthlyLeads > 0 ? fmt(Math.round(gt.caHT / gt.monthlyLeads)) : (gt.caHT > 0 ? fmt(gt.caHT) : "—")}</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.oldBked / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.totalDone / gt.monthlyLeads) * 100) : 0}%</td>
                      <td style={tdC}>{gt.monthlyLeads > 0 ? Math.round((gt.nSigned / gt.monthlyLeads) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Prospection ===== */}
      {selectedReport === "outbound" && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["weekly", "monthly", "yearly"] as const).map(mode => (
            <button key={mode} onClick={() => setOutboundMode(mode)}
              style={{ height: 32, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: outboundMode === mode ? 700 : 500, border: `1px solid ${outboundMode === mode ? "#1a6b9c" : "#dce8f0"}`, background: outboundMode === mode ? "#1a6b9c" : "white", color: outboundMode === mode ? "white" : "#5a6f80", cursor: "pointer" }}>
              {mode === "weekly" ? "Weekly" : mode === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      )}

      {selectedReport === "outbound" && outboundMode === "monthly" && (() => {
        function ini(name: string) { return name.split(" ").map(w => w[0]).join("").toUpperCase(); }

        // Filter by selected month
        const pMonthStart = `${selectedMonth}-01`;
        const pMonthEnd = (() => {
          const [y, m] = selectedMonth.split("-").map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          return `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
        })();
        function isInProspMonth(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= pMonthStart && d <= pMonthEnd;
        }
        const prospMonthLabel = (() => {
          const [y, m] = selectedMonth.split("-").map(Number);
          return new Date(y, m - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        })();

        const pActivities = activities.filter(a => isInProspMonth(a.created_at as string));
        const pMeetings = meetings.filter(m => isInProspMonth(m.scheduled_at as string));
        const pOrders = orders.filter(o => isInProspMonth(((o.close_date || o.created_at) as string)));

        const teamMembersSet = new Set<string>();
        // From contact owners (for leads count)
        outboundContacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });
        // From meeting assignees (primary attribution)
        pMeetings.forEach((m) => {
          if (!outboundContactIds.has(m.contact_id as string)) return;
          const name = getTeamMemberName(m);
          if (name) teamMembersSet.add(name);
        });
        // From activity performers
        pActivities.forEach((a) => {
          if (!outboundContactIds.has(a.contact_id as string)) return;
          const name = getTeamMemberName(a);
          if (name) teamMembersSet.add(name);
        });

        const reps = Array.from(teamMembersSet).map((repName) => {
          // Contacts owned by this rep (for leads/contacts count)
          const repContacts = outboundContacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Meetings ASSIGNED TO this rep (on outbound contacts)
          const repMeetings = pMeetings.filter((m) => {
            if (!outboundContactIds.has(m.contact_id as string)) return false;
            return getTeamMemberName(m) === repName;
          });

          // Activities PERFORMED BY this rep (on outbound contacts)
          const repActivities = pActivities.filter((a) => {
            if (!outboundContactIds.has(a.contact_id as string)) return false;
            return getTeamMemberName(a) === repName;
          });

          // Build repContactIds from BOTH owned contacts + contacts from meetings/activities
          const repContactIds = new Set([
            ...repContacts.map(c => c.id as string),
            ...repMeetings.map(m => m.contact_id as string),
            ...repActivities.map(a => a.contact_id as string),
          ].filter(Boolean));

          const repOrders = pOrders.filter(o => {
            const tm = o.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });
          const repDeals = deals.filter(d => {
            const tm = d.team_members as { first_name: string; last_name: string } | null;
            if (tm) return `${tm.first_name} ${tm.last_name}` === repName;
            // Fallback: if no owner, match by contact
            return d.contact_id ? repContactIds.has(d.contact_id as string) : false;
          });

          // Prospection — based on activities PERFORMED by this rep
          const callsByRep: Record<string, number> = {};
          repActivities.filter(a => a.type === "appel").forEach(a => {
            const cid = a.contact_id as string;
            callsByRep[cid] = (callsByRep[cid] || 0) + 1;
          });
          const suiviRelances = Object.values(callsByRep).reduce((s, n) => s + Math.max(0, n - 1), 0);

          // Contacts actually REACHED by this rep (exclude unanswered / voicemail)
          const reachedByRep: Record<string, number> = {};
          repActivities.filter(a => {
            if (a.type !== "appel") return false;
            const desc = String(a.description ?? "");
            return !desc.includes("Pas de réponse") && !desc.includes("Message vocal");
          }).forEach(a => {
            const cid = a.contact_id as string;
            reachedByRep[cid] = (reachedByRep[cid] || 0) + 1;
          });

          // Cibles qualifiées: contacts owned by this rep marked as is_qualified
          const ciblesQualifiees = repContacts.filter(c => (c as Record<string, unknown>).is_qualified === true).length;

          // Actions sortantes: email + call activities performed by this rep
          const actionsSortantes = repActivities.filter(a => a.type === "appel" || a.type === "email").length;

          // Deci 1er contact: unique outbound contacts this rep has actually REACHED
          const repReachedContactIds = new Set(Object.keys(reachedByRep));
          const deci1erContact = repReachedContactIds.size;
          const pctDeciContacte = repContacts.length > 0 ? Math.round((deci1erContact / repContacts.length) * 100) : 0;

          // Deci recontacté: contacts this rep has reached more than once
          const deciRecontacte = Object.values(reachedByRep).filter(n => n > 1).length;

          // RDV pris: meetings booked where the booking call was made by this rep
          // (detected via "Booké" activity by this rep on the contact)
          const repBookedContactIds = new Set<string>();
          repActivities.filter(a => a.type === "appel" && a.description && (
            String(a.description).includes("Booké") || String(a.description).includes("Booked")
          )).forEach(a => { if (a.contact_id) repBookedContactIds.add(a.contact_id as string); });
          // Also count meetings directly assigned to this rep as R1 pris
          const r1PrisByBooking = pMeetings.filter(m => {
            if (!outboundContactIds.has(m.contact_id as string)) return false;
            if (!(m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1")) return false;
            if (!(m.status === "booked" || m.status === "done")) return false;
            // Credit to this rep if they made the booking call OR are assigned
            return repBookedContactIds.has(m.contact_id as string) || getTeamMemberName(m) === repName;
          });
          // Deduplicate: avoid counting same meeting twice if rep both called and is assigned
          const r1PrisIds = new Set(r1PrisByBooking.map(m => m.id as string));
          const r1Pris = r1PrisIds.size;
          const pctR1Pris = ciblesQualifiees > 0 ? Math.round((r1Pris / ciblesQualifiees) * 100) : 0;

          // R1 fait: meetings done that are assigned to this rep
          const r1Fait = repMeetings.filter(m => (m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1") && m.status === "done").length;
          const pctR1Fait = r1Pris > 0 ? Math.round((r1Fait / r1Pris) * 100) : 0;

          // Prop: nb of proposals (deals)
          const propDeals = repDeals.filter(d => ["opportunities", "quote_to_send", "quote_sent", "opco_deposit", "quote_signed"].includes(d.stage as string) && isInProspMonth((d.created_at) as string));
          const prop = propDeals.length;

          // Pipe: total amount of proposals
          const pipeMontant = propDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

          const wonDeals = repDeals.filter(d => d.stage === "closed_won" && isInProspMonth((d.close_date || d.created_at) as string));
          const nSignes = wonDeals.length;
          const montantSigne = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

          // Performances
          const pctClosingR1 = r1Fait > 0 ? Math.round((nSignes / r1Fait) * 100) : 0;
          const pctTransfoProp = prop > 0 ? Math.round((nSignes / prop) * 100) : 0;
          const pctConvPipe = pipeMontant > 0 ? Math.round((montantSigne / pipeMontant) * 100) : 0;
          const panierMoyen = nSignes > 0 ? Math.round(montantSigne / nSignes) : 0;

          // Raw data for drill-down
          const _qualifiedContacts = repContacts.filter(c => (c as Record<string, unknown>).is_qualified === true);
          const _deci1erContacts = [...repReachedContactIds].map(cid => outboundContacts.find(c => (c.id as string) === cid)).filter(Boolean) as R[];
          const _deciRecontacteContacts = Object.entries(reachedByRep).filter(([, n]) => n > 1).map(([cid]) => outboundContacts.find(c => (c.id as string) === cid)).filter(Boolean) as R[];
          const _r1PrisMeetings = r1PrisByBooking;
          const _r1FaitMeetings = repMeetings.filter(m => (m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1") && m.status === "done");

          return {
            name: repName, suiviRelances, ciblesQualifiees, actionsSortantes,
            deci1erContact, pctDeciContacte, deciRecontacte,
            r1Pris, pctR1Pris, r1Fait, pctR1Fait,
            prop, pipeMontant, nSignes, montantSigne,
            pctClosingR1, pctTransfoProp, pctConvPipe, panierMoyen,
            _repContacts: repContacts,
            _repMeetings: repMeetings,
            _repOrders: repOrders,
            _repDeals: repDeals,
            _repActivities: repActivities,
            _qualifiedContacts,
            _deci1erContacts,
            _deciRecontacteContacts,
            _r1PrisMeetings,
            _r1FaitMeetings,
            _propDeals: propDeals,
            _wonDeals: wonDeals,
          };
        });

        // Group header styles
        const thGroup: React.CSSProperties = { fontSize: 10, fontWeight: 800, textAlign: "center", padding: "6px 4px", lineHeight: 1.2, color: "white" };
        const th: React.CSSProperties = { fontSize: 8, fontWeight: 700, color: "#1a2a3a", textAlign: "center", padding: "4px 2px", borderBottom: "2px solid #dce8f0", lineHeight: 1.2, whiteSpace: "normal" };
        const td: React.CSSProperties = { fontSize: 11, textAlign: "center", padding: "5px 2px", borderBottom: "1px solid #e6f0f7" };
        const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "#1a2a3a" };
        const tdC: React.CSSProperties = { ...td, color: "#1a6b9c", fontWeight: 600 };
        const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: "#1a2a3a" };

        return (
          <>
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Monthly Outbound — <span style={{ textTransform: "capitalize" }}>{prospMonthLabel}</span></h3>
                  <div className="flex items-center gap-2">
                  <ExportButton onExport={(fmt: ExportFormat) => exportData(
                    reps.map((r) => ({ rep: r.name, suivi_relances: r.suiviRelances, cibles_qualifiees: r.ciblesQualifiees, actions_sortantes: r.actionsSortantes, deci_1er_contact: r.deci1erContact, r1_pris: r.r1Pris, r1_fait: r.r1Fait, propositions: r.prop, pipe_montant: r.pipeMontant, n_signes: r.nSignes, ca_ht: r.montantSigne, panier_moyen: r.panierMoyen })),
                    [{ key: "rep", label: "Commercial" }, { key: "suivi_relances", label: "Suivi & Relances" }, { key: "cibles_qualifiees", label: "Cibles Qualifiées" }, { key: "actions_sortantes", label: "Actions Sortantes" }, { key: "deci_1er_contact", label: "Déci 1er Contact" }, { key: "r1_pris", label: "R1 Pris" }, { key: "r1_fait", label: "R1 Fait" }, { key: "propositions", label: "Propositions" }, { key: "pipe_montant", label: "Pipe €" }, { key: "n_signes", label: "N° Signés" }, { key: "ca_ht", label: "CA € HT" }, { key: "panier_moyen", label: "Panier Moyen" }],
                    `outbound_monthly_${selectedMonth}`, fmt
                  )} />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                  />
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    {/* Group headers */}
                    <tr>
                      <th style={{ ...thGroup, background: "#1a6b9c", borderRadius: "6px 0 0 0" }} colSpan={1}></th>
                      <th style={{ ...thGroup, background: "#1a6b9c" }} colSpan={6}>Prospection</th>
                      <th style={{ ...thGroup, background: "#0d4f7a" }} colSpan={7}>RDV</th>
                      <th style={{ ...thGroup, background: "#FF6B35", borderRadius: "0 6px 0 0" }} colSpan={5}>Performances</th>
                    </tr>
                    {/* Column headers */}
                    <tr>
                      <th style={{ ...th, textAlign: "left", width: 36, background: "#e6f0f7" }}>Sales<br />Rep</th>
                      {/* Prospection */}
                      <th style={{ ...th, background: "#e6f0f7" }}>Suivi &amp;<br />Relances</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Cibles<br />Qualif.</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Actions<br />Sort.</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Deci 1er<br />contact</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>% Deci<br />contacté</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Deci<br />recontacté</th>
                      {/* RDV */}
                      <th style={{ ...th, background: "#dce8f0" }}>R1<br />pris</th>
                      <th style={{ ...th, background: "#dce8f0" }}>% R1<br />pris</th>
                      <th style={{ ...th, background: "#dce8f0" }}>R1<br />fait</th>
                      <th style={{ ...th, background: "#dce8f0" }}>% R1<br />fait</th>
                      <th style={{ ...th, background: "#dce8f0" }}>Prop</th>
                      <th style={{ ...th, background: "#dce8f0" }}>Prop €</th>
                      <th style={{ ...th, background: "#dce8f0" }}>N°<br />signés</th>
                      {/* Performances */}
                      <th style={{ ...th, background: "#fff0e6" }}>CA €<br />HT</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Clos.<br />R1</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Transfo<br />Prop</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Conv.<br />Pipe</th>
                      <th style={{ ...th, background: "#fff0e6" }}>Panier<br />Moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tdL, color: "#1a6b9c" }} title={r.name}>{ini(r.name)}</td>
                        {/* Prospection */}
                        {drillCell(r.suiviRelances, tdB, `Suivi & Relances — ${r.name}`, (r._repActivities as R[]).filter((a: R) => a.type === "appel").map((a: R) => ({ label: getContactNameFromRecord(a), sublabel: (a.created_at as string).slice(0, 10), href: getContactIdFromRecord(a) ? `/contacts/${getContactIdFromRecord(a)}` : undefined })))}
                        {drillCell(r.ciblesQualifiees, tdB, `Cibles Qualifiées — ${r.name}`, (r._qualifiedContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.actionsSortantes, tdB, `Actions Sortantes — ${r.name}`, (r._repActivities as R[]).filter((a: R) => a.type === "appel" || a.type === "email").map((a: R) => ({ label: getContactNameFromRecord(a), sublabel: `${(a.type as string)} — ${(a.created_at as string).slice(0, 10)}`, href: getContactIdFromRecord(a) ? `/contacts/${getContactIdFromRecord(a)}` : undefined })))}
                        {drillCell(r.deci1erContact, tdB, `Déci 1er Contact — ${r.name}`, (r._deci1erContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        <td style={tdC}>{r.pctDeciContacte}%</td>
                        {drillCell(r.deciRecontacte, tdB, `Déci Recontacté — ${r.name}`, (r._deciRecontacteContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {/* RDV */}
                        {drillCell(r.r1Pris, tdB, `R1 Pris — ${r.name}`, (r._r1PrisMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctR1Pris}%</td>
                        {drillCell(r.r1Fait, tdB, `R1 Fait — ${r.name}`, (r._r1FaitMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctR1Fait}%</td>
                        {drillCell(r.prop, tdB, `Propositions — ${r.name}`, (r._propDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: `${(d.stage as string)} — ${(d.created_at as string).slice(0, 10)}`, amount: Number(d.amount) || 0 })))}
                        {drillCell(fmt(r.pipeMontant), tdB, `Pipe Montant — ${r.name}`, (r._propDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: `${(d.stage as string)} — ${(d.created_at as string).slice(0, 10)}`, amount: Number(d.amount) || 0 })))}
                        {drillCell(r.nSignes, { ...tdB, color: "#27ae60" }, `Signés — ${r.name}`, (r._wonDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: ((d.close_date || d.created_at) as string).slice(0, 10), href: `/deals`, amount: Number(d.amount) || 0 })))}
                        {/* Performances */}
                        {drillCell(fmt(r.montantSigne), { ...tdB, color: "#27ae60" }, `CA HT — ${r.name}`, (r._repOrders as R[]).map((o: R) => ({ label: (o.name as string) ?? "Commande", sublabel: ((o.close_date || o.created_at) as string).slice(0, 10), amount: Number(o.amount) || 0 })))}
                        <td style={tdC}>{r.pctClosingR1}%</td>
                        <td style={tdC}>{r.pctTransfoProp}%</td>
                        <td style={tdC}>{r.pctConvPipe}%</td>
                        <td style={tdB}>{fmt(r.panierMoyen)}</td>
                      </tr>
                    ))}
                    {/* Total */}
                    <tr style={{ background: "#e6f0f7", fontWeight: 700 }}>
                      <td style={{ ...tdL, fontWeight: 800 }}>Total</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.suiviRelances, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.ciblesQualifiees, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.actionsSortantes, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.deci1erContact, 0)}</td>
                      <td style={tdC}>{(() => { const totalContacts = contacts.length; const d = reps.reduce((s, r) => s + r.deci1erContact, 0); return totalContacts > 0 ? Math.round((d / totalContacts) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.deciRecontacte, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.r1Pris, 0)}</td>
                      <td style={tdC}>{(() => { const q = reps.reduce((s, r) => s + r.ciblesQualifiees, 0); const p = reps.reduce((s, r) => s + r.r1Pris, 0); return q > 0 ? Math.round((p / q) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.r1Fait, 0)}</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.r1Pris, 0); const f = reps.reduce((s, r) => s + r.r1Fait, 0); return p > 0 ? Math.round((f / p) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.prop, 0)}</td>
                      <td style={tdB}>{fmt(reps.reduce((s, r) => s + r.pipeMontant, 0))}</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{reps.reduce((s, r) => s + r.nSignes, 0)}</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{fmt(reps.reduce((s, r) => s + r.montantSigne, 0))}</td>
                      <td style={tdC}>{(() => { const f = reps.reduce((s, r) => s + r.r1Fait, 0); const n = reps.reduce((s, r) => s + r.nSignes, 0); return f > 0 ? Math.round((n / f) * 100) : 0; })()}%</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.prop, 0); const n = reps.reduce((s, r) => s + r.nSignes, 0); return p > 0 ? Math.round((n / p) * 100) : 0; })()}%</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.pipeMontant, 0); const m = reps.reduce((s, r) => s + r.montantSigne, 0); return p > 0 ? Math.round((m / p) * 100) : 0; })()}%</td>
                      <td style={tdB}>{(() => { const n = reps.reduce((s, r) => s + r.nSignes, 0); const c = reps.reduce((s, r) => s + r.montantSigne, 0); return n > 0 ? fmt(Math.round(c / n)) : "—"; })()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Weekly Outbound ===== */}
      {selectedReport === "outbound" && outboundMode === "weekly" && (() => {
        function ini(name: string) { return name.split(" ").map(w => w[0]).join("").toUpperCase(); }

        // Compute week bounds from filterWeekOutbound (a Monday date string)
        const weekMonday = new Date(filterWeekOutbound + "T00:00:00");
        const weekSunday = new Date(weekMonday);
        weekSunday.setDate(weekSunday.getDate() + 6);
        const weekStart = filterWeekOutbound;
        const weekEnd = `${weekSunday.getFullYear()}-${String(weekSunday.getMonth() + 1).padStart(2, "0")}-${String(weekSunday.getDate()).padStart(2, "0")}`;

        function isInWeekOut(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= weekStart && d <= weekEnd;
        }

        const weekLabel = (() => {
          const dStart = weekMonday;
          const dEnd = weekSunday;
          const dayStart = dStart.getDate();
          const dayEnd = dEnd.getDate();
          const monthStart = dStart.toLocaleDateString("fr-FR", { month: "long" });
          const monthEnd = dEnd.toLocaleDateString("fr-FR", { month: "long" });
          const year = dEnd.getFullYear();
          if (monthStart === monthEnd) {
            return `Semaine du ${dayStart} au ${dayEnd} ${monthStart} ${year}`;
          }
          return `Semaine du ${dayStart} ${monthStart} au ${dayEnd} ${monthEnd} ${year}`;
        })();

        function shiftWeekOutbound(offset: number) {
          const d = new Date(filterWeekOutbound + "T00:00:00");
          d.setDate(d.getDate() + offset * 7);
          setFilterWeekOutbound(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        }

        const pActivities = activities.filter(a => isInWeekOut(a.created_at as string));
        const pMeetings = meetings.filter(m => isInWeekOut(m.scheduled_at as string));
        const pOrders = orders.filter(o => isInWeekOut(((o.close_date || o.created_at) as string)));

        const teamMembersSet = new Set<string>();
        // From contact owners (for leads count)
        outboundContacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });
        // From meeting assignees (primary attribution)
        pMeetings.forEach((m) => {
          if (!outboundContactIds.has(m.contact_id as string)) return;
          const name = getTeamMemberName(m);
          if (name) teamMembersSet.add(name);
        });
        // From activity performers
        pActivities.forEach((a) => {
          if (!outboundContactIds.has(a.contact_id as string)) return;
          const name = getTeamMemberName(a);
          if (name) teamMembersSet.add(name);
        });

        const reps = Array.from(teamMembersSet).map((repName) => {
          // Contacts owned by this rep (for leads/contacts count)
          const repContacts = outboundContacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Meetings ASSIGNED TO this rep (on outbound contacts)
          const repMeetings = pMeetings.filter((m) => {
            if (!outboundContactIds.has(m.contact_id as string)) return false;
            return getTeamMemberName(m) === repName;
          });

          // Activities PERFORMED BY this rep (on outbound contacts)
          const repActivities = pActivities.filter((a) => {
            if (!outboundContactIds.has(a.contact_id as string)) return false;
            return getTeamMemberName(a) === repName;
          });

          // Build repContactIds from BOTH owned contacts + contacts from meetings/activities
          const repContactIds = new Set([
            ...repContacts.map(c => c.id as string),
            ...repMeetings.map(m => m.contact_id as string),
            ...repActivities.map(a => a.contact_id as string),
          ].filter(Boolean));

          const repOrders = pOrders.filter(o => {
            const tm = o.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });
          const repDeals = deals.filter(d => {
            const tm = d.team_members as { first_name: string; last_name: string } | null;
            if (tm) return `${tm.first_name} ${tm.last_name}` === repName;
            // Fallback: if no owner, match by contact
            return d.contact_id ? repContactIds.has(d.contact_id as string) : false;
          });

          // Prospection — based on activities PERFORMED by this rep
          const callsByRep: Record<string, number> = {};
          repActivities.filter(a => a.type === "appel").forEach(a => {
            const cid = a.contact_id as string;
            callsByRep[cid] = (callsByRep[cid] || 0) + 1;
          });
          const suiviRelances = Object.values(callsByRep).reduce((s, n) => s + Math.max(0, n - 1), 0);

          // Contacts actually REACHED by this rep (exclude unanswered / voicemail)
          const reachedByRep: Record<string, number> = {};
          repActivities.filter(a => {
            if (a.type !== "appel") return false;
            const desc = String(a.description ?? "");
            return !desc.includes("Pas de réponse") && !desc.includes("Message vocal");
          }).forEach(a => {
            const cid = a.contact_id as string;
            reachedByRep[cid] = (reachedByRep[cid] || 0) + 1;
          });

          const ciblesQualifiees = repContacts.filter(c => (c as Record<string, unknown>).is_qualified === true).length;
          const actionsSortantes = repActivities.filter(a => a.type === "appel" || a.type === "email").length;
          const repReachedContactIds = new Set(Object.keys(reachedByRep));
          const deci1erContact = repReachedContactIds.size;
          const pctDeciContacte = repContacts.length > 0 ? Math.round((deci1erContact / repContacts.length) * 100) : 0;
          const deciRecontacte = Object.values(reachedByRep).filter(n => n > 1).length;

          // RDV pris: credit to who made the booking call
          const repBookedContactIds = new Set<string>();
          repActivities.filter(a => a.type === "appel" && a.description && (
            String(a.description).includes("Booké") || String(a.description).includes("Booked")
          )).forEach(a => { if (a.contact_id) repBookedContactIds.add(a.contact_id as string); });
          const r1PrisByBooking = pMeetings.filter((m: R) => {
            if (!outboundContactIds.has(m.contact_id as string)) return false;
            if (!(m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1")) return false;
            if (!(m.status === "booked" || m.status === "done")) return false;
            return repBookedContactIds.has(m.contact_id as string) || getTeamMemberName(m) === repName;
          });
          const r1PrisIds = new Set(r1PrisByBooking.map((m: R) => m.id as string));
          const r1Pris = r1PrisIds.size;
          const pctR1Pris = ciblesQualifiees > 0 ? Math.round((r1Pris / ciblesQualifiees) * 100) : 0;
          const r1Fait = repMeetings.filter(m => (m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1") && m.status === "done").length;
          const pctR1Fait = r1Pris > 0 ? Math.round((r1Fait / r1Pris) * 100) : 0;

          const propDeals = repDeals.filter(d => ["opportunities", "quote_to_send", "quote_sent", "opco_deposit", "quote_signed"].includes(d.stage as string) && isInWeekOut((d.created_at) as string));
          const prop = propDeals.length;
          const pipeMontant = propDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
          const wonDeals = repDeals.filter(d => d.stage === "closed_won" && isInWeekOut((d.close_date || d.created_at) as string));
          const nSignes = wonDeals.length;
          const montantSigne = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
          const pctClosingR1 = r1Fait > 0 ? Math.round((nSignes / r1Fait) * 100) : 0;
          const pctTransfoProp = prop > 0 ? Math.round((nSignes / prop) * 100) : 0;
          const pctConvPipe = pipeMontant > 0 ? Math.round((montantSigne / pipeMontant) * 100) : 0;
          const panierMoyen = nSignes > 0 ? Math.round(montantSigne / nSignes) : 0;

          const _qualifiedContacts = repContacts.filter(c => (c as Record<string, unknown>).is_qualified === true);
          const _deci1erContacts = [...repReachedContactIds].map(cid => outboundContacts.find(c => (c.id as string) === cid)).filter(Boolean) as R[];
          const _deciRecontacteContacts = Object.entries(reachedByRep).filter(([, n]) => n > 1).map(([cid]) => outboundContacts.find(c => (c.id as string) === cid)).filter(Boolean) as R[];
          const _r1PrisMeetings = r1PrisByBooking;
          const _r1FaitMeetings = repMeetings.filter(m => (m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1") && m.status === "done");

          return {
            name: repName, suiviRelances, ciblesQualifiees, actionsSortantes,
            deci1erContact, pctDeciContacte, deciRecontacte,
            r1Pris, pctR1Pris, r1Fait, pctR1Fait,
            prop, pipeMontant, nSignes, montantSigne,
            pctClosingR1, pctTransfoProp, pctConvPipe, panierMoyen,
            _repContacts: repContacts,
            _repMeetings: repMeetings,
            _repOrders: repOrders,
            _repDeals: repDeals,
            _repActivities: repActivities,
            _qualifiedContacts,
            _deci1erContacts,
            _deciRecontacteContacts,
            _r1PrisMeetings,
            _r1FaitMeetings,
            _propDeals: propDeals,
            _wonDeals: wonDeals,
          };
        });

        // Group header styles
        const thGroup: React.CSSProperties = { fontSize: 10, fontWeight: 800, textAlign: "center", padding: "6px 4px", lineHeight: 1.2, color: "white" };
        const th: React.CSSProperties = { fontSize: 8, fontWeight: 700, color: "#1a2a3a", textAlign: "center", padding: "4px 2px", borderBottom: "2px solid #dce8f0", lineHeight: 1.2, whiteSpace: "normal" };
        const td: React.CSSProperties = { fontSize: 11, textAlign: "center", padding: "5px 2px", borderBottom: "1px solid #e6f0f7" };
        const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "#1a2a3a" };
        const tdC: React.CSSProperties = { ...td, color: "#1a6b9c", fontWeight: 600 };
        const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: "#1a2a3a" };

        return (
          <>
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Weekly Outbound — <span style={{ textTransform: "capitalize" }}>{weekLabel}</span></h3>
                  <div className="flex items-center gap-2">
                    <ExportButton onExport={(fmt: ExportFormat) => exportData(
                      reps.map((r) => ({ rep: r.name, suivi_relances: r.suiviRelances, cibles_qualifiees: r.ciblesQualifiees, actions_sortantes: r.actionsSortantes, deci_1er_contact: r.deci1erContact, r1_pris: r.r1Pris, r1_fait: r.r1Fait, propositions: r.prop, pipe_montant: r.pipeMontant, n_signes: r.nSignes, ca_ht: r.montantSigne, panier_moyen: r.panierMoyen })),
                      [{ key: "rep", label: "Commercial" }, { key: "suivi_relances", label: "Suivi & Relances" }, { key: "cibles_qualifiees", label: "Cibles Qualifiées" }, { key: "actions_sortantes", label: "Actions Sortantes" }, { key: "deci_1er_contact", label: "Déci 1er Contact" }, { key: "r1_pris", label: "R1 Pris" }, { key: "r1_fait", label: "R1 Fait" }, { key: "propositions", label: "Propositions" }, { key: "pipe_montant", label: "Pipe €" }, { key: "n_signes", label: "N° Signés" }, { key: "ca_ht", label: "CA € HT" }, { key: "panier_moyen", label: "Panier Moyen" }],
                      `outbound_weekly_${filterWeekOutbound}`, fmt
                    )} />
                    <button onClick={() => shiftWeekOutbound(-1)} style={{ height: 32, width: 32, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#1a2a3a" }}>&lt;</button>
                    <input
                      type="date"
                      value={filterWeekOutbound}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const d = new Date(val + "T00:00:00");
                        const day = d.getDay();
                        const diff = day === 0 ? -6 : 1 - day;
                        d.setDate(d.getDate() + diff);
                        setFilterWeekOutbound(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                      }}
                      style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                    />
                    <button onClick={() => shiftWeekOutbound(1)} style={{ height: 32, width: 32, borderRadius: 8, border: "1px solid #dce8f0", background: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#1a2a3a" }}>&gt;</button>
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    {/* Group headers */}
                    <tr>
                      <th style={{ ...thGroup, background: "#1a6b9c", borderRadius: "6px 0 0 0" }} colSpan={1}></th>
                      <th style={{ ...thGroup, background: "#1a6b9c" }} colSpan={6}>Prospection</th>
                      <th style={{ ...thGroup, background: "#0d4f7a" }} colSpan={7}>RDV</th>
                      <th style={{ ...thGroup, background: "#FF6B35", borderRadius: "0 6px 0 0" }} colSpan={5}>Performances</th>
                    </tr>
                    {/* Column headers */}
                    <tr>
                      <th style={{ ...th, textAlign: "left", width: 36, background: "#e6f0f7" }}>Sales<br />Rep</th>
                      {/* Prospection */}
                      <th style={{ ...th, background: "#e6f0f7" }}>Suivi &amp;<br />Relances</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Cibles<br />Qualif.</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Actions<br />Sort.</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Deci 1er<br />contact</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>% Deci<br />contacté</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Deci<br />recontacté</th>
                      {/* RDV */}
                      <th style={{ ...th, background: "#dce8f0" }}>R1<br />pris</th>
                      <th style={{ ...th, background: "#dce8f0" }}>% R1<br />pris</th>
                      <th style={{ ...th, background: "#dce8f0" }}>R1<br />fait</th>
                      <th style={{ ...th, background: "#dce8f0" }}>% R1<br />fait</th>
                      <th style={{ ...th, background: "#dce8f0" }}>Prop</th>
                      <th style={{ ...th, background: "#dce8f0" }}>Prop €</th>
                      <th style={{ ...th, background: "#dce8f0" }}>N°<br />signés</th>
                      {/* Performances */}
                      <th style={{ ...th, background: "#fff0e6" }}>CA €<br />HT</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Clos.<br />R1</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Transfo<br />Prop</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Conv.<br />Pipe</th>
                      <th style={{ ...th, background: "#fff0e6" }}>Panier<br />Moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tdL, color: "#1a6b9c" }} title={r.name}>{ini(r.name)}</td>
                        {/* Prospection */}
                        {drillCell(r.suiviRelances, tdB, `Suivi & Relances — ${r.name}`, (r._repActivities as R[]).filter((a: R) => a.type === "appel").map((a: R) => ({ label: getContactNameFromRecord(a), sublabel: (a.created_at as string).slice(0, 10), href: getContactIdFromRecord(a) ? `/contacts/${getContactIdFromRecord(a)}` : undefined })))}
                        {drillCell(r.ciblesQualifiees, tdB, `Cibles Qualifiées — ${r.name}`, (r._qualifiedContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.actionsSortantes, tdB, `Actions Sortantes — ${r.name}`, (r._repActivities as R[]).filter((a: R) => a.type === "appel" || a.type === "email").map((a: R) => ({ label: getContactNameFromRecord(a), sublabel: `${(a.type as string)} — ${(a.created_at as string).slice(0, 10)}`, href: getContactIdFromRecord(a) ? `/contacts/${getContactIdFromRecord(a)}` : undefined })))}
                        {drillCell(r.deci1erContact, tdB, `Déci 1er Contact — ${r.name}`, (r._deci1erContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        <td style={tdC}>{r.pctDeciContacte}%</td>
                        {drillCell(r.deciRecontacte, tdB, `Déci Recontacté — ${r.name}`, (r._deciRecontacteContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {/* RDV */}
                        {drillCell(r.r1Pris, tdB, `R1 Pris — ${r.name}`, (r._r1PrisMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctR1Pris}%</td>
                        {drillCell(r.r1Fait, tdB, `R1 Fait — ${r.name}`, (r._r1FaitMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctR1Fait}%</td>
                        {drillCell(r.prop, tdB, `Propositions — ${r.name}`, (r._propDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: `${(d.stage as string)} — ${(d.created_at as string).slice(0, 10)}`, amount: Number(d.amount) || 0 })))}
                        {drillCell(fmt(r.pipeMontant), tdB, `Pipe Montant — ${r.name}`, (r._propDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: `${(d.stage as string)} — ${(d.created_at as string).slice(0, 10)}`, amount: Number(d.amount) || 0 })))}
                        {drillCell(r.nSignes, { ...tdB, color: "#27ae60" }, `Signés — ${r.name}`, (r._wonDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: ((d.close_date || d.created_at) as string).slice(0, 10), href: `/deals`, amount: Number(d.amount) || 0 })))}
                        {/* Performances */}
                        {drillCell(fmt(r.montantSigne), { ...tdB, color: "#27ae60" }, `CA HT — ${r.name}`, (r._repOrders as R[]).map((o: R) => ({ label: (o.name as string) ?? "Commande", sublabel: ((o.close_date || o.created_at) as string).slice(0, 10), amount: Number(o.amount) || 0 })))}
                        <td style={tdC}>{r.pctClosingR1}%</td>
                        <td style={tdC}>{r.pctTransfoProp}%</td>
                        <td style={tdC}>{r.pctConvPipe}%</td>
                        <td style={tdB}>{fmt(r.panierMoyen)}</td>
                      </tr>
                    ))}
                    {/* Total */}
                    <tr style={{ background: "#e6f0f7", fontWeight: 700 }}>
                      <td style={{ ...tdL, fontWeight: 800 }}>Total</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.suiviRelances, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.ciblesQualifiees, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.actionsSortantes, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.deci1erContact, 0)}</td>
                      <td style={tdC}>{(() => { const totalContacts = contacts.length; const d = reps.reduce((s, r) => s + r.deci1erContact, 0); return totalContacts > 0 ? Math.round((d / totalContacts) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.deciRecontacte, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.r1Pris, 0)}</td>
                      <td style={tdC}>{(() => { const q = reps.reduce((s, r) => s + r.ciblesQualifiees, 0); const p = reps.reduce((s, r) => s + r.r1Pris, 0); return q > 0 ? Math.round((p / q) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.r1Fait, 0)}</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.r1Pris, 0); const f = reps.reduce((s, r) => s + r.r1Fait, 0); return p > 0 ? Math.round((f / p) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.prop, 0)}</td>
                      <td style={tdB}>{fmt(reps.reduce((s, r) => s + r.pipeMontant, 0))}</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{reps.reduce((s, r) => s + r.nSignes, 0)}</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{fmt(reps.reduce((s, r) => s + r.montantSigne, 0))}</td>
                      <td style={tdC}>{(() => { const f = reps.reduce((s, r) => s + r.r1Fait, 0); const n = reps.reduce((s, r) => s + r.nSignes, 0); return f > 0 ? Math.round((n / f) * 100) : 0; })()}%</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.prop, 0); const n = reps.reduce((s, r) => s + r.nSignes, 0); return p > 0 ? Math.round((n / p) * 100) : 0; })()}%</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.pipeMontant, 0); const m = reps.reduce((s, r) => s + r.montantSigne, 0); return p > 0 ? Math.round((m / p) * 100) : 0; })()}%</td>
                      <td style={tdB}>{(() => { const n = reps.reduce((s, r) => s + r.nSignes, 0); const c = reps.reduce((s, r) => s + r.montantSigne, 0); return n > 0 ? fmt(Math.round(c / n)) : "—"; })()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Prospection Yearly ===== */}
      {selectedReport === "outbound" && outboundMode === "yearly" && (() => {
        function ini(name: string) { return name.split(" ").map(w => w[0]).join("").toUpperCase(); }

        const pyFyRange = getCurrentFiscalYearRange();
        const pyStart = yearlyMode === "full" ? pyFyRange.from : yearlyFrom;
        const pyEnd = yearlyMode === "full" ? pyFyRange.to : yearlyTo;
        const pyLabel = yearlyMode === "full"
          ? `Année complète ${getFiscalYearLabel(getCurrentFiscalYearStart())}`
          : `Du ${new Date(pyStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} au ${new Date(pyEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

        function isInPY(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= pyStart && d <= pyEnd;
        }

        const pyActivities = activities.filter(a => isInPY(a.created_at as string));
        const pyMeetings = meetings.filter(m => isInPY(m.scheduled_at as string));
        const pyOrders = orders.filter(o => isInPY(((o.close_date || o.created_at) as string)));

        const teamMembersSet = new Set<string>();
        // From contact owners (for leads count)
        outboundContacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });
        // From meeting assignees (primary attribution)
        pyMeetings.forEach((m) => {
          if (!outboundContactIds.has(m.contact_id as string)) return;
          const name = getTeamMemberName(m);
          if (name) teamMembersSet.add(name);
        });
        // From activity performers
        pyActivities.forEach((a) => {
          if (!outboundContactIds.has(a.contact_id as string)) return;
          const name = getTeamMemberName(a);
          if (name) teamMembersSet.add(name);
        });

        const reps = Array.from(teamMembersSet).map((repName) => {
          // Contacts owned by this rep (for leads/contacts count)
          const repContacts = outboundContacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });

          // Meetings ASSIGNED TO this rep (on outbound contacts)
          const repMeetings = pyMeetings.filter((m) => {
            if (!outboundContactIds.has(m.contact_id as string)) return false;
            return getTeamMemberName(m) === repName;
          });

          // Activities PERFORMED BY this rep (on outbound contacts)
          const repActivities = pyActivities.filter((a) => {
            if (!outboundContactIds.has(a.contact_id as string)) return false;
            return getTeamMemberName(a) === repName;
          });

          // Build repContactIds from BOTH owned contacts + contacts from meetings/activities
          const repContactIds = new Set([
            ...repContacts.map(c => c.id as string),
            ...repMeetings.map(m => m.contact_id as string),
            ...repActivities.map(a => a.contact_id as string),
          ].filter(Boolean));
          const repOrders = pyOrders.filter(o => {
            const tm = o.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });
          const repDeals = deals.filter(d => {
            const tm = d.team_members as { first_name: string; last_name: string } | null;
            if (tm) return `${tm.first_name} ${tm.last_name}` === repName;
            // Fallback: if no owner, match by contact
            return d.contact_id ? repContactIds.has(d.contact_id as string) : false;
          });

          // Prospection — based on activities PERFORMED by this rep
          const callsByRep: Record<string, number> = {};
          repActivities.filter(a => a.type === "appel").forEach(a => {
            const cid = a.contact_id as string;
            callsByRep[cid] = (callsByRep[cid] || 0) + 1;
          });
          const suiviRelances = Object.values(callsByRep).reduce((s, n) => s + Math.max(0, n - 1), 0);

          // Contacts actually REACHED by this rep (exclude unanswered / voicemail)
          const reachedByRep: Record<string, number> = {};
          repActivities.filter(a => {
            if (a.type !== "appel") return false;
            const desc = String(a.description ?? "");
            return !desc.includes("Pas de réponse") && !desc.includes("Message vocal");
          }).forEach(a => {
            const cid = a.contact_id as string;
            reachedByRep[cid] = (reachedByRep[cid] || 0) + 1;
          });

          const ciblesQualifiees = repContacts.filter(c => (c as unknown as Record<string, unknown>).is_qualified === true).length;
          const actionsSortantes = repActivities.filter(a => a.type === "appel" || a.type === "email").length;
          const repReachedContactIds = new Set(Object.keys(reachedByRep));
          const deci1erContact = repReachedContactIds.size;
          const pctDeciContacte = repContacts.length > 0 ? Math.round((deci1erContact / repContacts.length) * 100) : 0;
          const deciRecontacte = Object.values(reachedByRep).filter(n => n > 1).length;

          // RDV pris: credit to who made the booking call
          const repBookedContactIds = new Set<string>();
          repActivities.filter(a => a.type === "appel" && a.description && (
            String(a.description).includes("Booké") || String(a.description).includes("Booked")
          )).forEach(a => { if (a.contact_id) repBookedContactIds.add(a.contact_id as string); });
          const r1PrisByBooking = pyMeetings.filter((m: R) => {
            if (!outboundContactIds.has(m.contact_id as string)) return false;
            if (!(m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1")) return false;
            if (!(m.status === "booked" || m.status === "done")) return false;
            return repBookedContactIds.has(m.contact_id as string) || getTeamMemberName(m) === repName;
          });
          const r1PrisIds = new Set(r1PrisByBooking.map(m => m.id as string));
          const r1Pris = r1PrisIds.size;
          const pctR1Pris = ciblesQualifiees > 0 ? Math.round((r1Pris / ciblesQualifiees) * 100) : 0;
          const r1Fait = repMeetings.filter(m => (m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1") && m.status === "done").length;
          const pctR1Fait = r1Pris > 0 ? Math.round((r1Fait / r1Pris) * 100) : 0;
          const propDeals = repDeals.filter(d => ["opportunities", "quote_to_send", "quote_sent", "opco_deposit", "quote_signed"].includes(d.stage as string) && isInPY((d.created_at) as string));
          const prop = propDeals.length;
          const pipeMontant = propDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
          const wonDeals = repDeals.filter(d => d.stage === "closed_won" && isInPY((d.close_date || d.created_at) as string));
          const nSignes = wonDeals.length;
          const montantSigne = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
          const pctClosingR1 = r1Fait > 0 ? Math.round((nSignes / r1Fait) * 100) : 0;
          const pctTransfoProp = prop > 0 ? Math.round((nSignes / prop) * 100) : 0;
          const pctConvPipe = pipeMontant > 0 ? Math.round((montantSigne / pipeMontant) * 100) : 0;
          const panierMoyen = nSignes > 0 ? Math.round(montantSigne / nSignes) : 0;

          const _qualifiedContacts = repContacts.filter(c => (c as unknown as Record<string, unknown>).is_qualified === true);
          const _deci1erContacts = [...repReachedContactIds].map(cid => outboundContacts.find(c => (c.id as string) === cid)).filter(Boolean) as R[];
          const _deciRecontacteContacts = Object.entries(reachedByRep).filter(([, n]) => n > 1).map(([cid]) => outboundContacts.find(c => (c.id as string) === cid)).filter(Boolean) as R[];
          const _r1PrisMeetings = r1PrisByBooking;
          const _r1FaitMeetings = repMeetings.filter(m => (m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1") && m.status === "done");

          return {
            name: repName, suiviRelances, ciblesQualifiees, actionsSortantes,
            deci1erContact, pctDeciContacte, deciRecontacte,
            r1Pris, pctR1Pris, r1Fait, pctR1Fait,
            prop, pipeMontant, nSignes, montantSigne,
            pctClosingR1, pctTransfoProp, pctConvPipe, panierMoyen,
            _repContacts: repContacts,
            _repMeetings: repMeetings,
            _repOrders: repOrders,
            _repDeals: repDeals,
            _repActivities: repActivities,
            _qualifiedContacts,
            _deci1erContacts,
            _deciRecontacteContacts,
            _r1PrisMeetings,
            _r1FaitMeetings,
            _propDeals: propDeals,
            _wonDeals: wonDeals,
          };
        });

        const th: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: "#1a6b9c", textAlign: "center", padding: "4px 2px", borderBottom: "2px solid #1a6b9c", lineHeight: 1.2, whiteSpace: "normal" };
        const thH: React.CSSProperties = { ...th, background: "#e6f0f7" };
        const thGroup: React.CSSProperties = { fontSize: 10, fontWeight: 800, textAlign: "center", padding: "6px 4px", lineHeight: 1.2, color: "white" };
        const td: React.CSSProperties = { fontSize: 11, textAlign: "center", padding: "5px 2px", borderBottom: "1px solid #e6f0f7" };
        const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "#1a2a3a" };
        const tdC: React.CSSProperties = { ...td, color: "#1a6b9c", fontWeight: 600 };
        const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: "#1a2a3a" };

        return (
          <>
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Yearly Outbound — {pyLabel}</h3>
                  <div className="flex items-center gap-3">
                    <ExportButton onExport={(fmt: ExportFormat) => exportData(
                      reps.map((r) => ({ rep: r.name, suivi_relances: r.suiviRelances, cibles_qualifiees: r.ciblesQualifiees, actions_sortantes: r.actionsSortantes, deci_1er_contact: r.deci1erContact, r1_pris: r.r1Pris, r1_fait: r.r1Fait, propositions: r.prop, pipe_montant: r.pipeMontant, n_signes: r.nSignes, ca_ht: r.montantSigne, panier_moyen: r.panierMoyen })),
                      [{ key: "rep", label: "Commercial" }, { key: "suivi_relances", label: "Suivi & Relances" }, { key: "cibles_qualifiees", label: "Cibles Qualifiées" }, { key: "actions_sortantes", label: "Actions Sortantes" }, { key: "deci_1er_contact", label: "Déci 1er Contact" }, { key: "r1_pris", label: "R1 Pris" }, { key: "r1_fait", label: "R1 Fait" }, { key: "propositions", label: "Propositions" }, { key: "pipe_montant", label: "Pipe €" }, { key: "n_signes", label: "N° Signés" }, { key: "ca_ht", label: "CA € HT" }, { key: "panier_moyen", label: "Panier Moyen" }],
                      "outbound_yearly", fmt
                    )} />
                    <select
                      style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                      value={yearlyMode}
                      onChange={(e) => setYearlyMode(e.target.value as "full" | "custom")}
                    >
                      <option value="full">Année complète</option>
                      <option value="custom">Période personnalisée</option>
                    </select>
                    {yearlyMode === "custom" && (
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 11, color: "#8399a9" }}>Du</span>
                        <input type="date" value={yearlyFrom} onChange={(e) => setYearlyFrom(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
                        <span style={{ fontSize: 11, color: "#8399a9" }}>au</span>
                        <input type="date" value={yearlyTo} onChange={(e) => setYearlyTo(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
                      </div>
                    )}
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thGroup, background: "#1a6b9c", borderRadius: "6px 0 0 0" }} colSpan={1}></th>
                      <th style={{ ...thGroup, background: "#1a6b9c" }} colSpan={6}>Prospection</th>
                      <th style={{ ...thGroup, background: "#0d4f7a" }} colSpan={7}>RDV</th>
                      <th style={{ ...thGroup, background: "#FF6B35", borderRadius: "0 6px 0 0" }} colSpan={5}>Performances</th>
                    </tr>
                    <tr>
                      <th style={{ ...th, textAlign: "left", width: 36, background: "#e6f0f7" }}>Sales<br />Rep</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Suivi &amp;<br />Relances</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Cibles<br />Qualif.</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Actions<br />Sort.</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Deci 1er<br />contact</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>% Deci<br />contacté</th>
                      <th style={{ ...th, background: "#e6f0f7" }}>Deci<br />recontacté</th>
                      <th style={{ ...th, background: "#dce8f0" }}>R1<br />pris</th>
                      <th style={{ ...th, background: "#dce8f0" }}>% R1<br />pris</th>
                      <th style={{ ...th, background: "#dce8f0" }}>R1<br />fait</th>
                      <th style={{ ...th, background: "#dce8f0" }}>% R1<br />fait</th>
                      <th style={{ ...th, background: "#dce8f0" }}>Prop</th>
                      <th style={{ ...th, background: "#dce8f0" }}>Prop €</th>
                      <th style={{ ...th, background: "#dce8f0" }}>N°<br />signés</th>
                      <th style={{ ...th, background: "#fff0e6" }}>CA €<br />HT</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Clos.<br />R1</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Transfo<br />Prop</th>
                      <th style={{ ...th, background: "#fff0e6" }}>% Conv.<br />Pipe</th>
                      <th style={{ ...th, background: "#fff0e6" }}>Panier<br />Moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tdL, color: "#1a6b9c" }} title={r.name}>{ini(r.name)}</td>
                        {drillCell(r.suiviRelances, tdB, `Suivi & Relances — ${r.name}`, (r._repActivities as R[]).filter((a: R) => a.type === "appel").map((a: R) => ({ label: getContactNameFromRecord(a), sublabel: (a.created_at as string).slice(0, 10), href: getContactIdFromRecord(a) ? `/contacts/${getContactIdFromRecord(a)}` : undefined })))}
                        {drillCell(r.ciblesQualifiees, tdB, `Cibles Qualifiées — ${r.name}`, (r._qualifiedContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.actionsSortantes, tdB, `Actions Sortantes — ${r.name}`, (r._repActivities as R[]).filter((a: R) => a.type === "appel" || a.type === "email").map((a: R) => ({ label: getContactNameFromRecord(a), sublabel: `${(a.type as string)} — ${(a.created_at as string).slice(0, 10)}`, href: getContactIdFromRecord(a) ? `/contacts/${getContactIdFromRecord(a)}` : undefined })))}
                        {drillCell(r.deci1erContact, tdB, `Déci 1er Contact — ${r.name}`, (r._deci1erContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        <td style={tdC}>{r.pctDeciContacte}%</td>
                        {drillCell(r.deciRecontacte, tdB, `Déci Recontacté — ${r.name}`, (r._deciRecontacteContacts as R[]).map((c: R) => ({ label: `${c.first_name} ${c.last_name}`, sublabel: (c.created_at as string).slice(0, 10), href: `/contacts/${c.id}` })))}
                        {drillCell(r.r1Pris, tdB, `R1 Pris — ${r.name}`, (r._r1PrisMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctR1Pris}%</td>
                        {drillCell(r.r1Fait, tdB, `R1 Fait — ${r.name}`, (r._r1FaitMeetings as R[]).map((m: R) => ({ label: getContactNameFromRecord(m), sublabel: `${(m.meeting_type as string)} — ${(m.scheduled_at as string).slice(0, 10)}`, href: getContactIdFromRecord(m) ? `/contacts/${getContactIdFromRecord(m)}` : undefined })))}
                        <td style={tdC}>{r.pctR1Fait}%</td>
                        {drillCell(r.prop, tdB, `Propositions — ${r.name}`, (r._propDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: `${(d.stage as string)} — ${(d.created_at as string).slice(0, 10)}`, amount: Number(d.amount) || 0 })))}
                        {drillCell(fmt(r.pipeMontant), tdB, `Pipe Montant — ${r.name}`, (r._propDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: `${(d.stage as string)} — ${(d.created_at as string).slice(0, 10)}`, amount: Number(d.amount) || 0 })))}
                        {drillCell(r.nSignes, { ...tdB, color: "#27ae60" }, `Signés — ${r.name}`, (r._wonDeals as R[]).map((d: R) => ({ label: (d.name as string) ?? "Deal", sublabel: ((d.close_date || d.created_at) as string).slice(0, 10), href: `/deals`, amount: Number(d.amount) || 0 })))}
                        {drillCell(fmt(r.montantSigne), { ...tdB, color: "#27ae60" }, `CA HT — ${r.name}`, (r._repOrders as R[]).map((o: R) => ({ label: (o.name as string) ?? "Commande", sublabel: ((o.close_date || o.created_at) as string).slice(0, 10), amount: Number(o.amount) || 0 })))}
                        <td style={tdC}>{r.pctClosingR1}%</td>
                        <td style={tdC}>{r.pctTransfoProp}%</td>
                        <td style={tdC}>{r.pctConvPipe}%</td>
                        <td style={tdB}>{fmt(r.panierMoyen)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#e6f0f7", fontWeight: 700 }}>
                      <td style={{ ...tdL, fontWeight: 800 }}>Total</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.suiviRelances, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.ciblesQualifiees, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.actionsSortantes, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.deci1erContact, 0)}</td>
                      <td style={tdC}>{(() => { const t = contacts.length; const d = reps.reduce((s, r) => s + r.deci1erContact, 0); return t > 0 ? Math.round((d / t) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.deciRecontacte, 0)}</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.r1Pris, 0)}</td>
                      <td style={tdC}>{(() => { const q = reps.reduce((s, r) => s + r.ciblesQualifiees, 0); const p = reps.reduce((s, r) => s + r.r1Pris, 0); return q > 0 ? Math.round((p / q) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.r1Fait, 0)}</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.r1Pris, 0); const f = reps.reduce((s, r) => s + r.r1Fait, 0); return p > 0 ? Math.round((f / p) * 100) : 0; })()}%</td>
                      <td style={tdB}>{reps.reduce((s, r) => s + r.prop, 0)}</td>
                      <td style={tdB}>{fmt(reps.reduce((s, r) => s + r.pipeMontant, 0))}</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{reps.reduce((s, r) => s + r.nSignes, 0)}</td>
                      <td style={{ ...tdB, color: "#27ae60" }}>{fmt(reps.reduce((s, r) => s + r.montantSigne, 0))}</td>
                      <td style={tdC}>{(() => { const f = reps.reduce((s, r) => s + r.r1Fait, 0); const n = reps.reduce((s, r) => s + r.nSignes, 0); return f > 0 ? Math.round((n / f) * 100) : 0; })()}%</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.prop, 0); const n = reps.reduce((s, r) => s + r.nSignes, 0); return p > 0 ? Math.round((n / p) * 100) : 0; })()}%</td>
                      <td style={tdC}>{(() => { const p = reps.reduce((s, r) => s + r.pipeMontant, 0); const m = reps.reduce((s, r) => s + r.montantSigne, 0); return p > 0 ? Math.round((m / p) * 100) : 0; })()}%</td>
                      <td style={tdB}>{(() => { const n = reps.reduce((s, r) => s + r.nSignes, 0); const c = reps.reduce((s, r) => s + r.montantSigne, 0); return n > 0 ? fmt(Math.round(c / n)) : "—"; })()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Type de RDV fait ===== */}
      {selectedReport === "rdv_types" && (() => {
        // Period filter - supports fiscal, month, custom
        function getRdvPeriod(): { from: string; to: string } {
          if (yearlyMode === "full") return getCurrentFiscalYearRange();
          if ((yearlyMode as string) === "month") {
            const [y, m] = selectedMonth.split("-").map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            return { from: `${selectedMonth}-01`, to: `${selectedMonth}-${String(lastDay).padStart(2, "0")}` };
          }
          return { from: yearlyFrom, to: yearlyTo };
        }
        const rdvPeriod = getRdvPeriod();

        function isInRdvPeriod(dateStr: string | null | undefined): boolean {
          if (!dateStr) return false;
          const d = (dateStr as string).slice(0, 10);
          return d >= rdvPeriod.from && d <= rdvPeriod.to;
        }

        const rdvLabel = yearlyMode === "full" ? `Année fiscale ${getFiscalYearLabel(getCurrentFiscalYearStart())}`
          : (yearlyMode as string) === "month" ? (() => { const [y, m] = selectedMonth.split("-").map(Number); return new Date(y, m - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); })()
          : `Du ${new Date(yearlyFrom).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} au ${new Date(yearlyTo).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

        // Count meetings by type (done only), filtered by period
        const doneMeetings = meetings.filter(m => m.status === "done" && isInRdvPeriod(m.scheduled_at as string));
        const doneActivities = activities.filter(a => (a.type === "appel" || a.type === "relance") && isInRdvPeriod(a.created_at as string));

        // RDV types
        const r0Count = doneMeetings.filter(m => m.meeting_type === "R0" || m.meeting_type === "R0+R1").length;
        const r1Count = doneMeetings.filter(m => m.meeting_type === "R1" || m.meeting_type === "R0+R1").length;
        const r2Count = doneMeetings.filter(m => m.meeting_type === "R2" || m.meeting_type === "R2+R3").length;
        const r3Count = doneMeetings.filter(m => m.meeting_type === "R3" || m.meeting_type === "R2+R3").length;

        // Activity types
        const appelCount = doneActivities.filter(a => a.type === "appel").length;
        const relanceCount = doneActivities.filter(a => a.type === "relance").length;

        // Chart data - grouped by activity type
        const chartDataAppels = [
          { type: "Appels", Appel: appelCount, Relance: relanceCount },
        ];

        const chartDataRdv = [
          { type: "Réunions", "R0 Qualification": r0Count, "R1 Découverte": r1Count, "R2 Solution": r2Count, "R3 Négociation": r3Count },
        ];

        const COLORS_APPELS = {
          "Appel": "#FF8C5A",
          "Relance": "#1abc9c",
        };

        const COLORS_RDV = {
          "R0 Qualification": "#b8a9e8",
          "R1 Découverte": "#e74c3c",
          "R2 Solution": "#7fb3d8",
          "R3 Négociation": "#27ae60",
        };

        const appelKeys = ["Appel", "Relance"] as const;
        const rdvKeys = ["R0 Qualification", "R1 Découverte", "R2 Solution", "R3 Négociation"] as const;

        // Per sales rep breakdown
        const teamMembersSet = new Set<string>();
        contacts.forEach((c) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) teamMembersSet.add(`${tm.first_name} ${tm.last_name}`);
        });

        const repData = Array.from(teamMembersSet).map((repName) => {
          const repContacts = contacts.filter((c) => {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            return tm ? `${tm.first_name} ${tm.last_name}` === repName : false;
          });
          const repContactIds = new Set(repContacts.map(c => c.id as string));
          const repDoneMeetings = doneMeetings.filter(m => repContactIds.has(m.contact_id as string));
          const repDoneActivities = doneActivities.filter(a => repContactIds.has(a.contact_id as string));

          return {
            name: repName,
            initials: repName.split(" ").map(w => w[0]).join("").toUpperCase(),
            appel: repDoneActivities.filter(a => a.type === "appel").length,
            relance: repDoneActivities.filter(a => a.type === "relance").length,
            r0: repDoneMeetings.filter(m => m.meeting_type === "R0" || m.meeting_type === "R0+R1").length,
            r1: repDoneMeetings.filter(m => m.meeting_type === "R1" || m.meeting_type === "R0+R1").length,
            r2: repDoneMeetings.filter(m => m.meeting_type === "R2" || m.meeting_type === "R2+R3").length,
            r3: repDoneMeetings.filter(m => m.meeting_type === "R3" || m.meeting_type === "R2+R3").length,
            total: repDoneMeetings.length + repDoneActivities.length,
          };
        });

        return (
          <>
            {/* Period selector */}
            <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 12 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic" }}>Activité Commerciale — <span style={{ textTransform: "capitalize" }}>{rdvLabel}</span></h3>
              <div className="flex items-center gap-3">
                <select
                  style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
                  value={yearlyMode}
                  onChange={(e) => setYearlyMode(e.target.value as "full" | "custom")}
                >
                  <option value="full">Année fiscale</option>
                  <option value="month">Par mois</option>
                  <option value="custom">Période personnalisée</option>
                </select>
                {(yearlyMode as string) === "month" && (
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }} />
                )}
                {yearlyMode === "custom" && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 11, color: "#8399a9" }}>Du</span>
                    <input type="date" value={yearlyFrom} onChange={(e) => setYearlyFrom(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: "#8399a9" }}>au</span>
                    <input type="date" value={yearlyTo} onChange={(e) => setYearlyTo(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
                  </div>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-3 md:grid-cols-6">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total RDV faits</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{doneMeetings.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R0 Qualification</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#b8a9e8" }}>{r0Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R1 Découverte</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{r1Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R2 Solution</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#7fb3d8" }}>{r2Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R3 Négociation</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{r3Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Appels + Relances</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF8C5A" }}>{appelCount + relanceCount}</div>
              </div>
            </div>

            {/* Charts side by side */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Appels */}
              <div className="lca-card">
                <div style={{ height: 4, background: "#FF8C5A" }} />
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 16 }}>Appels</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartDataAppels} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                      <XAxis dataKey="type" tick={{ fill: "#1a2a3a", fontSize: 13, fontWeight: 700 }} />
                      <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                      {appelKeys.map((key) => (
                        <Bar key={key} dataKey={key} fill={COLORS_APPELS[key]} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={200} animationEasing="ease-out" label={{ position: "top", fontSize: 13, fontWeight: 700, fill: "#1a2a3a" }} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Réunions */}
              <div className="lca-card">
                <div style={{ height: 4, background: "#1a6b9c" }} />
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 16 }}>Réunions</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartDataRdv} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                      <XAxis dataKey="type" tick={{ fill: "#1a2a3a", fontSize: 13, fontWeight: 700 }} />
                      <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                      {rdvKeys.map((key) => (
                        <Bar key={key} dataKey={key} fill={COLORS_RDV[key]} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={200} animationEasing="ease-out" label={{ position: "top", fontSize: 13, fontWeight: 700, fill: "#1a2a3a" }} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Per Sales Rep Table */}
            <div className="lca-card">
              <div style={{ height: 4, background: "#1a6b9c" }} />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 12 }}>Détail par Sales Rep</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#1a6b9c", textAlign: "left", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>Sales Rep</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#FF8C5A", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>Appels</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#1abc9c", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>Relances</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#b8a9e8", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>R0</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#e74c3c", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>R1</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#7fb3d8", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>R2</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#27ae60", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>R3</th>
                      <th style={{ fontSize: 10, fontWeight: 700, color: "#1a2a3a", textAlign: "center", padding: "6px 4px", borderBottom: "2px solid #1a6b9c" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repData.map((r) => (
                      <tr key={r.name}>
                        <td style={{ fontSize: 12, fontWeight: 600, color: "#1a6b9c", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "left" }} title={r.name}>{r.initials}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.appel}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.relance}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.r0}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.r1}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.r2}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.r3}</td>
                        <td style={{ fontSize: 12, fontWeight: 800, color: "#1a6b9c", padding: "6px 4px", borderBottom: "1px solid #e6f0f7", textAlign: "center" }}>{r.total}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#e6f0f7" }}>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "left" }}>Total</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.appel, 0)}</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.relance, 0)}</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.r0, 0)}</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.r1, 0)}</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.r2, 0)}</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a2a3a", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.r3, 0)}</td>
                      <td style={{ fontSize: 12, fontWeight: 800, color: "#1a6b9c", padding: "6px 4px", textAlign: "center" }}>{repData.reduce((s, r) => s + r.total, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Anciens Clients ===== */}
      {selectedReport === "anciens_clients" && (() => {
        // All owners for filter
        const acAllOwners = new Map<string, string>();
        companies.forEach((c: R) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) acAllOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const acOwnerList = Array.from(acAllOwners.keys()).sort();

        // Build set of company IDs that have at least one contact matching the type filter
        const companyIdsWithMatchingContact = new Set<string>();
        filteredByType.forEach((ct: R) => {
          if (ct.company_id) companyIdsWithMatchingContact.add(ct.company_id as string);
        });

        const formerClients = companies.filter(c => {
          if (c.lifecycle_stage !== "former_customer") return false;
          if (!companyIdsWithMatchingContact.has(c.id as string)) return false;
          // Date filter on created_at
          const created = c.created_at as string | undefined;
          if (created && acPeriod !== "all") {
            const dateOnly = created.split("T")[0];
            if (acPeriod === "month" && !dateOnly.startsWith(acMonth)) return false;
            if (acPeriod === "custom") {
              if (acFrom && dateOnly < acFrom) return false;
              if (acTo && dateOnly > acTo) return false;
            }
          }
          // Owner filter
          if (acOwner) {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            const name = tm ? `${tm.first_name} ${tm.last_name}` : "";
            if (name !== acOwner) return false;
          }
          return true;
        });

        // Get orders & deals per company
        const companyData = formerClients.map(c => {
          const companyOrders = orders.filter(o => o.company_id === c.id);
          const companyDeals = deals.filter(d => d.company_id === c.id);
          const totalCA = companyOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
          const lastOrderDate = companyOrders.length > 0
            ? companyOrders.reduce((latest, o) => {
                const d = new Date(((o.close_date || o.created_at) as string));
                return d > latest ? d : latest;
              }, new Date(0))
            : null;
          const owner = c.team_members as { first_name: string; last_name: string } | null;
          const ownerInitials = owner ? `${owner.first_name?.[0] ?? ""}${owner.last_name?.[0] ?? ""}`.toUpperCase() : "";
          const companyContacts = contacts.filter(ct => ct.company_id === c.id);

          return {
            id: c.id,
            name: c.name as string,
            city: (c.city as string) || "",
            phone: (c.phone as string) || "",
            email: (c.email as string) || "",
            opco: (c.opco as string) || "",
            ownerInitials,
            contactCount: companyContacts.length,
            orderCount: companyOrders.length,
            dealCount: companyDeals.length,
            totalCA,
            lastOrderDate,
          };
        }).sort((a, b) => {
          if (b.lastOrderDate && a.lastOrderDate) return b.lastOrderDate.getTime() - a.lastOrderDate.getTime();
          if (b.lastOrderDate) return 1;
          if (a.lastOrderDate) return -1;
          return a.name.localeCompare(b.name);
        });

        const totalCA = companyData.reduce((s, c) => s + c.totalCA, 0);

        return (
          <>
            {/* Filtres */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={acPeriod} onChange={(e) => setAcPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {acPeriod === "month" && (
                <input type="month" value={acMonth} onChange={(e) => setAcMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {acPeriod === "custom" && (
                <>
                  <input type="date" value={acFrom} onChange={(e) => setAcFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={acTo} onChange={(e) => setAcTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={acOwner} onChange={(e) => setAcOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les Account Managers</option>
                {acOwnerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            {/* KPIs */}
            <div className="grid gap-3 md:grid-cols-4">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Anciens Clients</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{formerClients.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CA Total Généré</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totalCA)}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Commandes Totales</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{companyData.reduce((s, c) => s + c.orderCount, 0)}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Contacts Associés</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#2ecc71" }}>{companyData.reduce((s, c) => s + c.contactCount, 0)}</div>
              </div>
            </div>

            {/* Table */}
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontStyle: "italic", marginBottom: 12 }}>Anciens Clients — Liste complète</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c" }}>Entreprise</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c" }}>Ville</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c" }}>Téléphone</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c" }}>Email</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c" }}>OPCO</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", textAlign: "center" }}>Propriétaire</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", textAlign: "center" }}>Contacts</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", textAlign: "center" }}>Commandes</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", textAlign: "right" }}>CA Total</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c" }}>Dernière Commande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>
                            Aucun ancien client trouvé
                          </TableCell>
                        </TableRow>
                      ) : companyData.map((c) => (
                        <TableRow
                          key={c.id as string}
                          className="cursor-pointer hover:bg-[#f0f7fb]"
                          onClick={() => router.push(`/clients/${c.id}`)}
                        >
                          <TableCell style={{ fontWeight: 600, color: "#1a2a3a" }}>{c.name}</TableCell>
                          <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{c.city}</TableCell>
                          <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{formatPhone(c.phone)}</TableCell>
                          <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{c.email}</TableCell>
                          <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{c.opco}</TableCell>
                          <TableCell style={{ textAlign: "center" }}>
                            {c.ownerInitials ? (
                              <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 11, fontWeight: 700, lineHeight: "28px", textAlign: "center" }}>
                                {c.ownerInitials}
                              </span>
                            ) : <span style={{ color: "#ccc" }}>—</span>}
                          </TableCell>
                          <TableCell style={{ textAlign: "center", color: "#5a6f80", fontSize: 13 }}>{c.contactCount}</TableCell>
                          <TableCell style={{ textAlign: "center", color: "#5a6f80", fontSize: 13 }}>{c.orderCount}</TableCell>
                          <TableCell style={{ textAlign: "right", fontWeight: 700, color: "#1a2a3a" }}>{fmt(c.totalCA)}</TableCell>
                          <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>
                            {c.lastOrderDate ? format(c.lastOrderDate, "dd MMM yyyy", { locale: fr }) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {selectedReport === "rdv_non_ferme" && (() => {
        const todayStr = new Date().toISOString().split("T")[0];

        // Build index of "done" meetings by contact + type + date
        const doneIndex = new Set<string>();
        meetings.forEach((m: R) => {
          if (m.status === "done") {
            const sa = m.scheduled_at as string | undefined;
            if (sa) {
              const dateOnly = sa.split("T")[0];
              doneIndex.add(`${m.contact_id}|${m.meeting_type}|${dateOnly}`);
            }
          }
        });

        const allOverdue = meetings.filter((m: R) => {
          if (!filteredContactIds.has(m.contact_id as string)) return false;
          const status = m.status as string;
          const scheduledAt = m.scheduled_at as string | undefined;
          if (!scheduledAt) return false;
          if (status === "done" || status === "cancelled" || status === "no_show") return false;
          if ((m as any).next_step === "completed") return false;
          const dateOnly = scheduledAt.split("T")[0];
          if (dateOnly > todayStr) return false;
          // Exclude if a "done" meeting exists for same contact + type + date
          const key = `${m.contact_id}|${m.meeting_type}|${dateOnly}`;
          if (doneIndex.has(key)) return false;
          // Date filter on scheduled_at
          if (rdvPeriod !== "all") {
            if (rdvPeriod === "month" && !dateOnly.startsWith(rdvMonth)) return false;
            if (rdvPeriod === "custom") {
              if (rdvFrom && dateOnly < rdvFrom) return false;
              if (rdvTo && dateOnly > rdvTo) return false;
            }
          }
          return true;
        }).sort((a: R, b: R) => new Date(b.scheduled_at as string).getTime() - new Date(a.scheduled_at as string).getTime());

        // Get unique owners for filter
        const ownerSet = new Map<string, string>();
        allOverdue.forEach((m: R) => {
          const o = m.team_members as { first_name: string; last_name: string } | null;
          if (o) {
            const key = `${o.first_name} ${o.last_name}`;
            ownerSet.set(key, key);
          }
        });
        const ownerNames = Array.from(ownerSet.keys()).sort();

        const overdue = rdvOwnerFilter
          ? allOverdue.filter((m: R) => {
              const o = m.team_members as { first_name: string; last_name: string } | null;
              return o ? `${o.first_name} ${o.last_name}` === rdvOwnerFilter : false;
            })
          : allOverdue;

        return (
          <>
            {/* Filtres */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={rdvPeriod} onChange={(e) => setRdvPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {rdvPeriod === "month" && (
                <input type="month" value={rdvMonth} onChange={(e) => setRdvMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {rdvPeriod === "custom" && (
                <>
                  <input type="date" value={rdvFrom} onChange={(e) => setRdvFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={rdvTo} onChange={(e) => setRdvTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={rdvOwnerFilter} onChange={(e) => setRdvOwnerFilter(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les commerciaux</option>
                {ownerNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Rdvs non fermés</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{overdue.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R0 / R1 non fermés</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{overdue.filter((m: R) => m.meeting_type === "R0" || m.meeting_type === "R1" || m.meeting_type === "R0+R1").length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R2 / R3 non fermés</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{overdue.filter((m: R) => m.meeting_type === "R2" || m.meeting_type === "R3" || m.meeting_type === "R2+R3").length}</div>
              </div>
            </div>

            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a" }}>Rendez-vous non fermés ({overdue.length})</h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date du rdv</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Retard</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Type</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Contact</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Téléphone</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Statut</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Commercial</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdue.length === 0 ? (
                        <TableRow><TableCell colSpan={9} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucun rdv non fermé</TableCell></TableRow>
                      ) : overdue.map((m: R) => {
                        const contact = m.contacts as { id: string; first_name: string; last_name: string; email: string; phone: string; companies: { id: string; name: string } | null } | null;
                        const owner = m.team_members as { first_name: string; last_name: string } | null;
                        const scheduledAt = new Date(m.scheduled_at as string);
                        const diffDays = Math.floor((new Date().getTime() - scheduledAt.getTime()) / (1000 * 60 * 60 * 24));
                        const retardLabel = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? "1 jour" : `${diffDays} jours`;

                        const typeColors: Record<string, { bg: string; text: string }> = {
                          R0: { bg: "#e8f0fe", text: "#1a6b9c" },
                          R1: { bg: "#e8f0fe", text: "#1a6b9c" },
                          R2: { bg: "#fff3e0", text: "#FF6B35" },
                          R3: { bg: "#fde8e8", text: "#e74c3c" },
                        };
                        const tc = typeColors[m.meeting_type as string] ?? { bg: "#f0f0f0", text: "#666" };

                        return (
                          <TableRow
                            key={m.id as string}
                            className="hover:bg-[#f0f7fb]"
                          >
                            <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>
                              {format(scheduledAt, "dd MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: diffDays > 7 ? "#fde8e8" : "#fff3e0", color: diffDays > 7 ? "#e74c3c" : "#FF6B35" }}>
                                {retardLabel}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: tc.bg, color: tc.text }}>
                                {m.meeting_type as string}
                              </span>
                            </TableCell>
                            <TableCell>
                              {contact ? (
                                <span onClick={() => router.push(`/contacts/${contact.id}`)} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                                  {contact.first_name} {contact.last_name}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {contact?.companies?.name ?? "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {contact?.phone ? formatPhone(contact.phone) : "—"}
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#fff3e0", color: "#FF6B35" }}>
                                {m.status as string}
                              </span>
                            </TableCell>
                            <TableCell style={{ textAlign: "center" }}>
                              {owner ? (
                                <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 11, fontWeight: 700, lineHeight: "28px", textAlign: "center" }}>
                                  {owner.first_name[0]}{owner.last_name[0]}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => openRdvPopup(m)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 9, fontWeight: 700, padding: "0 10px", whiteSpace: "nowrap" }}
                              >
                                📋 Suivi rdv
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Suivi du RDV popup */}
                {selectedRdv && (() => {
                  const pc = selectedRdv.contacts as { id: string; first_name: string; last_name: string; email: string; phone: string; companies: { id: string; name: string } | null } | null;
                  const po = selectedRdv.team_members as { first_name: string; last_name: string } | null;
                  const pDate = new Date(selectedRdv.scheduled_at as string);
                  const tc = RDV_TYPE_COLORS[rdvForm.meeting_type] ?? RDV_TYPE_COLORS.R0;
                  const sc = RDV_STATUS_LABELS[rdvForm.status] ?? RDV_STATUS_LABELS.booked;

                  return (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={(e) => { if (e.target === e.currentTarget) { stopRdvRecording(); setSelectedRdv(null); } }}>
                      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
                        {/* Header */}
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Suivi du RDV</h3>
                            <div style={{ fontSize: 13, color: "#5a6f80", marginTop: 2 }}>
                              {format(pDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                            </div>
                          </div>
                          <button onClick={() => { stopRdvRecording(); setSelectedRdv(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: 20 }} className="space-y-4">
                          {/* Contact & Company */}
                          <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                            {pc && (
                              <div className="flex items-center gap-2">
                                <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                                <span onClick={() => { setSelectedRdv(null); router.push(`/contacts/${pc.id}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                                  {pc.first_name} {pc.last_name}
                                </span>
                              </div>
                            )}
                            {pc?.companies && (
                              <div className="flex items-center gap-2">
                                <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                                <span onClick={() => { setSelectedRdv(null); router.push(`/clients/${pc.companies!.id}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                                  {pc.companies.name}
                                </span>
                              </div>
                            )}
                            {po && (
                              <div className="flex items-center gap-2">
                                <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                                <span style={{ fontSize: 12, color: "#8399a9" }}>Propriétaire : {po.first_name} {po.last_name}</span>
                              </div>
                            )}
                            {(selectedRdv.location as string) && (
                              <div className="flex items-center gap-2">
                                <MapPin style={{ width: 14, height: 14, color: "#8399a9" }} />
                                <span style={{ fontSize: 12, color: "#5a6f80" }}>{selectedRdv.location as string}</span>
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
                                <option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option>
                                <option value="60">1h</option><option value="90">1h30</option><option value="120">2h</option>
                              </select>
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Notes du RDV</div>
                              <button onClick={() => isRecording && recordTarget === "notes" ? stopRdvRecording() : startRdvRecording("notes")}
                                style={{ height: 30, width: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: isRecording && recordTarget === "notes" ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", animation: isRecording && recordTarget === "notes" ? "pulse 1.5s infinite" : "none" }}>
                                {isRecording && recordTarget === "notes" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <textarea value={rdvForm.notes} onChange={(e) => setRdvForm({ ...rdvForm, notes: e.target.value })}
                              placeholder="Écrivez ou dictez vos notes de RDV..."
                              style={{ width: "100%", minHeight: 100, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }} />
                          </div>

                          {/* Statut */}
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Statut du RDV</div>
                            <select value={rdvForm.status} onChange={(e) => setRdvForm({ ...rdvForm, status: e.target.value, rdv_result: "" })}
                              style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, background: sc.bg, color: sc.text, cursor: "pointer" }}>
                              <option value="booked">Planifié</option>
                              <option value="done">Effectué (Done)</option>
                              <option value="no_show">No show</option>
                              <option value="cancelled">Annulé</option>
                            </select>
                          </div>

                          {/* Résultat (si done) */}
                          {rdvForm.status === "done" && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 6 }}>Résultat du RDV</div>
                              <select value={rdvForm.rdv_result} onChange={(e) => setRdvForm({ ...rdvForm, rdv_result: e.target.value as any })}
                                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, fontWeight: 600, color: "#1a2a3a", cursor: "pointer" }}>
                                <option value="">Sélectionner...</option>
                                <option value="opportunity_detected">Opportunité détectée</option>
                                <option value="quote_to_send">Devis à envoyer</option>
                                <option value="signed">Signed</option>
                                <option value="not_signed">Not signed</option>
                              </select>
                            </div>
                          )}

                          {rdvForm.status === "done" && rdvForm.rdv_result === "signed" && (
                            <div style={{ padding: "10px 14px", background: "#e8f8f0", borderRadius: 8, borderLeft: "4px solid #2ecc71", fontSize: 13, color: "#27ae60", fontWeight: 500 }}>Le contact passera en statut &quot;Signed&quot; et en cycle &quot;Client&quot;.</div>
                          )}
                          {rdvForm.status === "done" && rdvForm.rdv_result === "opportunity_detected" && (
                            <div style={{ padding: "10px 14px", background: "#e3f2fd", borderRadius: 8, borderLeft: "4px solid #1a6b9c", fontSize: 13, color: "#0d4f7a", fontWeight: 500 }}>Un deal &quot;Opportunité&quot; sera créé automatiquement.</div>
                          )}
                          {rdvForm.status === "done" && rdvForm.rdv_result === "quote_to_send" && (
                            <div style={{ padding: "10px 14px", background: "#fff3e0", borderRadius: 8, borderLeft: "4px solid #FF6B35", fontSize: 13, color: "#e65100", fontWeight: 500 }}>Un deal &quot;Devis à envoyer&quot; sera créé automatiquement.</div>
                          )}
                          {rdvForm.status === "no_show" && (
                            <div style={{ padding: "10px 14px", background: "#fde8e8", borderRadius: 8, borderLeft: "4px solid #e74c3c", fontSize: 13, color: "#c62828", fontWeight: 500 }}>Le prospect ne s&apos;est pas présenté au rendez-vous.</div>
                          )}

                          {/* Outcome */}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Résumé / Outcome</div>
                              <button onClick={() => isRecording && recordTarget === "outcome" ? stopRdvRecording() : startRdvRecording("outcome")}
                                style={{ height: 30, width: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: isRecording && recordTarget === "outcome" ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", animation: isRecording && recordTarget === "outcome" ? "pulse 1.5s infinite" : "none" }}>
                                {isRecording && recordTarget === "outcome" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <textarea value={rdvForm.outcome} onChange={(e) => setRdvForm({ ...rdvForm, outcome: e.target.value })}
                              placeholder="Résumé du RDV, prochaine étape..."
                              style={{ width: "100%", minHeight: 70, borderRadius: 10, border: "1px solid #dce8f0", padding: 12, fontSize: 13, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }} />
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                          <button onClick={() => { setSelectedRdv(null); if (pc) router.push(`/contacts/${pc.id}`); }}
                            style={{ fontSize: 12, color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                            Voir la fiche contact
                          </button>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => { stopRdvRecording(); setSelectedRdv(null); }}
                              style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                              Annuler
                            </button>
                            <button onClick={handleSaveRdvReport} disabled={rdvSaving}
                              style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: rdvSaving ? 0.6 : 1 }}>
                              {rdvSaving ? "..." : "Sauvegarder le suivi"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <style>{`@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.4); } 70% { box-shadow: 0 0 0 10px rgba(231,76,60,0); } 100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); } }`}</style>
              </div>
            </div>
          </>
        );
      })()}

      {selectedReport === "rdv_planifies" && (() => {
        // Build index of "done" meetings by contact + type + date
        const doneIdx = new Set<string>();
        meetings.forEach((m: R) => {
          if (m.status === "done") {
            const sa = m.scheduled_at as string | undefined;
            if (sa) doneIdx.add(`${m.contact_id}|${m.meeting_type}|${sa.split("T")[0]}`);
          }
        });

        const planned = meetings.filter((m: R) => {
          if (!filteredContactIds.has(m.contact_id as string)) return false;
          if (m.status !== "booked") return false;
          // Exclude meetings that already have a result (done/no_show/cancelled)
          if (m.next_step === "completed") return false;
          const scheduledAt = m.scheduled_at as string | undefined;
          if (!scheduledAt) return false;
          // Exclude if a "done" meeting exists for same contact + type + date
          const dateOnly = scheduledAt.split("T")[0];
          if (doneIdx.has(`${m.contact_id}|${m.meeting_type}|${dateOnly}`)) return false;
          return true;
        }).sort((a: R, b: R) => new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime());

        // Owner filter
        const ownerSet = new Map<string, string>();
        planned.forEach((m: R) => {
          const o = m.team_members as { first_name: string; last_name: string } | null;
          if (o) ownerSet.set(`${o.first_name} ${o.last_name}`, `${o.first_name} ${o.last_name}`);
        });
        const ownerNames = Array.from(ownerSet.keys()).sort();
        const filtered = rdvOwnerFilter
          ? planned.filter((m: R) => { const o = m.team_members as { first_name: string; last_name: string } | null; return o ? `${o.first_name} ${o.last_name}` === rdvOwnerFilter : false; })
          : planned;

        const r0Count = filtered.filter((m: R) => m.meeting_type === "R0" || m.meeting_type === "R0+R1").length;
        const r1Count = filtered.filter((m: R) => m.meeting_type === "R1" || m.meeting_type === "R0+R1").length;
        const r2Count = filtered.filter((m: R) => m.meeting_type === "R2" || m.meeting_type === "R2+R3").length;
        const r3Count = filtered.filter((m: R) => m.meeting_type === "R3" || m.meeting_type === "R2+R3").length;

        return (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              {typeFilterSelect}
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total planifiés</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R0 Qualif.</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#4a148c" }}>{r0Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R1 Découverte</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#c62828" }}>{r1Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R2 Solution</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1565c0" }}>{r2Count}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>R3 Négo.</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#2e7d32" }}>{r3Count}</div>
              </div>
            </div>

            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, color: "#1a2a3a" }}>RDV planifiés jusqu&apos;à aujourd&apos;hui ({filtered.length})</h3>
                  <select value={rdvOwnerFilter} onChange={(e) => setRdvOwnerFilter(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a", minWidth: 180 }}>
                    <option value="">Tous les commerciaux</option>
                    {ownerNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date du rdv</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Type</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Contact</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Téléphone</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Mode</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Commercial</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucun RDV planifié</TableCell></TableRow>
                      ) : filtered.map((m: R) => {
                        const contact = m.contacts as { id: string; first_name: string; last_name: string; email: string; phone: string; companies: { id: string; name: string } | null } | null;
                        const owner = m.team_members as { first_name: string; last_name: string } | null;
                        const scheduledAt = new Date(m.scheduled_at as string);
                        const typeColors: Record<string, { bg: string; text: string }> = {
                          R0: { bg: "#ede7f6", text: "#4a148c" }, R1: { bg: "#fce4ec", text: "#c62828" },
                          R2: { bg: "#e3f2fd", text: "#1565c0" }, R3: { bg: "#e8f5e9", text: "#2e7d32" },
                        };
                        const tc = typeColors[m.meeting_type as string] ?? { bg: "#f0f0f0", text: "#666" };
                        const modeLabels: Record<string, string> = { visio: "Visio", phone: "Téléphone", in_person: "Présentiel" };

                        return (
                          <TableRow key={m.id as string} className="hover:bg-[#f0f7fb]">
                            <TableCell style={{ fontWeight: 600, color: "#1a2a3a", fontSize: 13 }}>
                              {format(scheduledAt, "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: tc.bg, color: tc.text }}>
                                {m.meeting_type as string}
                              </span>
                            </TableCell>
                            <TableCell>
                              {contact ? (
                                <span onClick={() => router.push(`/contacts/${contact.id}`)} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                                  {contact.first_name} {contact.last_name}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {contact?.companies?.name ?? "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {contact?.phone ? formatPhone(contact.phone) : "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {modeLabels[m.meeting_mode as string] ?? (m.meeting_mode as string) ?? "—"}
                            </TableCell>
                            <TableCell style={{ textAlign: "center" }}>
                              {owner ? (
                                <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 11, fontWeight: 700, lineHeight: "28px", textAlign: "center" }}>
                                  {owner.first_name[0]}{owner.last_name[0]}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                            <TableCell>
                              <button onClick={() => openRdvPopup(m)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 11, fontWeight: 700, padding: "0 14px", whiteSpace: "nowrap" }}>
                                📋 Suivi du RDV
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {selectedReport === "taches" && (() => {
        // All owners from tasks
        const taskOwners = new Map<string, string>();
        tasks.forEach((t: R) => {
          const tm = t.team_members as { first_name: string; last_name: string } | null;
          if (tm) taskOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const ownerList = Array.from(taskOwners.keys()).sort();

        const filtered = tasks.filter((t: R) => {
          // Status filter
          if (taskStatus === "todo" && t.is_completed) return false;
          if (taskStatus === "done" && !t.is_completed) return false;
          // Owner filter
          if (taskOwner) {
            const tm = t.team_members as { first_name: string; last_name: string } | null;
            if (!tm || `${tm.first_name} ${tm.last_name}` !== taskOwner) return false;
          }
          // Date filter on due_date
          if (taskPeriod !== "all" && t.due_date) {
            const d = (t.due_date as string).slice(0, 10);
            if (taskPeriod === "month" && !d.startsWith(taskMonth)) return false;
            if (taskPeriod === "custom") {
              if (taskFrom && d < taskFrom) return false;
              if (taskTo && d > taskTo) return false;
            }
          }
          return true;
        });

        const totalTodo = filtered.filter((t: R) => !t.is_completed).length;
        const totalDone = filtered.filter((t: R) => t.is_completed).length;
        const totalOverdue = filtered.filter((t: R) => !t.is_completed && t.task_deadline && new Date(t.task_deadline as string) < new Date()).length;

        return (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les tâches</option>
                <option value="todo">À faire</option>
                <option value="done">Accomplies</option>
              </select>
              <select value={taskOwner} onChange={(e) => setTaskOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les propriétaires</option>
                {ownerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={taskPeriod} onChange={(e) => setTaskPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {taskPeriod === "month" && (
                <input type="month" value={taskMonth} onChange={(e) => setTaskMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {taskPeriod === "custom" && (
                <>
                  <input type="date" value={taskFrom} onChange={(e) => setTaskFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={taskTo} onChange={(e) => setTaskTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
            </div>

            {/* KPIs */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>À faire</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{totalTodo}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>En retard</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{totalOverdue}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Accomplies</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{totalDone}</div>
              </div>
            </div>

            {/* Table */}
            <div className="lca-card">
              <div className="lca-bar-gradient" />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Tâches ({filtered.length})</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Statut</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Titre</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Contact</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Entreprise</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Date</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Échéance</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Propriétaire</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={7} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune tâche</TableCell></TableRow>
                      ) : filtered.map((t: R) => {
                        const contact = t.contacts as { id: string; first_name: string; last_name: string } | null;
                        const company = t.companies as { id: string; name: string } | null;
                        const owner = t.team_members as { first_name: string; last_name: string } | null;
                        const isCompleted = !!t.is_completed;
                        const deadline = t.task_deadline as string | null;
                        const isOverdue = !isCompleted && deadline && new Date(deadline) < new Date();

                        return (
                          <TableRow key={t.id as string} className="hover:bg-[#f0f7fb]">
                            <TableCell>
                              {isCompleted ? (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#e8f5e9", color: "#2e7d32" }}>Accomplie</span>
                              ) : isOverdue ? (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#fde8e8", color: "#e74c3c" }}>En retard</span>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#fff3e0", color: "#FF6B35" }}>À faire</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span onClick={() => openTaskPopup(t)} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: isCompleted ? "line-through" : "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                                {t.title as string}
                              </span>
                            </TableCell>
                            <TableCell>
                              {contact ? (
                                <span onClick={() => router.push(`/contacts/${contact.id}`)} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                                  {contact.first_name} {contact.last_name}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {company?.name ?? "—"}
                            </TableCell>
                            <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                              {t.due_date ? (() => { try { return format(new Date(t.due_date as string), "dd MMM yyyy", { locale: fr }); } catch { return "—"; } })() : "—"}
                            </TableCell>
                            <TableCell>
                              {deadline ? (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: isOverdue ? "#fde8e8" : "#fff3e0", color: isOverdue ? "#e74c3c" : "#e65100" }}>
                                  {(() => { try { return format(new Date(deadline), "dd MMM yyyy", { locale: fr }); } catch { return "—"; } })()}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                            <TableCell style={{ textAlign: "center" }}>
                              {owner ? (
                                <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 11, fontWeight: 700, lineHeight: "28px", textAlign: "center" }}>
                                  {owner.first_name[0]}{owner.last_name[0]}
                                </span>
                              ) : <span style={{ color: "#ccc" }}>—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Task detail popup */}
      {taskPopup && (() => {
        const tc = taskPopup.contacts as { id: string; first_name: string; last_name: string } | null;
        const co = taskPopup.companies as { name: string } | null;
        const owner = taskPopup.team_members as { first_name: string; last_name: string } | null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setTaskPopup(null); }}>
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#c62828", background: "#fce4ec", padding: "2px 10px", borderRadius: 20 }}>Tâche</span>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Détail de la tâche</h3>
                </div>
                <button onClick={() => setTaskPopup(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>✕</button>
              </div>
              <div style={{ padding: 20 }} className="space-y-4">
                {(tc || co || owner) && (
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                    {tc && <div style={{ fontSize: 13, color: "#1a6b9c" }}>👤 {tc.first_name} {tc.last_name}</div>}
                    {co && <div style={{ fontSize: 13, color: "#5a6f80" }}>🏢 {co.name}</div>}
                    {owner && <div style={{ fontSize: 12, color: "#8399a9" }}>📋 Propriétaire : {owner.first_name} {owner.last_name}</div>}
                  </div>
                )}
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Titre *</label>
                  <input value={taskEditForm.title} onChange={(e) => setTaskEditForm({ ...taskEditForm, title: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Date & Heure</label>
                  <input type="datetime-local" value={taskEditForm.due_date} onChange={(e) => setTaskEditForm({ ...taskEditForm, due_date: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Échéance</label>
                  <input type="date" value={taskEditForm.task_deadline} onChange={(e) => setTaskEditForm({ ...taskEditForm, task_deadline: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Description</label>
                  <textarea value={taskEditForm.description} onChange={(e) => setTaskEditForm({ ...taskEditForm, description: e.target.value })}
                    placeholder="Détails de la tâche..."
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" style={{ resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button onClick={handleDeleteTaskEdit} style={{ fontSize: 12, color: "#e74c3c", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  🗑️ Supprimer
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  {!taskPopup.is_completed && (
                    <button onClick={handleCompleteTaskEdit}
                      style={{ height: 36, borderRadius: 8, background: "#27ae60", color: "white", fontSize: 13, fontWeight: 700, padding: "0 18px", border: "none", cursor: "pointer" }}>
                      ✅ Accomplie
                    </button>
                  )}
                  <button onClick={handleSaveTaskEdit} disabled={taskEditSaving || !taskEditForm.title.trim()}
                    style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: taskEditSaving || !taskEditForm.title.trim() ? 0.5 : 1 }}>
                    {taskEditSaving ? "..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== Report: Pas intéressé ===== */}
      {/* ===== Report: Pas intéressé (by lead_status) ===== */}
      {selectedReport === "pas_interesse" && (() => {
        const niAllOwners = new Map<string, string>();
        filteredByType.filter((c: R) => c.lead_status === "not_interested").forEach((c: R) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) niAllOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const niOwnerList = Array.from(niAllOwners.keys()).sort();

        const niContacts = filteredByType.filter((c: R) => {
          if (c.lead_status !== "not_interested") return false;
          if (niPeriod !== "all") {
            const dateOnly = (c.created_at as string).split("T")[0];
            if (niPeriod === "month" && !dateOnly.startsWith(niMonth)) return false;
            if (niPeriod === "custom") {
              if (niFrom && dateOnly < niFrom) return false;
              if (niTo && dateOnly > niTo) return false;
            }
          }
          if (niOwner) {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            if (!tm || `${tm.first_name} ${tm.last_name}` !== niOwner) return false;
          }
          return true;
        });

        function fmtDate(d: string | null | undefined): string {
          if (!d) return "—";
          try { return format(new Date(d as string), "dd MMM yyyy", { locale: fr }); } catch { return "—"; }
        }

        return (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={niPeriod} onChange={(e) => setNiPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {niPeriod === "month" && (
                <input type="month" value={niMonth} onChange={(e) => setNiMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {niPeriod === "custom" && (
                <>
                  <input type="date" value={niFrom} onChange={(e) => setNiFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={niTo} onChange={(e) => setNiTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={niOwner} onChange={(e) => setNiOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les Account Managers</option>
                {niOwnerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total Pas intéressé</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#6a1b9a" }}>{niContacts.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Avec entreprise</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{niContacts.filter(c => c.company_id).length}</div>
              </div>
            </div>

            <div className="lca-card">
              <div style={{ height: 4, background: "#6a1b9a" }} />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Contacts « Pas intéressé »</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>NOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PRÉNOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>EMAIL</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>TÉLÉPHONE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>ENTREPRISE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PROPRIÉTAIRE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>CRÉÉ LE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {niContacts.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8" style={{ color: "#8399a9" }}>Aucun contact « Pas intéressé »</TableCell></TableRow>
                      ) : niContacts.map((c) => {
                        const tm = c.team_members as { first_name: string; last_name: string } | null;
                        const co = c.companies as { name: string } | null;
                        return (
                          <TableRow key={c.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/contacts/${c.id}`)}>
                            <TableCell className="font-medium">{c.last_name as string}</TableCell>
                            <TableCell>{c.first_name as string}</TableCell>
                            <TableCell>{(c.email as string) ?? "—"}</TableCell>
                            <TableCell>{formatPhone(c.phone as string | null)}</TableCell>
                            <TableCell>{co?.name ?? "—"}</TableCell>
                            <TableCell>
                              {tm ? (<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#0d4f7a", color: "white", fontSize: 10, fontWeight: 700 }} title={`${tm.first_name} ${tm.last_name}`}>{tm.first_name[0]}{tm.last_name[0]}</span>) : "—"}
                            </TableCell>
                            <TableCell>{fmtDate(c.created_at as string)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Report: Cancelled (by lead_status) ===== */}
      {selectedReport === "cancelled" && (() => {
        const clAllOwners = new Map<string, string>();
        filteredByType.filter((c: R) => c.lead_status === "cancelled").forEach((c: R) => {
          const tm = c.team_members as { first_name: string; last_name: string } | null;
          if (tm) clAllOwners.set(`${tm.first_name} ${tm.last_name}`, `${tm.first_name} ${tm.last_name}`);
        });
        const clOwnerList = Array.from(clAllOwners.keys()).sort();

        const clContacts = filteredByType.filter((c: R) => {
          if (c.lead_status !== "cancelled") return false;
          if (clPeriod !== "all") {
            const dateOnly = (c.created_at as string).split("T")[0];
            if (clPeriod === "month" && !dateOnly.startsWith(clMonth)) return false;
            if (clPeriod === "custom") {
              if (clFrom && dateOnly < clFrom) return false;
              if (clTo && dateOnly > clTo) return false;
            }
          }
          if (clOwner) {
            const tm = c.team_members as { first_name: string; last_name: string } | null;
            if (!tm || `${tm.first_name} ${tm.last_name}` !== clOwner) return false;
          }
          return true;
        });

        function fmtDate(d: string | null | undefined): string {
          if (!d) return "—";
          try { return format(new Date(d as string), "dd MMM yyyy", { locale: fr }); } catch { return "—"; }
        }

        return (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <select value={clPeriod} onChange={(e) => setClPeriod(e.target.value as any)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="all">Toutes les dates</option>
                <option value="month">Par mois</option>
                <option value="custom">Personnalisé</option>
              </select>
              {clPeriod === "month" && (
                <input type="month" value={clMonth} onChange={(e) => setClMonth(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
              )}
              {clPeriod === "custom" && (
                <>
                  <input type="date" value={clFrom} onChange={(e) => setClFrom(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                  <span style={{ color: "#8399a9" }}>→</span>
                  <input type="date" value={clTo} onChange={(e) => setClTo(e.target.value)}
                    style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
                </>
              )}
              <select value={clOwner} onChange={(e) => setClOwner(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
                <option value="">Tous les Account Managers</option>
                {clOwnerList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {typeFilterSelect}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total Cancelled</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#c62828" }}>{clContacts.length}</div>
              </div>
              <div className="lca-card" style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Avec entreprise</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{clContacts.filter(c => c.company_id).length}</div>
              </div>
            </div>

            <div className="lca-card">
              <div style={{ height: 4, background: "#c62828" }} />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Contacts « Cancelled »</h3>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>NOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PRÉNOM</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>EMAIL</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>TÉLÉPHONE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>ENTREPRISE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>PROPRIÉTAIRE</TableHead>
                        <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 11 }}>CRÉÉ LE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clContacts.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8" style={{ color: "#8399a9" }}>Aucun contact « Cancelled »</TableCell></TableRow>
                      ) : clContacts.map((c) => {
                        const tm = c.team_members as { first_name: string; last_name: string } | null;
                        const co = c.companies as { name: string } | null;
                        return (
                          <TableRow key={c.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/contacts/${c.id}`)}>
                            <TableCell className="font-medium">{c.last_name as string}</TableCell>
                            <TableCell>{c.first_name as string}</TableCell>
                            <TableCell>{(c.email as string) ?? "—"}</TableCell>
                            <TableCell>{formatPhone(c.phone as string | null)}</TableCell>
                            <TableCell>{co?.name ?? "—"}</TableCell>
                            <TableCell>
                              {tm ? (<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#0d4f7a", color: "white", fontSize: 10, fontWeight: 700 }} title={`${tm.first_name} ${tm.last_name}`}>{tm.first_name[0]}{tm.last_name[0]}</span>) : "—"}
                            </TableCell>
                            <TableCell>{fmtDate(c.created_at as string)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {drillDown && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDrillDown(null); }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "80vh", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: "#1a2a3a", margin: 0 }}>{drillDown.title}</h3>
              <button onClick={() => setDrillDown(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#8399a9", padding: 4 }}>&#x2715;</button>
            </div>
            <div style={{ padding: "12px 20px", overflowY: "auto", flex: 1 }}>
              {drillDown.items.length === 0 ? (
                <p style={{ color: "#8399a9", fontSize: 13, fontStyle: "italic" }}>Aucune donn&eacute;e</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {drillDown.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8fbfd", borderRadius: 8 }}>
                      <div>
                        {item.href ? (
                          <a href={item.href} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "none" }}
                            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >{item.label}</a>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{item.label}</span>
                        )}
                        {item.sublabel && <div style={{ fontSize: 11, color: "#8399a9", marginTop: 2 }}>{item.sublabel}</div>}
                      </div>
                      {item.amount !== undefined && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#27ae60", whiteSpace: "nowrap" }}>
                          {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(item.amount)} &euro;
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "10px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd", fontSize: 11, color: "#8399a9", textAlign: "right" }}>
              {drillDown.items.length} &eacute;l&eacute;ment{drillDown.items.length !== 1 ? "s" : ""}
              {drillDown.items.some(it => it.amount !== undefined) && (
                <span style={{ marginLeft: 12, fontWeight: 700, color: "#27ae60" }}>
                  Total : {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(drillDown.items.reduce((s, it) => s + (it.amount ?? 0), 0))} &euro;
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}