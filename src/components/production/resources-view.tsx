"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search, Download, Trash2, FolderOpen, Folder, FileText, Image, Film, File,
  ChevronRight, Upload, ArrowLeft, ArrowUpDown, SortAsc, Calendar, FileType, HardDrive,
} from "lucide-react";
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

interface FolderNode {
  name: string;
  children?: FolderNode[];
}

const FOLDER_TREE: FolderNode[] = [
  { name: "Formation Formateur" },
  {
    name: "Formation Manager",
    children: [
      { name: "Coaching", children: [{ name: "PDF" }] },
    ],
  },
  {
    name: "Formation Sales",
    children: [
      { name: "BtoB" },
      { name: "BtoC", children: [{ name: "10 Steps" }] },
      {
        name: "Habillage",
        children: [
          { name: "Bandeau" },
          { name: "Charte graphique" },
          { name: "Images carrés" },
        ],
      },
      {
        name: "Marston",
        children: [
          { name: "Posture Consultant" },
          { name: "Prospect" },
        ],
      },
      { name: "Traitement des objections" },
    ],
  },
  { name: "Formation prise de parole public" },
  { name: "Slides" },
  { name: "Time Management" },
  {
    name: "Vidéos",
    children: [
      { name: "CNV" },
      { name: "Leadership" },
      { name: "Opportunités" },
      { name: "Perception" },
      { name: "Performance" },
      { name: "Persistence" },
      { name: "Peur" },
      { name: "Prise Parole en Public" },
      { name: "Ratatouille Hersey Blanchard" },
      { name: "Travail, répétition, entraînement" },
    ],
  },
];

type SortMode = "name" | "date" | "type" | "size";

function getFileIcon(fileType: string | null, size: "sm" | "lg" = "lg") {
  const cls = size === "lg" ? "h-8 w-8" : "h-4 w-4";
  if (!fileType) return <File className={cls} style={{ color: "#8399a9" }} />;
  const t = fileType.toLowerCase();
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("gif") || t.includes("svg"))
    return <Image className={cls} style={{ color: "#6a1b9a" }} />;
  if (t.includes("video") || t.includes("mp4") || t.includes("mov") || t.includes("avi"))
    return <Film className={cls} style={{ color: "#e65100" }} />;
  if (t.includes("pdf"))
    return <FileText className={cls} style={{ color: "#c62828" }} />;
  if (t.includes("pptx") || t.includes("ppt") || t.includes("presentation") || t.includes("powerpoint") || t.includes("pages"))
    return <FileText className={cls} style={{ color: "#e65100" }} />;
  if (t.includes("doc") || t.includes("word"))
    return <FileText className={cls} style={{ color: "#1a6b9c" }} />;
  if (t.includes("xls") || t.includes("sheet") || t.includes("excel"))
    return <FileText className={cls} style={{ color: "#2e7d32" }} />;
  return <FileText className={cls} style={{ color: "#1a6b9c" }} />;
}

function getFileTypeLabel(fileType: string | null): string {
  if (!fileType) return "Fichier";
  const t = fileType.toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("gif") || t.includes("svg")) return "Image";
  if (t.includes("video") || t.includes("mp4") || t.includes("mov")) return "Vidéo";
  if (t.includes("pptx") || t.includes("ppt") || t.includes("presentation") || t.includes("powerpoint")) return "PowerPoint";
  if (t.includes("pages")) return "Pages";
  if (t.includes("doc") || t.includes("word")) return "Word";
  if (t.includes("xls") || t.includes("sheet") || t.includes("excel")) return "Excel";
  return "Fichier";
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function getFoldersAtPath(path: string[]): FolderNode[] {
  let nodes = FOLDER_TREE;
  for (const segment of path) {
    const found = nodes.find((n) => n.name === segment);
    if (!found?.children) return [];
    nodes = found.children;
  }
  return nodes;
}

function getResourcePath(r: Resource): string {
  if (r.subcategory) return `${r.category}/${r.subcategory}`;
  return r.category;
}

function getAllFolderPaths(nodes: FolderNode[], prefix: string[] = []): { name: string; path: string[] }[] {
  const result: { name: string; path: string[] }[] = [];
  for (const node of nodes) {
    const path = [...prefix, node.name];
    result.push({ name: node.name, path });
    if (node.children) {
      result.push(...getAllFolderPaths(node.children, path));
    }
  }
  return result;
}

function buildAllSubPaths(nodes: FolderNode[], prefix: string = ""): string[] {
  const paths: string[] = [];
  for (const n of nodes) {
    const p = prefix ? `${prefix}/${n.name}` : n.name;
    paths.push(p);
    if (n.children) paths.push(...buildAllSubPaths(n.children, p));
  }
  return paths;
}

export function ResourcesView({ resources }: { resources: Resource[] }) {
  const router = useRouter();
  const memberId = useCurrentMember();
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadSubcategory, setUploadSubcategory] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const currentPathStr = currentPath.join("/");
  const subfolders = getFoldersAtPath(currentPath);
  const allFolders = useMemo(() => getAllFolderPaths(FOLDER_TREE), []);

  // Files at current folder level
  const filesAtCurrentLevel = resources.filter((r) => {
    const rPath = getResourcePath(r);
    if (currentPath.length === 0) {
      return !FOLDER_TREE.some((f) => rPath.startsWith(f.name + "/") || rPath === f.name);
    }
    return rPath === currentPathStr;
  });

  // Sort files
  const sortedFiles = useMemo(() => {
    const sorted = [...filesAtCurrentLevel];
    switch (sortMode) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "fr"));
        break;
      case "date":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "type":
        sorted.sort((a, b) => (a.file_type ?? "").localeCompare(b.file_type ?? ""));
        break;
      case "size":
        sorted.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0));
        break;
    }
    return sorted;
  }, [filesAtCurrentLevel, sortMode]);

  // Sort subfolders by name
  const sortedSubfolders = useMemo(() => {
    return [...subfolders].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [subfolders]);

  // Search: matches both folders and files
  const isSearching = search.length > 0;
  const searchMatchedFolders = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase();
    return allFolders.filter((f) =>
      f.name.toLowerCase().includes(q) || f.path.join("/").toLowerCase().includes(q)
    );
  }, [search, isSearching, allFolders]);

  const searchMatchedFiles = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase();
    const files = resources.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.subcategory ?? "").toLowerCase().includes(q) ||
      getFileTypeLabel(r.file_type).toLowerCase().includes(q)
    );
    // Sort search results too
    switch (sortMode) {
      case "name": files.sort((a, b) => a.name.localeCompare(b.name, "fr")); break;
      case "date": files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "type": files.sort((a, b) => (a.file_type ?? "").localeCompare(b.file_type ?? "")); break;
      case "size": files.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0)); break;
    }
    return files;
  }, [search, isSearching, resources, sortMode]);

  function countResourcesInFolder(folderPath: string[]): number {
    const pathStr = folderPath.join("/");
    return resources.filter((r) => {
      const rPath = getResourcePath(r);
      return rPath === pathStr || rPath.startsWith(pathStr + "/");
    }).length;
  }

  function navigateToFolder(folderName: string) {
    setCurrentPath([...currentPath, folderName]);
  }

  function navigateToPath(path: string[]) {
    setCurrentPath(path);
    setSearch("");
  }

  function navigateBack() {
    setCurrentPath(currentPath.slice(0, -1));
  }

  function navigateToBreadcrumb(index: number) {
    setCurrentPath(currentPath.slice(0, index));
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

  function openUploadAtCurrentPath() {
    if (currentPath.length > 0) {
      setUploadCategory(currentPath[0]);
      setUploadSubcategory(currentPath.slice(1).join("/"));
    } else {
      setUploadCategory("");
      setUploadSubcategory("");
    }
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || !uploadCategory) return;
    setUploading(true);
    const supabase = createClient();

    for (const file of selectedFiles) {
      const filePath = `${uploadCategory}/${uploadSubcategory ? uploadSubcategory + "/" : ""}${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage.from("resources").upload(filePath, file);
      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("resources").insert({
        name: file.name,
        category: uploadCategory,
        subcategory: uploadSubcategory || null,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || file.name.split(".").pop() || null,
        description: uploadDescription || null,
        uploaded_by: memberId || null,
      });
    }

    setUploading(false);
    setUploadOpen(false);
    setSelectedFiles([]);
    setUploadCategory("");
    setUploadSubcategory("");
    setUploadDescription("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const totalFiles = resources.length;
  const totalSize = resources.reduce((a, r) => a + (r.file_size ?? 0), 0);

  const SORT_OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
    { value: "name", label: "Nom", icon: <SortAsc className="h-3.5 w-3.5" /> },
    { value: "date", label: "Date", icon: <Calendar className="h-3.5 w-3.5" /> },
    { value: "type", label: "Type", icon: <FileType className="h-3.5 w-3.5" /> },
    { value: "size", label: "Taille", icon: <HardDrive className="h-3.5 w-3.5" /> },
  ];

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
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Dossiers</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{allFolders.length}</div>
          </div>
          <Folder style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
        <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Taille totale</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{formatSize(totalSize)}</div>
          </div>
          <FileText style={{ width: 16, height: 16, color: "#8399a9" }} />
        </div>
      </div>

      {/* Toolbar: Search + Sort + Import */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un dossier ou fichier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-72"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "#e8ecf1", border: "none", borderRadius: "50%", width: 18, height: 18,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  fontSize: 11, color: "#5a6a7a", fontWeight: 700,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort / Organiser */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              style={{
                height: 36, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600,
                border: "1px solid #dce8f0", background: "white", color: "#1a2a3a",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <ArrowUpDown className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />
              Organiser
              <span style={{ fontSize: 11, color: "#8399a9", marginLeft: 2 }}>
                {SORT_OPTIONS.find((o) => o.value === sortMode)?.label}
              </span>
            </button>
            {sortMenuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setSortMenuOpen(false)}
                />
                <div
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                    background: "white", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                    border: "1px solid #e8ecf1", padding: 4, minWidth: 180,
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortMode(opt.value); setSortMenuOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "8px 12px", border: "none", borderRadius: 6,
                        background: sortMode === opt.value ? "#f0f7ff" : "transparent",
                        cursor: "pointer", fontSize: 13, color: sortMode === opt.value ? "#1a6b9c" : "#1a2a3a",
                        fontWeight: sortMode === opt.value ? 600 : 400,
                      }}
                    >
                      <span style={{ color: sortMode === opt.value ? "#1a6b9c" : "#8399a9" }}>{opt.icon}</span>
                      {opt.label}
                      {sortMode === opt.value && (
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#1a6b9c" }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Import button */}
        <Button onClick={openUploadAtCurrentPath} style={{ gap: 8 }}>
          <Upload className="h-4 w-4" />
          Importer des fichiers
        </Button>
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8ecf1", fontSize: 13, fontWeight: 600, color: "#8399a9", display: "flex", justifyContent: "space-between" }}>
            <span>
              {searchMatchedFolders.length + searchMatchedFiles.length} résultat{(searchMatchedFolders.length + searchMatchedFiles.length) !== 1 ? "s" : ""} pour &quot;{search}&quot;
            </span>
          </div>

          {searchMatchedFolders.length === 0 && searchMatchedFiles.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8399a9" }}>
              <Search style={{ width: 32, height: 32, margin: "0 auto 12px", color: "#dce8f0" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun résultat</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Essayez avec d&apos;autres mots-clés</div>
            </div>
          ) : (
            <>
              {/* Matched folders */}
              {searchMatchedFolders.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "#8399a9", textTransform: "uppercase", letterSpacing: "0.05em", background: "#f8fafb" }}>
                    Dossiers ({searchMatchedFolders.length})
                  </div>
                  {searchMatchedFolders.map((f) => (
                    <button
                      key={f.path.join("/")}
                      onClick={() => navigateToPath(f.path)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                        borderBottom: "1px solid #f0f4f8", fontSize: 13, width: "100%",
                        background: "none", border: "none", borderBlockEnd: "1px solid #f0f4f8",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <Folder className="h-4 w-4" style={{ color: "#5AC8FA", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "#1a2a3a" }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: "#8399a9" }}>{f.path.join(" › ")}</div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5" style={{ color: "#8399a9" }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Matched files */}
              {searchMatchedFiles.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "#8399a9", textTransform: "uppercase", letterSpacing: "0.05em", background: "#f8fafb" }}>
                    Fichiers ({searchMatchedFiles.length})
                  </div>
                  {searchMatchedFiles.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                        borderBottom: "1px solid #f0f4f8", fontSize: 13,
                      }}
                    >
                      {getFileIcon(r.file_type ?? r.name.split(".").pop() ?? null, "sm")}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: "#8399a9", display: "flex", gap: 8 }}>
                          <span>{getResourcePath(r)}</span>
                          <span>·</span>
                          <span>{getFileTypeLabel(r.file_type)}</span>
                          <span>·</span>
                          <span>{formatSize(r.file_size)}</span>
                          <span>·</span>
                          <span>{formatDate(r.created_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(r)}
                        style={{
                          background: "#f0f7ff", border: "none", cursor: "pointer", color: "#1a6b9c",
                          padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4,
                          fontSize: 12, fontWeight: 500,
                        }}
                        title="Télécharger"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Télécharger</span>
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        style={{
                          background: "#fff5f5", border: "none", cursor: "pointer", color: "#e74c3c",
                          padding: "6px 8px", borderRadius: 6, display: "flex", alignItems: "center",
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Breadcrumb navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexWrap: "wrap" }}>
            {currentPath.length > 0 && (
              <button
                onClick={navigateBack}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4, color: "#1a6b9c",
                  padding: "4px 8px", borderRadius: 6, marginRight: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
            )}
            <button
              onClick={() => setCurrentPath([])}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontWeight: currentPath.length === 0 ? 700 : 500,
                color: currentPath.length === 0 ? "#1a2a3a" : "#1a6b9c",
                padding: "4px 6px", borderRadius: 4,
              }}
              onMouseEnter={(e) => { if (currentPath.length > 0) e.currentTarget.style.background = "#f0f7ff"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Supports formation
            </button>
            {currentPath.map((segment, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronRight className="h-3 w-3" style={{ color: "#8399a9" }} />
                <button
                  onClick={() => navigateToBreadcrumb(i + 1)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontWeight: i === currentPath.length - 1 ? 700 : 500,
                    color: i === currentPath.length - 1 ? "#1a2a3a" : "#1a6b9c",
                    padding: "4px 6px", borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { if (i < currentPath.length - 1) e.currentTarget.style.background = "#f0f7ff"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  {segment}
                </button>
              </span>
            ))}
          </div>

          {/* Folder & File Grid */}
          <div className="lca-card" style={{ padding: "20px 24px", minHeight: 200 }}>
            {sortedSubfolders.length === 0 && sortedFiles.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8399a9", padding: "40px 0" }}>
                <FolderOpen style={{ width: 40, height: 40, margin: "0 auto 12px", color: "#dce8f0" }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Dossier vide</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Importez des fichiers avec le bouton ci-dessus</div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 12,
                }}
              >
                {/* Subfolders */}
                {sortedSubfolders.map((folder) => {
                  const folderPath = [...currentPath, folder.name];
                  const count = countResourcesInFolder(folderPath);
                  return (
                    <button
                      key={folder.name}
                      onClick={() => navigateToFolder(folder.name)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        padding: "16px 8px 12px", borderRadius: 10, border: "none",
                        background: "transparent", cursor: "pointer", textAlign: "center",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f8")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="64" height="52" viewBox="0 0 64 52" fill="none">
                        <path d="M2 8C2 5.79 3.79 4 6 4H22L28 10H58C60.21 10 62 11.79 62 14V46C62 48.21 60.21 50 58 50H6C3.79 50 2 48.21 2 46V8Z" fill="#5AC8FA" />
                        <path d="M2 18H62V46C62 48.21 60.21 50 58 50H6C3.79 50 2 48.21 2 46V18Z" fill="#4AB8E8" />
                        <path d="M2 8C2 5.79 3.79 4 6 4H22L28 10H2V8Z" fill="#4AB8E8" />
                      </svg>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#1a2a3a", lineHeight: 1.3, maxWidth: 110, wordBreak: "break-word" }}>
                        {folder.name}
                      </div>
                      {count > 0 && (
                        <div style={{ fontSize: 10, color: "#8399a9" }}>
                          {count} élément{count > 1 ? "s" : ""}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Files */}
                {sortedFiles.map((r) => (
                  <div
                    key={r.id}
                    className="resource-file-card"
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      padding: "16px 8px 10px", borderRadius: 10, textAlign: "center",
                      position: "relative", transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f8fafb";
                      const actions = e.currentTarget.querySelector(".file-actions") as HTMLElement;
                      if (actions) actions.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      const actions = e.currentTarget.querySelector(".file-actions") as HTMLElement;
                      if (actions) actions.style.opacity = "0";
                    }}
                  >
                    {/* File icon */}
                    <div
                      style={{
                        width: 56, height: 52, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "#f5f8fa", borderRadius: 8, border: "1px solid #e8ecf1",
                      }}
                    >
                      {getFileIcon(r.file_type ?? r.name.split(".").pop() ?? null, "lg")}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "#1a2a3a", lineHeight: 1.3, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#8399a9", lineHeight: 1.2 }}>
                      {sortMode === "date" ? formatDate(r.created_at) : sortMode === "type" ? getFileTypeLabel(r.file_type) : formatSize(r.file_size)}
                    </div>

                    {/* Action buttons - visible on hover */}
                    <div
                      className="file-actions"
                      style={{
                        display: "flex", gap: 4, marginTop: 2,
                        opacity: 0, transition: "opacity 0.15s",
                      }}
                    >
                      <button
                        onClick={() => handleDownload(r)}
                        style={{
                          background: "#1a6b9c", border: "none", cursor: "pointer", color: "white",
                          padding: "4px 8px", borderRadius: 5, display: "flex", alignItems: "center", gap: 3,
                          fontSize: 10, fontWeight: 600,
                        }}
                        title="Télécharger sur votre ordinateur"
                      >
                        <Download className="h-3 w-3" />
                        Télécharger
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        style={{
                          background: "#fff5f5", border: "1px solid #fde2e2", cursor: "pointer", color: "#e74c3c",
                          padding: "4px 6px", borderRadius: 5, display: "flex", alignItems: "center",
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Upload sheet */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Importer des fichiers</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            {/* Folder picker */}
            <div className="space-y-2">
              <Label>Dossier de destination *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={uploadCategory}
                onChange={(e) => {
                  setUploadCategory(e.target.value);
                  setUploadSubcategory("");
                }}
              >
                <option value="">Sélectionner un dossier</option>
                {FOLDER_TREE.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Subfolder picker */}
            {uploadCategory && (() => {
              const parentFolder = FOLDER_TREE.find((f) => f.name === uploadCategory);
              if (!parentFolder?.children) return null;
              const subPaths = buildAllSubPaths(parentFolder.children);
              return (
                <div className="space-y-2">
                  <Label>Sous-dossier</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={uploadSubcategory}
                    onChange={(e) => setUploadSubcategory(e.target.value)}
                  >
                    <option value="">Racine de {uploadCategory}</option>
                    {subPaths.map((sp) => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Destination preview */}
            {uploadCategory && (
              <div style={{ padding: "8px 12px", background: "#f0f7ff", borderRadius: 8, fontSize: 12, color: "#1a6b9c", display: "flex", alignItems: "center", gap: 6 }}>
                <Folder className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
                <span>
                  Destination : <strong>{uploadCategory}{uploadSubcategory ? ` / ${uploadSubcategory}` : ""}</strong>
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Optionnel..." />
            </div>

            {/* File picker */}
            <div className="space-y-2">
              <Label>Fichiers</Label>
              <input ref={fileRef} type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  height: 48, borderRadius: 10, padding: "0 20px", fontSize: 13, fontWeight: 600,
                  border: "2px dashed #dce8f0", background: "#fafcfd", color: "#1a6b9c", width: "100%",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <Upload className="h-4 w-4" />
                Cliquer pour choisir des fichiers
              </button>
              {selectedFiles.length > 0 && (
                <div style={{ fontSize: 12, color: "#1a2a3a", marginTop: 4 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {selectedFiles.length} fichier{selectedFiles.length > 1 ? "s" : ""} sélectionné{selectedFiles.length > 1 ? "s" : ""}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {selectedFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5a6a7a" }}>
                        {getFileIcon(f.type || f.name.split(".").pop() || null, "sm")}
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ color: "#8399a9", flexShrink: 0 }}>{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0 || !uploadCategory}
              className="w-full"
              style={{ height: 42 }}
            >
              {uploading ? (
                "Import en cours..."
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer {selectedFiles.length > 0 ? `${selectedFiles.length} fichier${selectedFiles.length > 1 ? "s" : ""}` : ""}
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
