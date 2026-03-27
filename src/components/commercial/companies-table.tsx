"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Company {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  industry: string | null;
  lifecycle_stage: string | null;
  annual_revenue: number | null;
  owner_id: string | null;
  company_types: { name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
  contacts: { count: number }[];
  deals: { count: number }[];
}

interface CompanyType {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

const lifecycleColors: Record<string, { bg: string; text: string; label: string }> = {
  lead: { bg: "#f0f0f0", text: "#666", label: "Lead" },
  prospect: { bg: "#e3f2fd", text: "#1565c0", label: "Prospect" },
  customer: { bg: "#e8f5e9", text: "#2e7d32", label: "Client" },
  partner: { bg: "#f3e5f5", text: "#6a1b9a", label: "Partenaire" },
  former_customer: { bg: "#fce4ec", text: "#c62828", label: "Ancien client" },
};

type SortKey = "name" | "city" | "lifecycle_stage" | "contacts_count" | "deals_count" | "annual_revenue";

export function CompaniesTable({
  companies,
  companyTypes,
  teamMembers = [],
}: {
  companies: Company[];
  companyTypes: CompanyType[];
  teamMembers?: TeamMember[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLifecycle, setFilterLifecycle] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", company_type_id: "", phone: "", email: "", address: "", city: "",
    website: "", notes: "", industry: "", lifecycle_stage: "prospect",
    employee_count: "", annual_revenue: "", linkedin_url: "", siret: "", opco: "",
  });

  function getContactCount(c: Company): number {
    return c.contacts?.[0]?.count ?? 0;
  }

  function getDealCount(c: Company): number {
    return c.deals?.[0]?.count ?? 0;
  }

  const filtered = companies
    .filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType && c.company_types?.name !== filterType) return false;
      if (filterLifecycle && c.lifecycle_stage !== filterLifecycle) return false;
      if (filterOwner && c.owner_id !== filterOwner) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "city": cmp = (a.city ?? "").localeCompare(b.city ?? ""); break;
        case "lifecycle_stage": cmp = (a.lifecycle_stage ?? "").localeCompare(b.lifecycle_stage ?? ""); break;
        case "contacts_count": cmp = getContactCount(a) - getContactCount(b); break;
        case "deals_count": cmp = getDealCount(a) - getDealCount(b); break;
        case "annual_revenue": cmp = (a.annual_revenue ?? 0) - (b.annual_revenue ?? 0); break;
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
    const supabase = createClient();
    await supabase.from("companies").insert({
      name: form.name,
      company_type_id: form.company_type_id || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      website: form.website || null,
      notes: form.notes || null,
      industry: form.industry || null,
      lifecycle_stage: form.lifecycle_stage || "lead",
      employee_count: form.employee_count ? parseInt(form.employee_count) : null,
      annual_revenue: form.annual_revenue ? parseFloat(form.annual_revenue) : null,
      linkedin_url: form.linkedin_url || null,
      siret: form.siret || null,
      opco: form.opco || null,
    });
    setSaving(false);
    setOpen(false);
    setForm({
      name: "", company_type_id: "", phone: "", email: "", address: "", city: "",
      website: "", notes: "", industry: "", lifecycle_stage: "prospect",
      employee_count: "", annual_revenue: "", linkedin_url: "", siret: "", opco: "",
    });
    router.refresh();
  }

  function formatRevenue(amount: number | null): string {
    if (amount == null) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-60" />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Tous les types</option>
            {companyTypes.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
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
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle entreprise
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">Nom <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("city")}>
                <span className="flex items-center gap-1">Ville <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("lifecycle_stage")}>
                <span className="flex items-center gap-1">Cycle de vie <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("contacts_count")}>
                <span className="flex items-center gap-1 justify-center">Contacts <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("deals_count")}>
                <span className="flex items-center gap-1 justify-center">Deals <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Propriétaire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucune entreprise trouvée
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const lc = lifecycleColors[c.lifecycle_stage ?? ""] ?? null;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.city ?? "—"}</TableCell>
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
                    <TableCell className="text-center">{getContactCount(c)}</TableCell>
                    <TableCell className="text-center">{getDealCount(c)}</TableCell>
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
            <SheetTitle>Nouvelle entreprise</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.company_type_id}
                onChange={(e) => setForm({ ...form, company_type_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {companyTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Industrie</Label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cycle de vie</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Site web</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SIRET</Label>
              <Input value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="Ex: 123 456 789 00012" />
            </div>
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
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/company/..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nb employés</Label>
                <Input type="number" value={form.employee_count} onChange={(e) => setForm({ ...form, employee_count: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Revenue annuel (€)</Label>
                <Input type="number" value={form.annual_revenue} onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
