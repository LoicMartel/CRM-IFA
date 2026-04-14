"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Highlighter,
  Type,
  Undo,
  Redo,
  Quote,
  Minus,
} from "lucide-react";

const TEXT_COLORS = [
  { label: "Noir", value: "#1a2a3a" },
  { label: "Rouge", value: "#c62828" },
  { label: "Orange", value: "#e65100" },
  { label: "Vert", value: "#2e7d32" },
  { label: "Bleu", value: "#1565c0" },
  { label: "Violet", value: "#6a1b9a" },
  { label: "Gris", value: "#8399a9" },
];

const HIGHLIGHT_COLORS = [
  { label: "Jaune", value: "#fff9c4" },
  { label: "Vert", value: "#c8e6c9" },
  { label: "Bleu", value: "#bbdefb" },
  { label: "Rose", value: "#f8bbd0" },
  { label: "Orange", value: "#ffe0b2" },
  { label: "Violet", value: "#e1bee7" },
];

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Écrivez votre post..." }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { style: "color: #1a6b9c; text-decoration: underline;" } }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: "min-height: 150px; padding: 12px 14px; outline: none; font-size: 14px; line-height: 1.7; color: #1a2a3a;",
      },
    },
  });

  if (!editor) return null;

  return (
    <div style={{ border: "1px solid #dce8f0", borderRadius: 10, overflow: "hidden", background: "#f8fbfd" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: "6px 8px",
        borderBottom: "1px solid #dce8f0",
        background: "white",
        alignItems: "center",
      }}>
        {/* Undo / Redo */}
        <ToolbarButton
          icon={Undo}
          onClick={() => editor.chain().focus().undo().run()}
          title="Annuler"
        />
        <ToolbarButton
          icon={Redo}
          onClick={() => editor.chain().focus().redo().run()}
          title="Rétablir"
        />
        <ToolbarDivider />

        {/* Text format */}
        <ToolbarButton
          icon={Bold}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        />
        <ToolbarButton
          icon={Italic}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        />
        <ToolbarButton
          icon={UnderlineIcon}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        />
        <ToolbarButton
          icon={Strikethrough}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barré"
        />
        <ToolbarDivider />

        {/* Text color */}
        <ColorPicker
          icon={Type}
          colors={TEXT_COLORS}
          activeColor={editor.getAttributes("textStyle").color}
          onSelect={(color) => editor.chain().focus().setColor(color).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
          title="Couleur du texte"
        />

        {/* Highlight */}
        <ColorPicker
          icon={Highlighter}
          colors={HIGHLIGHT_COLORS}
          activeColor={editor.getAttributes("highlight").color}
          onSelect={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
          title="Surligner"
        />
        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          label="H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titre"
        />
        <ToolbarButton
          label="H3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Sous-titre"
        />
        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          icon={List}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        />
        <ToolbarButton
          icon={ListOrdered}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        />
        <ToolbarButton
          icon={Quote}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citation"
        />
        <ToolbarButton
          icon={Minus}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Ligne horizontale"
        />
        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          icon={AlignLeft}
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Aligner à gauche"
        />
        <ToolbarButton
          icon={AlignCenter}
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Centrer"
        />
        <ToolbarButton
          icon={AlignRight}
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Aligner à droite"
        />
        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          icon={LinkIcon}
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = prompt("URL du lien :");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          title="Lien"
        />
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #8399a9;
          pointer-events: none;
          height: 0;
        }
        .tiptap h2 { font-size: 20px; font-weight: 700; margin: 12px 0 6px; color: #1a2a3a; }
        .tiptap h3 { font-size: 16px; font-weight: 700; margin: 10px 0 4px; color: #1a2a3a; }
        .tiptap ul, .tiptap ol { padding-left: 24px; margin: 6px 0; }
        .tiptap li { margin: 2px 0; }
        .tiptap blockquote { border-left: 3px solid #1a6b9c; margin: 8px 0; padding: 4px 14px; color: #5a6f80; background: #f0f4f8; border-radius: 0 6px 6px 0; }
        .tiptap hr { border: none; border-top: 1px solid #dce8f0; margin: 12px 0; }
        .tiptap a { color: #1a6b9c; text-decoration: underline; }
        .tiptap mark { border-radius: 2px; padding: 0 2px; }
        .tiptap p { margin: 4px 0; }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
  title,
}: {
  icon?: any;
  label?: string;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: label ? "auto" : 28,
        height: 28,
        padding: label ? "0 8px" : 0,
        borderRadius: 4,
        border: "none",
        background: active ? "#e3f2fd" : "transparent",
        color: active ? "#1565c0" : "#5a6f80",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {Icon ? <Icon style={{ width: 15, height: 15 }} /> : label}
    </button>
  );
}

function ToolbarDivider() {
  return <div style={{ width: 1, height: 20, background: "#dce8f0", margin: "0 4px" }} />;
}

function ColorPicker({
  icon: Icon,
  colors,
  activeColor,
  onSelect,
  onClear,
  title,
}: {
  icon: any;
  colors: { label: string; value: string }[];
  activeColor?: string;
  onSelect: (color: string) => void;
  onClear: () => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={title}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 4,
          border: "none",
          background: activeColor ? `${activeColor}22` : "transparent",
          color: activeColor || "#5a6f80",
          cursor: "pointer",
        }}
      >
        <Icon style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 20,
            background: "white",
            border: "1px solid #dce8f0",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            padding: 8,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            width: 160,
          }}
        >
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => { onSelect(c.value); setOpen(false); }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: activeColor === c.value ? "2px solid #1a2a3a" : "1px solid #dce8f0",
                background: c.value,
                cursor: "pointer",
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => { onClear(); setOpen(false); }}
            style={{
              width: "100%",
              padding: "4px 0",
              border: "none",
              background: "none",
              fontSize: 11,
              color: "#8399a9",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

// Read-only renderer for post content
export function RichTextContent({ html }: { html: string }) {
  return (
    <>
      <div
        className="tiptap-content"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ fontSize: 14, lineHeight: 1.7, color: "#3a4a5a" }}
      />
      <style>{`
        .tiptap-content h2 { font-size: 20px; font-weight: 700; margin: 12px 0 6px; color: #1a2a3a; }
        .tiptap-content h3 { font-size: 16px; font-weight: 700; margin: 10px 0 4px; color: #1a2a3a; }
        .tiptap-content ul, .tiptap-content ol { padding-left: 24px; margin: 6px 0; }
        .tiptap-content li { margin: 2px 0; }
        .tiptap-content blockquote { border-left: 3px solid #1a6b9c; margin: 8px 0; padding: 4px 14px; color: #5a6f80; background: #f0f4f8; border-radius: 0 6px 6px 0; }
        .tiptap-content hr { border: none; border-top: 1px solid #dce8f0; margin: 12px 0; }
        .tiptap-content a { color: #1a6b9c; text-decoration: underline; }
        .tiptap-content mark { border-radius: 2px; padding: 0 2px; }
        .tiptap-content p { margin: 4px 0; }
      `}</style>
    </>
  );
}
