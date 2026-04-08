"use client";

import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import type {
  LeadWithRelations,
  SalesMember,
  CompanyTypeOption,
  LeadSourceOption,
} from "@/types/leads";
import { LeadFormDialog } from "./lead-form-dialog";

interface LeadsTableProps {
  leads: LeadWithRelations[];
  salesMembers: SalesMember[];
  companyTypes: CompanyTypeOption[];
  leadSources: LeadSourceOption[];
}

const STATUS_LABELS: Record<LeadWithRelations["status"], string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  r_plus_booked: "R+ Booké",
  gagné: "Gagné",
  perdu: "Perdu",
};

const STATUS_COLORS: Record<LeadWithRelations["status"], string> = {
  nouveau: "bg-blue-100 text-blue-800",
  en_cours: "bg-yellow-100 text-yellow-800",
  r_plus_booked: "bg-orange-100 text-orange-800",
  gagné: "bg-green-100 text-green-800",
  perdu: "bg-red-100 text-red-800",
};

function StepBadge({ status }: { status: "pending" | "done" | "skipped" }) {
  if (status === "done") return <span title="Fait">&#9989;</span>;
  if (status === "pending") return <span title="En attente">&#9203;</span>;
  return <span title="Sauté">&#9197;</span>;
}

function formatMonthYear(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("fr-FR", {
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function LeadsTable({
  leads,
  salesMembers,
  companyTypes,
  leadSources,
}: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [salesFilter, setSalesFilter] = useState<string>("all");
  const [editingLead, setEditingLead] = useState<LeadWithRelations | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Status filter
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;

      // Sales filter
      if (salesFilter !== "all" && lead.sales_id !== salesFilter) return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const contactName =
          `${lead.contact_first_name ?? ""} ${lead.contact_last_name ?? ""}`.toLowerCase();
        const companyName = (lead.company_name ?? "").toLowerCase();
        if (
          !contactName.includes(searchLower) &&
          !companyName.includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [leads, statusFilter, salesFilter, search]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "desc") { setSortKey(null); setSortDir("asc"); }
      else setSortDir("desc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      let va = "";
      let vb = "";
      if (sortKey === "prospect") {
        va = `${a.contact_first_name ?? ""} ${a.contact_last_name ?? ""}`.toLowerCase();
        vb = `${b.contact_first_name ?? ""} ${b.contact_last_name ?? ""}`.toLowerCase();
      } else if (sortKey === "company") {
        va = (a.company_name ?? "").toLowerCase();
        vb = (b.company_name ?? "").toLowerCase();
      } else if (sortKey === "status") {
        va = (a.status ?? "").toLowerCase();
        vb = (b.status ?? "").toLowerCase();
      } else if (sortKey === "source") {
        va = (a.source_name ?? "").toLowerCase();
        vb = (b.source_name ?? "").toLowerCase();
      } else if (sortKey === "created_at") {
        va = a.created_at ?? "";
        vb = b.created_at ?? "";
      }
      const cmp = va.localeCompare(vb, "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredLeads, sortKey, sortDir]);

  function handleCreate() {
    setEditingLead(null);
    setDialogOpen(true);
  }

  function handleEdit(lead: LeadWithRelations) {
    setEditingLead(lead);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher prospect ou entreprise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            defaultValue="all"
            onValueChange={(value) => setStatusFilter(value as string)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="nouveau">Nouveau</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="r_plus_booked">R+ Booké</SelectItem>
              <SelectItem value="gagné">Gagné</SelectItem>
              <SelectItem value="perdu">Perdu</SelectItem>
            </SelectContent>
          </Select>

          <Select
            defaultValue="all"
            onValueChange={(value) => setSalesFilter(value as string)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les sales</SelectItem>
              {salesMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Nouveau lead
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("created_at")}>
                <span className="flex items-center gap-1">Créé le <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("prospect")}>
                <span className="flex items-center gap-1">Prospect <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("company")}>
                <span className="flex items-center gap-1">Entreprise <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mois</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("source")}>
                <span className="flex items-center gap-1">Source <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="text-center">R1</TableHead>
              <TableHead className="text-center">R2</TableHead>
              <TableHead className="text-center">R3</TableHead>
              <TableHead className="text-center">R3_2</TableHead>
              <TableHead>Suivi</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  Aucun lead trouvé
                </TableCell>
              </TableRow>
            ) : (
              sortedLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => handleEdit(lead)}
                >
                  <TableCell style={{ fontSize: 11, color: "#5a6f80" }}>
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {lead.contact_first_name || lead.contact_last_name
                      ? `${lead.contact_first_name ?? ""} ${lead.contact_last_name ?? ""}`.trim()
                      : "—"}
                  </TableCell>
                  <TableCell>{lead.company_name ?? "—"}</TableCell>
                  <TableCell>{lead.company_type_name ?? "—"}</TableCell>
                  <TableCell>{formatMonthYear(lead.month_year)}</TableCell>
                  <TableCell>
                    {lead.sales_first_name
                      ? `${lead.sales_first_name} ${lead.sales_last_name ?? ""}`.trim()
                      : "—"}
                  </TableCell>
                  <TableCell>{lead.source_name ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <StepBadge status={lead.r1_status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StepBadge status={lead.r2_status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StepBadge status={lead.r3_status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StepBadge status={lead.r3_2_status} />
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {lead.follow_up ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[lead.status]}
                    >
                      {STATUS_LABELS[lead.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}{" "}
        affichés sur {leads.length}
      </div>

      {/* Form Dialog */}
      <LeadFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        salesMembers={salesMembers}
        companyTypes={companyTypes}
        leadSources={leadSources}
      />
    </div>
  );
}
