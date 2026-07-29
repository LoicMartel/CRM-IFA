"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Tag, GraduationCap, BookOpen, Receipt, Megaphone, Award } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

interface NamedItem {
  id: string;
  name: string;
  created_at: string;
}

export function ReglagesView({
  leadSources,
  trainingPrograms,
  trainingTypes,
  fundingTypes,
  marketingProviders,
  expertises,
}: {
  leadSources: NamedItem[];
  trainingPrograms: NamedItem[];
  trainingTypes: NamedItem[];
  fundingTypes: NamedItem[];
  marketingProviders: NamedItem[];
  expertises: NamedItem[];
}) {
  return (
    <Tabs defaultValue="sources" className="w-full">
      <TabsList>
        <TabsTrigger value="sources" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Tag style={{ width: 14, height: 14 }} /> Sources
        </TabsTrigger>
        <TabsTrigger value="parcours" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <GraduationCap style={{ width: 14, height: 14 }} /> Parcours de formation
        </TabsTrigger>
        <TabsTrigger value="types-formation" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <BookOpen style={{ width: 14, height: 14 }} /> Types de formation
        </TabsTrigger>
        <TabsTrigger value="financement" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Receipt style={{ width: 14, height: 14 }} /> Types de financement
        </TabsTrigger>
        <TabsTrigger value="prestataires" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Megaphone style={{ width: 14, height: 14 }} /> Prestataires marketing
        </TabsTrigger>
        <TabsTrigger value="expertises" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Award style={{ width: 14, height: 14 }} /> Expertises
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sources" style={{ marginTop: 20 }}>
        <CrudSection
          icon={<Tag style={{ width: 20, height: 20, color: "#1E2A5A" }} />}
          title="Sources"
          description="Gérez les sources utilisées pour les leads, prospects et clients."
          placeholder="Nom de la nouvelle source..."
          table="lead_sources"
          uniqueKey="lead_sources_name_key"
          duplicateMessage="Cette source existe déjà."
          emptyMessage="Aucune source définie"
          items={leadSources}
        />
      </TabsContent>

      <TabsContent value="parcours" style={{ marginTop: 20 }}>
        <CrudSection
          icon={<GraduationCap style={{ width: 20, height: 20, color: "#1E2A5A" }} />}
          title="Parcours de formation"
          description="Gérez les parcours de formation disponibles dans les plans de formation."
          placeholder="Nom du nouveau parcours..."
          table="training_programs"
          uniqueKey="training_programs_name_key"
          duplicateMessage="Ce parcours existe déjà."
          emptyMessage="Aucun parcours défini"
          items={trainingPrograms}
        />
      </TabsContent>

      <TabsContent value="types-formation" style={{ marginTop: 20 }}>
        <CrudSection
          icon={<BookOpen style={{ width: 20, height: 20, color: "#1E2A5A" }} />}
          title="Types de formation"
          description="Gérez les types de formation utilisés dans les plans de formation."
          placeholder="Nom du nouveau type..."
          table="training_types"
          uniqueKey="training_types_name_key"
          duplicateMessage="Ce type existe déjà."
          emptyMessage="Aucun type défini"
          items={trainingTypes}
        />
      </TabsContent>

      <TabsContent value="financement" style={{ marginTop: 20 }}>
        <CrudSection
          icon={<Receipt style={{ width: 20, height: 20, color: "#1E2A5A" }} />}
          title="Types de financement"
          description="Gérez les types de financement disponibles dans la facturation."
          placeholder="Nom du nouveau type de financement..."
          table="funding_types"
          uniqueKey="funding_types_name_key"
          duplicateMessage="Ce type de financement existe déjà."
          emptyMessage="Aucun type de financement défini"
          items={fundingTypes}
        />
      </TabsContent>

      <TabsContent value="prestataires" style={{ marginTop: 20 }}>
        <CrudSection
          icon={<Megaphone style={{ width: 20, height: 20, color: "#1E2A5A" }} />}
          title="Prestataires marketing"
          description="Gerez les prestataires marketing disponibles dans les menus deroulants (depenses, suivi, rapports)."
          placeholder="Nom du nouveau prestataire..."
          table="marketing_providers"
          uniqueKey="marketing_providers_name_key"
          duplicateMessage="Ce prestataire existe deja."
          emptyMessage="Aucun prestataire defini"
          items={marketingProviders}
        />
      </TabsContent>

      <TabsContent value="expertises" style={{ marginTop: 20 }}>
        <CrudSection
          icon={<Award style={{ width: 20, height: 20, color: "#1E2A5A" }} />}
          title="Expertises"
          description="Gerez les expertises disponibles lors de la creation ou modification d'un membre de l'equipe."
          placeholder="Nom de la nouvelle expertise..."
          table="expertises"
          uniqueKey="expertises_name_key"
          duplicateMessage="Cette expertise existe deja."
          emptyMessage="Aucune expertise definie"
          items={expertises}
        />
      </TabsContent>
    </Tabs>
  );
}

/* ── Section CRUD générique ── */

function CrudSection({
  icon,
  title,
  description,
  placeholder,
  table,
  uniqueKey,
  duplicateMessage,
  emptyMessage,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  placeholder: string;
  table: string;
  uniqueKey: string;
  duplicateMessage: string;
  emptyMessage: string;
  items: NamedItem[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from(table).insert({ name });
    if (error) {
      alert(error.message.includes(uniqueKey) ? duplicateMessage : "Erreur : " + error.message);
    } else {
      setNewName("");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer « ${name} » ?`)) return;
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) alert("Impossible de supprimer : " + error.message);
    else router.refresh();
    setDeleting(null);
  }

  return (
    <div className="lca-card" style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        {icon}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a", margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 16, lineHeight: 1.5 }}>
        {description}
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder={placeholder}
          className="flex-1"
          disabled={saving}
        />
        <Button onClick={handleAdd} disabled={saving || !newName.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {items.length === 0 ? (
          <p style={{ color: "#8399a9", fontSize: 13, textAlign: "center", padding: 20 }}>{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #f0f4f8" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1a2a3a" }}>{item.name}</span>
              <button type="button" onClick={() => handleDelete(item.id, item.name)} disabled={deleting === item.id}
                style={{ background: "none", border: "none", cursor: "pointer", color: deleting === item.id ? "#ccc" : "#c62828", padding: 4 }} title="Supprimer">
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
