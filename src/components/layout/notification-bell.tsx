"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string | null;
}

const TYPE_ICON: Record<string, string> = {
  post_mention: "💬",
  post_comment: "💭",
  post_reaction: "👍",
  comment_reply: "↩️",
  post_pinned: "📌",
  session_assigned: "📅",
  session_cancelled: "❌",
  session_learner_added: "👥",
  session_reminder: "⏰",
  session_unclosed: "⚠️",
  meeting_assigned: "🤝",
  meeting_cancelled: "❌",
  meeting_noshow: "🚫",
  meeting_reminder: "⏰",
  meeting_unclosed: "⚠️",
  task_assigned: "✅",
  task_overdue: "🔥",
  task_due_soon: "⏳",
  task_completed: "✔️",
  deal_stage_changed: "💼",
  stripe_payment: "💰",
  new_lead: "🎯",
  new_review: "⭐",
  birthday: "🎂",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Resolve current member_id
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase
        .from("team_members")
        .select("id")
        .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
        .limit(1)
        .single();
      if (member) setMemberId(member.id);
    })();
  }, []);

  const loadNotifs = useCallback(async () => {
    if (!memberId) return;
    const supabase = createClient();
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link_url, read_at, created_at, actor_id")
      .eq("recipient_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifs((data as NotificationRow[]) ?? []);
    setLoading(false);
  }, [memberId]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!memberId) return;
    loadNotifs();

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${memberId}`,
        },
        () => loadNotifs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, loadNotifs]);

  // Click-outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  async function markAllAsRead() {
    if (!memberId) return;
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", memberId)
      .is("read_at", null);
    setNotifs((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
  }

  function handleNotifClick(n: NotificationRow) {
    if (!n.read_at) markAsRead(n.id);
    if (n.link_url) {
      setOpen(false);
      // Hard navigation to ensure query params (planId, etc.) are read on mount
      window.location.href = n.link_url;
    }
  }

  const unreadCount = notifs.filter((n) => !n.read_at).length;

  return (
    <div ref={wrapperRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.4)",
          background: "transparent",
          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.2s", position: "relative",
          boxShadow: open ? "0 0 0 3px rgba(255,107,53,0.4)" : "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 18, height: 18, padding: "0 5px",
              background: "#e74c3c", color: "white",
              borderRadius: 9, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid white", lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            width: 380, maxHeight: 500,
            background: "white", borderRadius: 10,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            border: "1px solid #e8ecf1", zIndex: 50,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px", borderBottom: "1px solid #f0f2f5",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <strong style={{ fontSize: 14, color: "#1a2a3a" }}>
              Notifications {unreadCount > 0 && <span style={{ color: "#E8732A" }}>({unreadCount})</span>}
            </strong>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, color: "#5a6f80",
                  background: "transparent", border: "none", cursor: "pointer",
                }}
              >
                <CheckCheck className="h-3 w-3" /> Tout marquer lu
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && notifs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#8399a9" }}>
                Chargement…
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#8399a9" }}>
                🎉 Pas de notification pour le moment
              </div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    width: "100%", padding: "12px 16px",
                    borderBottom: "1px solid #f5f7fa",
                    background: n.read_at ? "transparent" : "#fff7f3",
                    border: "none", borderLeft: n.read_at ? "none" : "3px solid #E8732A",
                    cursor: n.link_url ? "pointer" : "default", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f7fa"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.read_at ? "transparent" : "#fff7f3"; }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read_at ? 500 : 600, color: "#1a2a3a", marginBottom: 2 }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 12, color: "#5a6f80", lineHeight: 1.4, marginBottom: 4, whiteSpace: "pre-wrap" }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#8399a9" }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read_at && (
                    <span
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      title="Marquer comme lu"
                      style={{ flexShrink: 0, padding: 4, color: "#8399a9", cursor: "pointer" }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
