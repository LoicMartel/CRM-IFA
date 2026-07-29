"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Pin,
  MoreHorizontal,
  Pencil,
  Trash2,
  MessageCircle,
  FileText,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useCurrentRoles } from "@/lib/use-current-roles";
import {
  POST_CATEGORY_LABELS,
  POST_CATEGORY_COLORS,
  POST_BANNERS,
  type PostCategory,
} from "@/types/database";
import { CommentSection } from "./comment-section";
import { RichTextContent } from "./rich-text-editor";

const REACTION_EMOJIS = [
  { key: "like", emoji: "\uD83D\uDC4D", label: "J'aime", color: "#1E2A5A", bg: "#e3f2fd", animation: "reaction-thumbs" },
  { key: "love", emoji: "\u2764\uFE0F", label: "J'adore", color: "#e74c3c", bg: "#fce4ec", animation: "reaction-heart" },
  { key: "celebrate", emoji: "\uD83C\uDF89", label: "Bravo", color: "#e67e22", bg: "#fff3e0", animation: "reaction-confetti" },
  { key: "insightful", emoji: "\uD83D\uDCA1", label: "Intéressant", color: "#d4ac0d", bg: "#fffde7", animation: "reaction-bulb" },
  { key: "curious", emoji: "\uD83E\uDD14", label: "Curieux", color: "#8e44ad", bg: "#f3e5f5", animation: "reaction-think" },
];

interface PostCardProps {
  post: any;
  teamMembers: { id: string; first_name: string; last_name: string; avatar_url?: string | null }[];
  projectTags: { id: string; name: string; is_active: boolean }[];
  onEdit: (post: any) => void;
  onRefresh: () => void;
}

export function PostCard({ post, teamMembers, projectTags, onEdit, onRefresh }: PostCardProps) {
  const memberId = useCurrentMember();
  const { isAdmin } = useCurrentRoles();
  const [showAllComments, setShowAllComments] = useState(false);
  const [reactions, setReactions] = useState<any[]>(post.post_reactions ?? []);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [animatingReaction, setAnimatingReaction] = useState<string | null>(null);
  const [hoverReaction, setHoverReaction] = useState<string | null>(null);

  const author = post.team_members;
  const authorName = author ? `${author.first_name} ${author.last_name}` : "Inconnu";
  const authorInitials = author ? `${author.first_name[0]}${author.last_name[0]}` : "?";
  const commentCount = post.post_comments?.length ?? 0;
  const attachments = post.post_attachments ?? [];
  const categoryColors = POST_CATEGORY_COLORS[post.category as PostCategory];
  const isAuthor = memberId === post.author_id;
  const canManage = isAuthor || isAdmin;

  async function toggleReaction(emoji: string) {
    if (!memberId) return;
    const supabase = createClient();
    const existing = reactions.find((r: any) => r.team_member_id === memberId && r.emoji === emoji);
    if (existing) {
      setReactions((prev) => prev.filter((r: any) => r.id !== existing.id));
      await supabase.from("post_reactions").delete().eq("id", existing.id);
    } else {
      const tempId = crypto.randomUUID();
      setReactions((prev) => [...prev, { id: tempId, team_member_id: memberId, emoji }]);
      const { data } = await supabase
        .from("post_reactions")
        .insert({ post_id: post.id, team_member_id: memberId, emoji })
        .select("id")
        .single();
      if (data) {
        setReactions((prev) => prev.map((r: any) => (r.id === tempId ? { ...r, id: data.id } : r)));
      }

      // Notify post author of the new reaction (fire-and-forget)
      if (post.author_id && post.author_id !== memberId) {
        const actor = teamMembers.find((m) => m.id === memberId);
        const actorName = actor ? `${actor.first_name} ${actor.last_name}` : "Quelqu'un";
        supabase.from("notifications").insert({
          recipient_id: post.author_id,
          type: "post_reaction",
          title: `${actorName} a réagi à ton post ${emoji}`,
          body: post.title,
          link_url: `/posts#post-${post.id}`,
          related_entity_type: "post",
          related_entity_id: post.id,
          actor_id: memberId,
        }).then(() => { /* no-op */ });
      }
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce post ?")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("posts").delete().eq("id", post.id);
    onRefresh();
  }

  async function togglePin() {
    const supabase = createClient();
    const newPinned = !post.pinned;
    await supabase.from("posts").update({ pinned: newPinned }).eq("id", post.id);

    // Notify post author when someone else pins their post
    if (newPinned && post.author_id && post.author_id !== memberId) {
      const actor = teamMembers.find((m) => m.id === memberId);
      const actorName = actor ? `${actor.first_name} ${actor.last_name}` : "Quelqu'un";
      await supabase.from("notifications").insert({
        recipient_id: post.author_id,
        type: "post_pinned",
        title: `${actorName} a épinglé ton post`,
        body: post.title,
        link_url: `/posts#post-${post.id}`,
        related_entity_type: "post",
        related_entity_id: post.id,
        actor_id: memberId,
      });
    }

    onRefresh();
  }

  const imageAttachments = attachments.filter((a: any) =>
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name)
  );
  const fileAttachments = attachments.filter(
    (a: any) => !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name)
  );

  const bannerDef = post.banner ? POST_BANNERS.find((b) => b.key === post.banner) : null;

  return (
    <div
      id={`post-${post.id}`}
      className="lca-card"
      style={{
        borderRadius: 12,
        border: post.pinned ? "2px solid #1E2A5A" : "1px solid #dce8f0",
        background: "white",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Banner */}
      {bannerDef && (
        <div style={{
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
          ...bannerDef.style,
        }}>
          <h3 style={{
            fontSize: 18,
            fontWeight: 700,
            color: "white",
            textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            textAlign: "center",
            margin: 0,
          }}>
            {post.title}
          </h3>
        </div>
      )}

      <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: author?.avatar_url
              ? `url(${author.avatar_url}) center/cover no-repeat`
              : "#1E2A5A",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {!author?.avatar_url && authorInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#1a2a3a" }}>{authorName}</span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 20,
                background: categoryColors?.bg ?? "#f0f0f0",
                color: categoryColors?.text ?? "#666",
                fontWeight: 600,
              }}
            >
              {POST_CATEGORY_LABELS[post.category as PostCategory] ?? post.category}
            </span>
            {post.project_tag_id && (() => {
              const tag = projectTags.find((t) => t.id === post.project_tag_id);
              return tag ? (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#fff8e1", color: "#f57f17", fontWeight: 600 }}>
                  {tag.name}
                </span>
              ) : null;
            })()}
            {post.pinned && (
              <Pin style={{ width: 14, height: 14, color: "#1E2A5A" }} />
            )}
            <span style={{ fontSize: 11, color: "#8399a9", marginLeft: "auto" }}>
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>

        </div>

        {/* Actions menu */}
        {canManage && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#8399a9",
                padding: 4,
                borderRadius: 6,
              }}
            >
              <MoreHorizontal style={{ width: 18, height: 18 }} />
            </button>
            {showMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  background: "white",
                  border: "1px solid #dce8f0",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  zIndex: 10,
                  minWidth: 160,
                  overflow: "hidden",
                }}
              >
                {isAuthor && (
                  <button
                    onClick={() => { setShowMenu(false); onEdit(post); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      width: "100%",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#1a2a3a",
                    }}
                  >
                    <Pencil style={{ width: 14, height: 14 }} /> Modifier
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => { setShowMenu(false); togglePin(); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      width: "100%",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#1a2a3a",
                    }}
                  >
                    <Pin style={{ width: 14, height: 14 }} /> {post.pinned ? "Désépingler" : "Épingler"}
                  </button>
                )}
                <button
                  onClick={() => { setShowMenu(false); handleDelete(); }}
                  disabled={deleting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    width: "100%",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#e74c3c",
                  }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} /> Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title (only if no banner, otherwise shown in banner) */}
      {!bannerDef && (
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginBottom: 6 }}>
          {post.title}
        </h3>
      )}

      {/* Content */}
      {post.content && (
        <div style={{ marginBottom: 12 }}>
          <RichTextContent html={post.content} />
        </div>
      )}

      {/* Image attachments */}
      {imageAttachments.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: imageAttachments.length === 1 ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {imageAttachments.map((att: any) => (
            <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer">
              <img
                src={att.file_url}
                alt={att.file_name}
                style={{
                  width: "100%",
                  maxHeight: 300,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid #dce8f0",
                }}
              />
            </a>
          ))}
        </div>
      )}

      {/* File attachments */}
      {fileAttachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {fileAttachments.map((att: any) => (
            <a
              key={att.id}
              href={att.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #dce8f0",
                background: "#f8fbfd",
                fontSize: 12,
                color: "#1E2A5A",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              <FileText style={{ width: 14, height: 14 }} />
              {att.file_name}
              <Download style={{ width: 12, height: 12, color: "#8399a9" }} />
            </a>
          ))}
        </div>
      )}

      {/* Reactions bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        {REACTION_EMOJIS.map(({ key, emoji, label, color, bg, animation }) => {
          const count = reactions.filter((r: any) => r.emoji === key).length;
          const hasReacted = reactions.some((r: any) => r.emoji === key && r.team_member_id === memberId);
          const isAnimating = animatingReaction === key;
          const reactorNames = count > 0
            ? reactions
                .filter((r: any) => r.emoji === key)
                .map((r: any) => {
                  const m = teamMembers.find((tm) => tm.id === r.team_member_id);
                  return m ? m.first_name : null;
                })
                .filter(Boolean)
            : [];
          return (
            <div key={key} style={{ position: "relative" }}
              onMouseEnter={() => setHoverReaction(key)}
              onMouseLeave={() => setHoverReaction(null)}
            >
              <button
                onClick={() => {
                  setAnimatingReaction(key);
                  setTimeout(() => setAnimatingReaction(null), 600);
                  toggleReaction(key);
                }}
                title={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: hasReacted ? `1.5px solid ${color}` : "1px solid #dce8f0",
                  background: hasReacted ? bg : "white",
                  cursor: "pointer",
                  fontSize: 12,
                  color: hasReacted ? color : "#8399a9",
                  fontWeight: hasReacted ? 600 : 400,
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{
                  fontSize: 16,
                  lineHeight: 1,
                  display: "inline-block",
                  animation: isAnimating ? `${animation} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)` : undefined,
                }}>{emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
              {hoverReaction === key && reactorNames.length > 0 && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#1a2a3a",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: "pre-line",
                  textAlign: "center",
                  maxWidth: 220,
                  zIndex: 20,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  pointerEvents: "none",
                  animation: "tooltip-fade 0.15s ease",
                }}>
                  {reactorNames.join("\n")}
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0, height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "6px solid #1a2a3a",
                  }} />
                </div>
              )}
            </div>
          );
        })}

        {/* Comments count */}
        {commentCount > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#5a6f80", marginLeft: "auto" }}>
            <MessageCircle style={{ width: 14, height: 14 }} />
            {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Comments section — always visible */}
      <CommentSection
        postId={post.id}
        postAuthorId={post.author_id}
        postTitle={post.title}
        postCategory={post.category}
        teamMembers={teamMembers}
        onCommentCountChange={onRefresh}
        previewCount={4}
      />
      </div>
      <style>{`
        @keyframes reaction-thumbs {
          0% { transform: scale(1) rotate(0deg); }
          20% { transform: scale(1.4) rotate(-15deg); }
          40% { transform: scale(1.4) rotate(15deg); }
          60% { transform: scale(1.2) rotate(-5deg); }
          80% { transform: scale(1.05) rotate(0deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes reaction-heart {
          0% { transform: scale(1); }
          15% { transform: scale(1.5); }
          30% { transform: scale(0.9); }
          45% { transform: scale(1.35); }
          60% { transform: scale(0.95); }
          80% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes reaction-confetti {
          0% { transform: scale(1) rotate(0deg); }
          20% { transform: scale(1.4) rotate(-20deg); }
          40% { transform: scale(1.3) rotate(20deg); }
          60% { transform: scale(1.2) rotate(-10deg); }
          80% { transform: scale(1.1) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes reaction-bulb {
          0% { transform: scale(1); opacity: 1; }
          20% { transform: scale(1.4); opacity: 0.6; }
          40% { transform: scale(1.2); opacity: 1; }
          60% { transform: scale(1.35); opacity: 0.7; }
          80% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes reaction-think {
          0% { transform: scale(1) translateY(0); }
          25% { transform: scale(1.3) translateY(-3px); }
          50% { transform: scale(1.2) translateY(0); }
          75% { transform: scale(1.1) translateY(-1px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes tooltip-fade {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}