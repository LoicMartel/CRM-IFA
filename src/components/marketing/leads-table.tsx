"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";

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
  lead: { label: "Lead", color: "#1a6b9c", bg: "#e8f4f8" },
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

  return (
    <>
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
      </div>

      <div className="rounded-md border">
        <Table>
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
                <span className="flex items-center gap-1">Téléphone <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("company")}>
                <span className="flex items-center gap-1">Entreprise <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="p-0" style={{ fontSize: 11, color: "#5a6f80" }}>
                    <Link href={href} className="block px-4 py-2 text-inherit no-underline">
                      {l.created_at ? new Date(l.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link href={href} className="block px-4 py-2 text-inherit no-underline">
                      {(() => {
                        const s = STATUS_LABELS[l.lead_status ?? ""] ?? { label: l.lead_status ?? "—", color: "#5a6f80", bg: "#f0f0f0" };
                        return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, color: s.color, backgroundColor: s.bg }}>{s.label}</span>;
                      })()}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 font-medium"><Link href={href} className="block px-4 py-2 text-inherit no-underline">{l.last_name}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} className="block px-4 py-2 text-inherit no-underline">{l.first_name}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} className="block px-4 py-2 text-inherit no-underline">{getName(l.lead_sources) ?? "—"}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} className="block px-4 py-2 text-inherit no-underline">{l.email ?? "—"}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} className="block px-4 py-2 text-inherit no-underline">{formatPhone(l.phone)}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} className="block px-4 py-2 text-inherit no-underline">{getName(l.companies) ?? "—"}</Link></TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </>
  );
}
