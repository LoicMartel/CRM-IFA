"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  companies: { name: string }[] | { name: string } | null;
  lead_sources: { name: string }[] | { name: string } | null;
  created_at: string;
}

function getName(rel: { name: string }[] | { name: string } | null): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name;
}

type SortKey = "last_name" | "first_name" | "source" | "email" | "phone" | "company";

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last_name");
  const [sortAsc, setSortAsc] = useState(true);

  const sourceNames = Array.from(new Set(leads.map((l) => getName(l.lead_sources)).filter(Boolean) as string[])).sort();

  const filtered = leads
    .filter((l) => {
      if (filterSource && (getName(l.lead_sources) ?? "") !== filterSource) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
      return fullName.includes(q) || (l.email ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "last_name": cmp = (a.last_name ?? "").localeCompare(b.last_name ?? ""); break;
        case "first_name": cmp = (a.first_name ?? "").localeCompare(b.first_name ?? ""); break;
        case "source": cmp = (getName(a.lead_sources) ?? "").localeCompare(getName(b.lead_sources) ?? ""); break;
        case "email": cmp = (a.email ?? "").localeCompare(b.email ?? ""); break;
        case "phone": cmp = (a.phone ?? "").localeCompare(b.phone ?? ""); break;
        case "company": cmp = (getName(a.companies) ?? "").localeCompare(getName(b.companies) ?? ""); break;
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
        </div>
        <ExportButton onExport={(fmt: ExportFormat) => exportData(
          filtered.map((l) => ({
            nom: l.last_name,
            prenom: l.first_name,
            source: getName(l.lead_sources) ?? "",
            email: l.email ?? "",
            telephone: l.phone ?? "",
            entreprise: getName(l.companies) ?? "",
          })),
          [
            { key: "nom", label: "Nom" }, { key: "prenom", label: "Prénom" },
            { key: "source", label: "Source" }, { key: "email", label: "Email" },
            { key: "telephone", label: "Téléphone" }, { key: "entreprise", label: "Entreprise" },
          ],
          "leads-marketing", fmt
        )} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun lead trouvé
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/contacts/${l.id}`)}
                >
                  <TableCell className="font-medium">{l.last_name}</TableCell>
                  <TableCell>{l.first_name}</TableCell>
                  <TableCell>{getName(l.lead_sources) ?? "—"}</TableCell>
                  <TableCell>{l.email ?? "—"}</TableCell>
                  <TableCell>{formatPhone(l.phone)}</TableCell>
                  <TableCell>{getName(l.companies) ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
