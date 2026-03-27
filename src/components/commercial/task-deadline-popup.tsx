"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/lib/use-current-member";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DeadlineTask {
  id: string;
  title: string;
  task_deadline: string;
  contacts: { id: string; first_name: string; last_name: string } | null;
}

export function TaskDeadlinePopup() {
  const memberId = useCurrentMember();
  const [tasks, setTasks] = useState<DeadlineTask[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!memberId) return;

    const todayKey = format(new Date(), "yyyy-MM-dd");
    const storageKey = `task-deadline-popup-${todayKey}`;

    if (localStorage.getItem(storageKey)) return;

    async function load() {
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const todayStr = format(today, "yyyy-MM-dd");
      const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

      const { data } = await supabase
        .from("activities")
        .select("id, title, task_deadline, contacts:contact_id(id, first_name, last_name)")
        .eq("type", "tâche")
        .eq("is_completed", false)
        .eq("team_member_id", memberId!)
        .gte("task_deadline", todayStr)
        .lte("task_deadline", tomorrowStr)
        .order("task_deadline", { ascending: true });

      if (data && data.length > 0) {
        setTasks(data as any);
        setVisible(true);
      }
    }
    load();
  }, [memberId]);

  function dismiss() {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    localStorage.setItem(`task-deadline-popup-${todayKey}`, "1");
    setVisible(false);
  }

  function getDeadlineBadge(deadline: string) {
    const today = format(new Date(), "yyyy-MM-dd");
    const deadlineDate = deadline.slice(0, 10);
    if (deadlineDate === today) {
      return { label: "Aujourd'hui", bg: "#fde8e8", text: "#c62828" };
    }
    return { label: "Demain", bg: "#fff3e0", text: "#e65100" };
  }

  if (!visible || tasks.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div style={{
        background: "white", borderRadius: 14, width: "100%", maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e8ecf1",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, #fce4ec 0%, #fff3e0 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle className="h-5 w-5" style={{ color: "#c62828" }} />
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
              Tâches à traiter
            </h3>
          </div>
          <button onClick={dismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, maxHeight: "60vh", overflowY: "auto" }}>
          <p style={{ fontSize: 13, color: "#5a6f80", marginBottom: 16 }}>
            Tu as {tasks.length} tâche{tasks.length > 1 ? "s" : ""} dont l&apos;échéance arrive bientôt :
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tasks.map((t) => {
              const badge = getDeadlineBadge(t.task_deadline);
              return (
                <div key={t.id} style={{
                  padding: "12px 14px", borderRadius: 10,
                  background: "#f5f7fa", borderLeft: `3px solid ${badge.text}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>{t.title}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                      background: badge.bg, color: badge.text,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  {t.contacts && (
                    <div style={{ fontSize: 12, color: "#5a6f80" }}>
                      {t.contacts.first_name} {t.contacts.last_name}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#8399a9", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock className="h-3 w-3" />
                    {format(new Date(t.task_deadline), "d MMMM yyyy", { locale: fr })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            onClick={dismiss}
            style={{
              height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
              color: "white", fontSize: 13, fontWeight: 700,
              padding: "0 24px", border: "none", cursor: "pointer",
            }}
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}
