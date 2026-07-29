"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, UserPlus, BookOpen, Megaphone, PhoneCall, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";
import { ActivityModal } from "@/components/commercial/activity-modal";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  owner_id: string | null;
  lead_status: string | null;
  lifecycle_stage: string | null;
  companies: { name: string }[] | { name: string } | null;
  lead_sources: { name: string }[] | { name: string } | null;
  team_members: { id: string; first_name: string; last_name: string }[] | { id: string; first_name: string; last_name: string } | null;
  created_at: string;
}

function getName(rel: { name: string }[] | { name: string } | null): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  lead: { label: "Lead", color: "#1E2A5A", bg: "#e8f4f8" },
  contacted: { label: "Contacté", color: "#b8860b", bg: "#fef9e7" },
  booked: { label: "Booké", color: "#2e7d32", bg: "#e8f5e9" },
  rdv_done: { label: "RDV effectué", color: "#1565c0", bg: "#e3f2fd" },
  not_interested: { label: "Non intéressé", color: "#c62828", bg: "#ffebee" },
};

type SortKey = "created_at" | "last_name" | "first_name" | "source" | "email" | "phone" | "company" | "status";

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterSource, setFilterSource] = useState(searchParams.get("source") ?? "");
  const [filterOwner, setFilterOwner] = useState(searchParams.get("owner") ?? "");
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom">("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [activityLeadId, setActivityLeadId] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [addForm, setAddForm] = useState({ first_name: "", last_name: "", email: "", phone: "", company: "", source_id: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [availableSources, setAvailableSources] = useState<{ id: string; name: string }[]>([]);
  const PAGE_SIZE = 25;

  const sourceNames = Array.from(new Set(leads.map((l) => getName(l.lead_sources)).filter(Boolean) as string[])).sort();

  function getOwnerName(l: Lead): string | null {
    const tm = l.team_members;
    if (!tm) return null;
    const m = Array.isArray(tm) ? tm[0] : tm;
    return m ? `${m.first_name} ${m.last_name}` : null;
  }
  const ownerNames = Array.from(new Set(leads.map(getOwnerName).filter(Boolean) as string[])).sort();

  function inPeriod(dateStr: string) {
    if (periodMode === "month") return dateStr.startsWith(filterMonth);
    if (periodMode === "custom" && customFrom && customTo) return dateStr >= customFrom && dateStr <= customTo;
    return true;
  }

  const filtered = leads
    .filter((l) => {
      if (filterSource && (getName(l.lead_sources) ?? "") !== filterSource) return false;
      if (filterOwner && (getOwnerName(l) ?? "") !== filterOwner) return false;
      if (!inPeriod(l.created_at.split("T")[0])) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
      return fullName.includes(q) || (l.email ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "created_at": cmp = (a.created_at ?? "").localeCompare(b.created_at ?? ""); break;
        case "last_name": cmp = (a.last_name ?? "").localeCompare(b.last_name ?? ""); break;
        case "first_name": cmp = (a.first_name ?? "").localeCompare(b.first_name ?? ""); break;
        case "source": cmp = (getName(a.lead_sources) ?? "").localeCompare(getName(b.lead_sources) ?? ""); break;
        case "email": cmp = (a.email ?? "").localeCompare(b.email ?? ""); break;
        case "phone": cmp = (a.phone ?? "").localeCompare(b.phone ?? ""); break;
        case "company": cmp = (getName(a.companies) ?? "").localeCompare(getName(b.companies) ?? ""); break;
        case "status": cmp = (a.lead_status ?? "").localeCompare(b.lead_status ?? ""); break;
      }
      return sortAsc ? cmp : -cmp;
    });

  // Reset page when filters change
  const filterKey = `${search}|${filterSource}|${filterOwner}|${periodMode}|${filterMonth}|${customFrom}|${customTo}`;
  useMemo(() => { setPage(1); }, [filterKey]);

  const paginatedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const marketingCount = filtered.length;
  const tunnelBookCount = filtered.filter((l) => getName(l.lead_sources) === "Meta ads - tunnel book").length;
  const tunnelCommercialCount = filtered.filter((l) => getName(l.lead_sources) === "Meta ads - tunnel commercial").length;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3" style={{ maxWidth: 700 }}>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Leads Marketing</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{marketingCount}</div>
          </div>
          <UserPlus style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Meta Ads — Tunnel Book</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1E2A5A" }}>{tunnelBookCount}</div>
          </div>
          <BookOpen style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Meta Ads — Tunnel Commercial</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#2e7d32" }}>{tunnelCommercialCount}</div>
          </div>
          <Megaphone style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher nom ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="">Toutes les sources</option>
            {sourceNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
          >
            <option value="">Tous les Account Managers</option>
            {ownerNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as "all" | "month" | "custom")}
          >
            <option value="all">Toutes les périodes</option>
            <option value="month">Par mois</option>
            <option value="custom">Personnalisé</option>
          </select>
          {periodMode === "month" && (
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40 h-9" />
          )}
          {periodMode === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-9 text-xs" />
              <span style={{ color: "#8399a9" }}>au</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-9 text-xs" />
            </div>
          )}
        </div>
        <ExportButton onExport={(fmt: ExportFormat) => exportData(
          filtered.map((l) => ({
            nom: l.last_name,
            prenom: l.first_name,
            statut: STATUS_LABELS[l.lead_status ?? ""]?.label ?? l.lead_status ?? "",
            source: getName(l.lead_sources) ?? "",
            email: l.email ?? "",
            telephone: l.phone ?? "",
            entreprise: getName(l.companies) ?? "",
          })),
          [
            { key: "nom", label: "Nom" }, { key: "prenom", label: "Prénom" },
            { key: "statut", label: "Statut" }, { key: "source", label: "Source" },
            { key: "email", label: "Email" }, { key: "telephone", label: "Téléphone" },
            { key: "entreprise", label: "Entreprise" },
          ],
          "leads-marketing", fmt
        )} />
        <Button onClick={async () => {
          const supabase = (await import("@/lib/supabase/client")).createClient();
          const { data } = await supabase.from("lead_sources").select("id, name").order("name");
          setAvailableSources(data ?? []);
          setShowAddLead(true);
        }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus className="h-4 w-4" /> Ajouter un lead
        </Button>
      </div>

      {/* Modal ajout lead */}
      {showAddLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAddLead(false)}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: 440, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a" }}>Ajouter un lead</h3>
              <button onClick={() => setShowAddLead(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X style={{ width: 20, height: 20, color: "#8399a9" }} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Prenom *</label>
                  <Input value={addForm.first_name} onChange={(e) => setAddForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Prenom" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Nom *</label>
                  <Input value={addForm.last_name} onChange={(e) => setAddForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Nom" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Email</label>
                <Input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemple.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Telephone</label>
                <Input value={addForm.phone} onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Entreprise</label>
                <Input value={addForm.company} onChange={(e) => setAddForm(f => ({ ...f, company: e.target.value }))} placeholder="Nom de l'entreprise" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Source</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={addForm.source_id}
                  onChange={(e) => setAddForm(f => ({ ...f, source_id: e.target.value }))}
                >
                  <option value="">-- Selectionner une source --</option>
                  {availableSources.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <Button disabled={addSaving || !addForm.first_name.trim() || !addForm.last_name.trim()} onClick={async () => {
                setAddSaving(true);
                const supabase = (await import("@/lib/supabase/client")).createClient();
                const { error } = await supabase.from("contacts").insert({
                  first_name: addForm.first_name.trim(),
                  last_name: addForm.last_name.trim(),
                  email: addForm.email.trim() || null,
                  phone: addForm.phone.trim() || null,
                  source_id: addForm.source_id || null,
                  lifecycle_stage: "lead_marketing",
                  lead_status: "lead",
                  was_lead_marketing: true,
                });
                if (error) { alert("Erreur : " + error.message); }
                else { setShowAddLead(false); setAddForm({ first_name: "", last_name: "", email: "", phone: "", company: "", source_id: "" }); router.refresh(); }
                setAddSaving(false);
              }} style={{ marginTop: 8 }}>
                {addSaving ? "Enregistrement..." : "Ajouter le lead"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border" style={{ overflowX: "hidden" }}>
        <Table style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "9%" }} />   {/* Créé le */}
            <col style={{ width: "9%" }} />   {/* Statut */}
            <col style={{ width: "10%" }} />  {/* Nom */}
            <col style={{ width: "10%" }} />  {/* Prénom */}
            <col style={{ width: "13%" }} />  {/* Source */}
            <col style={{ width: "17%" }} />  {/* Email */}
            <col style={{ width: "11%" }} />  {/* Téléphone */}
            <col style={{ width: "13%" }} />  {/* Entreprise */}
            <col style={{ width: "8%" }} />   {/* Actions */}
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("created_at")}>
                <span className="flex items-center gap-1">Créé le <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                <span className="flex items-center gap-1">Statut <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("last_name")}>
                <span className="flex items-center gap-1">Nom <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("first_name")}>
                <span className="flex items-center gap-1">Prénom <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("source")}>
                <span className="flex items-center gap-1">Source <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("email")}>
                <span className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("phone")}>
                <span className="flex items-center gap-1">Tél. <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("company")}>
                <span className="flex items-center gap-1">Entreprise <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aucun lead trouvé
                </TableCell>
              </TableRow>
            ) : (
              paginatedFiltered.map((l) => {
                const params = new URLSearchParams({ from: "leads" });
                if (filterSource) params.set("source", filterSource);
                if (search) params.set("q", search);
                const href = `/contacts/${l.id}?${params.toString()}`;
                return (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="p-0" style={{ fontSize: 11, color: "#5a6f80", overflow: "hidden" }}>
                    <Link href={href} className="block px-2 py-2 text-inherit no-underline truncate">
                      {l.created_at ? new Date(l.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0" style={{ overflow: "hidden" }}>
                    <Link href={href} className="block px-2 py-2 text-inherit no-underline">
                      {(() => {
                        const s = STATUS_LABELS[l.lead_status ?? ""] ?? { label: l.lead_status ?? "—", color: "#5a6f80", bg: "#f0f0f0" };
                        return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 9999, color: s.color, backgroundColor: s.bg, whiteSpace: "nowrap" }}>{s.label}</span>;
                      })()}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 font-medium" style={{ overflow: "hidden" }}><Link href={href} className="block px-2 py-2 text-inherit no-underline truncate">{l.last_name}</Link></TableCell>
                  <TableCell className="p-0" style={{ overflow: "hidden" }}><Link href={href} className="block px-2 py-2 text-inherit no-underline truncate">{l.first_name}</Link></TableCell>
                  <TableCell className="p-0" style={{ overflow: "hidden" }}><Link href={href} className="block px-2 py-2 text-inherit no-underline truncate" title={getName(l.lead_sources) ?? ""}>{getName(l.lead_sources) ?? "—"}</Link></TableCell>
                  <TableCell className="p-0" style={{ overflow: "hidden" }}><Link href={href} className="block px-2 py-2 text-inherit no-underline truncate" title={l.email ?? ""}>{l.email ?? "—"}</Link></TableCell>
                  <TableCell className="p-0" style={{ overflow: "hidden" }}><Link href={href} className="block px-2 py-2 text-inherit no-underline truncate">{formatPhone(l.phone)}</Link></TableCell>
                  <TableCell className="p-0" style={{ overflow: "hidden" }}><Link href={href} className="block px-2 py-2 text-inherit no-underline truncate" title={getName(l.companies) ?? ""}>{getName(l.companies) ?? "—"}</Link></TableCell>
                  <TableCell className="p-0 px-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActivityLeadId(l.id); }}
                      title="Nouvelle activité"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "3px 7px", borderRadius: 6, border: "1px solid #dce8f0",
                        background: "white", color: "#1E2A5A", fontSize: 11, fontWeight: 600,
                        cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      <PhoneCall style={{ width: 12, height: 12 }} />
                      Actions
                    </button>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Activity modal for quick log from leads list */}
      {activityLeadId && (() => {
        const lead = leads.find((l) => l.id === activityLeadId);
        if (!lead) return null;
        return (
          <ActivityModal
            contactId={lead.id}
            companyId={lead.company_id}
            contactName={`${lead.first_name} ${lead.last_name}`}
            open={true}
            onOpenChange={(open) => { if (!open) setActivityLeadId(null); }}
          />
        );
      })()}
    </>
  );
}
