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
import { Plus, Send, Search, Eye, Mail, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  from_name: string;
  from_email: string;
  html_content: string;
  status: string;
  list_id: string | null;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
  contact_lists: { name: string } | null;
}

interface ContactList {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface RecipientStats {
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "#f0f0f0", text: "#666", label: "Brouillon" },
  sending: { bg: "#fff3e0", text: "#e65100", label: "Envoi en cours..." },
  sent: { bg: "#e8f5e9", text: "#2e7d32", label: "Envoyée" },
};

function fmtPct(n: number, d: number) {
  if (d === 0) return "0 %";
  return ((n / d) * 100).toFixed(1) + " %";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
}

export function CampaignsListView({
  campaigns,
  contactLists,
  contacts,
  recipientStats,
}: {
  campaigns: Campaign[];
  contactLists: ContactList[];
  contacts: Contact[];
  recipientStats: Record<string, RecipientStats>;
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    from_name: "IFA Formation",
    from_email: "contact@ifagroupe.com",
    html_content: "",
    list_id: "",
  });

  const filtered = campaigns.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q);
  });

  // KPIs
  const sentCampaigns = campaigns.filter((c) => c.status === "sent").length;
  const totalSent = Object.values(recipientStats).reduce((a, s) => a + s.total, 0);
  const totalOpened = Object.values(recipientStats).reduce((a, s) => a + s.opened, 0);
  const totalClicked = Object.values(recipientStats).reduce((a, s) => a + s.clicked, 0);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const { data: campaign } = await supabase.from("marketing_campaigns").insert({
      name: form.name,
      subject: form.subject,
      from_name: form.from_name,
      from_email: form.from_email,
      html_content: form.html_content,
      list_id: form.list_id || null,
      created_by: currentMemberId || null,
    }).select("id").single();

    // If a list is selected, add all its members as recipients
    if (form.list_id && campaign) {
      const { data: members } = await supabase
        .from("contact_list_members")
        .select("contact_id, contacts(email)")
        .eq("list_id", form.list_id);

      if (members && members.length > 0) {
        const recipients = members
          .filter((m: any) => m.contacts?.email)
          .map((m: any) => ({
            campaign_id: campaign.id,
            contact_id: m.contact_id,
            email: m.contacts.email,
          }));
        if (recipients.length > 0) {
          await supabase.from("campaign_recipients").insert(recipients);
        }
      }
    }

    setSaving(false);
    setOpen(false);
    setForm({ name: "", subject: "", from_name: "IFA Formation", from_email: "contact@ifagroupe.com", html_content: "", list_id: "" });
    router.refresh();
  }

  async function handleSend(campaignId: string) {
    if (!window.confirm("Envoyer cette campagne ? Cette action est irréversible.")) return;
    setSending(campaignId);
    try {
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erreur lors de l'envoi");
      } else {
        alert(`Campagne envoyée : ${data.sent}/${data.total} emails envoyés`);
      }
    } catch {
      alert("Erreur réseau");
    }
    setSending(null);
    router.refresh();
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Campagnes envoyées</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{sentCampaigns}</div>
          </div>
          <Mail style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total envoyés</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1E2A5A" }}>{totalSent}</div>
          </div>
          <Send style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taux d'ouverture</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmtPct(totalOpened, totalSent)}</div>
          </div>
          <Eye style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taux de clic</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{fmtPct(totalClicked, totalSent)}</div>
          </div>
          <FileText style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une campagne..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/marketing/listes")}>
            Gérer les listes
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle campagne
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Liste</TableHead>
              <TableHead style={{ textAlign: "center" }}>Statut</TableHead>
              <TableHead style={{ textAlign: "right" }}>Envoyés</TableHead>
              <TableHead style={{ textAlign: "right" }}>Remis</TableHead>
              <TableHead style={{ textAlign: "right" }}>Taux ouverture</TableHead>
              <TableHead style={{ textAlign: "right" }}>Taux clic</TableHead>
              <TableHead>Date d'envoi</TableHead>
              <TableHead style={{ width: 100 }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Aucune campagne
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const s = recipientStats[c.id] ?? { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
                const sc = statusColors[c.status] ?? statusColors.draft;
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/marketing/campagnes/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{c.subject}</TableCell>
                    <TableCell>{c.contact_lists?.name ?? "—"}</TableCell>
                    <TableCell style={{ textAlign: "center" }}>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.total}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>{s.delivered}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: "#27ae60" }}>{fmtPct(s.opened, s.total)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 600, color: "#e65100" }}>{fmtPct(s.clicked, s.total)}</TableCell>
                    <TableCell style={{ fontSize: 13 }}>{fmtDate(c.sent_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {c.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(c.id)}
                          disabled={sending === c.id}
                          style={{ background: "#27ae60", fontSize: 12 }}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {sending === c.id ? "..." : "Envoyer"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create campaign sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nouvelle campagne</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="space-y-2">
              <Label>Nom de la campagne *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Réforme CPF Mars 2026" />
            </div>
            <div className="space-y-2">
              <Label>Objet de l'email *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex: CPF plafonné, CA en chute..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom expéditeur</Label>
                <Input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email expéditeur</Label>
                <Input value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Liste de contacts *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.list_id}
                onChange={(e) => setForm({ ...form, list_id: e.target.value })}
              >
                <option value="">Sélectionner une liste</option>
                {contactLists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {contactLists.length === 0 && (
                <p style={{ fontSize: 11, color: "#e65100" }}>
                  Aucune liste de contacts. Créez-en une depuis "Gérer les listes".
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Contenu HTML de l'email *</Label>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                value={form.html_content}
                onChange={(e) => setForm({ ...form, html_content: e.target.value })}
                placeholder="<h1>Bonjour,</h1><p>Votre contenu ici...</p>"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.subject.trim() || !form.html_content.trim() || !form.list_id}
              className="w-full"
            >
              {saving ? "Création..." : "Créer la campagne (brouillon)"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
