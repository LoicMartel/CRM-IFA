"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Download, Trash2, FolderOpen, FileText, Image, Film, File, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";

interface Resource {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  created_at: string;
}

const CATEGORIES = [
  "Formation Formateur",
  "Formation Manager",
  "Formation Sales",
  "Formation Prise de Parole",
  "Slides — 10 Steps",
  "Slides — Marston",
  "Slides — Objections",
  "Slides — Habillage",
  "Time Management",
  "Vidéos",
  "Autre",
];

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="h-4 w-4" />;
  if (fileType.includes("image") || fileType.includes("png") || fileType.includes("jpg")) return <Image className="h-4 w-4" style={{ color: "#6a1b9a" }} />;
  if (fileType.includes("video") || fileType.includes("mp4") || fileType.includes("mov")) return <Film className="h-4 w-4" style={{ color: "#e65100" }} />;
  if (fileType.includes("pdf")) return <FileText className="h-4 w-4" style={{ color: "#c62828" }} />;
  return <FileText className="h-4 w-4" style={{ color: "#1a6b9c" }} />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ResourcesView({ resources }: { resources: Resource[] }) {
  const router = useRouter();
  const memberId = useCurrentMember();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ category: "", subcategory: "", description: "" });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Group resources by category
  const filtered = resources.filter((r) => {
    if (filterCategory && r.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped: Record<string, Resource[]> = {};
  filtered.forEach((r) => {
    const key = r.subcategory ? `${r.category} / ${r.subcategory}` : r.category;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  function toggleCategory(cat: string) {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    setExpandedCategories(next);
  }

  async function handleDownload(resource: Resource) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("resources").createSignedUrl(resource.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(resource: Resource) {
    if (!window.confirm(`Supprimer "${resource.name}" ?`)) return;
    const supabase = createClient();
    await supabase.storage.from("resources").remove([resource.file_path]);
    await supabase.from("resources").delete().eq("id", resource.id);
    router.refresh();
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || !uploadForm.category) return;
    setUploading(true);
    const supabase = createClient();

    for (const file of selectedFiles) {
      const filePath = `${uploadForm.category}/${uploadForm.subcategory ? uploadForm.subcategory + "/" : ""}${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage.from("resources").upload(filePath, file);
      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("resources").insert({
        name: file.name,
        category: uploadForm.category,
        subcategory: uploadForm.subcategory || null,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || file.name.split(".").pop() || null,
        description: uploadForm.description || null,
        uploaded_by: memberId || null,
      });
    }

    setUploading(false);
    setUploadOpen(false);
    setSelectedFiles([]);
    setUploadForm({ category: "", subcategory: "", description: "" });
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const totalFiles = resources.length;
  const totalSize = resources.reduce((a, r) => a + (r.file_size ?? 0), 0);

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3" style={{ maxWidth: 700 }}>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Ressources</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{totalFiles}</div>
          </div>
          <FolderOpen style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Catégories</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{Object.keys(grouped).length}</div>
          </div>
          <FolderOpen style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taille totale</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{formatSize(totalSize)}</div>
          </div>
          <FileText style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Ajouter des ressources
        </Button>
      </div>

      {/* File explorer */}
      <div className="space-y-2">
        {Object.keys(grouped).length === 0 ? (
          <div className="lca-card" style={{ padding: 40, textAlign: "center", color: "#8399a9" }}>
            <FolderOpen style={{ width: 40, height: 40, margin: "0 auto 12px", color: "#dce8f0" }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune ressource</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Commencez par ajouter des fichiers</div>
          </div>
        ) : (
          Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([category, files]) => {
            const isExpanded = expandedCategories.has(category);
            return (
              <div key={category} className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
                <button
                  onClick={() => toggleCategory(category)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
                    borderBottom: isExpanded ? "1px solid #e8ecf1" : "none",
                  }}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" style={{ color: "#8399a9" }} /> : <ChevronRight className="h-4 w-4" style={{ color: "#8399a9" }} />}
                  <FolderOpen className="h-4 w-4" style={{ color: "#FF6B35" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>{category}</span>
                  <span style={{ fontSize: 11, color: "#8399a9", marginLeft: "auto" }}>{files.length} fichier{files.length > 1 ? "s" : ""}</span>
                </button>
                {isExpanded && (
                  <div>
                    {files.map((r) => (
                      <div key={r.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 44px",
                        borderBottom: "1px solid #f0f4f8", fontSize: 13,
                      }}>
                        {getFileIcon(r.file_type)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                          {r.description && <div style={{ fontSize: 11, color: "#8399a9" }}>{r.description}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: "#8399a9", whiteSpace: "nowrap" }}>{formatSize(r.file_size)}</span>
                        <button onClick={() => handleDownload(r)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }} title="Télécharger">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(r)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }} title="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Upload sheet */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Ajouter des ressources</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <Input value={uploadForm.subcategory} onChange={(e) => setUploadForm({ ...uploadForm, subcategory: e.target.value })} placeholder="Optionnel (ex: Coaching, BtoB...)" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} placeholder="Optionnel..." />
            </div>
            <div className="space-y-2">
              <Label>Fichiers</Label>
              <input ref={fileRef} type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  height: 40, borderRadius: 8, padding: "0 20px", fontSize: 13, fontWeight: 600,
                  border: "1px solid #dce8f0", background: "white", color: "#1a6b9c",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <Upload className="h-4 w-4" />
                Choisir des fichiers
              </button>
              {selectedFiles.length > 0 && (
                <div style={{ fontSize: 12, color: "#1a2a3a", marginTop: 4 }}>
                  {selectedFiles.length} fichier{selectedFiles.length > 1 ? "s" : ""} sélectionné{selectedFiles.length > 1 ? "s" : ""}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                    {selectedFiles.map((f, i) => (
                      <span key={i} style={{ fontSize: 11, color: "#8399a9" }}>{f.name} ({formatSize(f.size)})</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0 || !uploadForm.category}
              className="w-full"
            >
              {uploading ? "Upload en cours..." : `Envoyer ${selectedFiles.length} fichier${selectedFiles.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
