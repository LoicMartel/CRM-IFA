"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { RichNotes } from "@/components/ui/rich-notes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Video, Phone, MapPin, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { MEETING_TYPE_LABELS, MEETING_STATUS_LABELS } from "@/types/database";
import type { MeetingType, MeetingStatus, MeetingMode } from "@/types/database";

interface Meeting {
  id: string;
  meeting_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_mode: string;
  notes: string | null;
  outcome: string | null;
  next_step: string | null;
  assigned_to: string | null;
  contact_id: string | null;
  company_id: string | null;
  contacts: { first_name: string; last_name: string } | null;
  companies: { name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
}

interface Ref { id: string; first_name?: string; last_name?: string; name?: string; }

const typeColors: Record<string, { bg: string; text: string }> = {
  R0: { bg: "#e3f2fd", text: "#1565c0" },
  R1: { bg: "#fff3e0", text: "#e65100" },
  R2: { bg: "#f3e5f5", text: "#6a1b9a" },
  R3: { bg: "#fce4ec", text: "#c62828" },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  booked: { bg: "#e3f2fd", text: "#1565c0" },
  done: { bg: "#e8f5e9", text: "#2e7d32" },
  no_show: { bg: "#fce4ec", text: "#c62828" },
  cancelled: { bg: "#f0f0f0", text: "#666" },
};

const modeIcons: Record<string, typeof Video> = {
  visio: Video,
  phone: Phone,
  in_person: MapPin,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MeetingsView({
  meetings, teamMembers, contacts, companies,
}: {
  meetings: Meeting[];
  teamMembers: Ref[];
  contacts: Ref[];
  companies: Ref[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    meeting_type: "R0" as MeetingType,
    status: "booked" as MeetingStatus,
    contact_id: "",
    company_id: "",
    assigned_to: "",
    scheduled_at: "",
    duration_minutes: "60",
    meeting_mode: "visio" as MeetingMode,
    location: "",
    notes: "",
  });
  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));

  const filtered = meetings.filter((m) => {
    const contactName = m.contacts ? `${m.contacts.first_name} ${m.contacts.last_name}`.toLowerCase() : "";
    const companyName = m.companies?.name?.toLowerCase() ?? "";
    if (search && !contactName.includes(search.toLowerCase()) && !companyName.includes(search.toLowerCase())) return false;
    if (filterType && m.meeting_type !== filterType) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    return true;
  });

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: newMeeting } = await supabase.from("meetings").insert({
      meeting_type: form.meeting_type,
      status: form.status,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      assigned_to: form.assigned_to || null,
      scheduled_at: form.scheduled_at || new Date().toISOString(),
      duration_minutes: parseInt(form.duration_minutes) || 60,
      meeting_mode: form.meeting_mode,
      location: form.location || null,
      notes: form.notes || null,
    }).select("id").single();

    // Auto-notify: Google Calendar + Slack/Email
    if (newMeeting?.id && form.status === "booked") {
      try {
        await fetch("/api/meetings/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId: newMeeting.id }),
        });
      } catch {}
    }

    setSaving(false);
    setOpen(false);
    setForm({ meeting_type: "R0", status: "booked", contact_id: "", company_id: "", assigned_to: "", scheduled_at: "", duration_minutes: "60", meeting_mode: "visio", location: "", notes: "" });
    router.refresh();
  }

  async function handleDeleteMeeting(id: string) {
    const supabase = createClient();
    await supabase.from("meetings").delete().eq("id", id);
    router.refresh();
  }

  async function updateStatus(id: string, newStatus: MeetingStatus) {
    const supabase = createClient();
    await supabase.from("meetings").update({ status: newStatus }).eq("id", id);

    // No-show: update contact lead_status + send email
    if (newStatus === "no_show") {
      const meeting = meetings.find(m => m.id === id);
      const contactId = (meeting as any)?.contact_id;
      if (contactId) {
        await supabase.from("contacts").update({ lead_status: "no_show" }).eq("id", contactId);
        fetch("/api/meetings/no-show-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        }).catch(() => {});
      }
    }

    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher contact ou entreprise..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          <select className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(MEETING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Button onClick={() => setOpen(true)} style={{ background: "#e8632b", color: "white" }}>
          <Plus className="h-4 w-4 mr-2" /> Nouveau RDV
        </Button>
      </div>

      <div style={{ fontSize: 13, color: "#7a8bab" }}>
        {filtered.length} rendez-vous sur {meetings.length}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Date & Heure</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8" style={{ color: "#7a8bab" }}>
                  Aucun rendez-vous trouvé
                </TableCell>
              </TableRow>
            ) : filtered.map((m) => {
              const tc = typeColors[m.meeting_type] ?? { bg: "#f0f0f0", text: "#666" };
              const sc = statusColors[m.status] ?? { bg: "#f0f0f0", text: "#666" };
              const ModeIcon = modeIcons[m.meeting_mode] ?? Video;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <span style={{ background: tc.bg, color: tc.text, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {MEETING_TYPE_LABELS[m.meeting_type as MeetingType] ?? m.meeting_type}
                    </span>
                  </TableCell>
                  <TableCell style={{ fontSize: 13 }}>{fmtDate(m.scheduled_at)}</TableCell>
                  <TableCell className="font-medium">
                    {m.contacts && m.contact_id ? (
                      <span
                        onClick={() => router.push(`/contacts/${m.contact_id}`)}
                        style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {m.contacts.first_name} {m.contacts.last_name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {m.companies && m.company_id ? (
                      <span
                        onClick={() => router.push(`/clients/${m.company_id}`)}
                        style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {m.companies.name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <ModeIcon style={{ width: 16, height: 16, color: "#7a8bab" }} />
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: "#7a8bab" }}>
                    {m.team_members ? `${m.team_members.first_name} ${m.team_members.last_name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span style={{ background: sc.bg, color: sc.text, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                      {MEETING_STATUS_LABELS[m.status as MeetingStatus] ?? m.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {m.status === "booked" && (
                        <>
                          <button onClick={() => updateStatus(m.id, "done")} style={{ background: "#e8f5e9", color: "#2e7d32", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            Done
                          </button>
                          <button onClick={() => updateStatus(m.id, "no_show")} style={{ background: "#fce4ec", color: "#c62828", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            No show
                          </button>
                          <button onClick={() => updateStatus(m.id, "cancelled")} style={{ background: "#f0f0f0", color: "#666", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            Annuler
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ? Cette action est irréversible.")) {
                            handleDeleteMeeting(m.id);
                          }
                        }}
                        style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* New Meeting Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nouveau rendez-vous</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Type de RDV *</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.meeting_type} onChange={(e) => setForm({ ...form, meeting_type: e.target.value as MeetingType })}>
                {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
                <option value="">Sélectionner</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                <option value="">Sélectionner</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Propriétaire</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">Sélectionner</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Heure *</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1h</option>
                  <option value="90">1h30</option>
                  <option value="120">2h</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.meeting_mode} onChange={(e) => setForm({ ...form, meeting_mode: e.target.value as MeetingMode })}>
                <option value="visio">Visio</option>
                <option value="phone">Téléphone</option>
                <option value="in_person">En personne</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Lieu / Lien</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lien Zoom, adresse..." />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MeetingStatus })}>
                {Object.entries(MEETING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <RichNotes value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Objectifs du RDV, points clés..." storageFolder="meetings" />
              <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} tone={notesVoice.tone} onToneChange={notesVoice.setTone} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.scheduled_at} className="w-full" style={{ background: "#e8632b", color: "white" }}>
              {saving ? "Enregistrement..." : "Créer le RDV"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
