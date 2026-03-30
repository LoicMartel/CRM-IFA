"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Plus, Search, Trash2, Users, UserCheck, UserPlus, Upload, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { confirmDelete } from "@/lib/confirm-delete";
import { formatPhone } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { exportData, type ExportFormat } from "@/lib/export";
import { checkLearnerDuplicate } from "@/lib/duplicate-check";
import { VisioformationImportModal } from "./visioformation-import-modal";
import { generateVisioformationImportXlsx } from "@/lib/visioformation";
import * as XLSX from "xlsx";

interface Learner {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  company_id: string | null;
  program_id: string | null;
  training_type_id: string | null;
  companies: { name: string } | null;
  training_programs: { name: string } | null;
  training_types: { name: string } | null;
}

interface Ref { id: string; name: string; }

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  actuel: { bg: "#e8f8f0", text: "#27ae60", label: "Actuel" },
  ancien: { bg: "#f0f0f0", text: "#666", label: "Ancien" },
  futur: { bg: "#e6f0f7", text: "#1a6b9c", label: "Futur" },
};

interface Expert { id: string; first_name: string; last_name: string; }

export function LearnersTable({
  learners, companies, programs, trainingTypes, experts = [],
}: {
  learners: Learner[];
  companies: Ref[];
  programs: Ref[];
  trainingTypes: Ref[];
  experts?: Expert[];
}) {
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly, onlyOwnData, memberId: roleMemberId } = useCurrentRoles();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterExpert, setFilterExpert] = useState("");
  const [visioImportOpen, setVisioImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", position: "",
    company_id: "", status: "actuel", program_id: "", training_type_id: "", expert_id: "", notes: "",
  });

  const filtered = learners.filter((l) => {
    if (onlyOwnData && roleMemberId && (l as any).expert_id !== roleMemberId) return false;
    const name = `${l.first_name} ${l.last_name}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    if (filterProgram && l.program_id !== filterProgram) return false;
    if (filterCompany === "__none__" && l.company_id) return false;
    if (filterCompany && filterCompany !== "__none__" && l.company_id !== filterCompany) return false;
    if (filterExpert && (l as any).expert_id !== filterExpert) return false;
    return true;
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  async function handleBulkDelete() {
    if (!confirmDelete(isRestrictedExterne || isReadOnly, `Supprimer ${selectedIds.size} apprenant(s) ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const supabase = createClient();
    for (const id of selectedIds) {
      await supabase.from("learners").delete().eq("id", id);
    }
    setSelectedIds(new Set());
    setDeleting(false);
    router.refresh();
  }

  async function handleDeleteLearner(id: string) {
    const supabase = createClient();
    await supabase.from("learners").delete().eq("id", id);
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    // Duplicate check
    if (form.email) {
      const dup = await checkLearnerDuplicate(form.email);
      if (dup.isDuplicate) {
        if (!window.confirm(`⚠ Doublon détecté !\n\n${dup.message}\n\nVoulez-vous quand même créer cet apprenant ?`)) {
          setSaving(false);
          return;
        }
      }
    }
    const supabase = createClient();
    await supabase.from("learners").insert({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      position: form.position || null,
      company_id: form.company_id || null,
      status: form.status,
      program_id: form.program_id || null,
      training_type_id: form.training_type_id || null,
      expert_id: form.expert_id || null,
      notes: form.notes || null,
    });
    setSaving(false);
    setOpen(false);
    setForm({ first_name: "", last_name: "", email: "", phone: "", position: "", company_id: "", status: "actuel", program_id: "", training_type_id: "", expert_id: "", notes: "" });
    router.refresh();
  }

  const totalFiltered = filtered.length;
  const actuelCount = filtered.filter(l => l.status === "actuel").length;
  const ancienCount = filtered.filter(l => l.status === "ancien").length;
  const futurCount = filtered.filter(l => l.status === "futur").length;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4" style={{ marginBottom: 16 }}>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total apprenants</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{totalFiltered}</div>
          </div>
          <Users style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Actuels</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{actuelCount}</div>
          </div>
          <UserCheck style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Anciens</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#8399a9" }}>{ancienCount}</div>
          </div>
          <Users style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Futurs</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{futurCount}</div>
          </div>
          <UserPlus style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Ligne 1 : Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher nom ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" />
        </div>
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="actuel">Actuel</option>
          <option value="ancien">Ancien</option>
          <option value="futur">Futur</option>
        </select>
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="">Toutes les entreprises</option>
          <option value="__none__">Sans entreprise</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
          <option value="">Tous les parcours</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {!isRestrictedExterne && !isReadOnly && (
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={filterExpert} onChange={(e) => setFilterExpert(e.target.value)}>
          <option value="">Tous les experts</option>
          {experts.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
        )}
      </div>

      {/* Ligne 2 : Boutons d'action */}
      <div className="flex flex-wrap gap-2 items-center">
        <ExportButton onExport={(fmt: ExportFormat) => exportData(
          filtered.map((l) => ({
            nom: `${l.first_name} ${l.last_name}`,
            email: l.email ?? "",
            telephone: l.phone ?? "",
            poste: l.position ?? "",
            entreprise: l.companies?.name ?? "",
            statut: l.status ?? "",
            parcours: (l as any).training_programs?.name ?? "",
            type_formation: (l as any).training_types?.name ?? "",
          })),
          [
            { key: "nom", label: "Nom" }, { key: "email", label: "Email" },
            { key: "telephone", label: "Téléphone" }, { key: "poste", label: "Poste" },
            { key: "entreprise", label: "Entreprise" }, { key: "statut", label: "Statut" },
            { key: "parcours", label: "Parcours" }, { key: "type_formation", label: "Type formation" },
          ],
          "apprenants", fmt
        )} />
        {!isRestrictedExterne && !isReadOnly && (
          <>
            <Button variant="outline" size="sm" onClick={() => setVisioImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Import Visioformation
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const buf = generateVisioformationImportXlsx(filtered);
              const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "visioformation-import.xlsx";
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <FileDown className="h-4 w-4 mr-2" /> Export Visioformation
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deleting}
                style={{ borderColor: "#e74c3c", color: "#e74c3c" }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Suppression..." : `Supprimer (${selectedIds.size})`}
              </Button>
            )}
            <Button onClick={() => setOpen(true)} style={{ background: "#FF6B35", color: "white" }}>
              <Plus className="h-4 w-4 mr-2" /> Nouvel apprenant
            </Button>
          </>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#8399a9" }}>
        {filtered.length} apprenant{filtered.length > 1 ? "s" : ""} sur {learners.length}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {!isRestrictedExterne && !isReadOnly && (
                <TableHead style={{ width: 30 }}>
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
                </TableHead>
              )}
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Parcours</TableHead>
              <TableHead>Type formation</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8" style={{ color: "#8399a9" }}>
                  Aucun apprenant trouvé
                </TableCell>
              </TableRow>
            ) : filtered.map((l) => {
              const sc = statusColors[l.status] ?? { bg: "#f0f0f0", text: "#666", label: l.status };
              return (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/learners/${l.id}`)}>
                  {!isRestrictedExterne && !isReadOnly && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {l.first_name} {l.last_name}
                  </TableCell>
                  <TableCell>{l.email ?? "—"}</TableCell>
                  <TableCell>{formatPhone(l.phone)}</TableCell>
                  <TableCell>{l.position ?? "—"}</TableCell>
                  <TableCell>
                    {l.companies && l.company_id ? (
                      <span
                        onClick={() => router.push(`/clients/${l.company_id}`)}
                        style={{ color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}
                      >
                        {l.companies.name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span style={{ background: sc.bg, color: sc.text, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                      {sc.label}
                    </span>
                  </TableCell>
                  <TableCell>{l.training_programs?.name ?? "—"}</TableCell>
                  <TableCell>{l.training_types?.name ?? "—"}</TableCell>
                  <TableCell>
                    {!isRestrictedExterne && !isReadOnly && (
                    <button
                      onClick={() => {
                        if (confirmDelete(isRestrictedExterne || isReadOnly, "Supprimer ? Cette action est irréversible.")) {
                          handleDeleteLearner(l.id);
                        }
                      }}
                      style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Nouvel apprenant</h3>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>✕</button>
            </div>
            <div style={{ padding: 24 }} className="space-y-4">
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
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Poste</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Entreprise</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                  <option value="">Sélectionner</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="actuel">Actuel</option>
                  <option value="ancien">Ancien</option>
                  <option value="futur">Futur</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Parcours</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
                  <option value="">Sélectionner</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Type de formation</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.training_type_id} onChange={(e) => setForm({ ...form, training_type_id: e.target.value })}>
                  <option value="">Sélectionner</option>
                  {trainingTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Expert assigné</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.expert_id} onChange={(e) => setForm({ ...form, expert_id: e.target.value })}>
                  <option value="">Sélectionner</option>
                  {experts.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={handleSave} disabled={saving || !form.first_name.trim() || !form.last_name.trim()} className="w-full" style={{ background: "#FF6B35", color: "white" }}>
                {saving ? "Enregistrement..." : "Créer l'apprenant"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <VisioformationImportModal
        open={visioImportOpen}
        onClose={() => setVisioImportOpen(false)}
        learners={learners.map((l) => ({ id: l.id, email: l.email }))}
        companies={companies}
      />
    </>
  );
}
