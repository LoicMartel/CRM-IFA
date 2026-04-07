"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";

interface Order {
  id: string;
  client_name: string;
  order_date: string;
  amount: number;
  training_days: number | null;
  is_invoiced: boolean;
  invoice_notes: string | null;
  notes: string | null;
  account_manager_id: string | null;
  source_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  companies: { id: string; name: string } | null;
  contacts: { id: string; first_name: string; last_name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
  lead_sources: { name: string } | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

interface Source {
  id: string;
  name: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
  });
}

export function OrdersTable({
  orders,
  teamMembers,
  sources,
}: {
  orders: Order[];
  teamMembers: TeamMember[];
  sources: Source[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [filterInvoiced, setFilterInvoiced] = useState("all");
  const [periodMode, setPeriodMode] = useState<"fiscal" | "month" | "custom">("fiscal");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("2025-09-01");
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    account_manager_id: "",
    source_id: "",
    order_date: new Date().toISOString().split("T")[0],
    amount: "",
    training_days: "",
    is_invoiced: false,
    invoice_notes: "",
    notes: "",
  });
  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));

  const periodRange = (() => {
    if (periodMode === "fiscal") return { from: "2025-09-01", to: "2026-08-31" };
    if (periodMode === "month") {
      const [y, m] = filterMonth.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return { from: `${filterMonth}-01`, to: `${filterMonth}-${String(lastDay).padStart(2, "0")}` };
    }
    return { from: customFrom, to: customTo };
  })();

  const filtered = orders.filter((o) => {
    if (search && !o.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterManager && o.account_manager_id !== filterManager) return false;
    if (filterInvoiced === "invoiced" && !o.is_invoiced) return false;
    if (filterInvoiced === "pending" && o.is_invoiced) return false;
    const d = o.order_date?.slice(0, 10) ?? "";
    if (d < periodRange.from || d > periodRange.to) return false;
    return true;
  });

  async function handleDeleteOrder(id: string) {
    const supabase = createClient();
    await supabase.from("orders").delete().eq("id", id);
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    await supabase.from("orders").insert({
      client_name: form.client_name,
      account_manager_id: form.account_manager_id || null,
      source_id: form.source_id || null,
      order_date: form.order_date,
      amount: parseFloat(form.amount) || 0,
      training_days: form.training_days ? parseFloat(form.training_days) : null,
      is_invoiced: form.is_invoiced,
      invoice_notes: form.invoice_notes || null,
      notes: form.notes || null,
    });

    setSaving(false);
    setOpen(false);
    setForm({
      client_name: "", account_manager_id: "", source_id: "",
      order_date: new Date().toISOString().split("T")[0],
      amount: "", training_days: "", is_invoiced: false, invoice_notes: "", notes: "",
    });
    router.refresh();
  }

  return (
    <>
      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 8 }}>
        <select
          style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", background: "white", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }}
          value={periodMode}
          onChange={(e) => setPeriodMode(e.target.value as "fiscal" | "month" | "custom")}
        >
          <option value="fiscal">Année fiscale (Sept — Août)</option>
          <option value="month">Par mois</option>
          <option value="custom">Période personnalisée</option>
        </select>
        {periodMode === "month" && (
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ height: 32, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 12, color: "#1a2a3a" }} />
        )}
        {periodMode === "custom" && (
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11, color: "#8399a9" }}>Du</span>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
            <span style={{ fontSize: 11, color: "#8399a9" }}>au</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ height: 32, borderRadius: 6, border: "1px solid #dce8f0", padding: "0 8px", fontSize: 11 }} />
          </div>
        )}
        <span style={{ fontSize: 12, color: "#8399a9" }}>
          {filtered.length} commande{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Cumulé Commandes</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{formatCurrency(filtered.reduce((s, o) => s + (Number(o.amount) || 0), 0))}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Cumulé Jours</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{filtered.reduce((s, o) => s + (Number(o.training_days) || 0), 0).toFixed(1)}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Nb Commandes</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
          </div>
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturées</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{filtered.filter(o => o.is_invoiced).length}/{filtered.length}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-60"
            />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterManager}
            onChange={(e) => setFilterManager(e.target.value)}
          >
            <option value="">Tous les managers</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterInvoiced}
            onChange={(e) => setFilterInvoiced(e.target.value)}
          >
            <option value="all">Toutes</option>
            <option value="invoiced">Facturées</option>
            <option value="pending">Non facturées</option>
          </select>
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={(fmt: ExportFormat) => exportData(
            filtered.map((o) => ({
              client: o.client_name,
              contact: o.contacts ? `${o.contacts.first_name} ${o.contacts.last_name}` : "",
              date: o.order_date ?? "",
              account_manager: o.team_members ? `${o.team_members.first_name} ${o.team_members.last_name}` : "",
              source: (o as any).lead_sources?.name ?? "",
              montant: o.amount,
              jours: o.training_days ?? "",
              facture: o.is_invoiced ? "Oui" : "Non",
              notes_facturation: o.invoice_notes ?? "",
            })),
            [
              { key: "client", label: "Client" }, { key: "contact", label: "Contact" },
              { key: "date", label: "Date" }, { key: "account_manager", label: "Account Manager" },
              { key: "source", label: "Source" }, { key: "montant", label: "Montant" },
              { key: "jours", label: "Jours" }, { key: "facture", label: "Facturé" },
              { key: "notes_facturation", label: "Notes facturation" },
            ],
            "commandes", fmt
          )} />
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle commande
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} commande{filtered.length > 1 ? "s" : ""} sur {orders.length}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Account Manager</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Jours</TableHead>
              <TableHead>Facturé</TableHead>
              <TableHead>Notes facturation</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Aucune commande trouvée
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.company_id ? (
                      <span
                        onClick={() => router.push(`/clients/${order.company_id}`)}
                        style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {order.client_name}
                      </span>
                    ) : order.client_name}
                  </TableCell>
                  <TableCell>
                    {order.contacts ? (
                      <span
                        onClick={() => router.push(`/contacts/${order.contact_id}`)}
                        style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer", fontSize: 13 }}
                      >
                        {order.contacts.first_name} {order.contacts.last_name}
                      </span>
                    ) : <span style={{ color: "#ccc" }}>—</span>}
                  </TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>
                    {order.team_members
                      ? `${order.team_members.first_name} ${order.team_members.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{order.lead_sources?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(order.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.training_days ? Number(order.training_days).toFixed(1) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.is_invoiced ? "default" : "secondary"}>
                      {order.is_invoiced ? "Oui" : "Non"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48">
                    <input
                      type="text"
                      defaultValue={order.invoice_notes ?? ""}
                      placeholder="—"
                      onBlur={async (e) => {
                        const newVal = e.target.value;
                        if (newVal !== (order.invoice_notes ?? "")) {
                          const supabase = createClient();
                          await supabase.from("orders").update({ invoice_notes: newVal || null }).eq("id", order.id);
                          router.refresh();
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      style={{
                        width: "100%", border: "none", background: "transparent",
                        fontSize: 13, color: "#8399a9", padding: "2px 4px",
                        borderBottom: "1px dashed #dce8f0", outline: "none",
                      }}
                      onFocus={(e) => { e.target.style.borderBottom = "1px solid #1a6b9c"; e.target.style.color = "#1a2a3a"; }}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => {
                        if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ? Cette action est irréversible.")) {
                          handleDeleteOrder(order.id);
                        }
                      }}
                      style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nouvelle commande</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Nom du client"
              />
            </div>
            <div className="space-y-2">
              <Label>Date de commande</Label>
              <Input
                type="date"
                value={form.order_date}
                onChange={(e) => setForm({ ...form, order_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Manager</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.account_manager_id}
                onChange={(e) => setForm({ ...form, account_manager_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
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
                <Label>Montant (€) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Jours de formation</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.training_days}
                  onChange={(e) => setForm({ ...form, training_days: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_invoiced}
                onChange={(e) => setForm({ ...form, is_invoiced: e.target.checked })}
                className="rounded border"
              />
              Facturé
            </label>
            <div className="space-y-2">
              <Label>Notes facturation</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.invoice_notes}
                onChange={(e) => setForm({ ...form, invoice_notes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} tone={notesVoice.tone} onToneChange={notesVoice.setTone} />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.client_name.trim() || !form.amount}
              className="w-full"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
