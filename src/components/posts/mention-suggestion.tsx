"use client";

import {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import { createRoot, Root } from "react-dom/client";
import type { Editor, Range } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { POST_CATEGORY_LABELS, POST_CATEGORY_COLORS, type PostCategory } from "@/types/database";

export interface MentionMember {
  id: string;
  label: string; // "Prénom Nom"
  first_name: string;
  avatar_url: string | null;
}

// ─── @-mention list (existing) ────────────────────────────────────────

interface MentionListProps {
  items: MentionMember[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListHandle {
  onKeyDown: (e: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    function selectItem(i: number) {
      const item = items[i];
      if (item) command({ id: item.id, label: item.first_name });
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div style={popoverStyle}>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "#8399a9" }}>
            Aucun membre trouvé
          </div>
        </div>
      );
    }

    return (
      <div style={popoverStyle}>
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(i)}
            onMouseEnter={() => setSelectedIndex(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 12px",
              border: "none",
              background: i === selectedIndex ? "#fff7f3" : "transparent",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
              color: "#1a2a3a",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: item.avatar_url
                  ? `url(${item.avatar_url}) center/cover`
                  : "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {!item.avatar_url && item.first_name[0]}
            </span>
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

// ─── #-tag list (categories + roles) ──────────────────────────────────

export interface TagItem {
  id: string;        // category key (e.g. "commercial") or role name (e.g. "Account Manager")
  label: string;     // display label
  type: "category" | "role";
  color: { bg: string; text: string };
}

function buildTagItems(): TagItem[] {
  const items: TagItem[] = [];

  // Post categories
  for (const [key, label] of Object.entries(POST_CATEGORY_LABELS)) {
    const colors = POST_CATEGORY_COLORS[key as PostCategory] ?? { bg: "#f0f0f0", text: "#666" };
    items.push({ id: `cat:${key}`, label, type: "category", color: colors });
  }

  // Team member roles
  const roles = [
    "Account Manager", "Admin", "Dirigeant", "Expert",
    "Externe", "Interne", "Marketing Manager",
    "Coordinatrice Pédagogique", "Ingénieure Pédagogique",
  ];
  for (const role of roles) {
    items.push({
      id: `role:${role}`,
      label: role,
      type: "role",
      color: { bg: "#fce4ec", text: "#c62828" },
    });
  }

  return items;
}

const ALL_TAG_ITEMS = buildTagItems();

interface TagListProps {
  items: TagItem[];
  command: (item: { id: string; label: string }) => void;
}

interface TagListHandle {
  onKeyDown: (e: { event: KeyboardEvent }) => boolean;
}

const TagList = forwardRef<TagListHandle, TagListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    function selectItem(i: number) {
      const item = items[i];
      if (item) command({ id: item.id, label: item.label });
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div style={popoverStyle}>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "#8399a9" }}>
            Aucun tag trouvé
          </div>
        </div>
      );
    }

    // Group by type
    const categories = items.filter(i => i.type === "category");
    const roles = items.filter(i => i.type === "role");
    let globalIdx = 0;

    return (
      <div style={popoverStyle}>
        {categories.length > 0 && (
          <>
            <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#8399a9", textTransform: "uppercase", letterSpacing: 1 }}>Catégories</div>
            {categories.map((item) => {
              const idx = globalIdx++;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 12px",
                    border: "none",
                    background: idx === selectedIndex ? "#fff7f3" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                  }}
                >
                  <span style={{ background: item.color.bg, color: item.color.text, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{item.label}</span>
                </button>
              );
            })}
          </>
        )}
        {roles.length > 0 && (
          <>
            <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#8399a9", textTransform: "uppercase", letterSpacing: 1, marginTop: categories.length > 0 ? 4 : 0 }}>Rôles</div>
            {roles.map((item) => {
              const idx = globalIdx++;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 12px",
                    border: "none",
                    background: idx === selectedIndex ? "#fff7f3" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                  }}
                >
                  <span style={{ background: item.color.bg, color: item.color.text, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{item.label}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  }
);

TagList.displayName = "TagList";

const popoverStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  border: "1px solid #e8ecf1",
  minWidth: 220,
  maxHeight: 300,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "4px 0",
};

/**
 * Build the @-mention suggestion plugin configuration for tiptap.
 */
export function buildMentionSuggestion(
  members: MentionMember[]
): Omit<SuggestionOptions, "editor"> {
  return {
    char: "@",
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return members
        .filter((m) => m.label.toLowerCase().includes(q) || m.first_name.toLowerCase().includes(q))
        .slice(0, 8);
    },
    render: () => {
      let container: HTMLDivElement | null = null;
      let root: Root | null = null;
      let ref: { current: MentionListHandle | null } = { current: null };

      function position(clientRect: (() => DOMRect | null) | null | undefined) {
        if (!clientRect || !container) return;
        const rect = clientRect();
        if (!rect) return;
        container.style.top = `${rect.bottom + window.scrollY + 4}px`;
        container.style.left = `${rect.left + window.scrollX}px`;
      }

      return {
        onStart: (props: { editor: Editor; clientRect?: (() => DOMRect | null) | null; items: MentionMember[]; command: (attrs: { id: string; label: string }) => void; range: Range }) => {
          container = document.createElement("div");
          container.style.position = "absolute";
          container.style.zIndex = "1000";
          document.body.appendChild(container);
          root = createRoot(container);
          ref = { current: null };
          const listRef = (instance: MentionListHandle | null) => {
            ref.current = instance;
          };
          root.render(<MentionList ref={listRef} items={props.items} command={props.command} />);
          position(props.clientRect);
        },
        onUpdate: (props: { items: MentionMember[]; command: (attrs: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
          if (!root) return;
          const listRef = (instance: MentionListHandle | null) => {
            ref.current = instance;
          };
          root.render(<MentionList ref={listRef} items={props.items} command={props.command} />);
          position(props.clientRect);
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") return true;
          return ref.current?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          if (root) {
            root.unmount();
            root = null;
          }
          if (container) {
            container.remove();
            container = null;
          }
        },
      };
    },
  };
}

/**
 * Build the #-tag suggestion plugin configuration for tiptap (categories + roles).
 */
export function buildTagSuggestion(): Omit<SuggestionOptions, "editor"> {
  return {
    char: "#",
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return ALL_TAG_ITEMS
        .filter((t) => t.label.toLowerCase().includes(q))
        .slice(0, 12);
    },
    render: () => {
      let container: HTMLDivElement | null = null;
      let root: Root | null = null;
      let ref: { current: TagListHandle | null } = { current: null };

      function position(clientRect: (() => DOMRect | null) | null | undefined) {
        if (!clientRect || !container) return;
        const rect = clientRect();
        if (!rect) return;
        container.style.top = `${rect.bottom + window.scrollY + 4}px`;
        container.style.left = `${rect.left + window.scrollX}px`;
      }

      return {
        onStart: (props: any) => {
          container = document.createElement("div");
          container.style.position = "absolute";
          container.style.zIndex = "1000";
          document.body.appendChild(container);
          root = createRoot(container);
          ref = { current: null };
          const listRef = (instance: TagListHandle | null) => { ref.current = instance; };
          root.render(<TagList ref={listRef} items={props.items} command={props.command} />);
          position(props.clientRect);
        },
        onUpdate: (props: any) => {
          if (!root) return;
          const listRef = (instance: TagListHandle | null) => { ref.current = instance; };
          root.render(<TagList ref={listRef} items={props.items} command={props.command} />);
          position(props.clientRect);
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") return true;
          return ref.current?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          if (root) { root.unmount(); root = null; }
          if (container) { container.remove(); container = null; }
        },
      };
    },
  };
}

/**
 * Parse post HTML and extract mentioned team_member IDs.
 * The Mention extension renders as <span data-type="mention" data-id="UUID">@Name</span>.
 */
export function extractMentionedIds(html: string): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const regex = /data-type="mention"[^>]*data-id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

/**
 * Parse post HTML and extract tagged categories and roles.
 * The tag extension renders as <span data-type="hashtag" data-id="cat:commercial">#Label</span>
 * Returns { categories: ["commercial", ...], roles: ["Account Manager", ...] }
 */
export function extractHashtags(html: string): { categories: string[]; roles: string[] } {
  if (!html) return { categories: [], roles: [] };
  const categories = new Set<string>();
  const roles = new Set<string>();
  const regex = /data-type="hashtag"[^>]*data-id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    if (id.startsWith("cat:")) categories.add(id.slice(4));
    else if (id.startsWith("role:")) roles.add(id.slice(5));
  }
  return { categories: Array.from(categories), roles: Array.from(roles) };
}
