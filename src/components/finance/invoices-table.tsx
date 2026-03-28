"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Trash2, Pencil, X, Building2, Handshake, Calendar, Receipt, Upload, FileText, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";

interface Invoice {
  id: string;
  client_name: string;
  funding_type: string | null;
  month: string;
  amount: number;
  is_paid: boolean;
  status: "facturable" | "facture" | "paye";
  paid_date: string | null;
  due_date: string | null;
  notes: string | null;
  company_id: string | null;
  deal_id: string | null;
  invoice_name: string | null;
  companies: { name: string } | null;
}

const INVOICE_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  facturable: { label: "Facturable", bg: "#fff3e0", text: "#e65100" },
  facture: { label: "Facturé", bg: "#e8f0fe", text: "#0d4f7a" },
  paye: { label: "Payé", bg: "#e8f5e9", text: "#2e7d32" },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

interface WonDeal {
  id: string;
  name: string;
  amount: number | null;
  company_id: string | null;
  companies: { id: string; name: string } | null;
}

export function InvoicesTable({ invoices, wonDeals }: { invoices: Invoice[]; wonDeals: WonDeal[] }) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterFunding, setFilterFunding] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [invoiceDocs, setInvoiceDocs] = useState<{ id: string; name: string; file_path: string; file_size: number | null; document_type: string; created_at: string }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [invDocType, setInvDocType] = useState("facture");

  const DOC_TYPES: Record<string, string> = { facture: "Facture", avoir: "Avoir", relance: "Relance", pennylane: "Import Pennylane", autre: "Autre" };
  const DOC_COLORS: Record<string, { bg: string; text: string }> = { facture: { bg: "#e8f0fe", text: "#0d4f7a" }, avoir: { bg: "#fce4ec", text: "#c62828" }, relance: { bg: "#fff3e0", text: "#e65100" }, pennylane: { bg: "#e8f5e9", text: "#2e7d32" }, autre: { bg: "#f5f5f5", text: "#555" } };

  async function loadInvoiceDocs(invoiceId: string) {
    setLoadingDocs(true);
    const supabase = createClient();
    const { data } = await supabase.from("invoice_documents").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false });
    setInvoiceDocs(data ?? []);
    setLoadingDocs(false);
  }

  async function handleUploadInvoiceDoc(e: React.ChangeEvent<HTMLInputElement>, invoiceId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const supabase = createClient();
    const path = `${invoiceId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("invoice-documents").upload(path, file);
    if (!error) {
      await supabase.from("invoice_documents").insert({ invoice_id: invoiceId, name: file.name, file_path: path, file_size: file.size, file_type: file.type, document_type: invDocType });
      await loadInvoiceDocs(invoiceId);
    }
    setUploadingDoc(false);
    e.target.value = "";
  }

  async function handleDownloadInvoiceDoc(doc: { file_path: string }) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("invoice-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteInvoiceDoc(doc: { id: string; file_path: string }, invoiceId: string) {
    if (!confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ce document ?")) return;
    const supabase = createClient();
    await supabase.storage.from("invoice-documents").remove([doc.file_path]);
    await supabase.from("invoice_documents").delete().eq("id", doc.id);
    await loadInvoiceDocs(invoiceId);
  }
  const [monthlyMode, setMonthlyMode] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthlyAmounts, setMonthlyAmounts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    deal_id: "",
    client_name: "",
    company_id: "" as string | null,
    funding_type: "",
    month: new Date().toISOString().slice(0, 7) + "-01",
    amount: "",
    status: "facturable" as string,
    due_date: "",
    notes: "",
  });

  const filtered = invoices.filter((inv) => {
    if (search && !inv.client_name.toLowerCase().includes(search.toLowerCase()) && !(inv.invoice_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterFunding && inv.funding_type !== filterFunding) return false;
    if (filterStatus && inv.status !== filterStatus) return false;
    return true;
  });

  async function handleDeleteInvoice(id: string) {
    const supabase = createClient();
    const inv = invoices.find(i => i.id === id);
    await supabase.from("invoices").delete().eq("id", id);

    if (inv?.deal_id) {
      await recalcDealInvoiceStatus(supabase, inv.deal_id);
    }

    router.refresh();
  }

  async function recalcDealInvoiceStatus(supabase: any, dealId: string) {
    const deal = wonDeals.find(d => d.id === dealId);
    const dealAmount = Number(deal?.amount) || 0;

    const { data: dealInvoices } = await supabase.from("invoices").select("amount, status").eq("deal_id", dealId);
    const invs = dealInvoices ?? [];
    const totalAmount = invs.reduce((s: number, inv: any) => s + (Number(inv.amount) || 0), 0);
    const allFacture = invs.length > 0 && invs.every((inv: any) => inv.status === "facture" || inv.status === "paye");
    const allPaye = invs.length > 0 && invs.every((inv: any) => inv.status === "paye");

    // is_invoiced = true only if total >= deal amount AND all invoices are at least "facturé"
    const isInvoiced = totalAmount >= dealAmount && allFacture;
    // is_paid for future use
    const isPaid = totalAmount >= dealAmount && allPaye;

    await supabase.from("deals").update({ is_invoiced: isInvoiced, is_paid: isPaid }).eq("id", dealId);
  }

  function openEdit(inv: Invoice) {
    setEditingId(inv.id);
    setForm({
      deal_id: inv.deal_id ?? "",
      client_name: inv.client_name,
      company_id: inv.company_id,
      funding_type: inv.funding_type ?? "",
      month: inv.month,
      amount: String(inv.amount),
      status: inv.status ?? "facturable",
      due_date: inv.due_date ?? "",
      notes: inv.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    if (monthlyMode && !editingId && selectedMonths.length > 0) {
      // Monthly mode: create one invoice per selected month
      const deal = wonDeals.find(d => d.id === form.deal_id);
      const dealName = deal?.name ?? "Deal";
      const existingCount = invoices.filter(inv => inv.deal_id === form.deal_id).length;

      for (let i = 0; i < selectedMonths.length; i++) {
        const m = selectedMonths[i];
        const amount = parseFloat(monthlyAmounts[m] ?? "0") || 0;
        await supabase.from("invoices").insert({
          client_name: form.client_name,
          company_id: form.company_id || null,
          deal_id: form.deal_id || null,
          funding_type: "mensuelle",
          month: m,
          amount,
          status: form.status,
          is_paid: form.status === "paye",
          due_date: form.due_date || null,
          notes: form.notes || null,
          invoice_name: `Facture ${existingCount + 1 + i} - ${dealName}`,
        });
      }
    } else {
      // Normal mode: single invoice
      const invoiceAmount = parseFloat(form.amount) || 0;

      let invoiceName = "";
      if (form.deal_id && !editingId) {
        const deal = wonDeals.find(d => d.id === form.deal_id);
        const dealName = deal?.name ?? "Deal";
        const existingCount = invoices.filter(inv => inv.deal_id === form.deal_id).length;
        invoiceName = `Facture ${existingCount + 1} - ${dealName}`;
      }

      const payload: Record<string, unknown> = {
        client_name: form.client_name,
        company_id: form.company_id || null,
        deal_id: form.deal_id || null,
        funding_type: form.funding_type || null,
        month: form.month,
        amount: invoiceAmount,
        status: form.status,
        is_paid: form.status === "paye",
        due_date: form.due_date || null,
        notes: form.notes || null,
      };

      if (invoiceName && !editingId) {
        payload.invoice_name = invoiceName;
      }

      if (editingId) {
        await supabase.from("invoices").update(payload).eq("id", editingId);
      } else {
        await supabase.from("invoices").insert(payload);
      }
    }

    // Update deal is_invoiced based on invoice totals AND statuses
    if (form.deal_id) {
      await recalcDealInvoiceStatus(supabase, form.deal_id);
    }

    setSaving(false);
    setOpen(false);
    setEditingId(null);
    setMonthlyMode(false);
    setSelectedMonths([]);
    setMonthlyAmounts({});
    setForm({ deal_id: "", client_name: "", company_id: null, funding_type: "", month: new Date().toISOString().slice(0, 7) + "-01", amount: "", status: "facturable", due_date: "", notes: "" });
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-60" />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterFunding}
            onChange={(e) => setFilterFunding(e.target.value)}
          >
            <option value="">Tous financements</option>
            <option value="UP FRONT">UP FRONT</option>
            <option value="OPCO">OPCO</option>
            <option value="CPF">CPF</option>
            <option value="autre">Autre</option>
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="facturable">Facturable</option>
            <option value="facture">Facturé</option>
            <option value="paye">Payé</option>
          </select>
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={(fmt: ExportFormat) => exportData(
            filtered.map((inv) => ({
              nom_facture: inv.invoice_name ?? "",
              client: inv.client_name,
              financement: inv.funding_type ?? "",
              emission: inv.month ?? "",
              montant: inv.amount,
              statut: inv.status ?? "",
              echeance: inv.due_date ?? "",
              notes: inv.notes ?? "",
            })),
            [
              { key: "nom_facture", label: "Nom facture" }, { key: "client", label: "Client" },
              { key: "financement", label: "Financement" }, { key: "emission", label: "Émission" },
              { key: "montant", label: "Montant" }, { key: "statut", label: "Statut" },
              { key: "echeance", label: "Échéance" }, { key: "notes", label: "Notes" },
            ],
            "facturation", fmt
          )} />
          <Button onClick={() => { setEditingId(null); setMonthlyMode(false); setSelectedMonths([]); setMonthlyAmounts({}); setForm({ deal_id: "", client_name: "", company_id: null, funding_type: "", month: new Date().toISOString().slice(0, 7) + "-01", amount: "", status: "facturable", due_date: "", notes: "" }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Financement</TableHead>
              <TableHead>Émission</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aucune facture trouvée
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <span onClick={() => { setViewInvoice(inv); loadInvoiceDocs(inv.id); }} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                      {inv.invoice_name || inv.client_name}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {inv.company_id ? (
                      <span
                        onClick={() => router.push(`/clients/${inv.company_id}`)}
                        style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {inv.client_name}
                      </span>
                    ) : inv.client_name}
                  </TableCell>
                  <TableCell>
                    {inv.funding_type ? (
                      <Badge variant="outline">{inv.funding_type}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="capitalize">{formatMonth(inv.month)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(Number(inv.amount))}</TableCell>
                  <TableCell>
                    {(() => {
                      const st = INVOICE_STATUS_LABELS[inv.status] ?? INVOICE_STATUS_LABELS.facturable;
                      return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 10, background: st.bg, color: st.text }}>{st.label}</span>;
                    })()}
                  </TableCell>
                  <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {inv.notes ?? ""}
                  </TableCell>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        onClick={() => openEdit(inv)}
                        style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                        title="Modifier"
                      >
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ? Cette action est irréversible.")) {
                            handleDeleteInvoice(inv.id);
                          }
                        }}
                        style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                        title="Supprimer"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Modifier la facture" : "Nouvelle facture"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-5 pb-5">
            <div className="space-y-2">
              <Label>Client *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.company_id ?? ""}
                onChange={(e) => {
                  const cid = e.target.value;
                  const companyDeals = wonDeals.filter(d => d.company_id === cid);
                  if (companyDeals.length === 1) {
                    const deal = companyDeals[0];
                    setForm({ ...form, company_id: cid, client_name: deal.companies?.name ?? deal.name, deal_id: deal.id, amount: String(Number(deal.amount) || 0) });
                  } else {
                    const compName = wonDeals.find(d => d.company_id === cid)?.companies?.name ?? "";
                    setForm({ ...form, company_id: cid, client_name: compName, deal_id: "", amount: "" });
                  }
                }}
              >
                <option value="">Sélectionner un client</option>
                {Array.from(new Map(wonDeals.filter(d => d.company_id).map(d => [d.company_id, d.companies?.name ?? d.name])).entries()).map(([cid, name]) => (
                  <option key={cid} value={cid!}>{name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Deal *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.deal_id}
                onChange={(e) => {
                  const deal = wonDeals.find(d => d.id === e.target.value);
                  if (deal) {
                    setForm({ ...form, deal_id: deal.id, amount: String(Number(deal.amount) || 0) });
                  } else {
                    setForm({ ...form, deal_id: "", amount: "" });
                  }
                }}
              >
                <option value="">Sélectionner un deal</option>
                {wonDeals.filter(d => d.company_id === form.company_id).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(d.amount) || 0)} €)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Financement</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={monthlyMode ? "mensuelle" : form.funding_type}
                onChange={(e) => {
                  if (e.target.value === "mensuelle") {
                    setMonthlyMode(true);
                    setForm({ ...form, funding_type: "mensuelle" });
                    setSelectedMonths([]);
                    setMonthlyAmounts({});
                  } else {
                    setMonthlyMode(false);
                    setForm({ ...form, funding_type: e.target.value });
                  }
                }}
              >
                <option value="">Sélectionner</option>
                <option value="UP FRONT">UP FRONT</option>
                <option value="OPCO">OPCO</option>
                <option value="CPF">CPF</option>
                <option value="mensuelle">Mensuel</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            {!monthlyMode ? (
              <>
                <div className="space-y-2">
                  <Label>Émission</Label>
                  <Input type="date" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Montant (€) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Montant total (€) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => {
                      const total = parseFloat(e.target.value) || 0;
                      setForm({ ...form, amount: e.target.value });
                      if (selectedMonths.length > 0) {
                        const perMonth = Math.round(total / selectedMonths.length * 100) / 100;
                        const newAmounts: Record<string, string> = {};
                        selectedMonths.forEach((m, i) => {
                          if (i === selectedMonths.length - 1) {
                            newAmounts[m] = String(Math.round((total - perMonth * (selectedMonths.length - 1)) * 100) / 100);
                          } else {
                            newAmounts[m] = String(perMonth);
                          }
                        });
                        setMonthlyAmounts(newAmounts);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sélectionner les mois</Label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const now = new Date();
                      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
                      const mLabel = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
                      const checked = selectedMonths.includes(mStr);
                      return (
                        <label
                          key={mStr}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer",
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
                            onChange={(ev) => {
                              let newMonths: string[];
                              if (ev.target.checked) {
                                newMonths = [...selectedMonths, mStr].sort();
                              } else {
                                newMonths = selectedMonths.filter(m => m !== mStr);
                              }
                              setSelectedMonths(newMonths);
                              const total = parseFloat(form.amount) || 0;
                              if (newMonths.length > 0 && total > 0) {
                                const perMonth = Math.round(total / newMonths.length * 100) / 100;
                                const newAmounts: Record<string, string> = {};
                                newMonths.forEach((m, idx) => {
                                  if (idx === newMonths.length - 1) {
                                    newAmounts[m] = String(Math.round((total - perMonth * (newMonths.length - 1)) * 100) / 100);
                                  } else {
                                    newAmounts[m] = String(perMonth);
                                  }
                                });
                                setMonthlyAmounts(newAmounts);
                              }
                            }}
                            style={{ accentColor: "#1a6b9c" }}
                          />
                          {mLabel}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {selectedMonths.length > 0 && (
                  <div className="space-y-2">
                    <Label>Montant par mois</Label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedMonths.map(m => {
                        const d = new Date(m);
                        const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                        return (
                          <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", textTransform: "capitalize", minWidth: 120 }}>{label}</span>
                            <div style={{ position: "relative" }}>
                              <input
                                type="number"
                                value={monthlyAmounts[m] ?? ""}
                                onChange={(e) => setMonthlyAmounts(prev => ({ ...prev, [m]: e.target.value }))}
                                style={{ height: 32, width: 130, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 26px 0 8px", fontSize: 13, textAlign: "right" }}
                              />
                              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#8399a9" }}>€</span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e8ecf1", paddingTop: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#8399a9" }}>Total</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: Object.values(monthlyAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0) === (parseFloat(form.amount) || 0) ? "#27ae60" : "#e74c3c" }}>
                          {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Object.values(monthlyAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0))} €
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>Statut</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="facturable">Facturable</option>
                <option value="facture">Facturé</option>
                <option value="paye">Payé</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Échéance</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.deal_id || !form.amount || (monthlyMode && selectedMonths.length === 0)} className="w-full">
              {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Invoice detail popup */}
      {viewInvoice && (() => {
        const inv = viewInvoice;
        const st = INVOICE_STATUS_LABELS[inv.status] ?? INVOICE_STATUS_LABELS.facturable;
        const deal = wonDeals.find(d => d.id === inv.deal_id);
        const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paye";

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setViewInvoice(null); }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "85vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: "#1a2a3a", margin: 0 }}>{inv.invoice_name || inv.client_name}</h3>
                <button onClick={() => setViewInvoice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div style={{ padding: 20 }} className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 999, background: st.bg, color: st.text }}>{st.label}</span>
                  {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#fce4ec", color: "#c62828" }}>En retard</span>}
                  {inv.funding_type && <span style={{ fontSize: 12, color: "#8399a9" }}>{inv.funding_type}</span>}
                </div>

                {/* Infos */}
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                  {inv.companies && (
                    <div className="flex items-center gap-2">
                      <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setViewInvoice(null); router.push(`/clients/${inv.company_id}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                        {inv.companies.name}
                      </span>
                    </div>
                  )}
                  {deal && (
                    <div className="flex items-center gap-2">
                      <Handshake style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setViewInvoice(null); router.push("/deals"); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                        {deal.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar style={{ width: 14, height: 14, color: "#8399a9" }} />
                    <span style={{ fontSize: 12, color: "#8399a9" }}>Émission : <span style={{ textTransform: "capitalize" }}>{formatMonth(inv.month)}</span></span>
                  </div>
                  {inv.due_date && (
                    <div className="flex items-center gap-2">
                      <Calendar style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: isOverdue ? "#e74c3c" : "#8399a9" }}>
                        Échéance : {new Date(inv.due_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Montant */}
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{formatCurrency(Number(inv.amount))}</div>
                  </div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Financement</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{inv.funding_type || "—"}</div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Documents</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <label style={{ height: 32, borderRadius: 6, background: "#1a6b9c", color: "white", fontSize: 12, fontWeight: 600, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: uploadingDoc ? "wait" : "pointer", opacity: uploadingDoc ? 0.6 : 1 }}>
                      <Upload className="h-3.5 w-3.5" />{uploadingDoc ? "Envoi..." : "Importer"}
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} disabled={uploadingDoc} onChange={(e) => { setInvDocType("facture"); handleUploadInvoiceDoc(e, inv.id); }} />
                    </label>
                    <button style={{ height: 32, borderRadius: 6, background: "white", border: "1px solid #2ecc71", color: "#2e7d32", fontSize: 12, fontWeight: 600, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%232e7d32' stroke-width='2'%3E%3Cpath d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3Cpath d='M9 12h6'/%3E%3Cpath d='M12 9v6'/%3E%3C/svg%3E" alt="" style={{ width: 14, height: 14 }} />
                      Pennylane
                    </button>
                  </div>
                  {loadingDocs ? (
                    <div style={{ fontSize: 12, color: "#8399a9", padding: 8 }}>Chargement...</div>
                  ) : invoiceDocs.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic" }}>Aucun document</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {invoiceDocs.map(doc => {
                        const dtc = DOC_COLORS[doc.document_type] ?? DOC_COLORS.autre;
                        return (
                          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f8fbfd", borderRadius: 8, border: "1px solid #e8ecf1" }}>
                            <FileText className="h-4 w-4" style={{ color: "#8399a9", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10, background: dtc.bg, color: dtc.text }}>{DOC_TYPES[doc.document_type] ?? doc.document_type}</span>
                                {doc.file_size && <span style={{ fontSize: 11, color: "#8399a9" }}>{doc.file_size < 1024 * 1024 ? `${(doc.file_size / 1024).toFixed(0)} KB` : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`}</span>}
                              </div>
                            </div>
                            <button onClick={() => handleDownloadInvoiceDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }} title="Télécharger"><Download className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteInvoiceDoc(doc, inv.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }} title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {inv.notes && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Notes</div>
                    <p style={{ fontSize: 13, color: "#1a2a3a", whiteSpace: "pre-wrap" }}>{inv.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-2" style={{ padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button
                  onClick={() => { setViewInvoice(null); openEdit(inv); }}
                  style={{ flex: 1, height: 40, borderRadius: 8, background: "#FF6B35", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Pencil className="h-4 w-4" /> Modifier la facture
                </button>
                <button
                  onClick={() => { if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ?")) { handleDeleteInvoice(inv.id); setViewInvoice(null); } }}
                  style={{ height: 40, width: 40, borderRadius: 8, border: "1px solid #e74c3c", color: "#e74c3c", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
