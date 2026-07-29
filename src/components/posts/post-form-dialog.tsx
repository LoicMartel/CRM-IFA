"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileText, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { RichTextEditor } from "./rich-text-editor";
import { extractMentionedIds, extractHashtags, resolveMentionIds, type MentionMember, type CategoryInfo } from "./mention-suggestion";
import {
  POST_CATEGORY_LABELS,
  POST_BANNERS,
  type PostCategory,
} from "@/types/database";

const CATEGORIES = Object.entries(POST_CATEGORY_LABELS) as [PostCategory, string][];

function getMemberLabel(id: string | null, members: MentionMember[]): string {
  if (!id) return "Quelqu'un";
  const m = members.find((x) => x.id === id);
  return m?.label ?? "Un membre";
}

interface PendingFile {
  file: File;
  preview?: string;
}

interface PostFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editPost?: any;
  projectTags: { id: string; name: string; is_active: boolean }[];
}

export function PostFormDialog({
  open,
  onClose,
  onSaved,
  editPost,
  projectTags,
}: PostFormDialogProps) {
  const router = useRouter();
  const memberId = useCurrentMember();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(editPost?.title ?? "");
  const [content, setContent] = useState(editPost?.content ?? "");
  const [category, setCategory] = useState<PostCategory>(editPost?.category ?? "annonces_generales");
  const [projectTagId, setProjectTagId] = useState(editPost?.project_tag_id ?? "");
  const [banner, setBanner] = useState(editPost?.banner ?? "none");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>(editPost?.post_attachments ?? []);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [mentionMembers, setMentionMembers] = useState<MentionMember[]>([]);
  const [categoryMemberIds, setCategoryMemberIds] = useState<string[]>([]);

  // Reset form when dialog opens (new post or edit)
  useEffect(() => {
    if (!open) return;
    setTitle(editPost?.title ?? "");
    setContent(editPost?.content ?? "");
    setCategory(editPost?.category ?? "annonces_generales");
    setProjectTagId(editPost?.project_tag_id ?? "");
    setBanner(editPost?.banner ?? "none");
    setPendingFiles([]);
    setExistingAttachments(editPost?.post_attachments ?? []);
    setRemovedAttachmentIds([]);
    setNewTagName("");
    setShowNewTagInput(false);
  }, [open, editPost]);

  // Load active team members for @-mentions
  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true)
        .order("first_name");
      if (data) {
        setMentionMembers(
          data.map((m: any) => ({
            id: m.id,
            label: `${m.first_name} ${m.last_name}`,
            first_name: m.first_name,
            avatar_url: m.avatar_url,
          }))
        );
      }
    })();
  }, [open]);

  // Load category members for @-mention filtering
  useEffect(() => {
    if (!open || !category) { setCategoryMemberIds([]); return; }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("category_members")
        .select("team_member_id")
        .eq("category", category);
      setCategoryMemberIds((data ?? []).map((r: any) => r.team_member_id));
    })();
  }, [open, category]);

  if (!open) return null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPending = files.map((file) => {
      const isImage = file.type.startsWith("image/");
      return {
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
      };
    });
    setPendingFiles((prev) => [...prev, ...newPending]);
    e.target.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function removeExistingAttachment(id: string) {
    setRemovedAttachmentIds((prev) => [...prev, id]);
    setExistingAttachments((prev) => prev.filter((a: any) => a.id !== id));
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("post_project_tags")
      .insert({ name: newTagName.trim() })
      .select("id")
      .single();
    if (data) {
      setProjectTagId(data.id);
      setNewTagName("");
      setShowNewTagInput(false);
      onSaved(); // refresh to get new tags list
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !memberId) return;
    setSaving(true);

    const supabase = createClient();

    // Upload pending files
    const uploadedAttachments: { file_name: string; file_url: string; file_type: string }[] = [];
    for (const pf of pendingFiles) {
      const safeName = pf.file.name.normalize("NFC").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `posts/${Date.now()}_${safeName}`;
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

    const postData = {
      title: title.trim(),
      content: content || null,
      category,
      entity_type: null,
      entity_id: null,
      project_tag_id: category === "projets_en_cours" && projectTagId ? projectTagId : null,
      banner: banner === "none" ? null : banner,
    };

    let savedPostId: string | null = null;
    let previouslyMentionedIds: string[] = [];

    if (editPost) {
      // Capture previous mentions before update so we only notify newly-added ones
      previouslyMentionedIds = extractMentionedIds(editPost.content ?? "");

      // Update
      await supabase.from("posts").update({ ...postData, updated_at: new Date().toISOString() }).eq("id", editPost.id);
      savedPostId = editPost.id;

      // Remove deleted attachments
      if (removedAttachmentIds.length > 0) {
        await supabase.from("post_attachments").delete().in("id", removedAttachmentIds);
      }

      // Add new attachments
      if (uploadedAttachments.length > 0) {
        await supabase.from("post_attachments").insert(
          uploadedAttachments.map((a) => ({ ...a, post_id: editPost.id }))
        );
      }
    } else {
      // Create
      const { data: newPost } = await supabase
        .from("posts")
        .insert({ ...postData, author_id: memberId })
        .select("id")
        .single();

      savedPostId = newPost?.id ?? null;

      if (newPost && uploadedAttachments.length > 0) {
        await supabase.from("post_attachments").insert(
          uploadedAttachments.map((a) => ({ ...a, post_id: newPost.id }))
        );
      }
    }

    // Create mention notifications for newly-mentioned members
    const mentionedIds = new Set<string>();
    if (savedPostId && content) {
      const rawMentions = extractMentionedIds(content);
      const currentMentions = resolveMentionIds(rawMentions, categoryMemberIds);
      const prevResolved = resolveMentionIds(previouslyMentionedIds, categoryMemberIds);
      const newMentions = currentMentions.filter(
        (id) => !prevResolved.includes(id) && id !== memberId
      );
      newMentions.forEach(id => mentionedIds.add(id));
      if (newMentions.length > 0) {
        const authorLabel = getMemberLabel(memberId, mentionMembers);
        const rows = newMentions.map((recipientId) => ({
          recipient_id: recipientId,
          type: "post_mention",
          title: `${authorLabel} t'a mentionné dans un post`,
          body: title.trim(),
          link_url: `/posts#post-${savedPostId}`,
          related_entity_type: "post",
          related_entity_id: savedPostId,
          actor_id: memberId,
        }));
        await supabase.from("notifications").insert(rows);

        // Slack DM for @mentions
        try {
          await fetch("/api/posts/notify-slack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientIds: newMentions,
              authorName: authorLabel,
              postTitle: title.trim(),
              postId: savedPostId,
              type: "mention_post",
            }),
          });
        } catch {}
      }
    }

    // Create notifications for #category and #role tags
    if (savedPostId && content) {
      const { categories, roles } = extractHashtags(content);
      const tagRecipientIds = new Set<string>();
      const authorLabel = getMemberLabel(memberId, mentionMembers);

      // Fetch members assigned to tagged categories
      if (categories.length > 0) {
        const { data: catMembers } = await supabase
          .from("category_members")
          .select("team_member_id")
          .in("category", categories);
        for (const cm of catMembers ?? []) {
          tagRecipientIds.add(cm.team_member_id);
        }
      }

      // Fetch members matching tagged roles
      if (roles.length > 0) {
        const { data: allMembers } = await supabase
          .from("team_members")
          .select("id, roles")
          .eq("is_active", true);
        for (const m of allMembers ?? []) {
          const memberRoles = (m.roles as string[]) ?? [];
          if (roles.some(r => memberRoles.includes(r))) {
            tagRecipientIds.add(m.id);
          }
        }
      }

      // Remove self and already-mentioned members (avoid double notification)
      tagRecipientIds.delete(memberId ?? "");
      mentionedIds.forEach(id => tagRecipientIds.delete(id));

      if (tagRecipientIds.size > 0) {
        const tagLabels = [
          ...categories.map(c => `#${c}`),
          ...roles.map(r => `#${r}`),
        ].join(", ");

        // In-app notifications
        const rows = Array.from(tagRecipientIds).map((recipientId) => ({
          recipient_id: recipientId,
          type: "post_category_tag",
          title: `${authorLabel} a tagué ${tagLabels} dans un post`,
          body: title.trim(),
          link_url: `/posts#post-${savedPostId}`,
          related_entity_type: "post",
          related_entity_id: savedPostId,
          actor_id: memberId,
        }));
        await supabase.from("notifications").insert(rows);

        // Slack DM notifications
        const slackToken = process.env.NEXT_PUBLIC_SLACK_BOT_TOKEN;
        if (!slackToken) {
          // Fallback: call a server endpoint to send Slack notifications
          try {
            await fetch("/api/posts/notify-slack", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipientIds: Array.from(tagRecipientIds),
                authorName: authorLabel,
                postTitle: title.trim(),
                tagLabels,
                postId: savedPostId,
              }),
            });
          } catch {}
        }
      }
    }

    // Cleanup previews
    pendingFiles.forEach((pf) => { if (pf.preview) URL.revokeObjectURL(pf.preview); });

    setSaving(false);
    onClose();
    onSaved();
  }

  const activeProjectTags = projectTags.filter((t) => t.is_active);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          width: "100%",
          maxWidth: 860,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        {/* Dialog header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #eef2f6",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a" }}>
            {editPost ? "Modifier le post" : "Nouveau post"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du post..."
              required
              style={inputStyle}
            />
          </div>

          {/* Banner */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Bannière</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
              {POST_BANNERS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBanner(b.key)}
                  style={{
                    height: 48,
                    borderRadius: 8,
                    border: banner === b.key ? "3px solid #1E2A5A" : "2px solid #dce8f0",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    ...(b.key === "none"
                      ? { background: "#f8fbfd" }
                      : b.style),
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: b.key === "none" ? "#8399a9" : "white",
                    textShadow: b.key === "none" ? "none" : "0 1px 3px rgba(0,0,0,0.4)",
                  }}>
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
            {/* Preview */}
            {banner !== "none" && (
              <div style={{
                marginTop: 8,
                borderRadius: 10,
                height: 80,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...POST_BANNERS.find((b) => b.key === banner)?.style,
              }}>
                <span style={{ color: "white", fontWeight: 700, fontSize: 16, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                  {title || "Titre du post"}
                </span>
              </div>
            )}
          </div>

          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Catégorie *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PostCategory)}
              style={inputStyle}
            >
              {CATEGORIES.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Project tag (only for projets_en_cours) */}
          {category === "projets_en_cours" && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Projet</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={projectTagId}
                  onChange={(e) => setProjectTagId(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">-- Sélectionner un projet --</option>
                  {activeProjectTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewTagInput(!showNewTagInput)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #dce8f0",
                    background: "#f8fbfd",
                    cursor: "pointer",
                    color: "#1E2A5A",
                    fontWeight: 600,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> Nouveau
                </button>
              </div>
              {showNewTagInput && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Nom du projet..."
                    style={{ ...inputStyle, flex: 1 }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: newTagName.trim() ? "#1E2A5A" : "#dce8f0",
                      color: newTagName.trim() ? "white" : "#8399a9",
                      cursor: newTagName.trim() ? "pointer" : "default",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Créer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Contenu</label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Écrivez votre post… (utilisez @ pour mentionner un membre)"
              mentionMembers={mentionMembers}
              categoryInfo={categoryMemberIds.length > 0 ? { memberIds: categoryMemberIds, key: category, label: POST_CATEGORY_LABELS[category] } : undefined}
            />
          </div>

          {/* File attachments */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Pièces jointes</label>

            {/* Existing attachments (edit mode) */}
            {existingAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {existingAttachments.map((att: any) => (
                  <div
                    key={att.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #dce8f0",
                      background: "#f8fbfd",
                      fontSize: 12,
                    }}
                  >
                    {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.file_name)
                      ? <ImageIcon style={{ width: 12, height: 12, color: "#1E2A5A" }} />
                      : <FileText style={{ width: 12, height: 12, color: "#1E2A5A" }} />}
                    <span style={{ color: "#1E2A5A" }}>{att.file_name}</span>
                    <button
                      type="button"
                      onClick={() => removeExistingAttachment(att.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 0, display: "flex" }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending files */}
            {pendingFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {pendingFiles.map((pf, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #c8e6c9",
                      background: "#e8f5e9",
                      fontSize: 12,
                    }}
                  >
                    {pf.preview
                      ? <ImageIcon style={{ width: 12, height: 12, color: "#2e7d32" }} />
                      : <FileText style={{ width: 12, height: 12, color: "#2e7d32" }} />}
                    <span style={{ color: "#2e7d32" }}>{pf.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 0, display: "flex" }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 8,
                border: "2px dashed #dce8f0",
                background: "#f8fbfd",
                cursor: "pointer",
                fontSize: 13,
                color: "#5a6f80",
                fontWeight: 500,
                width: "100%",
                justifyContent: "center",
              }}
            >
              <Upload style={{ width: 16, height: 16 }} />
              Ajouter des fichiers (images, PDF, documents)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>



          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #dce8f0",
                background: "white",
                color: "#5a6f80",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: saving ? "#8399a9" : "#1E2A5A",
                color: "white",
                cursor: saving ? "wait" : "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {saving ? "Publication..." : editPost ? "Enregistrer" : "Publier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#3a4a5a",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #dce8f0",
  fontSize: 14,
  color: "#1a2a3a",
  outline: "none",
  background: "#f8fbfd",
};
