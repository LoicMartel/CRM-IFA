"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface LeadSource {
  id: string;
  name: string;
  created_at: string;
}

export function ReglagesView({ leadSources }: { leadSources: LeadSource[] }) {
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
      alert(error.message.includes("lead_sources_name_key")
        ? "Cette source existe déjà."
        : "Erreur : " + error.message);
    } else {
      setNewSource("");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer la source « ${name} » ? Les contacts liés garderont leur source actuelle mais elle ne sera plus sélectionnable.`)) return;
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase.from("lead_sources").delete().eq("id", id);
    if (error) {
      alert("Impossible de supprimer : " + error.message);
    } else {
      router.refresh();
    }
    setDeleting(null);
  }

  return (
    <div>
      {/* Sources */}
      <div className="lca-card" style={{ padding: 24, maxWidth: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Tag style={{ width: 20, height: 20, color: "#1a6b9c" }} />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a3a", margin: 0 }}>Sources</h2>
        </div>
        <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 16, lineHeight: 1.5 }}>
          Gérez les sources utilisées pour les leads, prospects et clients (ex: Meta ads, LinkedIn, Prospection...).
        </p>

        {/* Add form */}
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

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {leadSources.length === 0 ? (
            <p style={{ color: "#8399a9", fontSize: 13, textAlign: "center", padding: 20 }}>Aucune source définie</p>
          ) : (
            leadSources.map((src) => (
              <div
                key={src.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderBottom: "1px solid #f0f4f8",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: "#1a2a3a" }}>{src.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(src.id, src.name)}
                  disabled={deleting === src.id}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: deleting === src.id ? "#ccc" : "#c62828", padding: 4,
                  }}
                  title="Supprimer cette source"
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
