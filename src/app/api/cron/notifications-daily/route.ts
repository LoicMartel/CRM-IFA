import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hhmm(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : "09:00";
}

/**
 * Daily cron that generates in-app notifications for:
 *  - Tasks overdue or due today
 *  - Sessions from yesterday still "planned" (not closed)
 *  - Meetings from yesterday still "booked" (not closed)
 *  - Session reminders J-1 (tomorrow's trainer schedule)
 *  - Meeting reminders J-1 (tomorrow's commercial meetings)
 *
 * Uses an idempotency guard on (recipient_id, type, related_entity_id)
 * to avoid sending the same reminder twice on the same day.
 */
export async function GET(req: NextRequest) {
  // Auth via Vercel cron header (automatic) or manual CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (!isVercelCron && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = isoDate(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = isoDate(tomorrowDate);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = isoDate(yesterdayDate);

  const stats = {
    task_overdue: 0,
    task_due_soon: 0,
    session_unclosed: 0,
    meeting_unclosed: 0,
    session_reminder: 0,
    meeting_reminder: 0,
  };

  // Helper: insert notifications only if same (recipient, type, entity) not already sent today
  async function insertUnique(rows: Array<{
    recipient_id: string;
    type: string;
    title: string;
    body?: string | null;
    link_url?: string | null;
    related_entity_type?: string | null;
    related_entity_id?: string | null;
  }>) {
    if (rows.length === 0) return 0;

    // Build dedup keys
    const keys = rows.map((r) => ({
      recipient_id: r.recipient_id,
      type: r.type,
      related_entity_id: r.related_entity_id ?? null,
    }));

    // Fetch existing notifs already sent today for these entities
    const sinceMidnight = `${today}T00:00:00Z`;
    const typesSet = Array.from(new Set(keys.map((k) => k.type)));
    const entityIds = keys.map((k) => k.related_entity_id).filter(Boolean) as string[];
    const { data: existing } = await supabase
      .from("notifications")
      .select("recipient_id, type, related_entity_id")
      .in("type", typesSet)
      .in("related_entity_id", entityIds.length > 0 ? entityIds : ["__none__"])
      .gte("created_at", sinceMidnight);

    const existingSet = new Set(
      (existing ?? []).map((e: any) => `${e.recipient_id}|${e.type}|${e.related_entity_id ?? ""}`)
    );

    const toInsert = rows.filter(
      (r) => !existingSet.has(`${r.recipient_id}|${r.type}|${r.related_entity_id ?? ""}`)
    );

    if (toInsert.length === 0) return 0;

    const { error } = await supabase.from("notifications").insert(
      toInsert.map((r) => ({
        recipient_id: r.recipient_id,
        type: r.type,
        title: r.title,
        body: r.body ?? null,
        link_url: r.link_url ?? null,
        related_entity_type: r.related_entity_type ?? null,
        related_entity_id: r.related_entity_id ?? null,
      }))
    );
    if (error) {
      console.error("[cron notifs] insert failed:", error.message);
      return 0;
    }
    return toInsert.length;
  }

  // ============================================================
  // 1. Tâches en retard (deadline passé, non complétées)
  // ============================================================
  {
    const { data: overdueTasks } = await supabase
      .from("activities")
      .select("id, title, task_deadline, due_date, team_member_id, contact_id")
      .eq("type", "tâche")
      .eq("is_completed", false)
      .not("team_member_id", "is", null)
      .lt("task_deadline", today);

    const rows = (overdueTasks ?? [])
      .filter((t: any) => t.task_deadline)
      .map((t: any) => ({
        recipient_id: t.team_member_id,
        type: "task_overdue",
        title: `🔥 Tâche en retard : ${t.title}`,
        body: `Échéance : ${new Date(t.task_deadline).toLocaleDateString("fr-FR")}`,
        link_url: t.contact_id ? `/contacts/${t.contact_id}` : "/",
        related_entity_type: "task",
        related_entity_id: t.id,
      }));
    stats.task_overdue = await insertUnique(rows);
  }

  // ============================================================
  // 2. Tâches à échéance aujourd'hui (dues soon)
  // ============================================================
  {
    const { data: soonTasks } = await supabase
      .from("activities")
      .select("id, title, task_deadline, team_member_id, contact_id")
      .eq("type", "tâche")
      .eq("is_completed", false)
      .not("team_member_id", "is", null)
      .eq("task_deadline", today);

    const rows = (soonTasks ?? []).map((t: any) => ({
      recipient_id: t.team_member_id,
      type: "task_due_soon",
      title: `⏳ Tâche à faire aujourd'hui : ${t.title}`,
      body: `Échéance : aujourd'hui`,
      link_url: t.contact_id ? `/contacts/${t.contact_id}` : "/",
      related_entity_type: "task",
      related_entity_id: t.id,
    }));
    stats.task_due_soon = await insertUnique(rows);
  }

  // ============================================================
  // 3. Sessions d'hier non fermées (status="planned")
  // ============================================================
  {
    const { data: unclosedSessions } = await supabase
      .from("training_sessions")
      .select(`
        id, session_type, session_date, trainers, status,
        service_plans(companies(name))
      `)
      .eq("status", "planned")
      .eq("session_date", yesterday);

    // Resolve trainer names → team_member ids
    const allTrainerNames = Array.from(
      new Set((unclosedSessions ?? []).flatMap((s: any) => (s.trainers ?? []) as string[]))
    );
    const nameToId = new Map<string, string>();
    if (allTrainerNames.length > 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, first_name")
        .in("first_name", allTrainerNames);
      for (const m of members ?? []) nameToId.set(m.first_name, m.id);
    }

    const rows: any[] = [];
    for (const s of unclosedSessions ?? []) {
      const company = (s as any).service_plans?.companies?.name ?? "Client";
      const typeLabel = s.session_type === "journee" ? "Journée" : "VT";
      for (const trainerName of (s.trainers ?? []) as string[]) {
        const recipientId = nameToId.get(trainerName);
        if (!recipientId) continue;
        rows.push({
          recipient_id: recipientId,
          type: s.session_type === "journee" ? "session_unclosed" : "session_unclosed",
          title: `⚠️ ${typeLabel} d'hier non fermée : ${company}`,
          body: `Merci de clôturer la session (done / no_show) dans le CRM`,
          link_url: `/planning`,
          related_entity_type: "training_session",
          related_entity_id: s.id,
        });
      }
    }
    stats.session_unclosed = await insertUnique(rows);
  }

  // ============================================================
  // 4. Meetings d'hier non fermés (status="booked")
  // ============================================================
  {
    const { data: unclosedMeetings } = await supabase
      .from("meetings")
      .select(`
        id, meeting_type, scheduled_at, status, assigned_to,
        contacts!meetings_contact_id_fkey(first_name, last_name, companies!contacts_company_id_fkey(name))
      `)
      .eq("status", "booked")
      .gte("scheduled_at", `${yesterday}T00:00:00Z`)
      .lt("scheduled_at", `${today}T00:00:00Z`)
      .not("assigned_to", "is", null);

    const rows = (unclosedMeetings ?? []).map((m: any) => {
      const contact = m.contacts;
      const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Contact";
      const company = contact?.companies?.name ? ` (${contact.companies.name})` : "";
      return {
        recipient_id: m.assigned_to as string,
        type: "meeting_unclosed",
        title: `⚠️ ${m.meeting_type} d'hier non fermé : ${contactName}${company}`,
        body: `Merci de clôturer le rdv (done / no_show / cancelled)`,
        link_url: `/sales`,
        related_entity_type: "meeting",
        related_entity_id: m.id,
      };
    });
    stats.meeting_unclosed = await insertUnique(rows);
  }

  // ============================================================
  // 5. Rappels de sessions J-1 (demain)
  // ============================================================
  {
    const { data: tomorrowSessions } = await supabase
      .from("training_sessions")
      .select(`
        id, session_type, session_date, session_time, trainers, duration_hours,
        service_plans(companies(name))
      `)
      .eq("status", "planned")
      .eq("session_date", tomorrow);

    const allTrainerNames = Array.from(
      new Set((tomorrowSessions ?? []).flatMap((s: any) => (s.trainers ?? []) as string[]))
    );
    const nameToId = new Map<string, string>();
    if (allTrainerNames.length > 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, first_name")
        .in("first_name", allTrainerNames);
      for (const m of members ?? []) nameToId.set(m.first_name, m.id);
    }

    const rows: any[] = [];
    for (const s of tomorrowSessions ?? []) {
      const company = (s as any).service_plans?.companies?.name ?? "Client";
      const typeLabel = s.session_type === "journee" ? "Journée" : "VT";
      const time = hhmm(s.session_time);
      for (const trainerName of (s.trainers ?? []) as string[]) {
        const recipientId = nameToId.get(trainerName);
        if (!recipientId) continue;
        rows.push({
          recipient_id: recipientId,
          type: "session_reminder",
          title: `⏰ ${typeLabel} demain à ${time} — ${company}`,
          body: `Durée : ${s.duration_hours ?? "?"}h`,
          link_url: `/planning`,
          related_entity_type: "training_session",
          related_entity_id: s.id,
        });
      }
    }
    stats.session_reminder = await insertUnique(rows);
  }

  // ============================================================
  // 6. Rappels meetings J-1
  // ============================================================
  {
    const { data: tomorrowMeetings } = await supabase
      .from("meetings")
      .select(`
        id, meeting_type, scheduled_at, status, assigned_to,
        contacts!meetings_contact_id_fkey(first_name, last_name, companies!contacts_company_id_fkey(name))
      `)
      .eq("status", "booked")
      .gte("scheduled_at", `${tomorrow}T00:00:00Z`)
      .lt("scheduled_at", `${isoDate(new Date(Date.now() + 2 * 86400000))}T00:00:00Z`)
      .not("assigned_to", "is", null);

    const rows = (tomorrowMeetings ?? []).map((m: any) => {
      const contact = m.contacts;
      const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Contact";
      const company = contact?.companies?.name ? ` (${contact.companies.name})` : "";
      const dt = new Date(m.scheduled_at);
      const time = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
      return {
        recipient_id: m.assigned_to as string,
        type: "meeting_reminder",
        title: `⏰ ${m.meeting_type} demain à ${time} : ${contactName}${company}`,
        body: null,
        link_url: `/sales`,
        related_entity_type: "meeting",
        related_entity_id: m.id,
      };
    });
    stats.meeting_reminder = await insertUnique(rows);
  }

  return NextResponse.json({ success: true, date: today, stats });
}
