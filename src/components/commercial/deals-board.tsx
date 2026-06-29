"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentMember } from "@/lib/use-current-member";
import { getDefaultCustomFrom, getCurrentFiscalYearStart, getFiscalYearRange, getFiscalYearLabel, getFiscalYearOptions } from "@/lib/fiscal-year";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { RichNotes } from "@/components/ui/rich-notes";
import { Plus, Trash2, Edit, Building2, User, Calendar, Upload, FileText, Download, Calculator, CalendarClock, FileSignature } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { DEAL_STAGE_LABELS, DEAL_STAGE_PROBABILITY } from "@/types/database";
import type { DealStage } from "@/types/database";
import { CotationModal } from "./cotation-modal";
import { WF009CollectorBlock } from "./wf009-collector-block";
import { BillingPlanModal } from "@/components/finance/billing-plan-modal";
import { ConventionModal } from "@/components/finance/convention-modal";
import { QuoteSendModal } from "./quote-send-modal";

interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  training_days: number | null;
  training_days_presentiel: number | null;
  training_days_distanciel: number | null;
  probability: number;
  expected_close_date: string | null;
  close_date: string | null;
  stage_changed_at: string | null;
  notes: string | null;
  owner_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  source_id: string | null;
  contacts: { first_name: string; last_name: string } | null;
  created_at: string;
  companies: { name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
}

interface Ref { id: string; first_name?: string; last_name?: string; name?: string; }

interface DealDocument {
  id: string;
  deal_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  document_type: string;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  devis: "Devis",
  convention: "Convention",
  programme: "Programme",
  convocation: "Convocation",
  facture: "Facture",
  emargements: "Émargements",
  bilan_initial: "Bilan de positionnement initial",
  bilan_intermediaire: "Bilan de positionnement intermédiaire",
  bilan_final: "Bilan de positionnement final",
  autre: "Autre",
};

const DOC_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  devis: { bg: "#fff3e0", text: "#e65100" },
  convention: { bg: "#e8f0fe", text: "#0d4f7a" },
  programme: { bg: "#e8f5e9", text: "#2e7d32" },
  convocation: { bg: "#f3e5f5", text: "#6a1b9a" },
  facture: { bg: "#fce4ec", text: "#c62828" },
  emargements: { bg: "#e0f2f1", text: "#00695c" },
  bilan_initial: { bg: "#e3f2fd", text: "#1565c0" },
  bilan_intermediaire: { bg: "#fff8e1", text: "#f57f17" },
  bilan_final: { bg: "#fce4ec", text: "#ad1457" },
  autre: { bg: "#f5f5f5", text: "#555" },
};

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const stageColors: Record<string, { bg: string; text: string; bar: string }> = {
  opportunities: { bg: "#e3f2fd", text: "#1565c0", bar: "#1a6b9c" },
  quote_to_send: { bg: "#fff3e0", text: "#e65100", bar: "#FF6B35" },
  quote_sent: { bg: "#f3e5f5", text: "#6a1b9a", bar: "#8e44ad" },
  opco_deposit: { bg: "#e8f0fe", text: "#0d4f7a", bar: "#0d4f7a" },
  quote_signed: { bg: "#e0f2f1", text: "#00695c", bar: "#1abc9c" },
  closed_won: { bg: "#e8f5e9", text: "#2e7d32", bar: "#27ae60" },
  closed_lost: { bg: "#fce4ec", text: "#c62828", bar: "#e74c3c" },
};

const kanbanStages: DealStage[] = ["opportunities", "quote_to_send", "quote_sent", "quote_signed", "opco_deposit", "closed_won", "closed_lost"];

// Le stage ADV "quote_to_validate" (devis préparé, en attente de validation Finance —
// trust gate) n'a pas de colonne dédiée : on le range dans la colonne "Devis à envoyer"
// (quote_to_send), dont il hérite libellé + couleur. Sans ça le deal disparaît du board.
function columnForStage(stage: string): DealStage {
  return stage === "quote_to_validate" ? "quote_to_send" : (stage as DealStage);
}

export function DealsBoard({
  deals, teamMembers, companies, contacts, sources,
}: {
  deals: Deal[];
  teamMembers: Ref[];
  companies: Ref[];
  contacts: (Ref & { company_id?: string })[];
  sources: Ref[];
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const { isRestrictedExterne, isReadOnly, isAdmin, roles } = useCurrentRoles();

  const canCreateQuoteFor = (deal: Deal) =>
    isAdmin || (currentMemberId !== null && deal.owner_id === currentMemberId);
  const canInvoiceDeal = () => isAdmin || roles.includes("Finance");

  const [open, setOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [planModalDeal, setPlanModalDeal] = useState<Deal | null>(null);
  const [conventionDeal, setConventionDeal] = useState<Deal | null>(null);
  const [quoteSendDeal, setQuoteSendDeal] = useState<Deal | null>(null);
  const [cotationOpen, setCotationOpen] = useState(false);
  const [cotationDealId, setCotationDealId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [periodMode, setPeriodMode] = useState<"fiscal" | "month" | "custom">("fiscal");
  const [selectedFY, setSelectedFY] = useState(() => getCurrentFiscalYearStart());
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState(() => getDefaultCustomFrom());
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [form, setForm] = useState({
    name: "", company_id: "", contact_id: "", owner_id: "", source_id: "",
    stage: "opportunities" as DealStage, amount: "", training_days: "",
    training_days_presentiel: "", training_days_distanciel: "",
    expected_close_date: "", close_date: "", notes: "",
  });
  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));
  const [contactLabel, setContactLabel] = useState("");

  const lastFetchedContacts = useRef<{ id: string; first_name: string; last_name: string; company_id: string | null }[]>([]);

  const fetchContacts = useCallback(async (q: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (form.company_id) params.set("company_id", form.company_id);
    const res = await fetch(`/api/contacts/search?${params}`);
    const data: { id: string; first_name: string; last_name: string; company_id: string | null }[] = await res.json();
    lastFetchedContacts.current = data;
    return data.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }));
  }, [form.company_id]);

  // Documents state
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState("devis");

  // Billing entries state for deal
  const [dealBillingMonths, setDealBillingMonths] = useState<{ id: string; amount: number; month: string; status: string | null; client_name: string }[]>([]);

  async function loadDealData(dealId: string) {
    setLoadingDocs(true);
    const supabase = createClient();
    // Load deal documents
    const { data: docs } = await supabase.from("deal_documents").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
    setDocuments(docs ?? []);

    // Load billing entries linked à CE deal (pas toute l'entreprise)
    const { data: entries } = await supabase
      .from("billing_entries")
      .select("client_name, billing_months(id, amount, month, status)")
      .eq("deal_id", dealId);
    type BillingMonthRow = { id: string; amount: number | string | null; month: string; status: string | null };
    type EntryRow = { client_name: string | null; billing_months: BillingMonthRow[] | null };
    const months = ((entries ?? []) as unknown as EntryRow[]).flatMap((e) =>
      (e.billing_months ?? []).map((m) => ({
        id: m.id, amount: Number(m.amount) || 0, month: m.month, status: m.status, client_name: e.client_name ?? "",
      }))
    );
    months.sort((a, b) => a.month.localeCompare(b.month));
    setDealBillingMonths(months);
    setLoadingDocs(false);
  }

  // Keep old name for compatibility
  async function loadDocuments(dealId: string) {
    return loadDealData(dealId);
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>, dealId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${dealId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(path, file);
    if (!uploadError) {
      await supabase.from("deal_documents").insert({
        deal_id: dealId,
        name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type,
        document_type: docType,
      });
      await loadDocuments(dealId);
    }
    setUploadingDoc(false);
    e.target.value = "";
  }

  async function handleDownloadDoc(doc: DealDocument) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("deal-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteDoc(doc: DealDocument, dealId: string) {
    if (!confirmDelete(isRestrictedExterne || isReadOnly, `Supprimer "${doc.name}" ?`)) return;
    const supabase = createClient();
    await supabase.storage.from("deal-documents").remove([doc.file_path]);
    await supabase.from("deal_documents").delete().eq("id", doc.id);
    await loadDocuments(dealId);
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function openEditDeal(deal: Deal) {
    setEditingDealId(deal.id);
    setForm({
      name: deal.name,
      company_id: deal.company_id ?? "",
      contact_id: deal.contact_id ?? "",
      owner_id: deal.owner_id ?? "",
      source_id: deal.source_id ?? "",
      stage: (deal.stage as DealStage) ?? "opportunities",
      amount: deal.amount ? String(deal.amount) : "",
      training_days: deal.training_days ? String(deal.training_days) : "",
      training_days_presentiel: deal.training_days_presentiel ? String(deal.training_days_presentiel) : "",
      training_days_distanciel: deal.training_days_distanciel ? String(deal.training_days_distanciel) : "",
      expected_close_date: deal.expected_close_date ?? "",
      close_date: deal.close_date ?? "",
      notes: deal.notes ?? "",
    });
    setContactLabel(deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : "");
    setOpen(true);
  }

  // Auto-open edit for newest deal when redirected
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
      const deal = deals.find((d) => d.id === editId);
      if (deal) openEditDeal(deal);
      // Clean URL
      window.history.replaceState({}, "", "/deals");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  async function handleDeleteDeal(id: string) {
    const supabase = createClient();
    const deal = deals.find((d) => d.id === id);
    await supabase.from("deals").delete().eq("id", id);
    router.refresh();
  }

  async function handleDrop(targetStage: DealStage) {
    if (!draggedDealId) return;
    const supabase = createClient();
    const deal = deals.find((d) => d.id === draggedDealId);
    const previousStage = deal?.stage;

    await supabase.from("deals").update({
      stage: targetStage,
      probability: DEAL_STAGE_PROBABILITY[targetStage],
      close_date: targetStage === "closed_won" ? new Date().toISOString().split("T")[0] : null,
      stage_changed_at: new Date().toISOString(),
    }).eq("id", draggedDealId);

    // Notify the deal owner of the stage change (if different from current user)
    if (deal?.owner_id && previousStage !== targetStage) {
      const stageLabels: Record<string, string> = {
        new: "Nouveau",
        qualified: "Qualifié",
        proposal: "Proposition",
        quote_signed: "Devis signé",
        closed_won: "Gagné",
        closed_lost: "Perdu",
      };
      await supabase.from("notifications").insert({
        recipient_id: deal.owner_id,
        type: "deal_stage_changed",
        title: `Deal "${deal.name}" → ${stageLabels[targetStage] ?? targetStage}`,
        body: previousStage ? `Déplacé depuis "${stageLabels[previousStage] ?? previousStage}"` : null,
        link_url: deal.contact_id ? `/contacts/${deal.contact_id}` : `/sales`,
        related_entity_type: "deal",
        related_entity_id: draggedDealId,
        actor_id: currentMemberId,
      });
    }

    // Si gagné → passer le contact en "signed" + entreprise en "customer"
    if (targetStage === "closed_won" && deal) {
      if (deal.contact_id) {
        await supabase.from("contacts").update({ lead_status: "signed", lifecycle_stage: "customer", is_client: true }).eq("id", deal.contact_id);
      }
      if (deal.company_id) {
        await supabase.from("companies").update({ lifecycle_stage: "customer" }).eq("id", deal.company_id);
        // Also set is_client on all contacts of this company
        await supabase.from("contacts").update({ is_client: true }).eq("company_id", deal.company_id);
      }
    }

    setDraggedDealId(null);
    setDragOverStage(null);
    router.refresh();
  }

  async function handleSave(): Promise<string | null> {
    setSaving(true);
    const supabase = createClient();
    const stage = form.stage as DealStage;
    const payload = {
      name: form.name,
      company_id: form.company_id || null,
      contact_id: form.contact_id || null,
      owner_id: form.owner_id || null,
      source_id: form.source_id || null,
      stage,
      amount: form.amount ? parseFloat(form.amount) : null,
      training_days: form.training_days ? parseFloat(form.training_days) : null,
      training_days_presentiel: form.training_days_presentiel ? parseFloat(form.training_days_presentiel) : null,
      training_days_distanciel: form.training_days_distanciel ? parseFloat(form.training_days_distanciel) : null,
      probability: DEAL_STAGE_PROBABILITY[stage],
      expected_close_date: form.expected_close_date || null,
      notes: form.notes || null,
    };
    const closeDate = stage === "closed_won" ? (form.close_date || new Date().toISOString().split("T")[0]) : null;
    let savedId: string | null = null;
    if (editingDealId) {
      await supabase.from("deals").update({ ...payload, close_date: closeDate }).eq("id", editingDealId);
      savedId = editingDealId;

      const originalDeal = deals.find((d) => d.id === editingDealId);

      // Si passé en gagné via édition → passer le contact en "signed" + entreprise en "customer"
      if (stage === "closed_won" && originalDeal && originalDeal.stage !== "closed_won") {
        if (form.contact_id) {
          await supabase.from("contacts").update({ lead_status: "signed", lifecycle_stage: "customer", is_client: true }).eq("id", form.contact_id);
        }
        if (form.company_id) {
          await supabase.from("companies").update({ lifecycle_stage: "customer" }).eq("id", form.company_id);
          await supabase.from("contacts").update({ is_client: true }).eq("company_id", form.company_id);
        }
      }
    } else {
      const { data } = await supabase.from("deals").insert({ ...payload, close_date: closeDate }).select("id").single();
      savedId = data?.id ?? null;
    }
    setSaving(false);
    setOpen(false);
    setEditingDealId(null);
    setForm({ name: "", company_id: "", contact_id: "", owner_id: "", source_id: "", stage: "opportunities", amount: "", training_days: "", training_days_presentiel: "", training_days_distanciel: "", expected_close_date: "", close_date: "", notes: "" });
    router.refresh();
    return savedId;
  }

  async function handleSaveAndOpenCotation() {
    if (!form.name.trim()) return;
    const id = await handleSave();
    if (id) {
      setCotationDealId(id);
      setCotationOpen(true);
    }
  }

  // Period filter logic
  const periodRange = (() => {
    if (periodMode === "fiscal") return getFiscalYearRange(selectedFY);
    if (periodMode === "month") {
      const [y, m] = filterMonth.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return { from: `${filterMonth}-01`, to: `${filterMonth}-${String(lastDay).padStart(2, "0")}` };
    }
    return { from: customFrom, to: customTo };
  })();

  const filteredDeals = deals.filter((d) => {
    const created = (d.created_at as string)?.slice(0, 10) ?? "";
    return created >= periodRange.from && created <= periodRange.to;
  });

  // Use filtered deals for display but keep all deals for drag operations
  const displayDeals = filteredDeals;
  const openDeals = displayDeals.filter(d => !["closed_won", "closed_lost"].includes(d.stage));
  const totalPipeline = openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const opportunityDeals = displayDeals.filter(d => d.stage === "opportunities");
  const totalOpportunities = opportunityDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const pipeDisplayDeals = displayDeals.filter(d => ["quote_to_send", "quote_to_validate", "quote_sent", "opco_deposit", "quote_signed"].includes(d.stage));
  const totalPipe = pipeDisplayDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const wonDisplayDeals = displayDeals.filter(d => d.stage === "closed_won");
  const totalWon = wonDisplayDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const periodLabel = periodMode === "fiscal" ? `Année fiscale ${getFiscalYearLabel(selectedFY)}`
    : periodMode === "month" ? new Date(filterMonth + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : `${new Date(customFrom).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${new Date(customTo).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <div className="p-6 space-y-5">
        {/* Period filter */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <select
              style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", padding: "0 12px", fontSize: 13, color: "#1a2a3a" }}
              value={periodMode}
              onChange={(e) => setPeriodMode(e.target.value as "fiscal" | "month" | "custom")}
            >
              <option value="fiscal">Année fiscale (Sept — Août)</option>
              <option value="month">Par mois</option>
              <option value="custom">Période personnalisée</option>
            </select>
            {periodMode === "fiscal" && (
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(Number(e.target.value))}
                style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", background: "white", padding: "0 12px", fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}
              >
                {getFiscalYearOptions(5).map(o => (
                  <option key={o.startYear} value={o.startYear}>{o.label}</option>
                ))}
              </select>
            )}
            {periodMode === "month" && (
              <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a" }} />
            )}
            {periodMode === "custom" && (
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, color: "#8399a9" }}>Du</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12 }} />
                <span style={{ fontSize: 12, color: "#8399a9" }}>au</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12 }} />
              </div>
            )}
            <span style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic" }}>{periodLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditingDealId(null); setContactLabel(""); setForm({ name: "", company_id: "", contact_id: "", owner_id: currentMemberId ?? "", source_id: "", stage: "opportunities", amount: "", training_days: "", training_days_presentiel: "", training_days_distanciel: "", expected_close_date: "", close_date: "", notes: "" }); setOpen(true); }} style={{ background: "#e8632b", color: "white" }}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau deal
            </Button>
            <Button onClick={() => { setCotationDealId(null); setCotationOpen(true); }} style={{ background: "#e8632b", color: "white" }}>
              <Calculator className="h-4 w-4 mr-2" /> Cotation
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-5">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Pipeline total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{fmt(totalPipeline)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{openDeals.length} deals ouverts</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Opportunités</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totalOpportunities)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{opportunityDeals.length} opportunité{opportunityDeals.length > 1 ? "s" : ""}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Pipe</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{fmt(totalPipe)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{pipeDisplayDeals.length} deal{pipeDisplayDeals.length > 1 ? "s" : ""}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Deals gagnés</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalWon)}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{wonDisplayDeals.length} deal{wonDisplayDeals.length > 1 ? "s" : ""}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taux de conversion</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{displayDeals.length > 0 ? Math.round((wonDisplayDeals.length / displayDeals.length) * 100) + "%" : "—"}</div>
            <div style={{ fontSize: 11, color: "#8399a9" }}>{wonDisplayDeals.length}/{displayDeals.length} deals</div>
          </div>
        </div>

      {/* Kanban Board */}
      <div style={{ display: "flex", gap: 12, minHeight: 400, overflowX: "auto", paddingBottom: 8 }}>
        {kanbanStages.map((stage) => {
          const stageDeals = displayDeals.filter((d) => columnForStage(d.stage) === stage);
          const total = stageDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
          const colors = stageColors[stage];
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(stage); }}
              style={{
                background: dragOverStage === stage ? "#e6f0f7" : "#f5f7fa",
                borderRadius: 8,
                padding: 12,
                border: dragOverStage === stage ? "2px dashed #1a6b9c" : "2px solid transparent",
                transition: "all 0.2s ease",
                minWidth: 220,
                flex: "1 0 220px",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <span style={{ background: colors.bg, color: colors.text, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                    {DEAL_STAGE_LABELS[stage]}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#7a8bab", fontWeight: 600 }}>{stageDeals.length}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1b2a4a", marginBottom: 8 }}>
                {fmt(total)}
              </div>
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="lca-card"
                    draggable
                    onDragStart={() => setDraggedDealId(deal.id)}
                    onDragEnd={() => { setDraggedDealId(null); setDragOverStage(null); }}
                    onClick={() => { setSelectedDeal(deal); loadDealData(deal.id); }}
                    style={{
                      padding: "8px 10px",
                      cursor: "grab",
                      borderLeft: `3px solid ${colors.bar}`,
                      position: "relative",
                      opacity: draggedDealId === deal.id ? 0.5 : 1,
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 0 }}>
                      {(["opportunities", "quote_to_send"].includes(deal.stage)) && canCreateQuoteFor(deal) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuoteSendDeal(deal); }}
                          title="Préparer le devis"
                          style={{ color: "#e8632b", background: "none", border: "none", cursor: "pointer", padding: 1 }}
                        >
                          <FileText style={{ width: 10, height: 10 }} />
                        </button>
                      )}
                      {(["quote_signed", "opco_deposit", "closed_won"].includes(deal.stage)) && canInvoiceDeal() && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPlanModalDeal(deal); }}
                          title="Programmer la facturation"
                          style={{ color: "#27ae60", background: "none", border: "none", cursor: "pointer", padding: 1 }}
                        >
                          <CalendarClock style={{ width: 10, height: 10 }} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditDeal(deal); }}
                        style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 1 }}
                      >
                        <Edit style={{ width: 10, height: 10 }} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ce deal ?")) {
                            handleDeleteDeal(deal.id);
                          }
                        }}
                        style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 1 }}
                      >
                        <Trash2 style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1b2a4a", paddingRight: 30, lineHeight: 1.3 }}>{deal.name}</div>
                    {deal.companies && (
                      <div style={{ fontSize: 10, marginTop: 1 }}>
                        <span
                          onClick={(e) => { e.stopPropagation(); router.push(`/clients/${deal.company_id}`); }}
                          style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                        >
                          {deal.companies.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between" style={{ marginTop: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>{fmt(deal.amount)}</span>
                      <span style={{ fontSize: 9, color: "#7a8bab" }}>{deal.probability}%</span>
                    </div>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <div style={{ fontSize: 12, color: "#aab5cc", textAlign: "center", padding: 20 }}>
                    Aucun deal
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* New Deal Sheet */}
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingDealId(null); setContactLabel(""); setForm({ name: "", company_id: "", contact_id: "", owner_id: "", source_id: "", stage: "opportunities", amount: "", training_days: "", training_days_presentiel: "", training_days_distanciel: "", expected_close_date: "", close_date: "", notes: "" }); } }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingDealId ? "Modifier le deal" : "Nouveau deal"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 pb-8 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="space-y-2">
              <Label>Nom du deal *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Formation Excellence WSE Nantes" />
            </div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <SearchableSelect
                value={form.company_id}
                onChange={(v) => setForm({ ...form, company_id: v, contact_id: "" })}
                placeholder="Sélectionner"
                options={companies.map((c) => ({ value: c.id, label: c.name ?? "" }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <SearchableSelect
                value={form.contact_id}
                selectedLabel={contactLabel}
                onChange={(v) => {
                  const match = lastFetchedContacts.current.find((c) => c.id === v);
                  setContactLabel(match ? `${match.first_name} ${match.last_name}` : "");
                  setForm({ ...form, contact_id: v, company_id: match?.company_id ?? form.company_id });
                }}
                placeholder="Sélectionner"
                fetchOptions={fetchContacts}
              />
            </div>
            <div className="space-y-2">
              <Label>Propriétaire</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
                <option value="">Sélectionner</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })}>
                <option value="">Sélectionner</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Étape</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage })}>
                {Object.entries(DEAL_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant (€)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jours formation (total)</Label>
                <Input type="number" step="0.1" value={form.training_days} onChange={(e) => setForm({ ...form, training_days: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ fontSize: 12, color: "#5a6f80" }}>↳ Jours présentiel</Label>
                <Input type="number" step="0.1" placeholder="0" value={form.training_days_presentiel} onChange={(e) => setForm({ ...form, training_days_presentiel: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label style={{ fontSize: 12, color: "#5a6f80" }}>↳ Jours distanciel</Label>
                <Input type="number" step="0.1" placeholder="0" value={form.training_days_distanciel} onChange={(e) => setForm({ ...form, training_days_distanciel: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date de closing prévue</Label>
              <Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} />
            </div>
            {form.stage === "closed_won" && (
              <div className="space-y-2">
                <Label>Date de signature (close date)</Label>
                <Input type="date" value={form.close_date} onChange={(e) => setForm({ ...form, close_date: e.target.value })} />
                <p style={{ fontSize: 11, color: "#8399a9" }}>Si vide, la date du jour sera utilisée.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <RichNotes value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} storageFolder="deals" />
              <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} tone={notesVoice.tone} onToneChange={notesVoice.setTone} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full" style={{ background: "#e8632b", color: "white" }}>
              {saving ? "Enregistrement..." : (editingDealId ? "Sauvegarder" : "Créer le deal")}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAndOpenCotation}
              disabled={saving || !form.name.trim()}
              className="w-full"
              style={{ color: "#1a6b9c", borderColor: "#1a6b9c" }}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {editingDealId ? "Sauvegarder et créer une cotation" : "Créer le deal et la cotation"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Deal Detail Popup */}
      <Dialog open={!!selectedDeal} onOpenChange={(o) => { if (!o) setSelectedDeal(null); }}>
        <DialogContent style={{ maxWidth: 600, maxHeight: "90vh" }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 18, color: "#1a2a3a" }}>
              {selectedDeal?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedDeal && (() => {
            const sc = stageColors[columnForStage(selectedDeal.stage)] ?? { bg: "#f0f0f0", text: "#666", bar: "#999" };
            return (
              <div className="space-y-4" style={{ marginTop: 8, maxHeight: "calc(90vh - 90px)", overflowY: "auto", paddingRight: 6 }}>
                {/* Stage badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ background: sc.bg, color: sc.text, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                    {DEAL_STAGE_LABELS[columnForStage(selectedDeal.stage)] ?? selectedDeal.stage}
                  </span>
                  <span style={{ fontSize: 12, color: "#8399a9" }}>{selectedDeal.probability}% de probabilité</span>
                  {selectedDeal.stage_changed_at && (
                    <span style={{ fontSize: 11, color: "#5a6f80" }}>
                      — le {new Date(selectedDeal.stage_changed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Infos */}
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-3">
                  {selectedDeal.companies && selectedDeal.company_id && (
                    <div className="flex items-center gap-2">
                      <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span
                        onClick={() => router.push(`/clients/${selectedDeal.company_id}`)}
                        style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {selectedDeal.companies.name}
                      </span>
                    </div>
                  )}
                  {selectedDeal.contacts && selectedDeal.contact_id && (
                    <div className="flex items-center gap-2">
                      <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span
                        onClick={() => router.push(`/contacts/${selectedDeal.contact_id}`)}
                        style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {selectedDeal.contacts.first_name} {selectedDeal.contacts.last_name}
                      </span>
                    </div>
                  )}
                  {selectedDeal.team_members && (
                    <div className="flex items-center gap-2">
                      <User style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: "#8399a9" }}>Propriétaire : {selectedDeal.team_members.first_name} {selectedDeal.team_members.last_name}</span>
                    </div>
                  )}
                  {selectedDeal.expected_close_date && (
                    <div className="flex items-center gap-2">
                      <Calendar style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: "#8399a9" }}>Closing prévu : {new Date(selectedDeal.expected_close_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                  )}
                </div>

                {/* Montant + Jours */}
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{fmt(selectedDeal.amount)}</div>
                  </div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Jours formation</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{selectedDeal.training_days ? `${Number(selectedDeal.training_days).toFixed(1)}j` : "—"}</div>
                    {(selectedDeal.training_days_presentiel || selectedDeal.training_days_distanciel) && (
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        {selectedDeal.training_days_presentiel != null && (
                          <span style={{ fontSize: 11, color: "#5a6f80", background: "#e8ecf1", padding: "2px 8px", borderRadius: 12 }}>
                            Présentiel : {Number(selectedDeal.training_days_presentiel).toFixed(1)}j
                          </span>
                        )}
                        {selectedDeal.training_days_distanciel != null && (
                          <span style={{ fontSize: 11, color: "#5a6f80", background: "#e8ecf1", padding: "2px 8px", borderRadius: 12 }}>
                            Distanciel : {Number(selectedDeal.training_days_distanciel).toFixed(1)}j
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Facturation */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Facturation</div>
                  {(() => {
                    const dealAmount = Number(selectedDeal.amount) || 0;
                    const totalBilling = dealBillingMonths.reduce((s, m) => s + (Number(m.amount) || 0), 0);
                    const encaisse = dealBillingMonths.filter(m => m.status === "encaisse").reduce((s, m) => s + (Number(m.amount) || 0), 0);
                    const facture = dealBillingMonths.filter(m => m.status === "facture").reduce((s, m) => s + (Number(m.amount) || 0), 0);

                    const statusBadge = encaisse >= dealAmount && dealAmount > 0
                      ? { label: "Entièrement encaissé", bg: "#c6efce", text: "#006100", bar: "#27ae60" }
                      : (encaisse + facture) >= dealAmount && dealAmount > 0
                        ? { label: "Entièrement facturé", bg: "#ffc7ce", text: "#9c0006", bar: "#e74c3c" }
                        : dealBillingMonths.length > 0
                          ? { label: "Facturation en cours", bg: "#bdd7ee", text: "#1f4e79", bar: "#3498db" }
                          : { label: "Non facturé", bg: "#f5f5f5", text: "#888", bar: "#bdc3c7" };

                    const BILLING_STATUS_COLORS: Record<string, { label: string; bg: string; text: string }> = {
                      a_valider: { label: "À valider", bg: "#ffe8b3", text: "#92600a" },
                      planifie: { label: "Planifié", bg: "#e7e0ff", text: "#5b21b6" },
                      a_facturer: { label: "À facturer", bg: "#bdd7ee", text: "#1f4e79" },
                      facture: { label: "Facturé", bg: "#ffc7ce", text: "#9c0006" },
                      encaisse: { label: "Encaissé", bg: "#c6efce", text: "#006100" },
                      non_fait: { label: "Non fait", bg: "#f5f5f5", text: "#888" },
                    };

                    return (
                      <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }}>
                        {/* Progress bar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10,
                            background: statusBadge.bg, color: statusBadge.text,
                          }}>
                            {statusBadge.label}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a" }}>{fmt(encaisse)} / {fmt(dealAmount)}</span>
                        </div>
                        <div style={{ height: 6, background: "#e8ecf1", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                          <div style={{
                            height: "100%", borderRadius: 3, transition: "width 0.5s",
                            width: `${Math.min(100, dealAmount > 0 ? (encaisse / dealAmount) * 100 : 0)}%`,
                            background: statusBadge.bar,
                          }} />
                        </div>

                        {dealBillingMonths.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {dealBillingMonths.map(m => {
                              const sc = BILLING_STATUS_COLORS[m.status ?? "non_fait"] ?? BILLING_STATUS_COLORS.non_fait;
                              return (
                                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                                  <span style={{ color: "#5a6f80" }}>
                                    {new Date(m.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                                  </span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: 700, color: "#1a2a3a" }}>{fmt(Number(m.amount))}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.text }}>{sc.label}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic" }}>Aucune facture pour cette entreprise</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Notes */}
                {selectedDeal.notes && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Notes</div>
                    <p style={{ fontSize: 13, color: "#1a2a3a", whiteSpace: "pre-wrap" }}>{selectedDeal.notes}</p>
                  </div>
                )}

                {/* Collector suggestion formateur (WF-009) */}
                <WF009CollectorBlock dealId={selectedDeal.id} />

                {/* Documents */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Documents</div>

                  {/* Upload */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <label style={{
                      height: 32, borderRadius: 6, background: "#1a6b9c", color: "white", fontSize: 12, fontWeight: 600,
                      padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: uploadingDoc ? "wait" : "pointer",
                      opacity: uploadingDoc ? 0.6 : 1,
                    }}>
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingDoc ? "Envoi..." : "Importer"}
                      <input
                        type="file"
                        style={{ display: "none" }}
                        disabled={uploadingDoc}
                        onChange={(e) => handleUploadDoc(e, selectedDeal.id)}
                      />
                    </label>
                  </div>

                  {/* Document list */}
                  {loadingDocs ? (
                    <div style={{ fontSize: 12, color: "#8399a9", padding: 8 }}>Chargement...</div>
                  ) : documents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic", padding: 8 }}>Aucun document</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {documents.map(doc => {
                        const dtc = DOC_TYPE_COLORS[doc.document_type] ?? DOC_TYPE_COLORS.autre;
                        return (
                          <div key={doc.id} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                            background: "#f8fbfd", borderRadius: 8, border: "1px solid #e8ecf1",
                          }}>
                            <FileText className="h-4 w-4" style={{ color: "#8399a9", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10, background: dtc.bg, color: dtc.text }}>
                                  {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                                </span>
                                {doc.file_size && <span style={{ fontSize: 11, color: "#8399a9" }}>{formatFileSize(doc.file_size)}</span>}
                                <span style={{ fontSize: 11, color: "#8399a9" }}>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadDoc(doc)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }}
                              title="Télécharger"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc, selectedDeal.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(["quote_signed", "opco_deposit", "closed_won"].includes(selectedDeal.stage)) && canInvoiceDeal() && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPlanModalDeal(selectedDeal)}
                      style={{ flex: 1, background: "#e8632b", color: "white" }}
                    >
                      <CalendarClock className="h-4 w-4 mr-2" /> Programmer la facturation
                    </Button>
                    <Button
                      onClick={() => setConventionDeal(selectedDeal)}
                      variant="outline"
                      style={{ flex: 1, borderColor: "#e8632b", color: "#e8632b" }}
                    >
                      <FileSignature className="h-4 w-4 mr-2" /> Gérer la convention
                    </Button>
                  </div>
                )}
                {(["opportunities", "quote_to_send"].includes(selectedDeal.stage)) && canCreateQuoteFor(selectedDeal) && (
                  <Button
                    onClick={() => setQuoteSendDeal(selectedDeal)}
                    className="w-full"
                    style={{ background: "#e8632b", color: "white" }}
                  >
                    <FileText className="h-4 w-4 mr-2" /> Préparer le devis
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => { setSelectedDeal(null); openEditDeal(selectedDeal); }}
                    style={{ background: "#FF6B35", color: "white", flex: 1 }}
                  >
                    <Edit className="h-4 w-4 mr-2" /> Modifier le deal
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCotationDealId(selectedDeal.id);
                      setSelectedDeal(null);
                      setCotationOpen(true);
                    }}
                    style={{ color: "#1a6b9c", borderColor: "#1a6b9c" }}
                  >
                    <Calculator className="h-4 w-4 mr-2" /> Cotation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ce deal ?")) {
                        handleDeleteDeal(selectedDeal.id);
                        setSelectedDeal(null);
                      }
                    }}
                    style={{ color: "#e74c3c", borderColor: "#e74c3c" }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cotation Modal */}
      <CotationModal
        open={cotationOpen}
        onClose={() => { setCotationOpen(false); setCotationDealId(null); }}
        deals={deals.map(d => ({ id: d.id, name: d.name, amount: d.amount, companies: d.companies }))}
        companies={companies.map(c => ({ id: c.id, name: c.name ?? "" }))}
        contacts={contacts.map(c => ({ id: c.id, first_name: c.first_name ?? "", last_name: c.last_name ?? "", company_id: c.company_id ?? null }))}
        editQuotation={cotationDealId ? { id: "", company_name: deals.find(d => d.id === cotationDealId)?.companies?.name ?? "", contact_name: "", nb_learners: 1, nb_rise_up: 0, deal_id: cotationDealId, months: null, tjm_lca: 2200, base_coeff: 1, travel_coeff: 0.25, prep_coeff: 0.25, cost_per_day_presentiel: 350, rise_up_cost_per_license: 690, vt_duration_hours: 1, presentiel_hours_per_day: 8, notes: null } : null}
        onSaved={() => router.refresh()}
      />

      {planModalDeal && (
        <BillingPlanModal
          dealId={planModalDeal.id}
          dealName={planModalDeal.name}
          dealAmount={planModalDeal.amount != null ? Number(planModalDeal.amount) : null}
          defaultClientName={planModalDeal.companies?.name ?? planModalDeal.name}
          onClose={() => setPlanModalDeal(null)}
          onDone={() => { setPlanModalDeal(null); router.refresh(); }}
        />
      )}
      {conventionDeal && (
        <ConventionModal
          dealId={conventionDeal.id}
          dealName={conventionDeal.name}
          dealAmount={conventionDeal.amount != null ? Number(conventionDeal.amount) : null}
          companyName={conventionDeal.companies?.name ?? "—"}
          contactName={conventionDeal.contacts ? `${conventionDeal.contacts.first_name} ${conventionDeal.contacts.last_name}`.trim() : "—"}
          trainingDays={conventionDeal.training_days != null ? Number(conventionDeal.training_days) : null}
          onClose={() => setConventionDeal(null)}
          onDone={() => { setConventionDeal(null); router.refresh(); }}
        />
      )}
      {quoteSendDeal && (
        <QuoteSendModal
          dealId={quoteSendDeal.id}
          dealName={quoteSendDeal.name}
          onClose={() => setQuoteSendDeal(null)}
          onDone={() => { setQuoteSendDeal(null); setSelectedDeal(null); router.refresh(); }}
        />
      )}
    </>
  );
}
