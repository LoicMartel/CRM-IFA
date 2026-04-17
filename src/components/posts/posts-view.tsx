"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Settings, Trash2, Users } from "lucide-react";
import { useCurrentRoles } from "@/lib/use-current-roles";
import { createClient } from "@/lib/supabase/client";
import {
  POST_CATEGORY_LABELS,
  POST_CATEGORY_COLORS,
  type PostCategory,
} from "@/types/database";
import { PostCard } from "./post-card";
import { PostFormDialog } from "./post-form-dialog";

const ALL_CATEGORIES = Object.keys(POST_CATEGORY_LABELS) as PostCategory[];

interface PostsViewProps {
  posts: any[];
  teamMembers: { id: string; first_name: string; last_name: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
  deals: { id: string; name: string }[];
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
}: PostsViewProps) {
  const router = useRouter();
  const { isAdmin, isRestrictedExterne } = useCurrentRoles();
  const [categoryFilter, setCategoryFilter] = useState<PostCategory | "all">("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [projectTagFilter, setProjectTagFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<any>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  function handleRefresh() {
    router.refresh();
  }

  const filteredPosts = useMemo(() => {
    let result = posts;

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (authorFilter !== "all") {
      result = result.filter((p) => p.author_id === authorFilter);
    }

    if (projectTagFilter !== "all") {
      result = result.filter((p) => p.project_tag_id === projectTagFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.content?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [posts, categoryFilter, authorFilter, projectTagFilter, searchQuery]);

  const pinnedCount = posts.filter((p) => p.pinned).length;
  const thisWeek = posts.filter((p) => {
    const d = new Date(p.created_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total posts" value={posts.length} color="#1a6b9c" />
        <StatCard label="Cette semaine" value={thisWeek} color="#2e7d32" />
        <StatCard label="Épinglés" value={pinnedCount} color="#e65100" />
      </div>

      {/* Filters & actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20, alignItems: "center" }}>
        {/* Category tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <FilterTab
            active={categoryFilter === "all"}
            onClick={() => { setCategoryFilter("all"); setProjectTagFilter("all"); }}
            label="Tous"
          />
          {ALL_CATEGORIES.map((cat) => (
            <FilterTab
              key={cat}
              active={categoryFilter === cat}
              onClick={() => { setCategoryFilter(cat); if (cat !== "projets_en_cours") setProjectTagFilter("all"); }}
              label={POST_CATEGORY_LABELS[cat]}
              color={POST_CATEGORY_COLORS[cat]}
            />
          ))}
        </div>

        {/* Project tag filter (only when projets_en_cours selected) */}
        {categoryFilter === "projets_en_cours" && projectTags.filter((t) => t.is_active).length > 0 && (
          <select
            value={projectTagFilter}
            onChange={(e) => setProjectTagFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #dce8f0",
              fontSize: 13,
              color: "#1a2a3a",
              background: "#f8fbfd",
            }}
          >
            <option value="all">Tous les projets</option>
            {projectTags.filter((t) => t.is_active).map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search style={{ width: 14, height: 14, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8399a9" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              style={{
                padding: "7px 10px 7px 30px",
                borderRadius: 8,
                border: "1px solid #dce8f0",
                fontSize: 13,
                color: "#1a2a3a",
                outline: "none",
                width: 200,
                background: "#f8fbfd",
              }}
            />
          </div>

          {/* Author filter */}
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid #dce8f0",
              fontSize: 13,
              color: "#1a2a3a",
              background: "#f8fbfd",
            }}
          >
            <option value="all">Tous les auteurs</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>

          {/* Admin tools */}
          {isAdmin && (
            <>
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                title="Gérer les catégories"
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #dce8f0",
                  background: showCategoryManager ? "#f3e5f5" : "white",
                  cursor: "pointer",
                  color: "#5a6f80",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Users style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={() => setShowTagManager(!showTagManager)}
                title="Gérer les projets"
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #dce8f0",
                  background: showTagManager ? "#e3f2fd" : "white",
                  cursor: "pointer",
                  color: "#5a6f80",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Settings style={{ width: 16, height: 16 }} />
              </button>
            </>
          )}

          {/* New post button */}
          <button
            onClick={() => { setEditPost(null); setShowForm(true); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#1a6b9c",
              color: "white",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Nouveau post
          </button>
        </div>
      </div>

      {/* Category manager panel */}
      {showCategoryManager && isAdmin && (
        <CategoryManagerPanel teamMembers={teamMembers} onRefresh={handleRefresh} />
      )}

      {/* Tag manager panel */}
      {showTagManager && isAdmin && (
        <TagManagerPanel projectTags={projectTags} onRefresh={handleRefresh} />
      )}

      {/* Posts list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filteredPosts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#8399a9",
              fontSize: 14,
            }}
          >
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

      {/* Form dialog */}
      <PostFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditPost(null); }}
        onSaved={handleRefresh}
        editPost={editPost}
        projectTags={projectTags}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="lca-card"
      style={{
        padding: "14px 18px",
        borderRadius: 10,
        border: "1px solid #dce8f0",
        background: "white",
      }}
    >
      <div style={{ fontSize: 11, color: "#8399a9", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: { bg: string; text: string };
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: active ? "none" : "1px solid #dce8f0",
        background: active ? (color?.bg ?? "#1a6b9c") : "white",
        color: active ? (color?.text ?? "white") : "#5a6f80",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function CategoryManagerPanel({
  teamMembers,
  onRefresh,
}: {
  teamMembers: { id: string; first_name: string; last_name: string }[];
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
          const colors = POST_CATEGORY_COLORS[cat];
          const label = POST_CATEGORY_LABELS[cat];
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
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: isAssigned ? "2px solid #6a1b9a" : "1px solid #dce8f0",
                        background: isAssigned ? "#f3e5f5" : "white",
                        color: isAssigned ? "#6a1b9a" : "#5a6f80",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: isAssigned ? 600 : 400,
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
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: "1px solid #dce8f0",
        background: "#f8fbfd",
        marginBottom: 20,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>
        Gestion des projets
      </h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du nouveau projet..."
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #dce8f0",
            fontSize: 13,
            outline: "none",
          }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: newName.trim() ? "#1a6b9c" : "#dce8f0",
            color: newName.trim() ? "white" : "#8399a9",
            cursor: newName.trim() ? "pointer" : "default",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Ajouter
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {projectTags.map((tag) => (
          <div
            key={tag.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #dce8f0",
              background: tag.is_active ? "white" : "#f0f0f0",
              fontSize: 13,
            }}
          >
            <span style={{ color: tag.is_active ? "#1a2a3a" : "#8399a9", textDecoration: tag.is_active ? "none" : "line-through" }}>
              {tag.name}
            </span>
            <button
              onClick={() => toggleActive(tag.id, tag.is_active)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                color: tag.is_active ? "#e65100" : "#2e7d32",
                fontWeight: 600,
              }}
            >
              {tag.is_active ? "Archiver" : "Réactiver"}
            </button>
            <button
              onClick={() => handleDelete(tag.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 0, display: "flex" }}
            >
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
        {projectTags.length === 0 && (
          <span style={{ fontSize: 13, color: "#8399a9" }}>Aucun projet créé</span>
        )}
      </div>
    </div>
  );
}
