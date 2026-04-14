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
  ThumbsUp,
  Heart,
  PartyPopper,
  Lightbulb,
  HelpCircle,
  FileText,
  Image as ImageIcon,
  Download,
  Link as LinkIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useCurrentRoles } from "@/lib/use-current-roles";
import {
  POST_CATEGORY_LABELS,
  POST_CATEGORY_COLORS,
  POST_ENTITY_TYPE_LABELS,
  type PostCategory,
  type PostEntityType,
} from "@/types/database";
import { CommentSection } from "./comment-section";

const REACTION_EMOJIS = [
  { key: "like", icon: ThumbsUp, label: "J'aime" },
  { key: "love", icon: Heart, label: "J'adore" },
  { key: "celebrate", icon: PartyPopper, label: "Bravo" },
  { key: "insightful", icon: Lightbulb, label: "Intéressant" },
  { key: "curious", icon: HelpCircle, label: "Curieux" },
];

interface PostCardProps {
  post: any;
  teamMembers: { id: string; first_name: string; last_name: string }[];
  projectTags: { id: string; name: string; is_active: boolean }[];
  onEdit: (post: any) => void;
  onRefresh: () => void;
}

export function PostCard({ post, teamMembers, projectTags, onEdit, onRefresh }: PostCardProps) {
  const memberId = useCurrentMember();
  const { isAdmin } = useCurrentRoles();
  const [showComments, setShowComments] = useState(false);
  const [reactions, setReactions] = useState<any[]>(post.post_reactions ?? []);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    await supabase.from("posts").update({ pinned: !post.pinned }).eq("id", post.id);
    onRefresh();
  }

  const imageAttachments = attachments.filter((a: any) =>
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name)
  );
  const fileAttachments = attachments.filter(
    (a: any) => !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name)
  );

  return (
    <div
      className="lca-card"
      style={{
        padding: 20,
        borderRadius: 12,
        border: post.pinned ? "2px solid #1a6b9c" : "1px solid #dce8f0",
        background: "white",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#1a6b9c",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {authorInitials}
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
              <Pin style={{ width: 14, height: 14, color: "#1a6b9c" }} />
            )}
            <span style={{ fontSize: 11, color: "#8399a9", marginLeft: "auto" }}>
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>

          {/* Entity link */}
          {post.entity_type && post.entity_id && (
            <div style={{ marginTop: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#f0f4f8",
                  color: "#5a6f80",
                }}
              >
                <LinkIcon style={{ width: 10, height: 10, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                {POST_ENTITY_TYPE_LABELS[post.entity_type as PostEntityType]}
              </span>
            </div>
          )}
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

      {/* Title */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginBottom: 6 }}>
        {post.title}
      </h3>

      {/* Content */}
      {post.content && (
        <div style={{ fontSize: 14, color: "#3a4a5a", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12 }}>
          <RenderTextWithLinks text={post.content} />
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
                color: "#1a6b9c",
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
        {REACTION_EMOJIS.map(({ key, icon: Icon, label }) => {
          const count = reactions.filter((r: any) => r.emoji === key).length;
          const hasReacted = reactions.some((r: any) => r.emoji === key && r.team_member_id === memberId);
          return (
            <button
              key={key}
              onClick={() => toggleReaction(key)}
              title={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 20,
                border: hasReacted ? "1px solid #1a6b9c" : "1px solid #dce8f0",
                background: hasReacted ? "#e3f2fd" : "white",
                cursor: "pointer",
                fontSize: 12,
                color: hasReacted ? "#1a6b9c" : "#8399a9",
                fontWeight: hasReacted ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 20,
            border: "1px solid #dce8f0",
            background: showComments ? "#f0f4f8" : "white",
            cursor: "pointer",
            fontSize: 12,
            color: "#5a6f80",
            marginLeft: "auto",
          }}
        >
          <MessageCircle style={{ width: 14, height: 14 }} />
          {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <CommentSection
          postId={post.id}
          teamMembers={teamMembers}
          onCommentCountChange={onRefresh}
        />
      )}
    </div>
  );
}

function RenderTextWithLinks({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1a6b9c", textDecoration: "underline", wordBreak: "break-all" }}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
