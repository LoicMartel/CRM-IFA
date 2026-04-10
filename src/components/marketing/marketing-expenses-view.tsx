"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, DollarSign, Users, Upload, Download, FileText, X, TrendingUp, Target, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ExpenseDoc {
  id: string;
  expense_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
}

interface Expense {
  id: string;
  period_start: string;
  period_end: string;
  provider_name: string;
  amount: number;
  rdv_done: number;
  revenue: number;
  description: string | null;
  created_at: string;
  marketing_expense_documents?: ExpenseDoc[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " \u20ac";
}

function fmtMonth(start: string) {
  try {
    return format(new Date(start), "MMMM yyyy", { locale: fr });
  } catch {
    return start;
  }
}

// Get first/last day of month from a YYYY-MM string
function monthStart(ym: string) { return ym + "-01"; }
function monthEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().split("T")[0];
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  "Baptiste": { bg: "#e3f2fd", text: "#1565c0" },
  "Pauline": { bg: "#f3e5f5", text: "#6a1b9a" },
  "Hugo": { bg: "#e8f5e9", text: "#2e7d32" },
  "Agence Personnelle": { bg: "#fff3e0", text: "#e65100" },
  "Pub": { bg: "#fce4ec", text: "#c62828" },
  "ASPNL": { bg: "#e0f2f1", text: "#00695c" },
  "Skaale": { bg: "#ede7f6", text: "#4527a0" },
  "LK Premium": { bg: "#e8eaf6", text: "#283593" },
  "Oliver List": { bg: "#f1f8e9", text: "#558b2f" },
};

export function MarketingExpensesView({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    provider_name: "",
    amount: "",
    rdv_done: "",
    revenue: "",
    description: "",
  });
  const descVoice = useVoiceDictation(() => form.description, (t) => setForm((f) => ({ ...f, description: t })));
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [editDocs, setEditDocs] = useState<ExpenseDoc[]>([]);

  // Filters
  const [filterProvider, setFilterProvider] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const providerNames = Array.from(new Set(expenses.map((e) => e.provider_name))).sort();

  const filtered = expenses.filter((e) => {
    if (filterProvider && e.provider_name !== filterProvider) return false;
    if (filterMonth && !e.period_start.startsWith(filterMonth)) return false;
    return true;
  });

  // KPIs
  const totalAmount = filtered.reduce((a, e) => a + Number(e.amount), 0);
  const totalRevenue = filtered.reduce((a, e) => a + Number(e.revenue || 0), 0);
  const totalRdvDone = filtered.reduce((a, e) => a + (e.rdv_done || 0), 0);
  const costPerRdv = totalRdvDone > 0 ? totalAmount / totalRdvDone : 0;
  const roi = totalAmount > 0 ? totalRevenue / totalAmount : 0;
  const byProvider: Record<string, number> = {};
  filtered.forEach((e) => { byProvider[e.provider_name] = (byProvider[e.provider_name] ?? 0) + Number(e.amount); });

  function openCreate() {
    setEditingId(null);
    setForm({ period: new Date().toISOString().slice(0, 7), provider_name: "", amount: "", rdv_done: "", revenue: "", description: "" });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      period: e.period_start.slice(0, 7),
      provider_name: e.provider_name,
      amount: String(e.amount),
      rdv_done: String(e.rdv_done || 0),
      revenue: String(e.revenue || 0),
      description: e.description ?? "",
    });
    setEditDocs(e.marketing_expense_documents ?? []);
    setOpen(true);
  }

  async function handleUploadDoc(expenseId: string, file: File) {
    setUploadingDoc(true);
    const supabase = createClient();
    const path = `${expenseId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("marketing-expense-documents").upload(path, file);
    if (!uploadError) {
      const { data: doc } = await supabase.from("marketing_expense_documents").insert({
        expense_id: expenseId,
        name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type,
      }).select().single();
      if (doc) setEditDocs(prev => [...prev, doc]);
    }
    setUploadingDoc(false);
  }

  async function handleDownloadDoc(doc: ExpenseDoc) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("marketing-expense-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteDoc(doc: ExpenseDoc) {
    if (!window.confirm(`Supprimer "${doc.name}" ?`)) return;
    const supabase = createClient();
    await supabase.storage.from("marketing-expense-documents").remove([doc.file_path]);
    await supabase.from("marketing_expense_documents").delete().eq("id", doc.id);
    setEditDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    const supabase = createClient();
    await supabase.from("marketing_expenses").delete().eq("id", id);
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      period_start: monthStart(form.period),
      period_end: monthEnd(form.period),
      provider_name: form.provider_name,
      amount: parseFloat(form.amount) || 0,
      rdv_done: parseInt(form.rdv_done) || 0,
      revenue: parseFloat(form.revenue) || 0,
      description: form.description || null,
      created_by: currentMemberId || null,
    };

    if (editingId) {
      await supabase.from("marketing_expenses").update(payload).eq("id", editingId);
    } else {
      await supabase.from("marketing_expenses").insert(payload);
    }
    setSaving(false);
    setOpen(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total dépenses</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e74c3c" }}>{fmt(totalAmount)}</div>
          </div>
          <DollarSign style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>CA généré</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalRevenue)}</div>
          </div>
          <TrendingUp style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>RDV faits</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalRdvDone}</div>
          </div>
          <Calendar style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Coût par RDV</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{totalRdvDone > 0 ? fmt(costPerRdv) : "—"}</div>
          </div>
          <Target style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>ROI</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: roi >= 1 ? "#27ae60" : "#e74c3c" }}>{totalAmount > 0 ? `x${roi.toFixed(1)}` : "—"}</div>
          </div>
          <DollarSign style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
          >
            <option value="">Tous les prestataires</option>
            {providerNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40 h-9" />
          {filterMonth && (
            <button onClick={() => setFilterMonth("")} style={{ fontSize: 11, color: "#e74c3c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Réinitialiser
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={(f: ExportFormat) => exportData(
            filtered.map((e) => ({
              periode: fmtMonth(e.period_start),
              prestataire: e.provider_name,
              montant: e.amount,
              rdv_faits: e.rdv_done || 0,
              ca_genere: e.revenue || 0,
              description: e.description ?? "",
            })),
            [
              { key: "periode", label: "Période" }, { key: "prestataire", label: "Prestataire" },
              { key: "montant", label: "Montant" }, { key: "rdv_faits", label: "RDV faits" },
              { key: "ca_genere", label: "CA généré" }, { key: "description", label: "Description" },
            ],
            "depenses-marketing", f
          )} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Période</TableHead>
              <TableHead>Prestataire</TableHead>
              <TableHead style={{ textAlign: "right" }}>Montant</TableHead>
              <TableHead style={{ textAlign: "right" }}>RDV faits</TableHead>
              <TableHead style={{ textAlign: "right" }}>CA généré</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead style={{ width: 70 }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucune dépense
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => {
                const pc = PROVIDER_COLORS[e.provider_name] ?? { bg: "#f0f0f0", text: "#666" };
                return (
                  <TableRow key={e.id}>
                    <TableCell style={{ fontWeight: 600, textTransform: "capitalize" }}>{fmtMonth(e.period_start)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: pc.bg, color: pc.text }}>
                        {e.provider_name}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700 }}>{fmt(Number(e.amount))}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{e.rdv_done || 0}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: "#27ae60" }}>{fmt(Number(e.revenue) || 0)}</TableCell>
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{e.description ?? "—"}</TableCell>
                    <TableCell>
                      {(e.marketing_expense_documents ?? []).length > 0 ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#1a6b9c" }}>
                          <FileText className="h-3.5 w-3.5 inline mr-1" />
                          {(e.marketing_expense_documents ?? []).length}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEdit(e)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fbfd", fontWeight: 700, fontSize: 13 }}>
                <td style={{ padding: "8px 16px" }}>TOTAL</td>
                <td></td>
                <td style={{ textAlign: "right", padding: "8px 16px", color: "#e74c3c" }}>{fmt(totalAmount)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      {/* Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingId ? "Modifier la dépense" : "Nouvelle dépense"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            <div className="space-y-2">
              <Label>Mois *</Label>
              <Input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Prestataire *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.provider_name}
                onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
              >
                <option value="">Sélectionner</option>
                <option value="Baptiste">Baptiste</option>
                <option value="Pauline">Pauline</option>
                <option value="Hugo">Hugo</option>
                <option value="Agence Personnelle">Agence Personnelle</option>
                <option value="Pub">Pub</option>
                <option value="ASPNL">ASPNL</option>
                <option value="Skaale">Skaale</option>
                <option value="LK Premium">LK Premium</option>
                <option value="Oliver List">Oliver List</option>
              </select>
              {/* Custom provider */}
              {!["Baptiste", "Pauline", "Hugo", "Agence Personnelle", "Pub", "ASPNL", "Skaale", "LK Premium", "Oliver List", ""].includes(form.provider_name) && (
                <Input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} placeholder="Nom du prestataire" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Montant (EUR) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>RDV faits</Label>
                <Input type="number" value={form.rdv_done} onChange={(e) => setForm({ ...form, rdv_done: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>CA généré (EUR)</Label>
                <Input type="number" step="0.01" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Détails optionnels..."
              />
              <VoiceButton isRecording={descVoice.isRecording} isFormatting={descVoice.isFormatting} onClick={descVoice.toggleRecording} tone={descVoice.tone} onToneChange={descVoice.setTone} />
            </div>
            {/* Documents section — only for existing expenses */}
            {editingId && (
              <div className="space-y-2">
                <Label>Documents</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {editDocs.map(doc => (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f7f8fa", borderRadius: 8, padding: "6px 10px" }}>
                      <FileText className="h-4 w-4" style={{ color: "#1a6b9c", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
                      {doc.file_size && <span style={{ fontSize: 10, color: "#8399a9" }}>{(doc.file_size / 1024).toFixed(0)}KB</span>}
                      <button onClick={() => handleDownloadDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 2 }}>
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 2 }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#1a6b9c", fontWeight: 600, marginTop: 4 }}>
                  <Upload className="h-4 w-4" />
                  {uploadingDoc ? "Upload en cours..." : "Ajouter un document"}
                  <input
                    type="file"
                    style={{ display: "none" }}
                    disabled={uploadingDoc}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && editingId) await handleUploadDoc(editingId, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !form.provider_name || !form.amount || !form.period}
              className="w-full"
            >
              {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
