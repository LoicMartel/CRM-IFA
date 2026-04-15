"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useCurrentRoles } from "@/lib/use-current-roles";

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  postTitle: string;
  teamMembers: { id: string; first_name: string; last_name: string }[];
  onCommentCountChange: () => void;
}

export function CommentSection({ postId, postAuthorId, postTitle, teamMembers, onCommentCountChange }: CommentSectionProps) {
  const memberId = useCurrentMember();
  const { isAdmin } = useCurrentRoles();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function loadComments() {
    const supabase = createClient();
    const { data } = await supabase
      .from("post_comments")
      .select("*, team_members!post_comments_author_id_fkey(id, first_name, last_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !memberId) return;
    setSubmitting(true);
    const supabase = createClient();
    const commentContent = newComment.trim();
    await supabase.from("post_comments").insert({
      post_id: postId,
      author_id: memberId,
      content: commentContent,
    });

    // Build notification recipients: post author + previously-commenting members (excluding current user)
    const recipients = new Set<string>();
    if (postAuthorId && postAuthorId !== memberId) recipients.add(postAuthorId);
    for (const c of comments) {
      if (c.author_id && c.author_id !== memberId) recipients.add(c.author_id);
    }

    if (recipients.size > 0) {
      const author = teamMembers.find((m) => m.id === memberId);
      const actorName = author ? `${author.first_name} ${author.last_name}` : "Quelqu'un";
      const rows = Array.from(recipients).map((recipientId) => ({
        recipient_id: recipientId,
        type: recipientId === postAuthorId ? "post_comment" : "comment_reply",
        title:
          recipientId === postAuthorId
            ? `${actorName} a commenté ton post`
            : `${actorName} a répondu à un post que tu as commenté`,
        body: `${postTitle} — « ${commentContent.slice(0, 120)}${commentContent.length > 120 ? "…" : ""} »`,
        link_url: `/posts#post-${postId}`,
        related_entity_type: "post",
        related_entity_id: postId,
        actor_id: memberId,
      }));
      await supabase.from("notifications").insert(rows);
    }

    setNewComment("");
    setSubmitting(false);
    await loadComments();
    onCommentCountChange();
  }

  async function handleDelete(commentId: string) {
    const supabase = createClient();
    await supabase.from("post_comments").delete().eq("id", commentId);
    await loadComments();
    onCommentCountChange();
  }

  const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

  if (loading) {
    return (
      <div style={{ padding: "12px 0", fontSize: 13, color: "#8399a9" }}>
        Chargement des commentaires...
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 12, marginTop: 4 }}>
      {/* Comments list */}
      {comments.map((comment) => {
        const author = comment.team_members ?? memberMap.get(comment.author_id);
        const name = author ? `${author.first_name} ${author.last_name}` : "Inconnu";
        const initials = author ? `${author.first_name[0]}${author.last_name[0]}` : "?";
        const canDelete = comment.author_id === memberId || isAdmin;

        return (
          <div key={comment.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#5a6f80",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#1a2a3a" }}>{name}</span>
                <span style={{ fontSize: 11, color: "#8399a9" }}>
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                </span>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#c0c8d0",
                      padding: 2,
                      marginLeft: "auto",
                    }}
                    title="Supprimer"
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: 13, color: "#3a4a5a", lineHeight: 1.5, marginTop: 2, whiteSpace: "pre-wrap" }}>
                {comment.content}
              </p>
            </div>
          </div>
        );
      })}

      {/* New comment input */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Écrire un commentaire..."
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #dce8f0",
            fontSize: 13,
            color: "#1a2a3a",
            outline: "none",
            background: "#f8fbfd",
          }}
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: newComment.trim() ? "#1a6b9c" : "#dce8f0",
            color: newComment.trim() ? "white" : "#8399a9",
            cursor: newComment.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Send style={{ width: 14, height: 14 }} />
        </button>
      </form>
    </div>
  );
}
