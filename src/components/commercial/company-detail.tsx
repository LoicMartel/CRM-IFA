"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Mail, Phone, Globe, MapPin, Edit, Briefcase, Linkedin,
  ExternalLink, Users, GraduationCap, Receipt, CalendarCheck, Handshake,
  CreditCard, Video, PhoneCall, MapPinIcon, Clock, Trash2, ArrowLeft,
  X, Upload, FileText, Download, Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MEETING_TYPE_LABELS, MEETING_STATUS_LABELS, DEAL_STAGE_LABELS,
  COMPANY_LIFECYCLE_LABELS,
} from "@/types/database";
import type { MeetingType, MeetingStatus, DealStage, CompanyLifecycle } from "@/types/database";

/* ---- Helpers ---- */

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: fr }); } catch { return "—"; }
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "EEE dd MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
}

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return <span style={{ background: bg, color: text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>;
}

const lifecycleColors: Record<string, { bg: string; text: string }> = {
  lead: { bg: "#f0f0f0", text: "#666" }, prospect: { bg: "#e3f2fd", text: "#1565c0" },
  customer: { bg: "#e8f5e9", text: "#2e7d32" }, partner: { bg: "#f3e5f5", text: "#6a1b9a" },
  former_customer: { bg: "#fce4ec", text: "#c62828" },
};

const contactLifecycle: Record<string, { bg: string; text: string; label: string }> = {
  lead: { bg: "#f0f0f0", text: "#666", label: "Lead" }, mql: { bg: "#e3f2fd", text: "#1565c0", label: "MQL" },
  sql: { bg: "#fff3e0", text: "#e65100", label: "SQL" }, opportunity: { bg: "#fce4ec", text: "#c62828", label: "Opportunité" },
  customer: { bg: "#e8f5e9", text: "#2e7d32", label: "Client" },
};

const typeColors: Record<string, { bg: string; text: string }> = {
  R0: { bg: "#e3f2fd", text: "#1565c0" }, R1: { bg: "#fff3e0", text: "#e65100" },
  R2: { bg: "#f3e5f5", text: "#6a1b9a" }, R3: { bg: "#fce4ec", text: "#c62828" },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  booked: { bg: "#e3f2fd", text: "#1565c0" }, done: { bg: "#e8f5e9", text: "#2e7d32" },
  no_show: { bg: "#fce4ec", text: "#c62828" }, cancelled: { bg: "#f0f0f0", text: "#666" },
};

const stageColors: Record<string, { bg: string; text: string }> = {
  opportunities: { bg: "#e3f2fd", text: "#1565c0" }, quote_to_send: { bg: "#fff3e0", text: "#e65100" },
  quote_sent: { bg: "#f3e5f5", text: "#6a1b9a" }, opco_deposit: { bg: "#e8f0fe", text: "#0d4f7a" },
  ordered: { bg: "#e8f5e9", text: "#2e7d32" }, closed_won: { bg: "#e8f5e9", text: "#2e7d32" },
  closed_lost: { bg: "#fce4ec", text: "#c62828" },
};

const learnerStatus: Record<string, { bg: string; text: string; label: string }> = {
  actuel: { bg: "#e8f5e9", text: "#2e7d32", label: "Actuel" },
  ancien: { bg: "#f0f0f0", text: "#666", label: "Ancien" },
  futur: { bg: "#e3f2fd", text: "#1565c0", label: "Futur" },
};

/* ---- Types ---- */

type R = Record<string, unknown>;

interface Props {
  company: R;
  contacts: R[];
  deals: R[];
  activities: R[];
  meetings: R[];
  orders: R[];
  invoices: R[];
  sessions: R[];
  learners: R[];
  companyTypes: R[];
  teamMembers: R[];
}

/* ---- Component ---- */

export function CompanyDetail({
  company, contacts, deals, activities, meetings, orders, invoices, sessions, learners, companyTypes, teamMembers,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deal popup state
  const [selectedDeal, setSelectedDeal] = useState<Record<string, unknown> | null>(null);
  const [dealInvoices, setDealInvoices] = useState<{ id: string; amount: number; month: string; status: string }[]>([]);
  const [dealDocuments, setDealDocuments] = useState<{ id: string; name: string; file_path: string; file_size: number | null; document_type: string; created_at: string }[]>([]);
  const [loadingDealData, setLoadingDealData] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState("devis");

  const DOC_TYPE_LABELS: Record<string, string> = { devis: "Devis", convention: "Convention", programme: "Programme", convocation: "Convocation", facture: "Facture", emargements: "Émargements", bilan_initial: "Bilan initial", bilan_intermediaire: "Bilan intermédiaire", bilan_final: "Bilan final", autre: "Autre" };
  const DOC_TYPE_COLORS: Record<string, { bg: string; text: string }> = { devis: { bg: "#fff3e0", text: "#e65100" }, convention: { bg: "#e8f0fe", text: "#0d4f7a" }, programme: { bg: "#e8f5e9", text: "#2e7d32" }, convocation: { bg: "#f3e5f5", text: "#6a1b9a" }, facture: { bg: "#fce4ec", text: "#c62828" }, emargements: { bg: "#e0f2f1", text: "#00695c" }, bilan_initial: { bg: "#e3f2fd", text: "#1565c0" }, bilan_intermediaire: { bg: "#fff8e1", text: "#f57f17" }, bilan_final: { bg: "#fce4ec", text: "#ad1457" }, autre: { bg: "#f5f5f5", text: "#555" } };
  const INVOICE_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = { facturable: { label: "Facturable", bg: "#fff3e0", text: "#e65100" }, facture: { label: "Facturé", bg: "#e8f0fe", text: "#0d4f7a" }, paye: { label: "Payé", bg: "#e8f5e9", text: "#2e7d32" } };

  async function openDealPopup(deal: Record<string, unknown>) {
    setSelectedDeal(deal);
    setLoadingDealData(true);
    const supabase = createClient();
    const [{ data: invs }, { data: docs }] = await Promise.all([
      supabase.from("invoices").select("id, amount, month, status").eq("deal_id", s(deal.id)).order("month", { ascending: false }),
      supabase.from("deal_documents").select("*").eq("deal_id", s(deal.id)).order("created_at", { ascending: false }),
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
    const path = `${s(selectedDeal.id)}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("deal-documents").upload(path, file);
    if (!error) {
      await supabase.from("deal_documents").insert({ deal_id: s(selectedDeal.id), name: file.name, file_path: path, file_size: file.size, file_type: file.type, document_type: docType });
      const { data: docs } = await supabase.from("deal_documents").select("*").eq("deal_id", s(selectedDeal.id)).order("created_at", { ascending: false });
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

  async function handleDeleteDealDoc(doc: { id: string; file_path: string }) {
    if (!confirm(`Supprimer "${doc.file_path.split("/").pop()}" ?`)) return;
    const supabase = createClient();
    await supabase.storage.from("deal-documents").remove([doc.file_path]);
    await supabase.from("deal_documents").delete().eq("id", doc.id);
    setDealDocuments(prev => prev.filter(d => d.id !== doc.id));
  }

  const [form, setForm] = useState({
    name: s(company.name), company_type_id: s(company.company_type_id),
    phone: s(company.phone), email: s(company.email),
    address: s(company.address), city: s(company.city),
    website: s(company.website), notes: s(company.notes),
    industry: s(company.industry), lifecycle_stage: s(company.lifecycle_stage) || "prospect",
    employee_count: s(company.employee_count), annual_revenue: s(company.annual_revenue),
    linkedin_url: s(company.linkedin_url), siret: s(company.siret), opco: s(company.opco),
    owner_id: s(company.owner_id), primary_contact_id: s(company.primary_contact_id),
  });

  async function handleDelete() {
    const supabase = createClient();
    await supabase.from("companies").delete().eq("id", company.id as string);
    router.push("/companies");
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("companies").update({
      name: form.name, company_type_id: form.company_type_id || null,
      phone: form.phone || null, email: form.email || null,
      address: form.address || null, city: form.city || null,
      website: form.website || null, notes: form.notes || null,
      industry: form.industry || null, lifecycle_stage: form.lifecycle_stage || "prospect",
      employee_count: form.employee_count || null, annual_revenue: form.annual_revenue || null,
      linkedin_url: form.linkedin_url || null, siret: form.siret || null, opco: form.opco || null, owner_id: form.owner_id || null, primary_contact_id: form.primary_contact_id || null,
    }).eq("id", company.id as string);
    setSaving(false);
    setEditOpen(false);
    router.refresh();
  }

  const lc = lifecycleColors[s(company.lifecycle_stage)] ?? { bg: "#f0f0f0", text: "#666" };
  const ct = company.company_types as { name: string } | null;
  const totalOrders = orders.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
  const totalInvoiced = invoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const totalSessions = sessions.length;
  const totalHours = sessions.reduce((acc, s) => acc + (Number(s.hours_delivered) || 0), 0);

  return (
    <div className="p-6">
      <div style={{ marginBottom: 16 }}>
        <Button variant="ghost" onClick={() => router.push("/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux entreprises
        </Button>
      </div>

      {/* ===== Summary Cards ===== */}
      <div className="grid gap-3 md:grid-cols-5" style={{ marginBottom: 24 }}>
        <SummaryCard icon={Users} color="#2d7dd2" label="Contacts" value={String(contacts.length)} />
        <SummaryCard icon={Handshake} color="#e8632b" label="Deals" value={String(deals.length)} />
        <SummaryCard icon={CreditCard} color="#27ae60" label="Commandes" value={fmt(totalOrders)} />
        <SummaryCard icon={Receipt} color="#6a1b9a" label="Facturé" value={fmt(totalInvoiced)} />
        <SummaryCard icon={GraduationCap} color="#1565c0" label="Sessions" value={`${totalSessions} (${totalHours.toFixed(0)}h)`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ===== Left: Company Info ===== */}
        <div className="space-y-4">
          {/* Identity Card */}
          <div className="lca-card" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: "#1b2a4a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 style={{ width: 24, height: 24, color: "white" }} />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit className="h-3 w-3 mr-1" /> Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Supprimer cette entreprise ? Cette action est irréversible.")) {
                      handleDelete();
                    }
                  }}
                  style={{ color: "#e74c3c" }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1b2a4a" }}>{s(company.name)}</h2>
            {ct && <p style={{ fontSize: 13, color: "#7a8bab" }}>{ct.name}</p>}
            {s(company.industry) && <p style={{ fontSize: 13, color: "#7a8bab" }}>{s(company.industry)}</p>}

            <div style={{ marginTop: 10 }}>
              <Badge bg={lc.bg} text={lc.text} label={COMPANY_LIFECYCLE_LABELS[s(company.lifecycle_stage) as CompanyLifecycle] ?? "Lead"} />
            </div>

            <Separator style={{ margin: "16px 0" }} />

            {/* Coordonnées */}
            <div className="space-y-3">
              <InfoRow icon={Phone} label="Téléphone" value={formatPhone(s(company.phone) || null)} />
              <InfoRow icon={Mail} label="Email" value={s(company.email)} href={s(company.email) ? `mailto:${s(company.email)}` : undefined} />
              <InfoRow icon={MapPin} label="Adresse" value={[s(company.address), s(company.city), s(company.country)].filter(Boolean).join(", ")} />
              <InfoRow icon={Globe} label="Site web" value={s(company.website)} href={s(company.website) ? (s(company.website).startsWith("http") ? s(company.website) : `https://${s(company.website)}`) : undefined} external />
              <InfoRow icon={Linkedin} label="LinkedIn" value={s(company.linkedin_url) ? "Voir le profil" : ""} href={s(company.linkedin_url) || undefined} external />
              <InfoRow icon={Briefcase} label="SIRET" value={s(company.siret)} mono />
              <InfoRow icon={Receipt} label="OPCO" value={s(company.opco)} />
              {/* Contact principal */}
              <div className="flex items-start gap-3">
                <Users style={{ width: 14, height: 14, color: "#8399a9", marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, color: "#8399a9", display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>Contact principal</span>
                  {(() => {
                    const pcId = s(company.primary_contact_id);
                    const pc = contacts.find((c) => s(c.id) === pcId);
                    if (pc) {
                      return (
                        <span
                          style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                          onClick={() => router.push(`/contacts/${s(pc.id)}`)}
                        >
                          {s(pc.first_name)} {s(pc.last_name)}
                        </span>
                      );
                    }
                    return (
                      <select
                        style={{ width: "100%", height: 30, borderRadius: 6, border: "1px solid #dce8f0", background: "white", padding: "0 8px", fontSize: 12, color: "#1a2a3a", marginTop: 2 }}
                        value=""
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          const supabase = createClient();
                          await supabase.from("companies").update({ primary_contact_id: e.target.value }).eq("id", s(company.id));
                          router.refresh();
                        }}
                      >
                        <option value="">Choisir...</option>
                        {contacts.map((c) => (
                          <option key={s(c.id)} value={s(c.id)}>{s(c.first_name)} {s(c.last_name)}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>
            </div>

            <Separator style={{ margin: "16px 0" }} />

            {/* Métriques */}
            <div className="grid grid-cols-2 gap-3">
              <MetricBox label="Employés" value={s(company.employee_count) || "—"} />
              <MetricBox label="CA annuel" value={company.annual_revenue ? fmt(Number(company.annual_revenue)) : "—"} />
            </div>

            <Separator style={{ margin: "16px 0" }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Propriétaire</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>
                {(company.team_members as { first_name: string; last_name: string } | null)
                  ? `${(company.team_members as { first_name: string; last_name: string }).first_name} ${(company.team_members as { first_name: string; last_name: string }).last_name}`
                  : <span style={{ color: "#8399a9", fontWeight: 400 }}>Non assigné</span>
                }
              </div>
            </div>

            {s(company.notes) && (
              <>
                <Separator style={{ margin: "16px 0" }} />
                <div>
                  <div className="lca-label" style={{ marginBottom: 4 }}>Notes</div>
                  <p style={{ fontSize: 13, color: "#1b2a4a", whiteSpace: "pre-wrap" }}>{s(company.notes)}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== Right: Tabs ===== */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
              <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
              <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
              <TabsTrigger value="meetings">RDV ({meetings.length})</TabsTrigger>
              <TabsTrigger value="invoices">Factures ({invoices.length})</TabsTrigger>
              <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
              <TabsTrigger value="learners">Apprenants ({learners.length})</TabsTrigger>
            </TabsList>

            {/* --- Vue d'ensemble --- */}
            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {/* Prochain RDV */}
                <div className="lca-card">
                  <div style={{ height: 4, background: "#1a6b9c" }} />
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <CalendarCheck style={{ width: 16, height: 16, color: "#1a6b9c" }} /> Prochain RDV
                    </h3>
                    {(() => {
                      const nextMeeting = meetings.find((m) => s(m.status) === "booked" && s(m.next_step) !== "completed");
                      if (!nextMeeting) return <Empty text="Aucun RDV planifié" />;
                      const mt = typeColors[s(nextMeeting.meeting_type)] ?? { bg: "#f0f0f0", text: "#666" };
                      const contact = nextMeeting.contacts as { first_name: string; last_name: string } | null;
                      return (
                        <div style={{ border: "1px solid #e6f0f7", borderRadius: 10, padding: 12, borderLeft: `4px solid ${mt.text}` }}>
                          <div className="flex items-center gap-2">
                            <Badge bg={mt.bg} text={mt.text} label={s(nextMeeting.meeting_type)} />
                            <Badge bg="#e3f2fd" text="#1565c0" label="Planifié" />
                          </div>
                          <div style={{ fontSize: 13, color: "#1a2a3a", fontWeight: 600, marginTop: 6 }}>
                            RDV prévu le {fmtDateTime(s(nextMeeting.scheduled_at))} — {nextMeeting.duration_minutes as number || 60} min
                          </div>
                          {contact && <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>Avec {contact.first_name} {contact.last_name}</div>}
                          {s(nextMeeting.notes) && <p style={{ fontSize: 12, color: "#8399a9", marginTop: 4 }}>{s(nextMeeting.notes)}</p>}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Derniers deals */}
                <div className="lca-card">
                  <div style={{ height: 4, background: "#FF6B35" }} />
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <Handshake style={{ width: 16, height: 16, color: "#FF6B35" }} /> Deals ({deals.length})
                    </h3>
                    {deals.length === 0 ? <Empty text="Aucun deal" /> : (
                      <div className="space-y-2">
                        {deals.slice(0, 3).map((d) => {
                          const sc = stageColors[s(d.stage)] ?? { bg: "#f0f0f0", text: "#666" };
                          return (
                            <div key={s(d.id)} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid #e6f0f7" }}>
                              <div>
                                <div onClick={() => openDealPopup(d)} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{s(d.name)}</div>
                                <Badge bg={sc.bg} text={sc.text} label={DEAL_STAGE_LABELS[s(d.stage) as DealStage] ?? s(d.stage)} />
                              </div>
                              <div className="flex items-center gap-2">
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#27ae60" }}>{fmt(d.amount as number)}</span>
                                <button onClick={() => openDealPopup(d)} style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Edit style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Facturation résumé */}
                <div className="lca-card">
                  <div style={{ height: 4, background: "#6a1b9a" }} />
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <Receipt style={{ width: 16, height: 16, color: "#6a1b9a" }} /> Facturation
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div style={{ background: "#f5f7fa", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturé</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>{fmt(totalInvoiced)}</div>
                      </div>
                      <div style={{ background: "#f5f7fa", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Payé</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#27ae60", marginTop: 2 }}>{fmt(invoices.filter((i) => i.is_paid).reduce((a, i) => a + (Number(i.amount) || 0), 0))}</div>
                      </div>
                      <div style={{ background: "#f5f7fa", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>En attente</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#FF6B35", marginTop: 2 }}>{fmt(totalInvoiced - invoices.filter((i) => i.is_paid).reduce((a, i) => a + (Number(i.amount) || 0), 0))}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sessions résumé */}
                <div className="lca-card">
                  <div style={{ height: 4, background: "#1565c0" }} />
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <GraduationCap style={{ width: 16, height: 16, color: "#1565c0" }} /> Production
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div style={{ background: "#f5f7fa", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sessions</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>{totalSessions}</div>
                      </div>
                      <div style={{ background: "#f5f7fa", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>{totalHours.toFixed(1)}h</div>
                      </div>
                      <div style={{ background: "#f5f7fa", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Apprenants</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginTop: 2 }}>{learners.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* --- Contacts --- */}
            <TabsContent value="contacts" className="mt-4">
              <div className="lca-card">
                <div style={{ height: 4, background: "#2d7dd2" }} />
                <div style={{ padding: 16 }}>
                  {contacts.length === 0 ? <Empty text="Aucun contact associé" /> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Poste</TableHead>
                          <TableHead>Cycle de vie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((c) => {
                          const cl = contactLifecycle[s(c.lifecycle_stage)] ?? null;
                          return (
                            <TableRow key={s(c.id)} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/contacts/${s(c.id)}`)}>
                              <TableCell className="font-medium">
                                <span style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                                  {s(c.first_name)} {s(c.last_name)}
                                </span>
                              </TableCell>
                              <TableCell>{s(c.email) || "—"}</TableCell>
                              <TableCell>{formatPhone(s(c.phone) || null)}</TableCell>
                              <TableCell>{s(c.position) || "—"}</TableCell>
                              <TableCell>{cl ? <Badge bg={cl.bg} text={cl.text} label={cl.label} /> : "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* --- Deals --- */}
            <TabsContent value="deals" className="mt-4">
              <div className="lca-card">
                <div style={{ height: 4, background: "#e8632b" }} />
                <div style={{ padding: 16 }}>
                  {deals.length === 0 ? <Empty text="Aucun deal" /> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Deal</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Étape</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead className="text-right">Jours</TableHead>
                          <TableHead>Facturé</TableHead>
                          <TableHead>Propriétaire</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deals.map((d) => {
                          const sc = stageColors[s(d.stage)] ?? { bg: "#f0f0f0", text: "#666" };
                          const contact = d.contacts as { first_name: string; last_name: string } | null;
                          const owner = d.team_members as { first_name: string; last_name: string } | null;
                          const isInvoiced = !!(d.is_invoiced);
                          return (
                            <TableRow key={s(d.id)}>
                              <TableCell className="font-medium"><span onClick={() => openDealPopup(d)} style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{s(d.name)}</span></TableCell>
                              <TableCell>
                                {contact && s(d.contact_id) ? (
                                  <span
                                    onClick={() => router.push(`/contacts/${s(d.contact_id)}`)}
                                    style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                                  >
                                    {contact.first_name} {contact.last_name}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell><Badge bg={sc.bg} text={sc.text} label={DEAL_STAGE_LABELS[s(d.stage) as DealStage] ?? s(d.stage)} /></TableCell>
                              <TableCell className="text-right font-semibold">{fmt(d.amount as number)}</TableCell>
                              <TableCell className="text-right" style={{ fontSize: 13, color: "#5a6f80" }}>{Number(d.training_days) ? `${Number(d.training_days).toFixed(1)}j` : "—"}</TableCell>
                              <TableCell>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: isInvoiced ? "#e8f5e9" : "#fce4ec", color: isInvoiced ? "#2e7d32" : "#c62828" }}>
                                  {isInvoiced ? "Oui" : "Non"}
                                </span>
                              </TableCell>
                              <TableCell style={{ textAlign: "center" }}>
                                {owner ? (
                                  <span style={{ display: "inline-block", width: 26, height: 26, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 10, fontWeight: 700, lineHeight: "26px", textAlign: "center" }}>
                                    {owner.first_name[0]}{owner.last_name[0]}
                                  </span>
                                ) : <span style={{ color: "#ccc" }}>—</span>}
                              </TableCell>
                              <TableCell>
                                <button onClick={() => openDealPopup(d)} style={{ color: "#1a6b9c", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Edit style={{ width: 14, height: 14 }} />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* --- Meetings / RDV --- */}
            <TabsContent value="meetings" className="mt-4">
              <div className="lca-card">
                <div style={{ height: 4, background: "#1565c0" }} />
                <div style={{ padding: 16 }}>
                  {meetings.length === 0 ? <Empty text="Aucun rendez-vous" /> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Propriétaire</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meetings.map((m) => {
                          const tc = typeColors[s(m.meeting_type)] ?? { bg: "#f0f0f0", text: "#666" };
                          const sc = statusColors[s(m.status)] ?? { bg: "#f0f0f0", text: "#666" };
                          const contact = m.contacts as { first_name: string; last_name: string } | null;
                          const assigned = (m as R)["team_members!meetings_assigned_to_fkey"] as { first_name: string; last_name: string } | null
                            ?? m.team_members as { first_name: string; last_name: string } | null;
                          return (
                            <TableRow key={s(m.id)}>
                              <TableCell><Badge bg={tc.bg} text={tc.text} label={MEETING_TYPE_LABELS[s(m.meeting_type) as MeetingType] ?? s(m.meeting_type)} /></TableCell>
                              <TableCell style={{ fontSize: 13 }}>{fmtDateTime(s(m.scheduled_at))}</TableCell>
                              <TableCell>
                                {contact && s(m.contact_id) ? (
                                  <span
                                    onClick={() => router.push(`/contacts/${s(m.contact_id)}`)}
                                    style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                                  >
                                    {contact.first_name} {contact.last_name}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell><Badge bg={sc.bg} text={sc.text} label={MEETING_STATUS_LABELS[s(m.status) as MeetingStatus] ?? s(m.status)} /></TableCell>
                              <TableCell style={{ textAlign: "center" }}>
                                {assigned ? (
                                  <span style={{ display: "inline-block", width: 26, height: 26, borderRadius: "50%", background: "#1a6b9c", color: "white", fontSize: 10, fontWeight: 700, lineHeight: "26px", textAlign: "center" }}>
                                    {assigned.first_name[0]}{assigned.last_name[0]}
                                  </span>
                                ) : <span style={{ color: "#ccc" }}>—</span>}
                              </TableCell>
                              <TableCell style={{ fontSize: 12, color: "#7a8bab", maxWidth: 180 }} className="truncate">{s(m.notes) || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* --- Invoices / Factures --- */}
            <TabsContent value="invoices" className="mt-4">
              <div className="lca-card">
                <div style={{ height: 4, background: "#6a1b9a" }} />
                <div style={{ padding: 16 }}>
                  {invoices.length === 0 ? <Empty text="Aucune facture" /> : (
                    <>
                      <div style={{ marginBottom: 12, fontSize: 14 }}>
                        <strong>Total facturé :</strong> <span style={{ color: "#6a1b9a", fontWeight: 700 }}>{fmt(totalInvoiced)}</span>
                        {" — "}
                        <strong>Payé :</strong> <span style={{ color: "#27ae60", fontWeight: 700 }}>
                          {fmt(invoices.filter((i) => i.is_paid).reduce((a, i) => a + (Number(i.amount) || 0), 0))}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mois</TableHead>
                            <TableHead>Financement</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((inv) => (
                            <TableRow key={s(inv.id)}>
                              <TableCell>{fmtDate(s(inv.month))}</TableCell>
                              <TableCell>{s(inv.funding_type) ? <Badge bg="#eef1f6" text="#1b2a4a" label={s(inv.funding_type)} /> : "—"}</TableCell>
                              <TableCell className="text-right font-semibold">{fmt(inv.amount as number)}</TableCell>
                              <TableCell>
                                <Badge
                                  bg={inv.is_paid ? "#e8f5e9" : "#fff3e0"}
                                  text={inv.is_paid ? "#2e7d32" : "#e65100"}
                                  label={inv.is_paid ? "Payée" : "En attente"}
                                />
                              </TableCell>
                              <TableCell style={{ fontSize: 12, color: "#7a8bab" }}>{s(inv.notes) || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* --- Sessions / Formations délivrées --- */}
            <TabsContent value="sessions" className="mt-4">
              <div className="lca-card">
                <div style={{ height: 4, background: "#1565c0" }} />
                <div style={{ padding: 16 }}>
                  {sessions.length === 0 ? <Empty text="Aucune session délivrée" /> : (
                    <>
                      <div style={{ marginBottom: 12, fontSize: 14 }}>
                        <strong>Total :</strong> {totalSessions} sessions — <strong>{totalHours.toFixed(1)}h</strong> délivrées —{" "}
                        <span style={{ color: "#27ae60", fontWeight: 700 }}>
                          {fmt(sessions.reduce((a, s) => a + (Number(s.billable_amount) || 0), 0))}
                        </span> facturable
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Thème</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Participants</TableHead>
                            <TableHead className="text-right">Heures</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                            <TableHead>Expert</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessions.map((sess) => {
                            const theme = sess.session_themes as { name: string } | null;
                            const trainer = sess.team_members as { first_name: string; last_name: string } | null;
                            return (
                              <TableRow key={s(sess.id)}>
                                <TableCell>{fmtDate(s(sess.session_date))}</TableCell>
                                <TableCell>{theme?.name ?? s(sess.session_label) ?? "—"}</TableCell>
                                <TableCell>
                                  <Badge
                                    bg={s(sess.delivery_mode) === "présentiel" ? "#e3f2fd" : "#f0f0f0"}
                                    text={s(sess.delivery_mode) === "présentiel" ? "#1565c0" : "#666"}
                                    label={s(sess.delivery_mode) === "présentiel" ? "Présentiel" : "Distanciel"}
                                  />
                                </TableCell>
                                <TableCell style={{ fontSize: 12, maxWidth: 150 }} className="truncate">{s(sess.attendee_names) || "—"}</TableCell>
                                <TableCell className="text-right">{sess.hours_delivered ? Number(sess.hours_delivered).toFixed(1) : "—"}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {sess.is_billable
                                    ? <span style={{ color: "#27ae60" }}>{fmt(sess.billable_amount as number)}</span>
                                    : <span style={{ color: "#7a8bab" }}>{fmt(sess.non_billable_amount as number)}</span>
                                  }
                                </TableCell>
                                <TableCell style={{ fontSize: 12, color: "#7a8bab" }}>{trainer ? `${trainer.first_name} ${trainer.last_name}` : "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* --- Learners / Apprenants --- */}
            <TabsContent value="learners" className="mt-4">
              <div className="lca-card">
                <div style={{ height: 4, background: "#e8632b" }} />
                <div style={{ padding: 16 }}>
                  {learners.length === 0 ? <Empty text="Aucun apprenant associé" /> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Poste</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Parcours</TableHead>
                          <TableHead>Type formation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {learners.map((l) => {
                          const ls = learnerStatus[s(l.status)] ?? { bg: "#f0f0f0", text: "#666", label: s(l.status) };
                          const prog = l.training_programs as { name: string } | null;
                          const tt = l.training_types as { name: string } | null;
                          return (
                            <TableRow key={s(l.id)}>
                              <TableCell className="font-medium">{s(l.first_name)} {s(l.last_name)}</TableCell>
                              <TableCell>{s(l.email) || "—"}</TableCell>
                              <TableCell>{formatPhone(s(l.phone) || null)}</TableCell>
                              <TableCell>{s(l.position) || "—"}</TableCell>
                              <TableCell><Badge bg={ls.bg} text={ls.text} label={ls.label} /></TableCell>
                              <TableCell>{prog?.name ?? "—"}</TableCell>
                              <TableCell>{tt?.name ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ===== Edit Sheet ===== */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Modifier l&apos;entreprise</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6 px-4 pb-8 overflow-y-auto max-h-[calc(100vh-120px)]">
            <Field label="Nom *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div className="space-y-2">
              <Label>Type</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.company_type_id} onChange={(e) => setForm({ ...form, company_type_id: e.target.value })}>
                <option value="">Sélectionner</option>
                {companyTypes.map((t) => <option key={s(t.id)} value={s(t.id)}>{s(t.name)}</option>)}
              </select>
            </div>
            <Field label="Industrie" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
            <div className="space-y-2">
              <Label>Cycle de vie</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.lifecycle_stage} onChange={(e) => setForm({ ...form, lifecycle_stage: e.target.value })}>
                {Object.entries(COMPANY_LIFECYCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            </div>
            <Field label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="Site web" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="https://www.exemple.com" />
            <div className="space-y-2">
              <Label>Propriétaire</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              >
                <option value="">Non assigné</option>
                {(teamMembers as { id: string; first_name: string; last_name: string }[]).map((m) => (
                  <option key={m.id as string} value={m.id as string}>{m.first_name as string} {m.last_name as string}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Contact principal</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.primary_contact_id}
                onChange={(e) => setForm({ ...form, primary_contact_id: e.target.value })}
              >
                <option value="">Aucun</option>
                {contacts.map((c) => (
                  <option key={s(c.id)} value={s(c.id)}>{s(c.first_name)} {s(c.last_name)}</option>
                ))}
              </select>
            </div>
            <Field label="SIRET" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} placeholder="123 456 789 00012" />
            <div className="space-y-2">
              <Label>OPCO</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.opco}
                onChange={(e) => setForm({ ...form, opco: e.target.value })}
              >
                <option value="">Aucun</option>
                <option value="AFDAS">AFDAS</option>
                <option value="AGEFICE">AGEFICE</option>
                <option value="AKTO">AKTO</option>
                <option value="ATLAS">ATLAS</option>
                <option value="FIFPL">FIFPL</option>
                <option value="OCAPIAT">OCAPIAT</option>
                <option value="OPCO Commerce">OPCO Commerce</option>
                <option value="OPCO EP">OPCO EP</option>
                <option value="OPCO Mobilité">OPCO Mobilité</option>
                <option value="OPCO2I">OPCO2I</option>
                <option value="Uniformation">Uniformation</option>
              </select>
            </div>
            <Field label="LinkedIn" value={form.linkedin_url} onChange={(v) => setForm({ ...form, linkedin_url: v })} placeholder="https://linkedin.com/company/..." />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nb employés" value={form.employee_count} onChange={(v) => setForm({ ...form, employee_count: v })} />
              <Field label="Revenue annuel (€)" value={form.annual_revenue} onChange={(v) => setForm({ ...form, annual_revenue: v })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full" style={{ background: "#e8632b", color: "white" }}>
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Deal popup */}
      {selectedDeal && (() => {
        const d = selectedDeal;
        const sc = stageColors[s(d.stage)] ?? { bg: "#f0f0f0", text: "#666" };
        const contact = d.contacts as { first_name: string; last_name: string } | null;
        const owner = d.team_members as { first_name: string; last_name: string } | null;
        const dealAmount = Number(d.amount) || 0;
        const totalInvoiced = dealInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
        const remaining = dealAmount - totalInvoiced;
        const allFacture = dealInvoices.length > 0 && dealInvoices.every(inv => inv.status === "facture" || inv.status === "paye");
        const allPaye = dealInvoices.length > 0 && dealInvoices.every(inv => inv.status === "paye");
        const isFullyInvoiced = totalInvoiced >= dealAmount && allFacture;
        const isFullyPaid = totalInvoiced >= dealAmount && allPaye;
        const statusBadge = isFullyPaid
          ? { label: "Entièrement payé", bg: "#e8f5e9", text: "#2e7d32", bar: "#27ae60" }
          : isFullyInvoiced
            ? { label: "Entièrement facturé", bg: "#e8f0fe", text: "#0d4f7a", bar: "#1a6b9c" }
            : { label: "Facturation en cours", bg: "#fff3e0", text: "#e65100", bar: "#FF6B35" };

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedDeal(null); }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: "#1a2a3a", margin: 0 }}>{s(d.name)}</h3>
                <button onClick={() => setSelectedDeal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div style={{ padding: 20 }} className="space-y-4">
                {/* Stage badge */}
                <div className="flex items-center gap-2">
                  <Badge bg={sc.bg} text={sc.text} label={DEAL_STAGE_LABELS[s(d.stage) as DealStage] ?? s(d.stage)} />
                  <span style={{ fontSize: 12, color: "#8399a9" }}>{d.probability as number}% de probabilité</span>
                </div>

                {/* Infos */}
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                    <span style={{ fontSize: 13, color: "#1a6b9c", fontWeight: 600 }}>{s(company.name)}</span>
                  </div>
                  {contact && (
                    <div className="flex items-center gap-2">
                      <Users style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setSelectedDeal(null); router.push(`/contacts/${s(d.contact_id)}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>
                        {contact.first_name} {contact.last_name}
                      </span>
                    </div>
                  )}
                  {owner && (
                    <div className="flex items-center gap-2">
                      <Users style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: "#8399a9" }}>Propriétaire : {owner.first_name} {owner.last_name}</span>
                    </div>
                  )}
                  {s(d.expected_close_date) && (
                    <div className="flex items-center gap-2">
                      <Calendar style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: "#8399a9" }}>Closing prévu : {fmtDate(s(d.expected_close_date))}</span>
                    </div>
                  )}
                </div>

                {/* Montant + Jours */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{fmt(d.amount as number)}</div>
                  </div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Jours formation</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{Number(d.training_days) ? `${Number(d.training_days).toFixed(1)}j` : "—"}</div>
                  </div>
                </div>

                {/* Facturation */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Facturation</div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: statusBadge.bg, color: statusBadge.text }}>
                        {statusBadge.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a" }}>{fmt(totalInvoiced)} / {fmt(dealAmount)}</span>
                    </div>
                    <div style={{ height: 6, background: "#e8ecf1", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, dealAmount > 0 ? (totalInvoiced / dealAmount) * 100 : 0)}%`, background: statusBadge.bar, transition: "width 0.5s" }} />
                    </div>
                    {dealInvoices.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {dealInvoices.map(inv => {
                          const ist = INVOICE_STATUS_LABELS[inv.status] ?? INVOICE_STATUS_LABELS.facturable;
                          return (
                            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                              <span style={{ color: "#5a6f80" }}>{new Date(inv.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontWeight: 700, color: "#1a2a3a" }}>{fmt(Number(inv.amount))}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: ist.bg, color: ist.text }}>{ist.label}</span>
                              </div>
                            </div>
                          );
                        })}
                        {remaining > 0 && <div style={{ fontSize: 11, color: "#e65100", marginTop: 4, borderTop: "1px solid #e8ecf1", paddingTop: 6 }}>Reste à facturer : <strong>{fmt(remaining)}</strong></div>}
                      </div>
                    ) : <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic" }}>Aucune facture émise</div>}
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>Documents</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <label style={{ height: 32, borderRadius: 6, background: "#1a6b9c", color: "white", fontSize: 12, fontWeight: 600, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: uploadingDoc ? "wait" : "pointer", opacity: uploadingDoc ? 0.6 : 1 }}>
                      <Upload className="h-3.5 w-3.5" />{uploadingDoc ? "Envoi..." : "Importer"}
                      <input type="file" style={{ display: "none" }} disabled={uploadingDoc} onChange={handleUploadDealDoc} />
                    </label>
                    <button style={{ height: 32, borderRadius: 6, background: "white", border: "1px solid #2ecc71", color: "#2e7d32", fontSize: 12, fontWeight: 600, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      Pennylane
                    </button>
                  </div>
                  {loadingDealData ? (
                    <div style={{ fontSize: 12, color: "#8399a9", padding: 8 }}>Chargement...</div>
                  ) : dealDocuments.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#8399a9", fontStyle: "italic", padding: 8 }}>Aucun document</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dealDocuments.map(doc => {
                        const dtc = DOC_TYPE_COLORS[doc.document_type] ?? DOC_TYPE_COLORS.autre;
                        return (
                          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f8fbfd", borderRadius: 8, border: "1px solid #e8ecf1" }}>
                            <FileText className="h-4 w-4" style={{ color: "#8399a9", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10, background: dtc.bg, color: dtc.text }}>{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</span>
                              </div>
                            </div>
                            <button onClick={() => handleDownloadDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }}><Download className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteDealDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {s(d.notes) && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Notes</div>
                    <p style={{ fontSize: 13, color: "#1a2a3a", whiteSpace: "pre-wrap" }}>{s(d.notes)}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button
                  onClick={() => { setSelectedDeal(null); router.push("/deals"); }}
                  style={{ flex: 1, height: 40, borderRadius: 8, background: "#FF6B35", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Edit className="h-4 w-4" /> Modifier le deal
                </button>
                <button
                  onClick={() => { if (confirm("Supprimer ce deal ?")) { createClient().from("deals").delete().eq("id", s(d.id)).then(() => { setSelectedDeal(null); router.refresh(); }); } }}
                  style={{ height: 40, width: 40, borderRadius: 8, border: "1px solid #e74c3c", color: "#e74c3c", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ---- Sub-components ---- */

function s(v: unknown): string { return v != null ? String(v) : ""; }

function Empty({ text }: { text: string }) {
  return <p style={{ color: "#7a8bab", fontSize: 13, textAlign: "center", padding: 24 }}>{text}</p>;
}

function SummaryCard({ icon: Icon, color, label, value }: { icon: typeof Users; color: string; label: string; value: string }) {
  return (
    <div className="lca-card" style={{ padding: 14 }}>
      <div className="flex items-center gap-3">
        <div style={{ background: color + "15", borderRadius: 8, padding: 8 }}>
          <Icon style={{ width: 18, height: 18, color }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7a8bab" }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1b2a4a" }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href, external, mono }: { icon: typeof Phone; label: string; value: string; href?: string; external?: boolean; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon style={{ width: 14, height: 14, color: "#7a8bab", marginTop: 2, flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: 10, color: "#7a8bab", display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        {href ? (
          <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} style={{ fontSize: 13, color: "#2d7dd2", textDecoration: "underline" }}>
            {value} {external && <ExternalLink style={{ width: 10, height: 10, display: "inline" }} />}
          </a>
        ) : (
          <span style={{ fontSize: 13, color: "#1b2a4a", fontFamily: mono ? "monospace" : undefined }}>{value}</span>
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f5f7fa", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7a8bab" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1b2a4a", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
