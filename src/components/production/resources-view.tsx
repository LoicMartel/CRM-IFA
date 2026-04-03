"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search, Download, Trash2, FolderOpen, Folder, FileText, Image, Film, File,
  ChevronRight, Upload, ArrowLeft, ArrowUpDown, SortAsc, Calendar, FileType, HardDrive, FolderInput,
  Eye, ExternalLink, X,
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

// Exact replica of the disk folder: Production/Supports formation
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
      {
        name: "BtoC",
        children: [{
          name: "10 Steps",
          children: [
            { name: "Step 1" },
            { name: "Step 2" },
            { name: "Step 3" },
            { name: "Step 4" },
            { name: "Step 5" },
            { name: "Step 6" },
            { name: "Step 7" },
            { name: "Step 8" },
            { name: "Step 9" },
            { name: "Step 10" },
          ],
        }],
      },
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

// ── Mapping DB category+subcategory → folder path ──
// Known subfolders in the DB that are real folders (not filenames used as subcategory)
const HABILLAGE_SUBFOLDERS = new Set(["Bandeau", "Charte graphique", "Images carrés"]);
const MARSTON_SUBFOLDERS = new Set(["Posture Consultant", "Prospect"]);

function getResourceFolderPath(r: Resource): string[] {
  const cat = r.category;
  const sub = r.subcategory;

  switch (cat) {
    case "Formation Formateur":
      return ["Formation Formateur"];

    case "Formation Manager":
      if (sub === "Coaching") return ["Formation Manager", "Coaching"];
      return ["Formation Manager"];

    case "Formation Sales":
      if (sub === "BtoB") return ["Formation Sales", "BtoB"];
      if (sub === "BtoC") return ["Formation Sales", "BtoC"];
      return ["Formation Sales"];

    case "Formation Prise de Parole":
      return ["Formation prise de parole public"];

    case "Time Management":
      return ["Time Management"];

    case "Vidéos":
      if (sub) return ["Vidéos", sub];
      return ["Vidéos"];

    // "Slides — X" categories → map to Formation Sales subfolders (matching disk structure)
    case "Slides — 10 Steps":
      if (sub && sub.startsWith("Step ")) return ["Formation Sales", "BtoC", "10 Steps", sub];
      return ["Formation Sales", "BtoC", "10 Steps"];

    case "Slides — Habillage":
      if (sub && HABILLAGE_SUBFOLDERS.has(sub)) return ["Formation Sales", "Habillage", sub];
      // Subcategory is a filename (e.g. "AdobeStock_xxx.jpeg", "S1.png") → Habillage root
      return ["Formation Sales", "Habillage"];

    case "Slides — Marston":
      if (sub && MARSTON_SUBFOLDERS.has(sub)) return ["Formation Sales", "Marston", sub];
      // Subcategory is a filename → Marston root
      return ["Formation Sales", "Marston"];

    case "Slides — Objections":
      return ["Formation Sales", "Traitement des objections"];

    case "Autre":
    default:
      // No "Autre" folder on disk — these files appear at root
      return [];
  }
}

// Reverse mapping: folder path → DB category + subcategory for uploads
function folderPathToDbFields(path: string[]): { category: string; subcategory: string } {
  const joined = path.join("/");

  // Direct matches
  if (joined === "Formation Formateur") return { category: "Formation Formateur", subcategory: "" };
  if (joined === "Formation Manager") return { category: "Formation Manager", subcategory: "" };
  if (joined === "Formation Manager/Coaching") return { category: "Formation Manager", subcategory: "Coaching" };
  if (joined === "Formation Manager/Coaching/PDF") return { category: "Formation Manager", subcategory: "Coaching" };
  if (joined === "Formation Sales") return { category: "Formation Sales", subcategory: "" };
  if (joined === "Formation Sales/BtoB") return { category: "Formation Sales", subcategory: "BtoB" };
  if (joined === "Formation Sales/BtoC") return { category: "Formation Sales", subcategory: "BtoC" };
  if (joined === "Formation Sales/BtoC/10 Steps") return { category: "Slides — 10 Steps", subcategory: "" };
  if (joined.startsWith("Formation Sales/BtoC/10 Steps/Step ")) return { category: "Slides — 10 Steps", subcategory: path[3] };
  if (joined.startsWith("Formation Sales/Habillage")) {
    const sub = path.slice(2).join("/");
    if (HABILLAGE_SUBFOLDERS.has(path[2])) return { category: "Slides — Habillage", subcategory: path[2] };
    return { category: "Slides — Habillage", subcategory: sub || "" };
  }
  if (joined.startsWith("Formation Sales/Marston")) {
    if (MARSTON_SUBFOLDERS.has(path[2])) return { category: "Slides — Marston", subcategory: path[2] };
    return { category: "Slides — Marston", subcategory: "" };
  }
  if (joined === "Formation Sales/Traitement des objections") return { category: "Slides — Objections", subcategory: "" };
  if (joined === "Formation prise de parole public") return { category: "Formation Prise de Parole", subcategory: "" };
  if (joined === "Slides") return { category: "Formation Sales", subcategory: "" }; // fallback
  if (joined === "Time Management") return { category: "Time Management", subcategory: "" };
  if (joined === "Autre") return { category: "Autre", subcategory: "" };
  if (joined.startsWith("Vidéos")) {
    const sub = path.slice(1).join("/");
    return { category: "Vidéos", subcategory: sub };
  }

  return { category: path[0] || "Autre", subcategory: path.slice(1).join("/") };
}

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
  const [uploadPath, setUploadPath] = useState<string[]>([]);
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveResource, setMoveResource] = useState<Resource | null>(null);
  const [movePath, setMovePath] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const currentPathStr = currentPath.join("/");
  const subfolders = getFoldersAtPath(currentPath);
  const allFolders = useMemo(() => getAllFolderPaths(FOLDER_TREE), []);

  // Map each resource to its folder path (memoized)
  const resourcePaths = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of resources) {
      map.set(r.id, getResourceFolderPath(r));
    }
    return map;
  }, [resources]);

  // Files at current folder level = resources whose folder path matches exactly
  const filesAtCurrentLevel = useMemo(() => {
    return resources.filter((r) => {
      const rPath = resourcePaths.get(r.id) ?? [];
      return rPath.join("/") === currentPathStr;
    });
  }, [resources, resourcePaths, currentPathStr]);

  // Sort files
  const sortedFiles = useMemo(() => {
    const sorted = [...filesAtCurrentLevel];
    switch (sortMode) {
      case "name": sorted.sort((a, b) => a.name.localeCompare(b.name, "fr")); break;
      case "date": sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "type": sorted.sort((a, b) => (a.file_type ?? "").localeCompare(b.file_type ?? "")); break;
      case "size": sorted.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0)); break;
    }
    return sorted;
  }, [filesAtCurrentLevel, sortMode]);

  const sortedSubfolders = useMemo(() => {
    return [...subfolders].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [subfolders]);

  // Search
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
    let count = 0;
    for (const [, rPath] of resourcePaths) {
      const rStr = rPath.join("/");
      if (rStr === pathStr || rStr.startsWith(pathStr + "/")) count++;
    }
    return count;
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

  function getPreviewType(resource: Resource): "image" | "pdf" | "video" | "none" {
    const t = (resource.file_type ?? resource.name.split(".").pop() ?? "").toLowerCase();
    if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("gif") || t.includes("svg") || t.includes("webp")) return "image";
    if (t.includes("pdf")) return "pdf";
    if (t.includes("video") || t.includes("mp4") || t.includes("mov") || t.includes("webm")) return "video";
    return "none";
  }

  async function openPreview(resource: Resource) {
    setPreviewResource(resource);
    setPreviewUrl(null);
    setPreviewLoading(true);
    const supabase = createClient();
    const { data } = await supabase.storage.from("resources").createSignedUrl(resource.file_path, 300);
    setPreviewUrl(data?.signedUrl ?? null);
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewResource(null);
    setPreviewUrl(null);
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

  function openMove(resource: Resource) {
    setMoveResource(resource);
    const currentFolderPath = resourcePaths.get(resource.id) ?? [];
    setMovePath(currentFolderPath);
    setMoveOpen(true);
  }

  async function handleMove() {
    if (!moveResource) return;
    setMoving(true);
    const supabase = createClient();
    const { category, subcategory } = folderPathToDbFields(movePath);

    await supabase.from("resources").update({
      category,
      subcategory: subcategory || null,
    }).eq("id", moveResource.id);

    setMoving(false);
    setMoveOpen(false);
    setMoveResource(null);
    setMovePath([]);
    router.refresh();
  }

  function openUploadAtCurrentPath() {
    setUploadPath(currentPath.length > 0 ? [...currentPath] : []);
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || uploadPath.length === 0) return;
    setUploading(true);
    const supabase = createClient();

    const { category, subcategory } = folderPathToDbFields(uploadPath);

    for (const file of selectedFiles) {
      const storagePath = `${category}/${subcategory ? subcategory + "/" : ""}${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage.from("resources").upload(storagePath, file);
      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("resources").insert({
        name: file.name,
        category,
        subcategory: subcategory || null,
        file_path: storagePath,
        file_size: file.size,
        file_type: file.type || file.name.split(".").pop() || null,
        description: uploadDescription || null,
        uploaded_by: memberId || null,
      });
    }

    setUploading(false);
    setUploadOpen(false);
    setSelectedFiles([]);
    setUploadPath([]);
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

  // Build full path list for upload folder picker
  const allUploadPaths = useMemo(() => {
    return allFolders.map((f) => ({ label: f.path.join(" › "), path: f.path }));
  }, [allFolders]);

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

      {/* Toolbar */}
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

          {/* Sort */}
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
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setSortMenuOpen(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                  background: "white", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                  border: "1px solid #e8ecf1", padding: 4, minWidth: 180,
                }}>
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
                      {sortMode === opt.value && <span style={{ marginLeft: "auto", fontSize: 11, color: "#1a6b9c" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Button onClick={openUploadAtCurrentPath} style={{ gap: 8 }}>
          <Upload className="h-4 w-4" />
          Importer des fichiers
        </Button>
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8ecf1", fontSize: 13, fontWeight: 600, color: "#8399a9" }}>
            {searchMatchedFolders.length + searchMatchedFiles.length} résultat{(searchMatchedFolders.length + searchMatchedFiles.length) !== 1 ? "s" : ""} pour &quot;{search}&quot;
          </div>

          {searchMatchedFolders.length === 0 && searchMatchedFiles.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8399a9" }}>
              <Search style={{ width: 32, height: 32, margin: "0 auto 12px", color: "#dce8f0" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun résultat</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Essayez avec d&apos;autres mots-clés</div>
            </div>
          ) : (
            <>
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
                        fontSize: 13, width: "100%", background: "none", border: "none",
                        borderBottom: "1px solid #f0f4f8", cursor: "pointer", textAlign: "left",
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

              {searchMatchedFiles.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "#8399a9", textTransform: "uppercase", letterSpacing: "0.05em", background: "#f8fafb" }}>
                    Fichiers ({searchMatchedFiles.length})
                  </div>
                  {searchMatchedFiles.map((r) => {
                    const rFolderPath = resourcePaths.get(r.id) ?? [];
                    return (
                      <div key={r.id} onClick={() => openPreview(r)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                        borderBottom: "1px solid #f0f4f8", fontSize: 13, cursor: "pointer",
                      }}>
                        {getFileIcon(r.file_type ?? r.name.split(".").pop() ?? null, "sm")}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "#8399a9", display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>{rFolderPath.join(" › ") || "Racine"}</span>
                            <span>·</span>
                            <span>{getFileTypeLabel(r.file_type)}</span>
                            <span>·</span>
                            <span>{formatSize(r.file_size)}</span>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(r); }} style={{
                          background: "#f0f7ff", border: "none", cursor: "pointer", color: "#1a6b9c",
                          padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4,
                          fontSize: 12, fontWeight: 500,
                        }} title="Télécharger">
                          <Download className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Télécharger</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openMove(r); }} style={{
                          background: "#f0f7ff", border: "none", cursor: "pointer", color: "#1a6b9c",
                          padding: "6px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4,
                          fontSize: 12, fontWeight: 500,
                        }} title="Déplacer">
                          <FolderInput className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} style={{
                          background: "#fff5f5", border: "none", cursor: "pointer", color: "#e74c3c",
                          padding: "6px 8px", borderRadius: 6, display: "flex", alignItems: "center",
                        }} title="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexWrap: "wrap" }}>
            {currentPath.length > 0 && (
              <button onClick={navigateBack} style={{
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
            <button onClick={() => setCurrentPath([])} style={{
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
                <button onClick={() => navigateToBreadcrumb(i + 1)} style={{
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

          {/* Grid */}
          <div className="lca-card" style={{ padding: "20px 24px", minHeight: 200 }}>
            {sortedSubfolders.length === 0 && sortedFiles.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8399a9", padding: "40px 0" }}>
                <FolderOpen style={{ width: 40, height: 40, margin: "0 auto 12px", color: "#dce8f0" }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Dossier vide</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Importez des fichiers avec le bouton ci-dessus</div>
              </div>
            ) : (
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12,
              }}>
                {sortedSubfolders.map((folder) => {
                  const folderPath = [...currentPath, folder.name];
                  const count = countResourcesInFolder(folderPath);
                  return (
                    <button key={folder.name} onClick={() => navigateToFolder(folder.name)} style={{
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

                {sortedFiles.map((r) => (
                  <div key={r.id} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "16px 8px 10px", borderRadius: 10, textAlign: "center",
                    position: "relative", transition: "background 0.15s", cursor: "pointer",
                  }}
                    onClick={() => openPreview(r)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f8fafb";
                      const actions = e.currentTarget.querySelector("[data-actions]") as HTMLElement;
                      if (actions) actions.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      const actions = e.currentTarget.querySelector("[data-actions]") as HTMLElement;
                      if (actions) actions.style.opacity = "0";
                    }}
                  >
                    <div style={{
                      width: 56, height: 52, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#f5f8fa", borderRadius: 8, border: "1px solid #e8ecf1",
                    }}>
                      {getFileIcon(r.file_type ?? r.name.split(".").pop() ?? null, "lg")}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "#1a2a3a", lineHeight: 1.3, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#8399a9", lineHeight: 1.2 }}>
                      {sortMode === "date" ? formatDate(r.created_at) : sortMode === "type" ? getFileTypeLabel(r.file_type) : formatSize(r.file_size)}
                    </div>
                    <div data-actions="" style={{ display: "flex", gap: 3, marginTop: 2, opacity: 0, transition: "opacity 0.15s" }}>
                      <button onClick={(e) => { e.stopPropagation(); handleDownload(r); }} style={{
                        background: "#1a6b9c", border: "none", cursor: "pointer", color: "white",
                        padding: "4px 7px", borderRadius: 5, display: "flex", alignItems: "center", gap: 3,
                        fontSize: 10, fontWeight: 600,
                      }} title="Télécharger">
                        <Download className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openMove(r); }} style={{
                        background: "#f0f7ff", border: "1px solid #dce8f0", cursor: "pointer", color: "#1a6b9c",
                        padding: "4px 7px", borderRadius: 5, display: "flex", alignItems: "center", gap: 3,
                        fontSize: 10, fontWeight: 600,
                      }} title="Déplacer vers un autre dossier">
                        <FolderInput className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} style={{
                        background: "#fff5f5", border: "1px solid #fde2e2", cursor: "pointer", color: "#e74c3c",
                        padding: "4px 6px", borderRadius: 5, display: "flex", alignItems: "center",
                      }} title="Supprimer">
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
            <div className="space-y-2">
              <Label>Dossier de destination *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={uploadPath.join("/")}
                onChange={(e) => setUploadPath(e.target.value ? e.target.value.split("/") : [])}
              >
                <option value="">Sélectionner un dossier</option>
                {allUploadPaths.map((p) => (
                  <option key={p.path.join("/")} value={p.path.join("/")}>
                    {p.path.length === 1 ? p.label : "— ".repeat(p.path.length - 1) + p.path[p.path.length - 1]}
                  </option>
                ))}
              </select>
            </div>

            {uploadPath.length > 0 && (
              <div style={{ padding: "8px 12px", background: "#f0f7ff", borderRadius: 8, fontSize: 12, color: "#1a6b9c", display: "flex", alignItems: "center", gap: 6 }}>
                <Folder className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
                <span>Destination : <strong>{uploadPath.join(" › ")}</strong></span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Optionnel..." />
            </div>

            <div className="space-y-2">
              <Label>Fichiers</Label>
              <input ref={fileRef} type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                height: 48, borderRadius: 10, padding: "0 20px", fontSize: 13, fontWeight: 600,
                border: "2px dashed #dce8f0", background: "#fafcfd", color: "#1a6b9c", width: "100%",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
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

            <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0 || uploadPath.length === 0} className="w-full" style={{ height: 42 }}>
              {uploading ? "Import en cours..." : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer {selectedFiles.length > 0 ? `${selectedFiles.length} fichier${selectedFiles.length > 1 ? "s" : ""}` : ""}
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Move sheet */}
      <Sheet open={moveOpen} onOpenChange={(open) => { setMoveOpen(open); if (!open) setMoveResource(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Déplacer le fichier</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-4">
            {moveResource && (
              <div style={{ padding: "10px 12px", background: "#f5f8fa", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                {getFileIcon(moveResource.file_type ?? moveResource.name.split(".").pop() ?? null, "sm")}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {moveResource.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#8399a9" }}>
                    Actuellement dans : {(resourcePaths.get(moveResource.id) ?? []).join(" › ") || "Racine"}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nouveau dossier de destination</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={movePath.join("/")}
                onChange={(e) => setMovePath(e.target.value ? e.target.value.split("/") : [])}
              >
                <option value="">Racine (Supports formation)</option>
                {allUploadPaths.map((p) => (
                  <option key={p.path.join("/")} value={p.path.join("/")}>
                    {p.path.length === 1 ? p.label : "— ".repeat(p.path.length - 1) + p.path[p.path.length - 1]}
                  </option>
                ))}
              </select>
            </div>

            {movePath.length > 0 && (
              <div style={{ padding: "8px 12px", background: "#f0f7ff", borderRadius: 8, fontSize: 12, color: "#1a6b9c", display: "flex", alignItems: "center", gap: 6 }}>
                <Folder className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
                <span>Déplacer vers : <strong>{movePath.join(" › ")}</strong></span>
              </div>
            )}

            <Button onClick={handleMove} disabled={moving || !moveResource} className="w-full" style={{ height: 42 }}>
              {moving ? "Déplacement en cours..." : (
                <>
                  <FolderInput className="h-4 w-4 mr-2" />
                  Déplacer
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview modal */}
      {previewResource && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={closePreview}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "white", borderRadius: 16, width: "90vw", maxWidth: 900,
            maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid #e8ecf1",
              display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
            }}>
              {getFileIcon(previewResource.file_type ?? previewResource.name.split(".").pop() ?? null, "sm")}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {previewResource.name}
                </div>
                <div style={{ fontSize: 12, color: "#8399a9", display: "flex", gap: 8 }}>
                  <span>{getFileTypeLabel(previewResource.file_type)}</span>
                  <span>·</span>
                  <span>{formatSize(previewResource.file_size)}</span>
                  <span>·</span>
                  <span>{formatDate(previewResource.created_at)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {previewUrl && (
                  <>
                    <button onClick={() => handleDownload(previewResource)} style={{
                      background: "#f0f7ff", border: "1px solid #dce8f0", cursor: "pointer", color: "#1a6b9c",
                      padding: "7px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 600,
                    }}>
                      <Download className="h-3.5 w-3.5" />
                      Télécharger
                    </button>
                    <button onClick={() => window.open(previewUrl, "_blank")} style={{
                      background: "#1a6b9c", border: "none", cursor: "pointer", color: "white",
                      padding: "7px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 600,
                    }}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ouvrir
                    </button>
                  </>
                )}
                <button onClick={closePreview} style={{
                  background: "#f5f5f5", border: "none", cursor: "pointer", color: "#666",
                  padding: "7px 10px", borderRadius: 8, display: "flex", alignItems: "center",
                }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{
              flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center",
              background: "#f5f8fa", minHeight: 300,
            }}>
              {previewLoading ? (
                <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Chargement...</div>
                </div>
              ) : !previewUrl ? (
                <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Impossible de charger le fichier</div>
                </div>
              ) : getPreviewType(previewResource) === "image" ? (
                <img
                  src={previewUrl}
                  alt={previewResource.name}
                  style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }}
                />
              ) : getPreviewType(previewResource) === "pdf" ? (
                <iframe
                  src={previewUrl}
                  style={{ width: "100%", height: "70vh", border: "none" }}
                  title={previewResource.name}
                />
              ) : getPreviewType(previewResource) === "video" ? (
                <video
                  src={previewUrl}
                  controls
                  style={{ maxWidth: "100%", maxHeight: "70vh" }}
                />
              ) : (
                <div style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ marginBottom: 16 }}>
                    {getFileIcon(previewResource.file_type ?? previewResource.name.split(".").pop() ?? null, "lg")}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
                    {previewResource.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#8399a9", marginBottom: 20 }}>
                    Aperçu non disponible pour ce type de fichier
                  </div>
                  <button onClick={() => window.open(previewUrl, "_blank")} style={{
                    background: "#1a6b9c", border: "none", cursor: "pointer", color: "white",
                    padding: "10px 24px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8,
                    fontSize: 13, fontWeight: 600,
                  }}>
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir le fichier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
