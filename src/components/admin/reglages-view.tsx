"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Tag, GraduationCap, BookOpen, Receipt, Megaphone, Award, Hash, Pencil, Settings, Target, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import type { FiscalMode } from "@/lib/fiscal-year";
import { ObjectifsCommerciauxTab } from "@/components/admin/objectifs-commerciaux-tab";

interface NamedItem {
  id: string;
  name: string;
  created_at: string;
}

interface AccountManagerOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface UserTargetRow {
  id: string;
  team_member_id: string;
  month: string;
  target_amount: number;
}

export function ReglagesView({
  leadSources,
  trainingPrograms,
  trainingTypes,
  fundingTypes,
  marketingProviders,
  expertises,
  postChannels,
  fiscalMode: initialFiscalMode = "sep-aug",
  accountManagers = [],
  userTargets = [],
}: {
  leadSources: NamedItem[];
  trainingPrograms: NamedItem[];
  trainingTypes: NamedItem[];
  fundingTypes: NamedItem[];
  marketingProviders: NamedItem[];
  expertises: NamedItem[];
  postChannels: { id: string; slug: string; label: string; color_bg: string; color_text: string; is_veille: boolean; display_order: number }[];
  fiscalMode?: FiscalMode;
  accountManagers?: AccountManagerOption[];
  userTargets?: UserTargetRow[];
}) {
  const router = useRouter();
  const [fiscalMode, setFiscalMode] = useState<FiscalMode>(initialFiscalMode);
  const [fiscalSaving, setFiscalSaving] = useState(false);

  async function handleFiscalModeChange(newMode: FiscalMode) {
    setFiscalSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("crm_settings")
      .update({ value: newMode })
      .eq("key", "fiscal_year_mode");
    setFiscalSaving(false);
    if (error) {
      alert("Erreur lors de la sauvegarde : " + error.message);
      return;
    }
    setFiscalMode(newMode);
    router.refresh();
  }

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList style={{ flexWrap: "wrap", height: "auto" }}>
        <TabsTrigger value="general" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Settings style={{ width: 14, height: 14 }} /> Général
        </TabsTrigger>
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
        <TabsTrigger value="canaux" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Hash style={{ width: 14, height: 14 }} /> Canaux
        </TabsTrigger>
        <TabsTrigger value="objectifs" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Target style={{ width: 14, height: 14 }} /> Objectifs Commerciaux
        </TabsTrigger>
        <TabsTrigger value="ressources" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ExternalLink style={{ width: 14, height: 14 }} /> Ressources
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" style={{ marginTop: 20 }}>
        <div className="lca-card" style={{ maxWidth: 500 }}>
          <div className="lca-bar-gradient" />
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Settings style={{ width: 20, height: 20, color: "#1E2A5A" }} />
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 16, margin: 0 }}>Année fiscale</h3>
            </div>
            <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 16 }}>
              Ce choix s&apos;applique à tous les rapports, graphiques et filtres de période du CRM.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleFiscalModeChange("jan-dec")}
                disabled={fiscalSaving}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 8, cursor: fiscalSaving ? "wait" : "pointer",
                  border: fiscalMode === "jan-dec" ? "2px solid #1E2A5A" : "2px solid #dce8f0",
                  background: fiscalMode === "jan-dec" ? "#f0f4ff" : "white",
                  fontWeight: fiscalMode === "jan-dec" ? 700 : 500,
                  color: "#1a2a3a", fontSize: 14,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Janvier → Décembre</div>
                <div style={{ fontSize: 11, color: "#8399a9" }}>Année civile</div>
              </button>
              <button
                onClick={() => handleFiscalModeChange("sep-aug")}
                disabled={fiscalSaving}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 8, cursor: fiscalSaving ? "wait" : "pointer",
                  border: fiscalMode === "sep-aug" ? "2px solid #1E2A5A" : "2px solid #dce8f0",
                  background: fiscalMode === "sep-aug" ? "#f0f4ff" : "white",
                  fontWeight: fiscalMode === "sep-aug" ? 700 : 500,
                  color: "#1a2a3a", fontSize: 14,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Septembre → Août</div>
                <div style={{ fontSize: 11, color: "#8399a9" }}>Année scolaire</div>
              </button>
            </div>
          </div>
        </div>
      </TabsContent>

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

      <TabsContent value="canaux" style={{ marginTop: 20 }}>
        <ChannelsCrudSection channels={postChannels} />
      </TabsContent>

      <TabsContent value="objectifs" style={{ marginTop: 20 }}>
        <ObjectifsCommerciauxTab
          accountManagers={accountManagers}
          userTargets={userTargets}
          fiscalMode={initialFiscalMode}
        />
      </TabsContent>

      <TabsContent value="ressources" style={{ marginTop: 20 }}>
        <ResourceLinksSection />
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

/* ── Section CRUD Canaux (Fil d'actualite) ── */

interface Channel {
  id: string; slug: string; label: string; color_bg: string; color_text: string; is_veille: boolean; display_order: number;
}

function ChannelsCrudSection({ channels }: { channels: Channel[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newColorBg, setNewColorBg] = useState("#e3f2fd");
  const [newColorText, setNewColorText] = useState("#1565c0");
  const [newIsVeille, setNewIsVeille] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [editLabel, setEditLabel] = useState("");

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label || saving) return;
    setSaving(true);
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const supabase = createClient();
    const maxOrder = channels.length > 0 ? Math.max(...channels.map(c => c.display_order)) : 0;
    const { error } = await supabase.from("post_channels").insert({
      slug, label, color_bg: newColorBg, color_text: newColorText, is_veille: newIsVeille, display_order: maxOrder + 1,
    });
    if (error) alert(error.message.includes("post_channels_slug_key") ? "Ce canal existe deja." : "Erreur : " + error.message);
    else { setNewLabel(""); router.refresh(); }
    setSaving(false);
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Supprimer le canal "${label}" ?`)) return;
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase.from("post_channels").delete().eq("id", id);
    if (error) alert("Impossible de supprimer : " + error.message);
    else router.refresh();
    setDeleting(null);
  }

  async function handleEditSave() {
    if (!editing || !editLabel.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("post_channels").update({ label: editLabel.trim() }).eq("id", editing.id);
    setEditing(null);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="lca-card" style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Hash style={{ width: 20, height: 20, color: "#1E2A5A" }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a", margin: 0 }}>Canaux du fil d'actualite</h2>
      </div>
      <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 16, lineHeight: 1.5 }}>
        Gerez les canaux disponibles dans le fil d'actualite. Chaque canal peut etre de type "Veille" (regroupe sous le menu Veille).
      </p>

      {/* Add form */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Nom du canal</label>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} placeholder="Ex: Commercial, RH..." disabled={saving} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Fond</label>
          <input type="color" value={newColorBg} onChange={(e) => setNewColorBg(e.target.value)} style={{ width: 36, height: 36, border: "1px solid #dce8f0", borderRadius: 6, cursor: "pointer" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4 }}>Texte</label>
          <input type="color" value={newColorText} onChange={(e) => setNewColorText(e.target.value)} style={{ width: 36, height: 36, border: "1px solid #dce8f0", borderRadius: 6, cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" id="is-veille" checked={newIsVeille} onChange={(e) => setNewIsVeille(e.target.checked)} />
          <label htmlFor="is-veille" style={{ fontSize: 12, color: "#5a6f80" }}>Veille</label>
        </div>
        <Button onClick={handleAdd} disabled={saving || !newLabel.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {channels.length === 0 ? (
          <p style={{ color: "#8399a9", fontSize: 13, textAlign: "center", padding: 20 }}>Aucun canal defini</p>
        ) : (
          channels.map((ch) => (
            <div key={ch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #f0f4f8" }}>
              {editing?.id === ch.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); }} style={{ maxWidth: 200 }} autoFocus />
                  <Button size="sm" onClick={handleEditSave}>OK</Button>
                  <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", fontSize: 12 }}>Annuler</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: ch.color_bg, color: ch.color_text, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{ch.label}</span>
                  {ch.is_veille && <span style={{ fontSize: 10, color: "#8399a9", fontStyle: "italic" }}>Veille</span>}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { setEditing(ch); setEditLabel(ch.label); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1E2A5A", padding: 4 }} title="Modifier">
                  <Pencil style={{ width: 14, height: 14 }} />
                </button>
                <button type="button" onClick={() => handleDelete(ch.id, ch.label)} disabled={deleting === ch.id}
                  style={{ background: "none", border: "none", cursor: "pointer", color: deleting === ch.id ? "#ccc" : "#c62828", padding: 4 }} title="Supprimer">
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Section Ressources ── */

interface ResourceLink {
  id: string;
  category: string;
  name: string;
  description: string | null;
  url: string;
  display_order: number;
}

const RESOURCE_CATEGORIES = [
  { value: "commercial", label: "Commercial" },
  { value: "production", label: "Production" },
  { value: "marketing", label: "Marketing" },
  { value: "admin", label: "Administration" },
];

function ResourceLinksSection() {
  const router = useRouter();
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", url: "", category: "commercial" });
  const [saving, setSaving] = useState(false);

  useState(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("resource_links").select("*").order("category").order("display_order");
      setLinks(data ?? []);
      setLoaded(true);
    })();
  });

  async function handleSave() {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    const supabase = createClient();

    if (editingId) {
      await supabase.from("resource_links").update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        category: form.category,
      }).eq("id", editingId);
    } else {
      const maxOrder = links.filter(l => l.category === form.category).reduce((max, l) => Math.max(max, l.display_order), -1);
      await supabase.from("resource_links").insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        category: form.category,
        display_order: maxOrder + 1,
      });
    }

    const { data } = await supabase.from("resource_links").select("*").order("category").order("display_order");
    setLinks(data ?? []);
    setForm({ name: "", description: "", url: "", category: "commercial" });
    setAdding(false);
    setEditingId(null);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette ressource ?")) return;
    const supabase = createClient();
    await supabase.from("resource_links").delete().eq("id", id);
    setLinks(links.filter(l => l.id !== id));
    router.refresh();
  }

  function startEdit(link: ResourceLink) {
    setEditingId(link.id);
    setForm({ name: link.name, description: link.description ?? "", url: link.url, category: link.category });
    setAdding(true);
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
    setForm({ name: "", description: "", url: "", category: "commercial" });
  }

  if (!loaded) return <div style={{ padding: 20, color: "#8399a9", fontSize: 13 }}>Chargement...</div>;

  const grouped = RESOURCE_CATEGORIES.map(cat => ({
    ...cat,
    items: links.filter(l => l.category === cat.value),
  })).filter(g => g.items.length > 0);

  return (
    <div className="lca-card" style={{ maxWidth: 600 }}>
      <div className="lca-bar-gradient" />
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ExternalLink style={{ width: 20, height: 20, color: "#1E2A5A" }} />
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", fontSize: 16, margin: 0 }}>Ressources</h3>
          </div>
          {!adding && (
            <button
              onClick={() => { setAdding(true); setEditingId(null); setForm({ name: "", description: "", url: "", category: "commercial" }); }}
              className="lca-btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, height: 32, fontSize: 12, padding: "0 14px" }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Ajouter
            </button>
          )}
        </div>

        <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 16, lineHeight: 1.5 }}>
          Configurez les liens rapides qui apparaissent dans les pages Ressources (Commerciales et Pédagogiques).
          Choisissez la catégorie pour définir où le lien apparaîtra.
        </p>

        {/* Add/Edit form */}
        {adding && (
          <div style={{ background: "#f8fbfd", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #e8ecf1" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>
              {editingId ? "Modifier la ressource" : "Nouvelle ressource"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Nom *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: ADV, Sales Deck..."
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #dce8f0", padding: "0 10px", fontSize: 13, background: "white" }}
                >
                  {RESOURCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Lien URL *</label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", marginBottom: 4, display: "block" }}>Description (optionnel)</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Supports de présentation"
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={cancelForm}>Annuler</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.url.trim()}
              >
                {saving ? "..." : editingId ? "Modifier" : "Ajouter"}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {grouped.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#8399a9", fontSize: 13 }}>
            Aucune ressource configurée.
          </div>
        )}

        {grouped.map(group => (
          <div key={group.value} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 8 }}>
              {group.label}
            </div>
            <div className="space-y-2">
              {group.items.map(link => (
                <div key={link.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  borderRadius: 8, border: "1px solid #e8ecf1", background: "white",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{link.name}</div>
                    {link.description && <div style={{ fontSize: 11, color: "#5a6f80" }}>{link.description}</div>}
                    <div style={{ fontSize: 11, color: "#8399a9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.url}</div>
                  </div>
                  <button onClick={() => startEdit(link)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1E2A5A", padding: 4 }} title="Modifier">
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={() => handleDelete(link.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }} title="Supprimer">
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
