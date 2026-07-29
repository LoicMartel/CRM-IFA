"use client";

import { useRef, useState } from "react";
import { Paperclip, X, FileText, Image as ImageIcon, Download, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Attachment {
  name: string;
  url: string;
  type: "image" | "document" | "link";
  size?: number;
}

function parseAttachments(text: string): { cleanText: string; attachments: Attachment[] } {
  const attachments: Attachment[] = [];
  // Parse [file:name|url] markers
  const cleanText = text.replace(/\[file:([^\]|]+)\|([^\]]+)\]/g, (_, name, url) => {
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
    attachments.push({ name, url, type: isImage ? "image" : "document" });
    return "";
  });
  return { cleanText, attachments };
}

function renderTextWithLinks(text: string) {
  // Split text by URLs and render them as clickable links
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex since we're reusing the regex
      urlRegex.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#1E2A5A", textDecoration: "underline", wordBreak: "break-all" }}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface RichNotesProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  storageBucket?: string;
  storageFolder?: string;
  readOnly?: boolean;
}

export function RichNotes({
  value,
  onChange,
  placeholder = "Notes...",
  minHeight = 80,
  storageBucket = "note-attachments",
  storageFolder = "general",
  readOnly = false,
}: RichNotesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { cleanText, attachments } = parseAttachments(value);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${storageFolder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from(storageBucket).upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from(storageBucket).getPublicUrl(path);
      const marker = `[file:${file.name}|${urlData.publicUrl}]`;
      onChange(value + (value ? "\n" : "") + marker);
    }
    setUploading(false);
    e.target.value = "";
  }

  function removeAttachment(att: Attachment) {
    const marker = `[file:${att.name}|${att.url}]`;
    onChange(value.replace(marker, "").trim());
  }

  if (readOnly) {
    return (
      <div style={{ fontSize: 13, color: "#1a2a3a", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {cleanText ? renderTextWithLinks(cleanText) : <span style={{ color: "#8399a9" }}>Aucune note</span>}
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
                  borderRadius: 6, border: "1px solid #dce8f0", background: "#f8fbfd",
                  fontSize: 11, color: "#1E2A5A", textDecoration: "none",
                }}
              >
                {att.type === "image" ? <ImageIcon style={{ width: 12, height: 12 }} /> : <FileText style={{ width: 12, height: 12 }} />}
                {att.name}
                <ExternalLink style={{ width: 10, height: 10 }} />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={cleanText}
        onChange={(e) => {
          // Rebuild value with attachments
          const markers = attachments.map(a => `[file:${a.name}|${a.url}]`).join("\n");
          onChange(e.target.value + (markers ? "\n" + markers : ""));
        }}
        placeholder={placeholder}
        style={{
          width: "100%", minHeight, borderRadius: 8, border: "1px solid #dce8f0",
          padding: "10px 12px", fontSize: 13, color: "#1a2a3a", resize: "vertical",
          lineHeight: 1.6, outline: "none", background: "#f8fbfd",
        }}
      />

      {/* Attachments display */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {attachments.map((att, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
                borderRadius: 6, border: "1px solid #dce8f0", background: "#f8fbfd",
                fontSize: 11,
              }}
            >
              {att.type === "image" ? <ImageIcon style={{ width: 12, height: 12, color: "#1E2A5A" }} /> : <FileText style={{ width: 12, height: 12, color: "#1E2A5A" }} />}
              <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1E2A5A", textDecoration: "none" }}>{att.name}</a>
              <button onClick={() => removeAttachment(att)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 0, display: "flex" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
            borderRadius: 6, border: "1px solid #dce8f0", background: "white",
            fontSize: 11, color: "#5a6f80", cursor: uploading ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          <Paperclip style={{ width: 12, height: 12 }} />
          {uploading ? "Upload..." : "Joindre un fichier"}
        </button>
        <span style={{ fontSize: 10, color: "#8399a9" }}>Images, PDF, documents</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          onChange={handleUpload}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
