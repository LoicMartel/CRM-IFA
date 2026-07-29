"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getDefaultCustomFrom, getCurrentFiscalYearStart, getFiscalYearRange, getFiscalYearOptions, type FiscalMode } from "@/lib/fiscal-year";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Mic, MicOff, X, Pencil, Building2, User, Calendar, Upload, FileText, Download, Trash2, Edit } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  training_days: number | null;
  close_date: string | null;
  expected_close_date: string | null;
  created_at: string;
  owner_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  source_id: string | null;
  notes: string | null;
  is_invoiced: boolean;
  is_paid: boolean;
  contacts: { id: string; first_name: string; last_name: string } | null;
  companies: { id: string; name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
  lead_sources: { name: string } | null;
}

interface Ref { id: string; first_name?: string; last_name?: string; name?: string; }

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

interface InvoiceNote { id: string; deal_id: string | null; notes: string | null; }

export function OrdersFromDeals({ deals, teamMembers, sources, invoiceNotes, fiscalMode = "sep-aug" }: { deals: Deal[]; teamMembers: Ref[]; sources: Ref[]; invoiceNotes: InvoiceNote[]; fiscalMode?: FiscalMode }) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [periodMode, setPeriodMode] = useState<"fiscal" | "month" | "custom">("fiscal");
  const [selectedFY, setSelectedFY] = useState(() => getCurrentFiscalYearStart(fiscalMode));
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState(() => getDefaultCustomFrom(fiscalMode));
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  // Deal popup
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dealInvoices, setDealInvoices] = useState<{ id: string; amount: number; month: string; status: string }[]>([]);
  const [dealDocuments, setDealDocuments] = useState<{ id: string; name: string; file_path: string; file_size: number | null; document_type: string }[]>([]);
  const [loadingDealData, setLoadingDealData] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const DEAL_STAGE_LABELS: Record<string, string> = { opportunities: "Opportunités", quote_to_send: "Devis à envoyer", quote_sent: "Devis envoyé", opco_deposit: "Dépôt OPCO", quote_signed: "Devis signé", closed_won: "Gagné", closed_lost: "Perdu" };
  const stageColors: Record<string, { bg: string; text: string }> = { closed_won: { bg: "#e8f5e9", text: "#2e7d32" }, closed_lost: { bg: "#fce4ec", text: "#c62828" } };
  const INV_STATUS: Record<string, { label: string; bg: string; text: string }> = { facturable: { label: "Facturable", bg: "#fff3e0", text: "#e65100" }, facture: { label: "Facturé", bg: "#e8f0fe", text: "#161f45" }, paye: { label: "Payé", bg: "#e8f5e9", text: "#2e7d32" } };

  async function openDealPopup(deal: Deal) {
    setSelectedDeal(deal);
    setLoadingDealData(true);
    const supabase = createClient();
    const [{ data: invs }, { data: docs }] = await Promise.all([
      supabase.from("invoices").select("id, amount, month, status").eq("deal_id", deal.id).order("month", { ascending: false }),
      supabase.from("deal_documents").select("*").eq("deal_id", deal.id).order("created_at", { ascending: false }),
    ]);
    setDealInvoices(invs ?? []);
    setDealDocuments(docs ?? []);
    setLoadingDealData(false);
  }

  async function handleUploadDealDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedDeal) return;
    setUploadingDoc(true);
    const supabase = createClient();
    const path = `${selectedDeal.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("deal-documents").upload(path, file);
    if (!error) {
      await supabase.from("deal_documents").insert({ deal_id: selectedDeal.id, name: file.name, file_path: path, file_size: file.size, file_type: file.type, document_type: "autre" });
      const { data: docs } = await supabase.from("deal_documents").select("*").eq("deal_id", selectedDeal.id).order("created_at", { ascending: false });
      setDealDocuments(docs ?? []);
    }
    setUploadingDoc(false);
    e.target.value = "";
  }

  async function handleDownloadDoc(doc: { file_path: string }) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("deal-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteDoc(doc: { id: string; file_path: string }) {
    if (!confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ce document ?")) return;
    const supabase = createClient();
    await supabase.storage.from("deal-documents").remove([doc.file_path]);
    await supabase.from("deal_documents").delete().eq("id", doc.id);
    setDealDocuments(prev => prev.filter(d => d.id !== doc.id));
  }

  // Edit row
  const [editingId, setEditingId] = useState<string | null>(null);

  async function toggleInvoiced(dealId: string, current: boolean) {
    const supabase = createClient();
    await supabase.from("deals").update({ is_invoiced: !current }).eq("id", dealId);
    router.refresh();
  }

  function getInvoiceNotesForDeal(dealId: string): string {
    return invoiceNotes
      .filter(inv => inv.deal_id === dealId && inv.notes)
      .map(inv => inv.notes!)
      .join(" | ");
  }

  // Notes popup
  const [notesPopup, setNotesPopup] = useState<{ dealId: string; notes: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  function autoPunctuate(text: string): string {
    let r = text;
    r = r.charAt(0).toUpperCase() + r.slice(1);
    r = r.replace(/\s*virgule\s*/gi, ", ");
    r = r.replace(/\s*point d'exclamation\s*/gi, "! ");
    r = r.replace(/\s*point d'interrogation\s*/gi, "? ");
    r = r.replace(/\s*point\s*$/gi, ".");
    r = r.replace(/\s*point\s+/gi, ". ");
    r = r.replace(/\s*deux[ -]points\s*/gi, " : ");
    r = r.replace(/\s*point-virgule\s*/gi, " ; ");
    r = r.replace(/\s*tiret\s*/gi, " - ");
    r = r.replace(/\s*retour [àa] la ligne\s*/gi, "\n");
    r = r.replace(/\s*aller [àa] la ligne\s*/gi, "\n");
    r = r.replace(/\s*nouvelle ligne\s*/gi, "\n");
    r = r.replace(/\s*saut de ligne\s*/gi, "\n");
    r = r.replace(/\s*[àa] la ligne\s*/gi, "\n");
    r = r.replace(/([.!?]\s+|[\n])(\w)/g, (_, p, c) => p + c.toUpperCase());
    r = r.replace(/ {2,}/g, " ");
    return r.trim();
  }

  function startRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée."); return; }
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = notesPopup?.notes ?? "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const punctuated = autoPunctuate(transcript);
          if (punctuated.startsWith("\n")) { finalTranscript = finalTranscript.trimEnd() + punctuated; }
          else {
            if (finalTranscript && !/[.!?:;\n]\s*$/.test(finalTranscript)) finalTranscript += ". ";
            else if (finalTranscript && !/[\s\n]$/.test(finalTranscript)) finalTranscript += " ";
            finalTranscript += punctuated;
          }
        } else { interim = transcript; }
      }
      setNotesPopup(prev => prev ? { ...prev, notes: finalTranscript + (interim ? " " + interim : "") } : null);
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

  async function saveNotes() {
    if (!notesPopup) return;
    setSavingNotes(true);
    const supabase = createClient();
    await supabase.from("deals").update({ notes: notesPopup.notes || null }).eq("id", notesPopup.dealId);
    setSavingNotes(false);
    setNotesPopup(null);
    stopRecording();
    router.refresh();
  }

  const filtered = deals.filter(d => {
    // Search
    if (search) {
      const s = search.toLowerCase();
      const name = d.name.toLowerCase();
      const compName = (d.companies?.name ?? "").toLowerCase();
      const contactName = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}`.toLowerCase() : "";
      if (!name.includes(s) && !compName.includes(s) && !contactName.includes(s)) return false;
    }
    if (filterOwner && d.owner_id !== filterOwner) return false;
    if (filterSource && d.source_id !== filterSource) return false;

    // Period filter on close_date
    const closeDate = d.close_date ?? d.created_at?.split("T")[0] ?? "";
    if (periodMode === "fiscal") {
      const { from: fyFrom, to: fyTo } = getFiscalYearRange(selectedFY, fiscalMode);
      if (closeDate < fyFrom || closeDate > fyTo) return false;
    } else if (periodMode === "month") {
      if (!closeDate.startsWith(filterMonth)) return false;
    } else if (periodMode === "custom") {
      if (closeDate < customFrom || closeDate > customTo) return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalDays = filtered.reduce((s, d) => s + (Number(d.training_days) || 0), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Commandes gagnées</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Chiffre d&apos;affaires</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalAmount)}</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Jours formation vendus</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#E8732A" }}>{totalDays.toFixed(1)}j</div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Panier moyen</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1E2A5A" }}>{filtered.length > 0 ? fmt(totalAmount / filtered.length) : "0 €"}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#8399a9" }} />
          <input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", paddingLeft: 36, paddingRight: 12, fontSize: 13, width: 220, color: "#1a2a3a" }}
          />
        </div>
        <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="">Tous les Account Managers</option>
          {teamMembers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}>
          <option value="">Toutes les sources</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={periodMode}
          onChange={(e) => setPeriodMode(e.target.value as "fiscal" | "month" | "custom")}
          style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }}
        >
          <option value="fiscal">Année fiscale</option>
          <option value="month">Mois</option>
          <option value="custom">Personnalisé</option>
        </select>
        {periodMode === "fiscal" && (
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(Number(e.target.value))}
            style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}
          >
            {getFiscalYearOptions(5, fiscalMode).map(o => (
              <option key={o.startYear} value={o.startYear}>{o.label}</option>
            ))}
          </select>
        )}
        {periodMode === "month" && (
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, color: "#1a2a3a" }} />
        )}
        {periodMode === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
            <span style={{ color: "#8399a9" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13 }} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="lca-card" style={{ overflow: "hidden" }}>
        <div className="lca-bar-gradient" />
        <div style={{ overflowX: "auto" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>Date</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>Deal</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>Client</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>Contact</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "center" }}>Account Manager</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12 }}>Source</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "right" }}>Jours</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, textAlign: "center" }}>Facturé</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, minWidth: 200 }}>Notes facturation</TableHead>
                <TableHead style={{ fontWeight: 700, color: "#1E2A5A", fontSize: 12, width: 40 }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune commande trouvée</TableCell>
                </TableRow>
              ) : filtered.map(d => (
                <TableRow key={d.id} className="hover:bg-[#f0f7fb]">
                  <TableCell style={{ fontSize: 13, color: "#5a6f80", whiteSpace: "nowrap" }}>
                    {d.close_date ? format(new Date(d.close_date), "dd MMM yyyy", { locale: fr }) : "—"}
                  </TableCell>
                  <TableCell>
                    <span onClick={() => openDealPopup(d)} style={{ fontWeight: 600, fontSize: 13, color: "#1E2A5A", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.name}</span>
                  </TableCell>
                  <TableCell style={{ fontSize: 13 }}>
                    {d.companies ? (
                      <span onClick={() => router.push(`/clients/${d.companies!.id}`)} style={{ color: "#1E2A5A", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                        {d.companies.name}
                      </span>
                    ) : <span style={{ color: "#ccc" }}>—</span>}
                  </TableCell>
                  <TableCell>
                    {d.contacts ? (
                      <span onClick={() => router.push(`/contacts/${d.contacts!.id}`)} style={{ color: "#1E2A5A", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer", fontSize: 13 }}>
                        {d.contacts.first_name} {d.contacts.last_name}
                      </span>
                    ) : <span style={{ color: "#ccc" }}>—</span>}
                  </TableCell>
                  <TableCell style={{ textAlign: "center" }}>
                    {d.team_members ? (
                      <span style={{ display: "inline-block", width: 26, height: 26, borderRadius: "50%", background: "#1E2A5A", color: "white", fontSize: 10, fontWeight: 700, lineHeight: "26px", textAlign: "center" }}>
                        {d.team_members.first_name[0]}{d.team_members.last_name[0]}
                      </span>
                    ) : <span style={{ color: "#ccc" }}>—</span>}
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{d.lead_sources?.name ?? "—"}</TableCell>
                  <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#27ae60" }}>{fmt(Number(d.amount) || 0)}</TableCell>
                  <TableCell style={{ textAlign: "right", fontSize: 13, color: "#5a6f80" }}>{d.training_days ? `${Number(d.training_days).toFixed(1)}j` : "—"}</TableCell>
                  <TableCell style={{ textAlign: "center" }}>
                    {(() => {
                      const st = d.is_paid
                        ? { label: "Payé", bg: "#e8f5e9", text: "#2e7d32" }
                        : d.is_invoiced
                          ? { label: "Facturé", bg: "#e8f0fe", text: "#161f45" }
                          : { label: "Non", bg: "#fce4ec", text: "#c62828" };
                      return (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell
                    onClick={() => setNotesPopup({ dealId: d.id, notes: d.notes ?? "" })}
                    style={{ fontSize: 12, color: "#5a6f80", cursor: "pointer", minWidth: 200 }}
                    title="Cliquer pour éditer"
                  >
                    {(() => {
                      const invNotes = getInvoiceNotesForDeal(d.id);
                      const display = invNotes || d.notes;
                      return <span style={{ borderBottom: "1px dashed #ccc" }}>{display || "Ajouter..."}</span>;
                    })()}
                  </TableCell>
                  <TableCell style={{ textAlign: "center" }}>
                    <button
                      onClick={() => setEditingId(editingId === d.id ? null : d.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#1E2A5A", padding: 4 }}
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} style={{ fontWeight: 800, color: "#161f45", fontSize: 13, borderTop: "2px solid #161f45" }}>Total</TableCell>
                  <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#161f45", fontSize: 13, borderTop: "2px solid #161f45" }}>{fmt(totalAmount)}</TableCell>
                  <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#161f45", fontSize: 13, borderTop: "2px solid #161f45" }}>{totalDays.toFixed(1)}j</TableCell>
                  <TableCell colSpan={3} style={{ borderTop: "2px solid #161f45" }}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Notes popup */}
      {notesPopup && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { stopRecording(); setNotesPopup(null); } }}
        >
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e8ecf1" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Notes de facturation</h3>
              <button onClick={() => { stopRecording(); setNotesPopup(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <textarea
                value={notesPopup.notes}
                onChange={(e) => setNotesPopup({ ...notesPopup, notes: e.target.value })}
                placeholder="Écrire ou dicter vos notes de facturation..."
                style={{ width: "100%", minHeight: 180, borderRadius: 10, border: "1px solid #dce8f0", padding: 14, fontSize: 14, color: "#1a2a3a", resize: "vertical", lineHeight: 1.6, outline: "none" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                <button
                  onClick={() => isRecording ? stopRecording() : startRecording()}
                  style={{
                    height: 42, width: 42, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: isRecording ? "#e74c3c" : "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)",
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isRecording ? "0 0 0 4px rgba(231,76,60,0.2)" : "none",
                    animation: isRecording ? "pulse 1.5s infinite" : "none",
                  }}
                >
                  {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
                <span style={{ fontSize: 13, color: isRecording ? "#e74c3c" : "#8399a9", fontWeight: isRecording ? 600 : 400 }}>
                  {isRecording ? "Enregistrement en cours..." : "Cliquez pour dicter"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
              <button onClick={() => { stopRecording(); setNotesPopup(null); }} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: savingNotes ? 0.6 : 1 }}
              >
                {savingNotes ? "..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal popup */}
      {selectedDeal && (() => {
        const d = selectedDeal;
        const sc = stageColors[d.stage] ?? { bg: "#e8f5e9", text: "#2e7d32" };
        const dealAmount = Number(d.amount) || 0;
        const totalInvoiced = dealInvoices.reduce((s, inv) => s + (Number(inv.amount) || 0), 0);
        const remaining = dealAmount - totalInvoiced;
        const allFacture = dealInvoices.length > 0 && dealInvoices.every(inv => inv.status === "facture" || inv.status === "paye");
        const allPaye = dealInvoices.length > 0 && dealInvoices.every(inv => inv.status === "paye");
        const isFullyInvoiced = totalInvoiced >= dealAmount && allFacture;
        const isFullyPaid = totalInvoiced >= dealAmount && allPaye;
        const statusBadge = isFullyPaid ? { label: "Entièrement payé", bg: "#e8f5e9", text: "#2e7d32", bar: "#27ae60" } : isFullyInvoiced ? { label: "Entièrement facturé", bg: "#e8f0fe", text: "#161f45", bar: "#1E2A5A" } : { label: "Facturation en cours", bg: "#fff3e0", text: "#e65100", bar: "#E8732A" };

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedDeal(null); }}>
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: "#1a2a3a", margin: 0 }}>{d.name}</h3>
                <button onClick={() => setSelectedDeal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}><X className="h-5 w-5" /></button>
              </div>
              <div style={{ padding: 20 }} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span style={{ background: sc.bg, color: sc.text, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{DEAL_STAGE_LABELS[d.stage] ?? d.stage}</span>
                  <span style={{ fontSize: 12, color: "#8399a9" }}>{d.amount ? fmt(Number(d.amount)) : ""}</span>
                </div>
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                  {d.companies && <div className="flex items-center gap-2"><Building2 style={{ width: 14, height: 14, color: "#8399a9" }} /><span onClick={() => { setSelectedDeal(null); router.push(`/clients/${d.companies!.id}`); }} style={{ fontSize: 13, color: "#1E2A5A", textDecoration: "underline", cursor: "pointer" }}>{d.companies.name}</span></div>}
                  {d.contacts && <div className="flex items-center gap-2"><User style={{ width: 14, height: 14, color: "#8399a9" }} /><span onClick={() => { setSelectedDeal(null); router.push(`/contacts/${d.contacts!.id}`); }} style={{ fontSize: 13, color: "#1E2A5A", textDecoration: "underline", cursor: "pointer" }}>{d.contacts.first_name} {d.contacts.last_name}</span></div>}
                  {d.team_members && <div className="flex items-center gap-2"><User style={{ width: 14, height: 14, color: "#8399a9" }} /><span style={{ fontSize: 12, color: "#8399a9" }}>Propriétaire : {d.team_members.first_name} {d.team_members.last_name}</span></div>}
                  {d.close_date && <div className="flex items-center gap-2"><Calendar style={{ width: 14, height: 14, color: "#8399a9" }} /><span style={{ fontSize: 12, color: "#8399a9" }}>Closing : {format(new Date(d.close_date), "d MMMM yyyy", { locale: fr })}</span></div>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant</div><div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{fmt(dealAmount)}</div></div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Jours formation</div><div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{Number(d.training_days) ? `${Number(d.training_days).toFixed(1)}j` : "—"}</div></div>
                </div>
                {/* Facturation */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Facturation</div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: statusBadge.bg, color: statusBadge.text }}>{statusBadge.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a" }}>{fmt(totalInvoiced)} / {fmt(dealAmount)}</span>
                    </div>
                    <div style={{ height: 6, background: "#e8ecf1", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}><div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, dealAmount > 0 ? (totalInvoiced / dealAmount) * 100 : 0)}%`, background: statusBadge.bar, transition: "width 0.5s" }} /></div>
                    {dealInvoices.length > 0 ? dealInvoices.map(inv => {
                      const ist = INV_STATUS[inv.status] ?? INV_STATUS.facturable;
                      return <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}><span style={{ color: "#5a6f80", textTransform: "capitalize" }}>{format(new Date(inv.month), "MMMM yyyy", { locale: fr })}</span><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, color: "#1a2a3a" }}>{fmt(inv.amount)}</span><span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: ist.bg, color: ist.text }}>{ist.label}</span></div></div>;
                    }) : <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic" }}>Aucune facture</div>}
                    {remaining > 0 && <div style={{ fontSize: 11, color: "#e65100", marginTop: 6, borderTop: "1px solid #e8ecf1", paddingTop: 6 }}>Reste à facturer : <strong>{fmt(remaining)}</strong></div>}
                  </div>
                </div>
                {/* Documents */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Documents</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <label style={{ height: 32, borderRadius: 6, background: "#1E2A5A", color: "white", fontSize: 12, fontWeight: 600, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: uploadingDoc ? "wait" : "pointer", opacity: uploadingDoc ? 0.6 : 1 }}>
                      <Upload className="h-3.5 w-3.5" />{uploadingDoc ? "Envoi..." : "Importer"}
                      <input type="file" style={{ display: "none" }} disabled={uploadingDoc} onChange={handleUploadDealDoc} />
                    </label>
                  </div>
                  {loadingDealData ? <div style={{ fontSize: 12, color: "#8399a9" }}>Chargement...</div> : dealDocuments.length === 0 ? <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic" }}>Aucun document</div> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dealDocuments.map(doc => (
                        <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f8fbfd", borderRadius: 8, border: "1px solid #e8ecf1" }}>
                          <FileText className="h-4 w-4" style={{ color: "#8399a9", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div></div>
                          <button onClick={() => handleDownloadDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1E2A5A", padding: 4 }}><Download className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2" style={{ padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button onClick={() => { setSelectedDeal(null); router.push("/deals"); }} style={{ flex: 1, height: 40, borderRadius: 8, background: "#E8732A", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Edit className="h-4 w-4" /> Modifier le deal</button>
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
    </div>
  );
}
