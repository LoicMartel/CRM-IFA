"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Upload, Trash2, UserPlus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  contact_list_members: { contact_id: string }[];
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  companies: { name: string } | { name: string }[] | null;
}

function getCompanyName(c: Contact): string {
  if (!c.companies) return "";
  if (Array.isArray(c.companies)) return c.companies[0]?.name ?? "";
  return c.companies.name;
}

export function ContactListsView({
  lists,
  contacts,
}: {
  lists: ContactList[];
  contacts: Contact[];
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const fileRef = useRef<HTMLInputElement>(null);

  // Create list
  const [createOpen, setCreateOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [listDesc, setListDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Add members
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [adding, setAdding] = useState(false);

  // Import CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importListId, setImportListId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; duplicates: number; errors: number } | null>(null);

  async function handleCreateList() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("contact_lists").insert({
      name: listName,
      description: listDesc || null,
      created_by: currentMemberId || null,
    });
    setSaving(false);
    setCreateOpen(false);
    setListName("");
    setListDesc("");
    router.refresh();
  }

  async function handleDeleteList(id: string) {
    if (!window.confirm("Supprimer cette liste et tous ses membres ?")) return;
    const supabase = createClient();
    await supabase.from("contact_lists").delete().eq("id", id);
    router.refresh();
  }

  function openMembers(list: ContactList) {
    setSelectedList(list);
    setMemberSearch("");
    setMembersOpen(true);
  }

  async function handleAddMember(contactId: string) {
    if (!selectedList) return;
    setAdding(true);
    const supabase = createClient();
    await supabase.from("contact_list_members").insert({
      list_id: selectedList.id,
      contact_id: contactId,
    });
    setAdding(false);
    router.refresh();
    // Update local state
    setSelectedList({
      ...selectedList,
      contact_list_members: [...selectedList.contact_list_members, { contact_id: contactId }],
    });
  }

  async function handleRemoveMember(contactId: string) {
    if (!selectedList) return;
    const supabase = createClient();
    await supabase.from("contact_list_members")
      .delete()
      .eq("list_id", selectedList.id)
      .eq("contact_id", contactId);
    router.refresh();
    setSelectedList({
      ...selectedList,
      contact_list_members: selectedList.contact_list_members.filter((m) => m.contact_id !== contactId),
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setImportFile(file);
  }

  async function handleImportCSV() {
    if (!importFile || !importListId) return;
    const file = importFile;
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const headerCols = lines[0].split(/[,;\t]/);
    const emailIdx = headerCols.findIndex((h) => {
      const normalized = h.toLowerCase().replace(/[^a-z]/g, "");
      return ["email", "emails", "emailaddress", "adresseemail", "mail", "mails", "adressemail"].includes(normalized);
    });
    if (emailIdx === -1) {
      alert("Colonne email non trouvée. Noms acceptés : email, emails, e-mail, e-mails, mail, adresse email...");
      setImporting(false);
      return;
    }

    const supabase = createClient();
    let added = 0, duplicates = 0, errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/);
      const email = cols[emailIdx]?.trim().toLowerCase();
      if (!email || !email.includes("@")) { errors++; continue; }

      // Find contact by email
      const contact = contacts.find((c) => c.email?.toLowerCase() === email);
      if (!contact) { errors++; continue; }

      // Check duplicate
      const { data: existing } = await supabase
        .from("contact_list_members")
        .select("id")
        .eq("list_id", importListId)
        .eq("contact_id", contact.id)
        .maybeSingle();

      if (existing) { duplicates++; continue; }

      await supabase.from("contact_list_members").insert({
        list_id: importListId,
        contact_id: contact.id,
      });
      added++;
    }

    setImportResult({ added, duplicates, errors });
    setImporting(false);
    setImportFile(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const memberIds = new Set(selectedList?.contact_list_members.map((m) => m.contact_id) ?? []);
  const availableContacts = contacts.filter((c) => {
    if (memberIds.has(c.id)) return false;
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });
  const currentMembers = contacts.filter((c) => memberIds.has(c.id));

  return (
    <>
      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Importer CSV
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle liste
        </Button>
      </div>

      {/* Lists table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead style={{ textAlign: "right" }}>Contacts</TableHead>
              <TableHead style={{ width: 120 }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Aucune liste de contacts
                </TableCell>
              </TableRow>
            ) : (
              lists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{l.description ?? "—"}</TableCell>
                  <TableCell style={{ textAlign: "right", fontWeight: 600 }}>{l.contact_list_members.length}</TableCell>
                  <TableCell>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button size="sm" variant="outline" onClick={() => openMembers(l)}>
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <button onClick={() => handleDeleteList(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create list sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nouvelle liste de contacts</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Ex: Prospects CPF" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={listDesc} onChange={(e) => setListDesc(e.target.value)} placeholder="Optionnel..." />
            </div>
            <Button onClick={handleCreateList} disabled={saving || !listName.trim()} className="w-full">
              {saving ? "Création..." : "Créer la liste"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Members sheet */}
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Membres : {selectedList?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {/* Current members */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1E2A5A", textTransform: "uppercase" }}>
              Membres actuels ({currentMembers.length})
            </div>
            {currentMembers.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {currentMembers.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#f8fbfd", borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</span>
                      <span style={{ color: "#8399a9", marginLeft: 8 }}>{c.email}</span>
                    </div>
                    <button onClick={() => handleRemoveMember(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c" }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search and add */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1E2A5A", textTransform: "uppercase", marginTop: 16 }}>
              Ajouter des contacts
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou email..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="pl-9" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
              {availableContacts.slice(0, 50).map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", border: "1px solid #dce8f0", borderRadius: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</span>
                    <span style={{ color: "#8399a9", marginLeft: 8, fontSize: 12 }}>{c.email}</span>
                    {getCompanyName(c) && <span style={{ color: "#1E2A5A", marginLeft: 8, fontSize: 11 }}>{getCompanyName(c)}</span>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddMember(c.id)} disabled={adding} style={{ height: 28, fontSize: 11 }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {availableContacts.length > 50 && (
                <p style={{ fontSize: 11, color: "#8399a9", textAlign: "center" }}>
                  {availableContacts.length - 50} contacts supplémentaires — affinez votre recherche
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Import CSV sheet */}
      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Importer un CSV</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            <p style={{ fontSize: 13, color: "#5a6f80" }}>
              Importez un fichier CSV contenant une colonne "email". Les contacts sont
              matchés par email avec les contacts existants dans le CRM. Les doublons sont ignorés.
            </p>
            <div className="space-y-2">
              <Label>Liste cible *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={importListId}
                onChange={(e) => setImportListId(e.target.value)}
              >
                <option value="">Sélectionner une liste</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.contact_list_members.length} contacts)</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fichier CSV</Label>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} style={{ display: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={importing || !importListId}
                  style={{
                    height: 40, borderRadius: 8, padding: "0 20px", fontSize: 13, fontWeight: 600,
                    border: "1px solid #dce8f0", background: "white", color: "#1E2A5A",
                    cursor: importing || !importListId ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    opacity: importing || !importListId ? 0.5 : 1,
                  }}
                >
                  <Upload className="h-4 w-4" />
                  Choisir un fichier
                </button>
                <span style={{ fontSize: 13, color: importFile ? "#1a2a3a" : "#8399a9" }}>
                  {importFile ? importFile.name : "Aucun fichier choisi"}
                </span>
              </div>
            </div>
            {importFile && !importing && (
              <Button
                onClick={handleImportCSV}
                disabled={!importListId || !importFile}
                className="w-full"
              >
                Lancer l'import
              </Button>
            )}
            {importing && <p style={{ fontSize: 13, color: "#1E2A5A" }}>Import en cours...</p>}
            {importResult && (
              <div style={{ padding: 12, borderRadius: 8, background: "#f8fbfd", fontSize: 13 }}>
                <p style={{ fontWeight: 600, color: "#27ae60" }}>{importResult.added} contacts ajoutés</p>
                {importResult.duplicates > 0 && <p style={{ color: "#e65100" }}>{importResult.duplicates} doublons ignorés</p>}
                {importResult.errors > 0 && <p style={{ color: "#e74c3c" }}>{importResult.errors} emails non trouvés dans le CRM</p>}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
