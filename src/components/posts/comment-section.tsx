"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, Trash2, Paperclip, X, FileText, Download, Pencil } from "lucide-react";
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

const REACTION_EMOJIS = [
  { key: "like", emoji: "\uD83D\uDC4D", label: "J'aime", color: "#1a6b9c", bg: "#e3f2fd" },
  { key: "love", emoji: "\u2764\uFE0F", label: "J'adore", color: "#e74c3c", bg: "#fce4ec" },
  { key: "celebrate", emoji: "\uD83C\uDF89", label: "Bravo", color: "#e67e22", bg: "#fff3e0" },
  { key: "insightful", emoji: "\uD83D\uDCA1", label: "Intéressant", color: "#d4ac0d", bg: "#fffde7" },
  { key: "curious", emoji: "\uD83E\uDD14", label: "Curieux", color: "#8e44ad", bg: "#f3e5f5" },
];

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  postTitle: string;
  postCategory: string;
  teamMembers: { id: string; first_name: string; last_name: string; avatar_url?: string | null }[];
  onCommentCountChange: () => void;
  previewCount?: number;
}

export function CommentSection({ postId, postAuthorId, postTitle, postCategory, teamMembers, onCommentCountChange, previewCount = 100 }: CommentSectionProps) {
  const memberId = useCurrentMember();
  const { isAdmin } = useCurrentRoles();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentHtml, setCommentHtml] = useState("");
  const commentHtmlRef = useRef("");
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview?: string }[]>([]);
  const pendingFilesRef = useRef<{ file: File; preview?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    onUpdate: ({ editor: e }) => { const h = e.getHTML(); setCommentHtml(h); commentHtmlRef.current = h; },
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
      .select("*, team_members!post_comments_author_id_fkey(id, first_name, last_name, avatar_url), comment_reactions(id, team_member_id, emoji), comment_attachments(id, file_name, file_url, file_type)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
    setLoading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPending = files.map((file) => {
      const isImage = file.type.startsWith("image/");
      return { file, preview: isImage ? URL.createObjectURL(file) : undefined };
    });
    setPendingFiles((prev) => {
      const next = [...prev, ...newPending];
      pendingFilesRef.current = next;
      return next;
    });
    e.target.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      const next = prev.filter((_, i) => i !== index);
      pendingFilesRef.current = next;
      return next;
    });
  }

  async function handleSubmit() {
    const html = commentHtmlRef.current;
    const files = pendingFilesRef.current;
    const isEmpty = !html || html === "<p></p>" || html.replace(/<[^>]*>/g, "").trim() === "";
    if ((isEmpty && files.length === 0) || !memberId || !editor) return;
    setSubmitting(true);
    const supabase = createClient();
    const plainText = editor.getText().trim();

    // Upload pending files
    const uploadedAttachments: { file_name: string; file_url: string; file_type: string }[] = [];
    for (const pf of files) {
      const safeName = pf.file.name.normalize("NFC").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `comments/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("post-attachments").upload(path, pf.file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("post-attachments").getPublicUrl(path);
        uploadedAttachments.push({
          file_name: pf.file.name,
          file_url: urlData.publicUrl,
          file_type: pf.file.type,
        });
      }
    }

    const commentId = crypto.randomUUID();
    await supabase.from("post_comments").insert({
      id: commentId,
      post_id: postId,
      author_id: memberId,
      content: isEmpty ? "<p></p>" : html,
    });

    // Save comment attachments
    if (uploadedAttachments.length > 0) {
      await supabase.from("comment_attachments").insert(
        uploadedAttachments.map((a) => ({ ...a, comment_id: commentId }))
      );
    }

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
    const allMentionRecipients = resolvedMentions.filter(id => id !== memberId);
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

    // Slack DM for all @mentioned people (including those already notified in-app via comment)
    if (allMentionRecipients.length > 0) {
      try {
        await fetch("/api/posts/notify-slack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientIds: allMentionRecipients,
            authorName: actorName,
            postTitle,
            postId,
            type: "mention_comment",
          }),
        });
      } catch {}
    }

    editor.commands.clearContent();
    setCommentHtml("");
    commentHtmlRef.current = "";
    files.forEach((pf) => { if (pf.preview) URL.revokeObjectURL(pf.preview); });
    setPendingFiles([]);
    pendingFilesRef.current = [];
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

  const hiddenCount = !showAll && comments.length > previewCount ? comments.length - previewCount : 0;
  const visibleComments = !showAll && comments.length > previewCount
    ? comments.slice(comments.length - previewCount)
    : comments;

  if (loading) {
    return (
      <div style={{ padding: "12px 0", fontSize: 13, color: "#8399a9" }}>
        Chargement...
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 12, marginTop: 4 }}>
      {/* "Show more" link */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#1a6b9c", fontSize: 12, fontWeight: 600, padding: "4px 0", marginBottom: 8,
          }}
        >
          Voir les {hiddenCount} commentaire{hiddenCount > 1 ? "s" : ""} précédent{hiddenCount > 1 ? "s" : ""}
        </button>
      )}

      {/* Comments list */}
      {visibleComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          memberId={memberId}
          isAdmin={isAdmin}
          memberMap={memberMap}
          teamMembers={teamMembers}
          postId={postId}
          postTitle={postTitle}
          onDelete={handleDelete}
          onReactionsChange={loadComments}
        />
      ))}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {pendingFiles.map((pf, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
              borderRadius: 6, border: "1px solid #dce8f0", background: "#f8fbfd", fontSize: 11,
            }}>
              {pf.preview ? (
                <img src={pf.preview} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: "cover" }} />
              ) : (
                <FileText style={{ width: 14, height: 14, color: "#1a6b9c" }} />
              )}
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#3a4a5a" }}>
                {pf.file.name}
              </span>
              <button onClick={() => removePendingFile(i)} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex",
              }}>
                <X style={{ width: 12, height: 12, color: "#8399a9" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New comment editor */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
        <div style={{
          flex: 1, borderRadius: 8, border: "1px solid #dce8f0", background: "#f8fbfd", overflow: "hidden",
        }}>
          <EditorContent editor={editor} />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Joindre un fichier"
          style={{
            padding: "8px", borderRadius: 8, border: "none",
            background: "#f0f4f8", cursor: "pointer",
            display: "flex", alignItems: "center", flexShrink: 0,
            color: "#5a6f80",
          }}
        >
          <Paperclip style={{ width: 14, height: 14 }} />
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (((!commentHtml || commentHtml === "<p></p>") && pendingFiles.length === 0))}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: (commentHtml && commentHtml !== "<p></p>") || pendingFiles.length > 0 ? "#1a6b9c" : "#dce8f0",
            color: (commentHtml && commentHtml !== "<p></p>") || pendingFiles.length > 0 ? "white" : "#8399a9",
            cursor: (commentHtml && commentHtml !== "<p></p>") || pendingFiles.length > 0 ? "pointer" : "default",
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

/* ===== Comment Item with Reactions ===== */

function CommentItem({
  comment,
  memberId,
  isAdmin,
  memberMap,
  teamMembers,
  postId,
  postTitle,
  onDelete,
  onReactionsChange,
}: {
  comment: any;
  memberId: string | null;
  isAdmin: boolean;
  memberMap: Map<string, any>;
  teamMembers: { id: string; first_name: string; last_name: string; avatar_url?: string | null }[];
  postId: string;
  postTitle: string;
  onDelete: (id: string) => void;
  onReactionsChange: () => void;
}) {
  const [reactions, setReactions] = useState<any[]>(comment.comment_reactions ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [hoverReaction, setHoverReaction] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const cAuthor = comment.team_members ?? memberMap.get(comment.author_id);
  const name = cAuthor ? `${cAuthor.first_name} ${cAuthor.last_name}` : "Inconnu";
  const initials = cAuthor ? `${cAuthor.first_name[0]}${cAuthor.last_name[0]}` : "?";
  const isOwner = comment.author_id === memberId;
  const canDelete = isOwner || isAdmin;
  const isHtml = comment.content?.includes("<p>") || comment.content?.includes("<span");

  async function handleSaveEdit() {
    if (!editText.trim()) return;
    setSavingEdit(true);
    const supabase = createClient();
    await supabase.from("post_comments").update({ content: editText }).eq("id", comment.id);
    setEditing(false);
    setSavingEdit(false);
    onReactionsChange(); // reloads comments
  }

  const activeEmojis = REACTION_EMOJIS.filter(({ key }) =>
    reactions.some((r: any) => r.emoji === key)
  );

  async function toggleReaction(emojiKey: string) {
    if (!memberId) return;
    const supabase = createClient();
    const existing = reactions.find((r: any) => r.team_member_id === memberId && r.emoji === emojiKey);
    if (existing) {
      setReactions((prev) => prev.filter((r: any) => r.id !== existing.id));
      await supabase.from("comment_reactions").delete().eq("id", existing.id);
    } else {
      const tempId = crypto.randomUUID();
      setReactions((prev) => [...prev, { id: tempId, team_member_id: memberId, emoji: emojiKey }]);
      const { data } = await supabase
        .from("comment_reactions")
        .insert({ comment_id: comment.id, team_member_id: memberId, emoji: emojiKey })
        .select("id")
        .single();
      if (data) {
        setReactions((prev) => prev.map((r: any) => (r.id === tempId ? { ...r, id: data.id } : r)));
      }

      // Notify comment author
      if (comment.author_id && comment.author_id !== memberId) {
        const actor = teamMembers.find((m) => m.id === memberId);
        const actorName = actor ? `${actor.first_name} ${actor.last_name}` : "Quelqu'un";
        const emojiChar = REACTION_EMOJIS.find((e) => e.key === emojiKey)?.emoji ?? "";
        supabase.from("notifications").insert({
          recipient_id: comment.author_id,
          type: "post_reaction",
          title: `${actorName} a réagi à ton commentaire ${emojiChar}`,
          body: postTitle,
          link_url: `/posts#post-${postId}`,
          related_entity_type: "post",
          related_entity_id: postId,
          actor_id: memberId,
        }).then(() => {});
      }
    }
    setShowPicker(false);
  }

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
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
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {isOwner && !editing && (
              <button
                onClick={() => { setEditing(true); setEditText(comment.content ?? ""); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#c0c8d0", padding: 2,
                }}
                title="Modifier"
              >
                <Pencil style={{ width: 12, height: 12 }} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#c0c8d0", padding: 2,
                }}
                title="Supprimer"
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        </div>
        {editing ? (
          <div style={{ marginTop: 4 }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
              style={{
                width: "100%", padding: "6px 10px", borderRadius: 6,
                border: "1px solid #1a6b9c", background: "#f8fbfd",
                fontSize: 13, lineHeight: 1.5, color: "#1a2a3a",
                resize: "vertical", minHeight: 40, outline: "none",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editText.trim()}
                style={{
                  padding: "3px 10px", borderRadius: 6, border: "none",
                  background: "#1a6b9c", color: "white", fontSize: 11,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Enregistrer
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: "3px 10px", borderRadius: 6, border: "1px solid #dce8f0",
                  background: "white", color: "#5a6f80", fontSize: 11,
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : isHtml ? (
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

        {/* Comment attachments */}
        <CommentAttachments attachments={comment.comment_attachments ?? []} />

        {/* Reaction bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
          {activeEmojis.map(({ key, emoji, label, color, bg }) => {
            const count = reactions.filter((r: any) => r.emoji === key).length;
            const hasReacted = reactions.some((r: any) => r.emoji === key && r.team_member_id === memberId);
            const reactorNames = reactions
              .filter((r: any) => r.emoji === key)
              .map((r: any) => {
                const m = teamMembers.find((tm) => tm.id === r.team_member_id);
                return m ? m.first_name : null;
              })
              .filter(Boolean);
            return (
              <div key={key} style={{ position: "relative" }}
                onMouseEnter={() => setHoverReaction(key)}
                onMouseLeave={() => setHoverReaction(null)}
              >
                <button
                  onClick={() => toggleReaction(key)}
                  title={label}
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 7px", borderRadius: 12,
                    border: hasReacted ? `1.5px solid ${color}` : "1px solid #e4eaf0",
                    background: hasReacted ? bg : "#f8fbfd",
                    cursor: "pointer", fontSize: 11,
                    color: hasReacted ? color : "#8399a9",
                    fontWeight: hasReacted ? 600 : 400,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
                  {count > 0 && <span>{count}</span>}
                </button>
                {hoverReaction === key && reactorNames.length > 0 && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 4px)", left: "50%",
                    transform: "translateX(-50%)", background: "#1a2a3a", color: "white",
                    padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                    whiteSpace: "pre-line", textAlign: "center", maxWidth: 180, zIndex: 20,
                    boxShadow: "0 3px 8px rgba(0,0,0,0.2)", pointerEvents: "none",
                  }}>
                    {reactorNames.join("\n")}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add reaction button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, borderRadius: 12,
                border: "1px solid #e4eaf0", background: showPicker ? "#e8f0fe" : "#f8fbfd",
                cursor: "pointer", fontSize: 13, color: "#8399a9",
                transition: "all 0.15s ease",
              }}
              title="Réagir"
            >
              +
            </button>
            {showPicker && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                display: "flex", gap: 2, background: "white", border: "1px solid #e4eaf0",
                borderRadius: 8, padding: "4px 6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 30,
              }}>
                {REACTION_EMOJIS.map(({ key, emoji, label }) => {
                  const hasReacted = reactions.some((r: any) => r.emoji === key && r.team_member_id === memberId);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleReaction(key)}
                      title={label}
                      style={{
                        background: hasReacted ? "#e8f0fe" : "none", border: "none",
                        cursor: "pointer", fontSize: 16, padding: "3px 5px",
                        borderRadius: 6, transition: "background 0.1s",
                      }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Comment Attachments ===== */

function CommentAttachments({ attachments }: { attachments: any[] }) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a: any) =>
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name)
  );
  const files = attachments.filter(
    (a: any) => !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name)
  );

  return (
    <div style={{ marginTop: 6 }}>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: files.length > 0 ? 6 : 0 }}>
          {images.map((att: any) => (
            <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer">
              <img
                src={att.file_url}
                alt={att.file_name}
                style={{
                  maxWidth: 200, maxHeight: 150, objectFit: "cover",
                  borderRadius: 6, border: "1px solid #dce8f0", cursor: "pointer",
                }}
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {files.map((att: any) => (
            <a
              key={att.id}
              href={att.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 6,
                border: "1px solid #dce8f0", background: "#f8fbfd",
                fontSize: 11, color: "#1a6b9c", textDecoration: "none", fontWeight: 500,
              }}
            >
              <FileText style={{ width: 13, height: 13 }} />
              <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {att.file_name}
              </span>
              <Download style={{ width: 11, height: 11, color: "#8399a9" }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
