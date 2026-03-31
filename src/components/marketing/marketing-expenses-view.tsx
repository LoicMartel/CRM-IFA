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
import { Plus, Pencil, Trash2, DollarSign, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Expense {
  id: string;
  period_start: string;
  period_end: string;
  provider_name: string;
  amount: number;
  description: string | null;
  created_at: string;
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
    description: "",
  });
  const descVoice = useVoiceDictation(() => form.description, (t) => setForm((f) => ({ ...f, description: t })));

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
  const byProvider: Record<string, number> = {};
  filtered.forEach((e) => { byProvider[e.provider_name] = (byProvider[e.provider_name] ?? 0) + Number(e.amount); });

  function openCreate() {
    setEditingId(null);
    setForm({ period: new Date().toISOString().slice(0, 7), provider_name: "", amount: "", description: "" });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      period: e.period_start.slice(0, 7),
      provider_name: e.provider_name,
      amount: String(e.amount),
      description: e.description ?? "",
    });
    setOpen(true);
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
        {Object.entries(byProvider).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, amount]) => {
          const pc = PROVIDER_COLORS[name] ?? { bg: "#f0f0f0", text: "#666" };
          return (
            <div key={name} className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>{name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: pc.text }}>{fmt(amount)}</div>
              </div>
              <Users style={{ width: 16, height: 16, color: "#8399a9" }} />
            </div>
          );
        })}
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
              description: e.description ?? "",
            })),
            [
              { key: "periode", label: "Période" }, { key: "prestataire", label: "Prestataire" },
              { key: "montant", label: "Montant" }, { key: "description", label: "Description" },
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
              <TableHead>Description</TableHead>
              <TableHead style={{ width: 70 }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{e.description ?? "—"}</TableCell>
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
                <td colSpan={2}></td>
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
              </select>
              {/* Custom provider */}
              {!["Baptiste", "Pauline", "Hugo", "Agence Personnelle", ""].includes(form.provider_name) && (
                <Input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} placeholder="Nom du prestataire" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Montant (EUR) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Détails optionnels..."
              />
              <VoiceButton isRecording={descVoice.isRecording} onClick={descVoice.toggleRecording} />
            </div>
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
