"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Settings, Trash2, Users, Hash, Pin, ChevronDown, ChevronRight } from "lucide-react";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { createClient } from "@/lib/supabase/client";
import {
  POST_CATEGORY_LABELS,
  POST_CATEGORY_COLORS,
  type PostCategory,
} from "@/types/database";
import { PostCard } from "./post-card";
import { PostFormDialog } from "./post-form-dialog";

// Fallback to hardcoded categories if no channels loaded
const VEILLE_CATEGORIES_FALLBACK: PostCategory[] = ["veille_reglementaire", "veille_metiers", "veille_pedagogie"];
const MAIN_CATEGORIES_FALLBACK = (Object.keys(POST_CATEGORY_LABELS) as PostCategory[]).filter(c => !VEILLE_CATEGORIES_FALLBACK.includes(c));

export interface PostChannel {
  id: string;
  slug: string;
  label: string;
  color_bg: string;
  color_text: string;
  is_veille: boolean;
  display_order: number;
}

interface PostsViewProps {
  posts: any[];
  teamMembers: { id: string; first_name: string; last_name: string; avatar_url?: string | null }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
  deals: { id: string; name: string }[];
  channels?: PostChannel[];
  orders: any[];
  projectTags: { id: string; name: string; is_active: boolean }[];
}

export function PostsView({
  posts,
  teamMembers,
  contacts,
  companies,
  deals,
  orders,
  projectTags,
  channels = [],
}: PostsViewProps) {
  const router = useRouter();
  const { isAdmin, isRestrictedExterne } = useCurrentRoles();
  const [categoryFilter, setCategoryFilter] = useState<PostCategory | "all">("all");

  // Dynamic channels — derive labels, colors, and category lists from DB
  const channelLabels: Record<string, string> = channels.length > 0
    ? Object.fromEntries(channels.map(c => [c.slug, c.label]))
    : POST_CATEGORY_LABELS;
  const channelColors: Record<string, { bg: string; text: string }> = channels.length > 0
    ? Object.fromEntries(channels.map(c => [c.slug, { bg: c.color_bg, text: c.color_text }]))
    : POST_CATEGORY_COLORS;
  const VEILLE_CATEGORIES = channels.length > 0
    ? channels.filter(c => c.is_veille).map(c => c.slug)
    : VEILLE_CATEGORIES_FALLBACK as string[];
  const MAIN_CATEGORIES = channels.length > 0
    ? channels.filter(c => !c.is_veille).map(c => c.slug)
    : MAIN_CATEGORIES_FALLBACK as string[];
  const ALL_CATEGORIES = channels.length > 0
    ? channels.map(c => c.slug)
    : Object.keys(POST_CATEGORY_LABELS);
  const [authorFilter, setAuthorFilter] = useState("all");
  const [projectTagFilter, setProjectTagFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<any>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [expandProjects, setExpandProjects] = useState(false);
  const [expandVeille, setExpandVeille] = useState(false);

  function handleRefresh() {
    router.refresh();
  }

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (categoryFilter !== "all") result = result.filter((p) => p.category === categoryFilter);
    if (authorFilter !== "all") result = result.filter((p) => p.author_id === authorFilter);
    if (projectTagFilter !== "all") result = result.filter((p) => p.project_tag_id === projectTagFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "recent" ? db - da : da - db;
    });
  }, [posts, categoryFilter, authorFilter, projectTagFilter, searchQuery, sortOrder]);

  // Count posts per category
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const cat of ALL_CATEGORIES) counts[cat] = posts.filter((p) => p.category === cat).length;
    return counts;
  }, [posts]);

  const pinnedCount = posts.filter((p) => p.pinned).length;
  const thisWeek = posts.filter((p) => {
    const d = new Date(p.created_at);
    return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).length;

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 130px)", margin: "-24px -24px -24px -24px" }}>
      {/* ===== LEFT SIDEBAR ===== */}
      <aside style={{
        width: 250,
        flexShrink: 0,
        background: "#f7f9fb",
        borderRight: "1px solid #e4eaf0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Sidebar header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e4eaf0" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1b2a4a", margin: 0 }}>Canaux</h2>
        </div>

        {/* Channel list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {/* All */}
          <ChannelItem
            label="Général"
            count={countByCategory.all}
            active={categoryFilter === "all"}
            onClick={() => { setCategoryFilter("all"); setProjectTagFilter("all"); setExpandProjects(false); }}
            dotColor="#1E2A5A"
          />

          {MAIN_CATEGORIES.map((cat) => {
            const colors = channelColors[cat];
            const isProjects = cat === "projets_en_cours";
            const isActive = categoryFilter === cat;
            return (
              <div key={cat}>
                <ChannelItem
                  label={channelLabels[cat]}
                  count={countByCategory[cat]}
                  active={isActive}
                  onClick={() => {
                    setCategoryFilter(cat);
                    if (!isProjects) setProjectTagFilter("all");
                    if (isProjects) setExpandProjects(true);
                    else setExpandProjects(false);
                    setExpandVeille(false);
                  }}
                  dotColor={colors.text}
                  expanded={isProjects ? expandProjects : undefined}
                  onToggleExpand={isProjects && projectTags.filter(t => t.is_active).length > 0
                    ? () => setExpandProjects((prev) => !prev)
                    : undefined}
                />
                {/* Project tag sub-items */}
                {isProjects && expandProjects && (
                  <div style={{ paddingLeft: 20 }}>
                    <SubChannelItem
                      label="Tous les projets"
                      active={projectTagFilter === "all"}
                      onClick={() => setProjectTagFilter("all")}
                    />
                    {projectTags.filter(t => t.is_active).map(tag => (
                      <SubChannelItem
                        key={tag.id}
                        label={tag.name}
                        active={projectTagFilter === tag.id}
                        onClick={() => setProjectTagFilter(tag.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Veille group */}
          <ChannelItem
            label="Veille"
            count={VEILLE_CATEGORIES.reduce((sum, c) => sum + (countByCategory[c] || 0), 0)}
            active={VEILLE_CATEGORIES.includes(categoryFilter as PostCategory)}
            onClick={() => {
              setExpandVeille(true);
              setExpandProjects(false);
              setCategoryFilter(VEILLE_CATEGORIES[0]);
              setProjectTagFilter("all");
            }}
            dotColor="#283593"
            expanded={expandVeille}
            onToggleExpand={() => setExpandVeille((prev) => !prev)}
          />
          {expandVeille && (
            <div style={{ paddingLeft: 20 }}>
              {VEILLE_CATEGORIES.map((cat) => (
                <SubChannelItem
                  key={cat}
                  label={channelLabels[cat]}
                  active={categoryFilter === cat}
                  onClick={() => setCategoryFilter(cat)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar footer — stats + admin */}
        <div style={{ borderTop: "1px solid #e4eaf0", padding: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: isAdmin ? 8 : 0 }}>
            <MiniStat label="Total" value={posts.length} />
            <MiniStat label="Semaine" value={thisWeek} />
            <MiniStat label="Épinglés" value={pinnedCount} />
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => { setShowCategoryManager(!showCategoryManager); setShowTagManager(false); }}
                title="Gérer les catégories"
                style={sidebarBtnStyle(showCategoryManager)}
              >
                <Users style={{ width: 13, height: 13 }} /> Catégories
              </button>
              <button
                onClick={() => { setShowTagManager(!showTagManager); setShowCategoryManager(false); }}
                title="Gérer les projets"
                style={sidebarBtnStyle(showTagManager)}
              >
                <Settings style={{ width: 13, height: 13 }} /> Projets
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
          borderBottom: "1px solid #e4eaf0", background: "white", flexWrap: "wrap",
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1b2a4a", margin: 0, marginRight: 8 }}>
            {categoryFilter === "all" ? "Tous les posts" : channelLabels[categoryFilter]}
          </h3>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search style={{ width: 13, height: 13, position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#8399a9" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                style={{
                  padding: "6px 10px 6px 28px", borderRadius: 6, border: "1px solid #dce8f0",
                  fontSize: 12, color: "#1a2a3a", outline: "none", width: 170, background: "#f8fbfd",
                }}
              />
            </div>

            <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} style={selectStyle}>
              <option value="all">Tous les auteurs</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>

            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "recent" | "oldest")} style={selectStyle}>
              <option value="recent">Plus récent</option>
              <option value="oldest">Plus ancien</option>
            </select>

            <button
              onClick={() => { setEditPost(null); setShowForm(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 6, border: "none",
                background: "#1E2A5A", color: "white", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Nouveau post
            </button>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Category / Tag manager panels */}
          {showCategoryManager && isAdmin && (
            <CategoryManagerPanel teamMembers={teamMembers} onRefresh={handleRefresh} />
          )}
          {showTagManager && isAdmin && (
            <TagManagerPanel projectTags={projectTags} onRefresh={handleRefresh} />
          )}

          {/* Posts list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
            {filteredPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#8399a9", fontSize: 14 }}>
                {posts.length === 0
                  ? "Aucun post pour le moment. Soyez le premier à publier !"
                  : "Aucun post ne correspond aux filtres sélectionnés."}
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  teamMembers={teamMembers}
                  projectTags={projectTags}
                  onEdit={(p) => { setEditPost(p); setShowForm(true); }}
                  onRefresh={handleRefresh}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Form dialog */}
      {showForm && (
        <PostFormDialog
          key={editPost?.id ?? "new"}
          open={showForm}
          onClose={() => { setShowForm(false); setEditPost(null); }}
          onSaved={handleRefresh}
          editPost={editPost}
          projectTags={projectTags}
        />
      )}
    </div>
  );
}

/* ===== Sidebar Components ===== */

function ChannelItem({ label, count, active, onClick, dotColor, expanded, onToggleExpand }: {
  label: string; count: number; active: boolean; onClick: () => void;
  dotColor: string; expanded?: boolean; onToggleExpand?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "8px 16px", border: "none", cursor: "pointer", textAlign: "left",
        background: active ? "#e8f0fe" : "transparent",
        borderLeft: active ? "3px solid #1E2A5A" : "3px solid transparent",
        transition: "all 0.12s",
      }}
    >
      <Hash style={{ width: 13, height: 13, color: dotColor, flexShrink: 0 }} />
      <span style={{
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? "#1E2A5A" : "#3a4a5a", flex: 1, overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      {count > 0 && (
        <span style={{
          fontSize: 10, color: active ? "#1E2A5A" : "#8399a9",
          fontWeight: 600, minWidth: 18, textAlign: "right",
        }}>
          {count}
        </span>
      )}
      {onToggleExpand && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, cursor: "pointer", color: "#8399a9",
            transition: "transform 0.15s ease",
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          <ChevronDown style={{ width: 14, height: 14 }} />
        </span>
      )}
    </button>
  );
}

function SubChannelItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, width: "100%",
        padding: "5px 16px 5px 12px", border: "none", cursor: "pointer", textAlign: "left",
        background: active ? "#e8f0fe" : "transparent",
        fontSize: 12, color: active ? "#1E2A5A" : "#5a6f80",
        fontWeight: active ? 600 : 400, transition: "all 0.12s",
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: active ? "#1E2A5A" : "#b0bec5", flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "6px 4px",
      background: "white", borderRadius: 6, border: "1px solid #e4eaf0",
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1b2a4a" }}>{value}</div>
      <div style={{ fontSize: 9, color: "#8399a9", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid #dce8f0",
  fontSize: 12, color: "#1a2a3a", background: "#f8fbfd",
};

function sidebarBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 4, flex: 1,
    padding: "5px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
    border: "1px solid #dce8f0", cursor: "pointer",
    background: active ? "#e8f0fe" : "white",
    color: active ? "#1E2A5A" : "#5a6f80",
    justifyContent: "center",
  };
}

/* ===== Admin Panels (unchanged logic, kept below) ===== */

function CategoryManagerPanel({
  teamMembers,
  onRefresh,
}: {
  teamMembers: { id: string; first_name: string; last_name: string; avatar_url?: string | null }[];
  onRefresh: () => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("category_members")
      .select("category, team_member_id")
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        for (const row of data ?? []) {
          if (!map[row.category]) map[row.category] = [];
          map[row.category].push(row.team_member_id);
        }
        setAssignments(map);
        setLoaded(true);
      });
  }, []);

  // Scroll to post when URL contains a hash (e.g. /posts#post-xxx)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    // Small delay to let posts render
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.style.boxShadow = "0 0 0 3px #E8732A";
        setTimeout(() => { el.style.boxShadow = ""; }, 2000);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  async function toggleMember(category: string, memberId: string) {
    const supabase = createClient();
    const current = assignments[category] ?? [];
    if (current.includes(memberId)) {
      await supabase.from("category_members").delete().eq("category", category).eq("team_member_id", memberId);
      setAssignments((prev) => ({ ...prev, [category]: prev[category]?.filter((id) => id !== memberId) ?? [] }));
    } else {
      await supabase.from("category_members").insert({ category, team_member_id: memberId });
      setAssignments((prev) => ({ ...prev, [category]: [...(prev[category] ?? []), memberId] }));
    }
  }

  if (!loaded) return <div style={{ padding: 16, fontSize: 13, color: "#8399a9" }}>Chargement...</div>;

  return (
    <div style={{ padding: 16, borderRadius: 10, border: "1px solid #dce8f0", background: "#f8fbfd", marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 4 }}>
        Gestion des notifications par catégorie
      </h3>
      <p style={{ fontSize: 12, color: "#8399a9", marginBottom: 16 }}>
        Les membres assignés à une catégorie recevront une notification quand un post contient <span style={{ color: "#6a1b9a", fontWeight: 600 }}>#Catégorie</span>.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ALL_CATEGORIES.map((cat) => {
          const colors = channelColors[cat];
          const label = channelLabels[cat];
          const assigned = assignments[cat] ?? [];
          return (
            <div key={cat} style={{ border: "1px solid #e8ecf1", borderRadius: 8, padding: 12, background: "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ background: colors.bg, color: colors.text, padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: "#8399a9" }}>{assigned.length} membre{assigned.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teamMembers.map((m) => {
                  const isAssigned = assigned.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(cat, m.id)}
                      style={{
                        padding: "4px 10px", borderRadius: 999,
                        border: isAssigned ? "2px solid #6a1b9a" : "1px solid #dce8f0",
                        background: isAssigned ? "#f3e5f5" : "white",
                        color: isAssigned ? "#6a1b9a" : "#5a6f80",
                        cursor: "pointer", fontSize: 12, fontWeight: isAssigned ? 600 : 400,
                      }}
                    >
                      {m.first_name} {m.last_name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TagManagerPanel({
  projectTags,
  onRefresh,
}: {
  projectTags: { id: string; name: string; is_active: boolean }[];
  onRefresh: () => void;
}) {
  const [newName, setNewName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    const supabase = createClient();
    await supabase.from("post_project_tags").insert({ name: newName.trim() });
    setNewName("");
    onRefresh();
  }

  async function toggleActive(id: string, currentActive: boolean) {
    const supabase = createClient();
    await supabase.from("post_project_tags").update({ is_active: !currentActive }).eq("id", id);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce projet ? Les posts liés ne seront pas supprimés.")) return;
    const supabase = createClient();
    await supabase.from("post_project_tags").delete().eq("id", id);
    onRefresh();
  }

  return (
    <div style={{ padding: 16, borderRadius: 10, border: "1px solid #dce8f0", background: "#f8fbfd", marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Gestion des projets</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du nouveau projet..."
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #dce8f0", fontSize: 13, outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
        />
        <button onClick={handleCreate} disabled={!newName.trim()}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: newName.trim() ? "#1E2A5A" : "#dce8f0",
            color: newName.trim() ? "white" : "#8399a9",
            cursor: newName.trim() ? "pointer" : "default", fontWeight: 600, fontSize: 13,
          }}
        >Ajouter</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {projectTags.map((tag) => (
          <div key={tag.id} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
            borderRadius: 8, border: "1px solid #dce8f0",
            background: tag.is_active ? "white" : "#f0f0f0", fontSize: 13,
          }}>
            <span style={{ color: tag.is_active ? "#1a2a3a" : "#8399a9", textDecoration: tag.is_active ? "none" : "line-through" }}>{tag.name}</span>
            <button onClick={() => toggleActive(tag.id, tag.is_active)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: tag.is_active ? "#e65100" : "#2e7d32", fontWeight: 600 }}>
              {tag.is_active ? "Archiver" : "Réactiver"}
            </button>
            <button onClick={() => handleDelete(tag.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 0, display: "flex" }}>
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
        {projectTags.length === 0 && <span style={{ fontSize: 13, color: "#8399a9" }}>Aucun projet créé</span>}
      </div>
    </div>
  );
}
