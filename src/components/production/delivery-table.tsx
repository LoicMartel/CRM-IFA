"use client";

import { useState, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";

interface SessionRow {
  id: string;
  week_number: string | null;
  session_date: string;
  company_id: string | null;
  theme_id: string | null;
  delivery_mode: "présentiel" | "distanciel";
  is_billable: boolean;
  attendee_names: string | null;
  session_label: string | null;
  hours_planned: number | null;
  hours_delivered: number | null;
  learners_planned: number | null;
  learners_delivered: number | null;
  hourly_rate: number;
  non_billable_amount: number;
  billable_amount: number;
  trainer_id: string | null;
  notes: string | null;
  companies: { name: string } | null;
  session_themes: {
    name: string;
    is_billable: boolean;
    delivery_mode: string;
  } | null;
  team_members: { first_name: string; last_name: string } | null;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
}

interface CompanyRef {
  id: string;
  name: string;
}

interface ThemeRef {
  id: string;
  name: string;
  is_billable: boolean;
  delivery_mode: string;
  default_hours: number | null;
  default_rate: number;
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
    day: "numeric",
  });
}

export function DeliveryTable({
  sessions,
  trainers,
  companies,
  themes,
}: {
  sessions: SessionRow[];
  trainers: Trainer[];
  companies: CompanyRef[];
  themes: ThemeRef[];
}) {
  const router = useRouter();
  const { isRestrictedExterne } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterTrainer, setFilterTrainer] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterBillable, setFilterBillable] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    week_number: "",
    session_date: new Date().toISOString().split("T")[0],
    company_id: "",
    theme_id: "",
    delivery_mode: "distanciel" as "présentiel" | "distanciel",
    is_billable: true,
    attendee_names: "",
    session_label: "",
    hours_planned: "",
    hours_delivered: "",
    learners_planned: "",
    learners_delivered: "",
    hourly_rate: "250",
    trainer_id: "",
    notes: "",
  });

  const filtered = useMemo(() => {
    let result = sessions.filter((s) => {
      const companyName = s.companies?.name ?? "";
      if (search && !companyName.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterTrainer && s.trainer_id !== filterTrainer) return false;
      if (filterMode && s.delivery_mode !== filterMode) return false;
      if (filterBillable === "yes" && !s.is_billable) return false;
      if (filterBillable === "no" && s.is_billable) return false;
      return true;
    });

    result.sort((a, b) => {
      const dateA = new Date(a.session_date).getTime();
      const dateB = new Date(b.session_date).getTime();
      return sortAsc ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [sessions, search, filterTrainer, filterMode, filterBillable, sortAsc]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const hoursPlanned = form.hours_planned ? parseFloat(form.hours_planned) : null;
    const hoursDelivered = form.hours_delivered ? parseFloat(form.hours_delivered) : null;
    const rate = parseFloat(form.hourly_rate) || 250;
    const billableAmt = form.is_billable && hoursDelivered ? hoursDelivered * rate : 0;
    const nonBillableAmt = !form.is_billable && hoursDelivered ? hoursDelivered * rate : 0;

    await supabase.from("sessions").insert({
      week_number: form.week_number || null,
      session_date: form.session_date,
      company_id: form.company_id || null,
      theme_id: form.theme_id || null,
      delivery_mode: form.delivery_mode,
      is_billable: form.is_billable,
      attendee_names: form.attendee_names || null,
      session_label: form.session_label || null,
      hours_planned: hoursPlanned,
      hours_delivered: hoursDelivered,
      learners_planned: form.learners_planned
        ? parseInt(form.learners_planned)
        : null,
      learners_delivered: form.learners_delivered
        ? parseInt(form.learners_delivered)
        : null,
      hourly_rate: rate,
      non_billable_amount: nonBillableAmt,
      billable_amount: billableAmt,
      trainer_id: form.trainer_id || null,
      notes: form.notes || null,
    });

    setSaving(false);
    setOpen(false);
    setForm({
      week_number: "",
      session_date: new Date().toISOString().split("T")[0],
      company_id: "",
      theme_id: "",
      delivery_mode: "distanciel",
      is_billable: true,
      attendee_names: "",
      session_label: "",
      hours_planned: "",
      hours_delivered: "",
      learners_planned: "",
      learners_delivered: "",
      hourly_rate: "250",
      trainer_id: "",
      notes: "",
    });
    router.refresh();
  }

  return (
    <>
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
            value={filterTrainer}
            onChange={(e) => setFilterTrainer(e.target.value)}
          >
            <option value="">Tous les experts</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
          >
            <option value="">Tous les modes</option>
            <option value="présentiel">Présentiel</option>
            <option value="distanciel">Distanciel</option>
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterBillable}
            onChange={(e) => setFilterBillable(e.target.value)}
          >
            <option value="all">Facturable : Tous</option>
            <option value="yes">Facturable</option>
            <option value="no">Non facturable</option>
          </select>
        </div>
        {!isRestrictedExterne && (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle séance
        </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} séance{filtered.length > 1 ? "s" : ""} sur{" "}
        {sessions.length}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semaine</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1"
                  onClick={() => setSortAsc((v) => !v)}
                >
                  Date
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Thème</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Facturable</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Séance</TableHead>
              <TableHead className="text-right">H prévues</TableHead>
              <TableHead className="text-right">H délivrées</TableHead>
              <TableHead className="text-right">Appr. prévus</TableHead>
              <TableHead className="text-right">Appr. délivrés</TableHead>
              <TableHead className="text-right">Taux</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="text-center text-muted-foreground py-8"
                >
                  Aucune séance trouvée
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((sess) => (
                <TableRow key={sess.id}>
                  <TableCell>{sess.week_number ?? "—"}</TableCell>
                  <TableCell>{formatDate(sess.session_date)}</TableCell>
                  <TableCell className="font-medium">
                    {sess.companies?.name ?? "—"}
                  </TableCell>
                  <TableCell>{sess.session_themes?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sess.delivery_mode === "présentiel"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {sess.delivery_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={sess.is_billable ? "default" : "secondary"}
                    >
                      {sess.is_billable ? "Oui" : "Non"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-32 truncate text-sm">
                    {sess.attendee_names ?? "—"}
                  </TableCell>
                  <TableCell>{sess.session_label ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {sess.hours_planned != null
                      ? Number(sess.hours_planned).toFixed(1)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {sess.hours_delivered != null
                      ? Number(sess.hours_delivered).toFixed(1)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {sess.learners_planned ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {sess.learners_delivered ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(sess.hourly_rate))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {sess.is_billable
                      ? formatCurrency(Number(sess.billable_amount))
                      : formatCurrency(Number(sess.non_billable_amount))}
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
            <SheetTitle>Nouvelle séance</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Semaine</Label>
                <Input
                  value={form.week_number}
                  onChange={(e) =>
                    setForm({ ...form, week_number: e.target.value })
                  }
                  placeholder="Ex: S12"
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.session_date}
                  onChange={(e) =>
                    setForm({ ...form, session_date: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.company_id}
                onChange={(e) =>
                  setForm({ ...form, company_id: e.target.value })
                }
              >
                <option value="">Sélectionner un client</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Thème</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.theme_id}
                onChange={(e) =>
                  setForm({ ...form, theme_id: e.target.value })
                }
              >
                <option value="">Sélectionner un thème</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Mode de livraison</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.delivery_mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delivery_mode: e.target.value as "présentiel" | "distanciel",
                  })
                }
              >
                <option value="distanciel">Distanciel</option>
                <option value="présentiel">Présentiel</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_billable}
                onChange={(e) =>
                  setForm({ ...form, is_billable: e.target.checked })
                }
                className="rounded border"
              />
              Facturable
            </label>
            <div className="space-y-2">
              <Label>Label séance</Label>
              <Input
                value={form.session_label}
                onChange={(e) =>
                  setForm({ ...form, session_label: e.target.value })
                }
                placeholder="Label de la séance"
              />
            </div>
            <div className="space-y-2">
              <Label>Participants (noms)</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.attendee_names}
                onChange={(e) =>
                  setForm({ ...form, attendee_names: e.target.value })
                }
                placeholder="Noms des participants"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heures prévues</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.hours_planned}
                  onChange={(e) =>
                    setForm({ ...form, hours_planned: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Heures délivrées</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.hours_delivered}
                  onChange={(e) =>
                    setForm({ ...form, hours_delivered: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Apprenants prévus</Label>
                <Input
                  type="number"
                  value={form.learners_planned}
                  onChange={(e) =>
                    setForm({ ...form, learners_planned: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Apprenants délivrés</Label>
                <Input
                  type="number"
                  value={form.learners_delivered}
                  onChange={(e) =>
                    setForm({ ...form, learners_delivered: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Taux horaire (€)</Label>
              <Input
                type="number"
                value={form.hourly_rate}
                onChange={(e) =>
                  setForm({ ...form, hourly_rate: e.target.value })
                }
                placeholder="250"
              />
            </div>
            <div className="space-y-2">
              <Label>Expert</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.trainer_id}
                onChange={(e) =>
                  setForm({ ...form, trainer_id: e.target.value })
                }
              >
                <option value="">Sélectionner</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.session_date}
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
