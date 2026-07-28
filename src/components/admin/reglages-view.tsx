"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Tag, Calendar, MessageSquare, Video, CheckCircle, XCircle, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface LeadSource {
  id: string;
  name: string;
  created_at: string;
}

interface Integration {
  id: string;
  category: string;
  provider: string;
  label: string;
  enabled: boolean;
  config: Record<string, string>;
}

const CATEGORY_META: Record<string, { title: string; description: string; icon: typeof Calendar; configFields: { key: string; label: string; placeholder: string }[] }> = {
  calendar: {
    title: "Agendas",
    description: "Synchronisez vos agendas pour gérer les RDV directement depuis le CRM.",
    icon: Calendar,
    configFields: [
      { key: "calendar_id", label: "ID du calendrier", placeholder: "ex: email@gmail.com ou ID Outlook" },
      { key: "api_key", label: "Clé API (optionnel)", placeholder: "Clé API ou token" },
    ],
  },
  messaging: {
    title: "Messageries",
    description: "Connectez vos outils de messagerie pour centraliser les communications.",
    icon: MessageSquare,
    configFields: [
      { key: "webhook_url", label: "URL du webhook", placeholder: "https://hooks.slack.com/..." },
      { key: "channel_id", label: "ID du canal", placeholder: "ex: C01234ABCDE" },
    ],
  },
  video: {
    title: "Visioconférence",
    description: "Connectez vos outils de visio pour créer des liens de réunion automatiquement.",
    icon: Video,
    configFields: [
      { key: "meeting_link", label: "Lien de réunion par défaut", placeholder: "https://zoom.us/j/..." },
      { key: "api_key", label: "Clé API (optionnel)", placeholder: "Clé API ou token" },
    ],
  },
};

export function ReglagesView({ leadSources, integrations }: { leadSources: LeadSource[]; integrations: Integration[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SourcesSection leadSources={leadSources} />
      {(["calendar", "messaging", "video"] as const).map((cat) => (
        <IntegrationSection key={cat} category={cat} integrations={integrations.filter((i) => i.category === cat)} />
      ))}
    </div>
  );
}

/* ── Sources ── */

function SourcesSection({ leadSources }: { leadSources: LeadSource[] }) {
  const router = useRouter();
  const [newSource, setNewSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAdd() {
    const name = newSource.trim();
    if (!name || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("lead_sources").insert({ name });
    if (error) {
      alert(error.message.includes("lead_sources_name_key") ? "Cette source existe déjà." : "Erreur : " + error.message);
    } else {
      setNewSource("");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer la source « ${name} » ?`)) return;
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase.from("lead_sources").delete().eq("id", id);
    if (error) alert("Impossible de supprimer : " + error.message);
    else router.refresh();
    setDeleting(null);
  }

  return (
    <div className="lca-card" style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Tag style={{ width: 20, height: 20, color: "#1a6b9c" }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a", margin: 0 }}>Sources</h2>
      </div>
      <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 16, lineHeight: 1.5 }}>
        Gérez les sources utilisées pour les leads, prospects et clients.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Input
          value={newSource}
          onChange={(e) => setNewSource(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Nom de la nouvelle source..."
          className="flex-1"
          disabled={saving}
        />
        <Button onClick={handleAdd} disabled={saving || !newSource.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {leadSources.length === 0 ? (
          <p style={{ color: "#8399a9", fontSize: 13, textAlign: "center", padding: 20 }}>Aucune source définie</p>
        ) : (
          leadSources.map((src) => (
            <div key={src.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #f0f4f8" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1a2a3a" }}>{src.name}</span>
              <button type="button" onClick={() => handleDelete(src.id, src.name)} disabled={deleting === src.id}
                style={{ background: "none", border: "none", cursor: "pointer", color: deleting === src.id ? "#ccc" : "#c62828", padding: 4 }} title="Supprimer">
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Intégrations ── */

function IntegrationSection({ category, integrations }: { category: string; integrations: Integration[] }) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <div className="lca-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Icon style={{ width: 20, height: 20, color: "#1a6b9c" }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a", margin: 0 }}>{meta.title}</h2>
      </div>
      <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 20, lineHeight: 1.5 }}>{meta.description}</p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {integrations.map((integ) => (
          <IntegrationCard key={integ.id} integration={integ} configFields={meta.configFields} />
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({ integration, configFields }: { integration: Integration; configFields: { key: string; label: string; placeholder: string }[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(integration.enabled);
  const [config, setConfig] = useState<Record<string, string>>(integration.config ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges = enabled !== integration.enabled ||
    JSON.stringify(config) !== JSON.stringify(integration.config ?? {});

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("crm_integrations").update({ enabled, config, updated_at: new Date().toISOString() }).eq("id", integration.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div style={{
      border: `1px solid ${enabled ? "#a5d6a7" : "#e0e0e0"}`,
      borderRadius: 10, padding: 16, background: enabled ? "#f9fdf9" : "#fafafa",
      transition: "all 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {enabled
            ? <CheckCircle style={{ width: 16, height: 16, color: "#2e7d32" }} />
            : <XCircle style={{ width: 16, height: 16, color: "#bbb" }} />
          }
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a" }}>{integration.label}</span>
        </div>
        {/* Toggle */}
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          style={{
            width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: enabled ? "#2e7d32" : "#ccc",
            position: "relative", transition: "background 0.2s",
          }}
        >
          <span style={{
            position: "absolute", top: 2, left: enabled ? 20 : 2,
            width: 20, height: 20, borderRadius: "50%", background: "white",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
      </div>

      {/* Config fields (visible only when enabled) */}
      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {configFields.map((field) => (
            <div key={field.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#5a6f80", marginBottom: 3, display: "block" }}>{field.label}</label>
              <Input
                value={config[field.key] ?? ""}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {/* Save */}
      {hasChanges && (
        <Button onClick={handleSave} disabled={saving} size="sm" style={{ width: "100%" }}>
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : <><Save className="h-3 w-3 mr-1" /> Sauvegarder</>}
        </Button>
      )}
      {!hasChanges && saved && (
        <div style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600, textAlign: "center" }}>Sauvegardé !</div>
      )}
    </div>
  );
}
