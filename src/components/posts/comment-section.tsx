"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Mention } from "@tiptap/extension-mention";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { useCurrentRoles } from "@/lib/use-current-roles";
import {
  buildMentionSuggestion,
  extractMentionedIds,
  resolveMentionIds,
  type MentionMember,
  type CategoryInfo,
} from "./mention-suggestion";
import { POST_CATEGORY_LABELS, type PostCategory } from "@/types/database";

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  postTitle: string;
  postCategory: string;
  teamMembers: { id: string; first_name: string; last_name: string; avatar_url?: string | null }[];
  onCommentCountChange: () => void;
}

export function CommentSection({ postId, postAuthorId, postTitle, postCategory, teamMembers, onCommentCountChange }: CommentSectionProps) {
  const memberId = useCurrentMember();
  const { isAdmin } = useCurrentRoles();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentHtml, setCommentHtml] = useState("");
  const [mentionMembers, setMentionMembers] = useState<MentionMember[]>([]);
  const [categoryMemberIds, setCategoryMemberIds] = useState<string[]>([]);
  const mentionActiveRef = useRef(false);

  // Load full member data + category members
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: members }, { data: catMembers }] = await Promise.all([
        supabase.from("team_members").select("id, first_name, last_name, avatar_url").eq("is_active", true).order("first_name"),
        supabase.from("category_members").select("team_member_id").eq("category", postCategory),
      ]);
      if (members) {
        setMentionMembers(members.map((m: any) => ({
          id: m.id, label: `${m.first_name} ${m.last_name}`, first_name: m.first_name, avatar_url: m.avatar_url,
        })));
      }
      setCategoryMemberIds((catMembers ?? []).map((r: any) => r.team_member_id));
    })();
  }, [postCategory]);

  const categoryInfo: CategoryInfo | undefined = useMemo(() => {
    if (categoryMemberIds.length === 0) return undefined;
    return {
      memberIds: categoryMemberIds,
      key: postCategory,
      label: POST_CATEGORY_LABELS[postCategory as PostCategory] ?? postCategory,
    };
  }, [categoryMemberIds, postCategory]);

  const catKey = JSON.stringify(categoryMemberIds);
  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: {
          style: "color: #1a6b9c; font-weight: 600; background: #e3f2fd; padding: 1px 4px; border-radius: 4px;",
        },
        renderHTML({ options, node }) {
          return [
            "span",
            { ...options.HTMLAttributes, "data-type": "mention", "data-id": node.attrs.id as string },
            `@${node.attrs.label as string}`,
          ];
        },
        suggestion: buildMentionSuggestion(
          mentionMembers,
          categoryInfo,
          (active) => { mentionActiveRef.current = active; },
        ),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentionMembers, catKey]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, bulletList: false, orderedList: false,
        blockquote: false, codeBlock: false, horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "Écrire un commentaire… (@ pour mentionner)" }),
      mentionExtension,
    ],
    content: "",
    onUpdate: ({ editor: e }) => setCommentHtml(e.getHTML()),
    editorProps: {
      attributes: {
        style: "padding: 8px 12px; min-height: 36px; max-height: 120px; overflow-y: auto; outline: none; font-size: 13px; line-height: 1.5; color: #1a2a3a;",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey && !mentionActiveRef.current) {
          event.preventDefault();
          handleSubmit();
          return true;
        }
        return false;
      },
    },
  }, [mentionExtension]);

  useEffect(() => { loadComments(); }, [postId]);

  async function loadComments() {
    const supabase = createClient();
    const { data } = await supabase
      .from("post_comments")
      .select("*, team_members!post_comments_author_id_fkey(id, first_name, last_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
    setLoading(false);
  }

  async function handleSubmit() {
    const isEmpty = !commentHtml || commentHtml === "<p></p>" || commentHtml.replace(/<[^>]*>/g, "").trim() === "";
    if (isEmpty || !memberId || !editor) return;
    setSubmitting(true);
    const supabase = createClient();
    const html = commentHtml;
    const plainText = editor.getText().trim();

    await supabase.from("post_comments").insert({
      post_id: postId,
      author_id: memberId,
      content: html,
    });

    // Build notification recipients: post author + previous commenters + mentioned members
    const recipients = new Set<string>();
    if (postAuthorId && postAuthorId !== memberId) recipients.add(postAuthorId);
    for (const c of comments) {
      if (c.author_id && c.author_id !== memberId) recipients.add(c.author_id);
    }

    // Extract @mentions and notify them too
    const rawMentions = extractMentionedIds(html);
    const resolvedMentions = resolveMentionIds(rawMentions, categoryMemberIds);
    const mentionOnlyRecipients = resolvedMentions.filter(id => id !== memberId && !recipients.has(id));

    const author = teamMembers.find((m) => m.id === memberId);
    const actorName = author ? `${author.first_name} ${author.last_name}` : "Quelqu'un";
    const bodySnippet = `${postTitle} — « ${plainText.slice(0, 120)}${plainText.length > 120 ? "…" : ""} »`;

    // Standard comment notifications
    if (recipients.size > 0) {
      const rows = Array.from(recipients).map((recipientId) => ({
        recipient_id: recipientId,
        type: recipientId === postAuthorId ? "post_comment" : "comment_reply",
        title: recipientId === postAuthorId
          ? `${actorName} a commenté ton post`
          : `${actorName} a répondu à un post que tu as commenté`,
        body: bodySnippet,
        link_url: `/posts#post-${postId}`,
        related_entity_type: "post",
        related_entity_id: postId,
        actor_id: memberId,
      }));
      await supabase.from("notifications").insert(rows);
    }

    // Mention-specific notifications (for people not already notified)
    if (mentionOnlyRecipients.length > 0) {
      const mentionRows = mentionOnlyRecipients.map((recipientId) => ({
        recipient_id: recipientId,
        type: "post_mention",
        title: `${actorName} t'a mentionné dans un commentaire`,
        body: bodySnippet,
        link_url: `/posts#post-${postId}`,
        related_entity_type: "post",
        related_entity_id: postId,
        actor_id: memberId,
      }));
      await supabase.from("notifications").insert(mentionRows);
    }

    editor.commands.clearContent();
    setCommentHtml("");
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
        const cAuthor = comment.team_members ?? memberMap.get(comment.author_id);
        const name = cAuthor ? `${cAuthor.first_name} ${cAuthor.last_name}` : "Inconnu";
        const initials = cAuthor ? `${cAuthor.first_name[0]}${cAuthor.last_name[0]}` : "?";
        const canDelete = comment.author_id === memberId || isAdmin;
        const isHtml = comment.content?.includes("<p>") || comment.content?.includes("<span");

        return (
          <div key={comment.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: "50%",
                background: cAuthor?.avatar_url
                  ? `url(${cAuthor.avatar_url}) center/cover no-repeat`
                  : "#5a6f80",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}
            >
              {!cAuthor?.avatar_url && initials}
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
                      background: "none", border: "none", cursor: "pointer",
                      color: "#c0c8d0", padding: 2, marginLeft: "auto",
                    }}
                    title="Supprimer"
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
              {isHtml ? (
                <div
                  className="tiptap-content"
                  dangerouslySetInnerHTML={{ __html: comment.content }}
                  style={{ fontSize: 13, color: "#3a4a5a", lineHeight: 1.5, marginTop: 2 }}
                />
              ) : (
                <p style={{ fontSize: 13, color: "#3a4a5a", lineHeight: 1.5, marginTop: 2, whiteSpace: "pre-wrap" }}>
                  {comment.content}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* New comment editor */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
        <div style={{
          flex: 1, borderRadius: 8, border: "1px solid #dce8f0", background: "#f8fbfd", overflow: "hidden",
        }}>
          <EditorContent editor={editor} />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !commentHtml || commentHtml === "<p></p>"}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: commentHtml && commentHtml !== "<p></p>" ? "#1a6b9c" : "#dce8f0",
            color: commentHtml && commentHtml !== "<p></p>" ? "white" : "#8399a9",
            cursor: commentHtml && commentHtml !== "<p></p>" ? "pointer" : "default",
            display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <Send style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #8399a9;
          pointer-events: none;
          height: 0;
        }
        .tiptap p { margin: 2px 0; }
        .tiptap-content [data-type="mention"] {
          color: #1a6b9c;
          font-weight: 600;
          background: #e3f2fd;
          padding: 1px 4px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
