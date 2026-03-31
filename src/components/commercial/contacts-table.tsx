"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentMember } from "@/lib/use-current-member";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { checkContactDuplicate } from "@/lib/duplicate-check";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  is_client: boolean;
  lifecycle_stage: string | null;
  lead_status: string | null;
  last_contacted_at: string | null;
  owner_id: string | null;
  companies: { name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
  contact_type: string | null;
  company_id: string | null;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

const lifecycleColors: Record<string, { bg: string; text: string; label: string }> = {
  prospect: { bg: "#e3f2fd", text: "#1565c0", label: "Prospect" },
  customer: { bg: "#e8f5e9", text: "#2e7d32", label: "Client" },
  former_customer: { bg: "#f0f0f0", text: "#666", label: "Ancien client" },
};

const contactTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  inbound: { bg: "#e8f5e9", text: "#2e7d32", label: "Inbound" },
  outbound: { bg: "#fff3e0", text: "#e65100", label: "Outbound" },
};

const leadStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  lead: { bg: "#f0f0f0", text: "#666", label: "New Not Contacted" },
  contacted: { bg: "#e3f2fd", text: "#1565c0", label: "Contacted" },
  booked: { bg: "#fff3e0", text: "#e65100", label: "Booked" },
  rdv_done: { bg: "#f3e5f5", text: "#6a1b9a", label: "RDV Done" },
  signed: { bg: "#e8f5e9", text: "#2e7d32", label: "Signed" },
};

type SortKey = "name" | "email" | "company" | "lifecycle_stage" | "lead_status" | "last_contacted_at";

interface Source { id: string; name: string; }

export function ContactsTable({
  contacts,
  companies,
  teamMembers = [],
  sources = [],
}: {
  contacts: Contact[];
  companies: Company[];
  teamMembers?: TeamMember[];
  sources?: Source[];
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const { isRestrictedExterne, isReadOnly, onlyOwnData, memberId: roleMemberId } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterLeadStatus, setFilterLeadStatus] = useState("");
  const [filterLifecycle, setFilterLifecycle] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterCreatedFrom, setFilterCreatedFrom] = useState("");
  const [filterCreatedTo, setFilterCreatedTo] = useState("");
  const [filterLastActionFrom, setFilterLastActionFrom] = useState("");
  const [filterLastActionTo, setFilterLastActionTo] = useState("");
  const [contactTypeTab, setContactTypeTab] = useState<"all" | "inbound" | "outbound">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", position: "",
    company_id: "", is_client: false, notes: "", lifecycle_stage: "prospect",
    lead_status: "lead", linkedin_url: "", contact_type: "", source_id: "",
  });
  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));

  const filtered = contacts
    .filter((c) => {
      if (onlyOwnData && roleMemberId && c.owner_id !== roleMemberId) return false;
      if (contactTypeTab !== "all" && c.contact_type !== contactTypeTab) return false;
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      if (search && !fullName.includes(search.toLowerCase()) && !(c.email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterLifecycle && c.lifecycle_stage !== filterLifecycle) return false;
      if (filterLeadStatus && c.lead_status !== filterLeadStatus) return false;
      if (filterOwner && c.owner_id !== filterOwner) return false;
      if (filterCreatedFrom && c.created_at < filterCreatedFrom) return false;
      if (filterCreatedTo && c.created_at > filterCreatedTo + "T23:59:59") return false;
      if (filterLastActionFrom && (!c.last_contacted_at || c.last_contacted_at < filterLastActionFrom)) return false;
      if (filterLastActionTo && (!c.last_contacted_at || c.last_contacted_at > filterLastActionTo + "T23:59:59")) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`); break;
        case "email": cmp = (a.email ?? "").localeCompare(b.email ?? ""); break;
        case "company": cmp = (a.companies?.name ?? "").localeCompare(b.companies?.name ?? ""); break;
        case "lifecycle_stage": cmp = (a.lifecycle_stage ?? "").localeCompare(b.lifecycle_stage ?? ""); break;
        case "lead_status": cmp = (a.lead_status ?? "").localeCompare(b.lead_status ?? ""); break;
        case "last_contacted_at": cmp = (a.last_contacted_at ?? "").localeCompare(b.last_contacted_at ?? ""); break;
      }
      return sortAsc ? cmp : -cmp;
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    // Duplicate check
    if (form.email) {
      const dup = await checkContactDuplicate(form.email);
      if (dup.isDuplicate) {
        if (!window.confirm(`⚠ Doublon détecté !\n\n${dup.message}\n\nVoulez-vous quand même créer ce contact ?`)) {
          setSaving(false);
          return;
        }
      }
    }
    const supabase = createClient();
    await supabase.from("contacts").insert({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      position: form.position || null,
      company_id: form.company_id || null,
      is_client: form.is_client,
      notes: form.notes || null,
      lifecycle_stage: form.lifecycle_stage || "lead",
      lead_status: form.lead_status || "new",
      contact_type: form.contact_type || null,
      linkedin_url: form.linkedin_url || null,
      source_id: form.source_id || null,
      owner_id: currentMemberId || null,
    });
    setSaving(false);
    setOpen(false);
    setForm({
      first_name: "", last_name: "", email: "", phone: "", position: "",
      company_id: "", is_client: false, notes: "", lifecycle_stage: "prospect",
      lead_status: "lead", linkedin_url: "", contact_type: "", source_id: "",
    });
    router.refresh();
  }

  function formatDate(d: string | null): string {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd MMM yyyy", { locale: fr });
    } catch {
      return "—";
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {(["all", "inbound", "outbound"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setContactTypeTab(tab)}
            style={{
              height: 36, borderRadius: 8, padding: "0 20px", fontSize: 14,
              fontWeight: contactTypeTab === tab ? 700 : 500,
              border: `1px solid ${contactTypeTab === tab ? "#1a6b9c" : "#dce8f0"}`,
              background: contactTypeTab === tab ? "#1a6b9c" : "white",
              color: contactTypeTab === tab ? "white" : "#5a6f80",
              cursor: "pointer",
            }}
          >
            {tab === "all" ? "Tous les contacts" : tab === "inbound" ? "Inbound" : "Outbound"}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher nom ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterLifecycle}
            onChange={(e) => setFilterLifecycle(e.target.value)}
          >
            <option value="">Tous les cycles</option>
            {Object.entries(lifecycleColors).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterLeadStatus}
            onChange={(e) => setFilterLeadStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(leadStatusColors).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          {teamMembers.length > 0 && (
            <select
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="">Tous les propriétaires</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={(fmt: ExportFormat) => exportData(
            filtered.map((c) => ({
              nom: `${c.first_name} ${c.last_name}`,
              email: c.email ?? "",
              telephone: c.phone ?? "",
              entreprise: c.companies?.name ?? "",
              cycle: c.lifecycle_stage ?? "",
              statut: c.lead_status ?? "",
              type: c.contact_type ?? "",
              dernier_contact: c.last_contacted_at ?? "",
              proprietaire: c.team_members ? `${c.team_members.first_name} ${c.team_members.last_name}` : "",
            })),
            [
              { key: "nom", label: "Nom" }, { key: "email", label: "Email" },
              { key: "telephone", label: "Téléphone" }, { key: "entreprise", label: "Entreprise" },
              { key: "cycle", label: "Cycle" }, { key: "statut", label: "Statut" },
              { key: "type", label: "Type" }, { key: "dernier_contact", label: "Dernier contact" },
              { key: "proprietaire", label: "Propriétaire" },
            ],
            "contacts", fmt
          )} />
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau contact
          </Button>
        </div>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: "#8399a9", whiteSpace: "nowrap" }}>Créé du</span>
          <Input type="date" value={filterCreatedFrom} onChange={(e) => setFilterCreatedFrom(e.target.value)} className="w-36 h-8 text-xs" />
          <span style={{ fontSize: 11, color: "#8399a9" }}>au</span>
          <Input type="date" value={filterCreatedTo} onChange={(e) => setFilterCreatedTo(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: "#8399a9", whiteSpace: "nowrap" }}>Dernière action du</span>
          <Input type="date" value={filterLastActionFrom} onChange={(e) => setFilterLastActionFrom(e.target.value)} className="w-36 h-8 text-xs" />
          <span style={{ fontSize: 11, color: "#8399a9" }}>au</span>
          <Input type="date" value={filterLastActionTo} onChange={(e) => setFilterLastActionTo(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        {(filterCreatedFrom || filterCreatedTo || filterLastActionFrom || filterLastActionTo) && (
          <button
            onClick={() => { setFilterCreatedFrom(""); setFilterCreatedTo(""); setFilterLastActionFrom(""); setFilterLastActionTo(""); }}
            style={{ fontSize: 11, color: "#e74c3c", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Réinitialiser dates
          </button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">Nom complet <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("email")}>
                <span className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("company")}>
                <span className="flex items-center gap-1">Entreprise <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("lifecycle_stage")}>
                <span className="flex items-center gap-1">Cycle <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("lead_status")}>
                <span className="flex items-center gap-1">Statut <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("last_contacted_at")}>
                <span className="flex items-center gap-1">Dernier contact <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Propriétaire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aucun contact trouvé
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const lc = lifecycleColors[c.lifecycle_stage ?? ""] ?? null;
                const ls = leadStatusColors[c.lead_status ?? ""] ?? null;
                const ct = contactTypeColors[c.contact_type ?? ""] ?? null;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/contacts/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{formatPhone(c.phone)}</TableCell>
                    <TableCell>{c.companies?.name ?? "—"}</TableCell>
                    <TableCell>
                      {lc ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: lc.bg, color: lc.text }}
                        >
                          {lc.label}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {ls ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: ls.bg, color: ls.text }}
                        >
                          {ls.label}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{formatDate(c.last_contacted_at)}</TableCell>
                    <TableCell>
                      {ct ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: ct.bg, color: ct.text }}
                        >
                          {ct.label}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.team_members ? (
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 28, height: 28, borderRadius: "50%",
                            background: "#0d4f7a", color: "white",
                            fontSize: 10, fontWeight: 700,
                          }}
                          title={`${c.team_members.first_name} ${c.team_members.last_name}`}
                        >
                          {c.team_members.first_name[0]}{c.team_members.last_name[0]}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nouveau contact</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="space-y-2">
              <Label>Type de contact *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.contact_type}
                onChange={(e) => setForm({ ...form, contact_type: e.target.value })}
              >
                <option value="">Sélectionner *</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email{form.contact_type === "inbound" || form.contact_type === "outbound" ? " *" : ""}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone{form.contact_type === "inbound" ? " *" : ""}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Entreprise{form.contact_type === "outbound" ? " *" : ""}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.company_id}
                onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                <Label>Cycle</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.lifecycle_stage}
                  onChange={(e) => setForm({ ...form, lifecycle_stage: e.target.value })}
                >
                  {Object.entries(lifecycleColors).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.lead_status}
                  onChange={(e) => setForm({ ...form, lead_status: e.target.value })}
                >
                  {Object.entries(leadStatusColors).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_client}
                onChange={(e) => setForm({ ...form, is_client: e.target.checked })}
                className="rounded border"
              />
              Client actif
            </label>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <VoiceButton isRecording={notesVoice.isRecording} onClick={notesVoice.toggleRecording} />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.first_name.trim() || !form.last_name.trim() || !form.contact_type
                || (form.contact_type === "inbound" && (!form.email.trim() || !form.phone.trim()))
                || (form.contact_type === "outbound" && (!form.email.trim() || !form.company_id))}
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
