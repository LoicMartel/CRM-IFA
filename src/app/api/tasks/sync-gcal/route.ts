import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json();
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

    const supabase = await createClient();

    const { data: task } = await supabase
      .from("activities")
      .select("*, contacts:contact_id(id, first_name, last_name), companies:company_id(id, name)")
      .eq("id", taskId)
      .single();

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Get assigned team member
    if (!task.team_member_id) return NextResponse.json({ success: true, result: "Pas de membre assigné" });

    const { data: member } = await supabase
      .from("team_members")
      .select("first_name, last_name, google_calendar_id_tasks, google_calendar_id_commercial, google_calendar_id, roles")
      .eq("id", task.team_member_id)
      .single();

    if (!member) return NextResponse.json({ success: true, result: "Membre non trouvé" });

    const isExterne = ((member.roles as string[]) ?? []).includes("Externe");
    if (isExterne) return NextResponse.json({ success: true, result: "Membre externe — pas de sync Calendar" });

    const calendarId = member.google_calendar_id_tasks || member.google_calendar_id_commercial || member.google_calendar_id;
    if (!calendarId) return NextResponse.json({ success: true, result: "Pas de calendrier configuré" });

    const contact = task.contacts as { first_name: string; last_name: string } | null;
    const company = task.companies as { name: string } | null;
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "";
    const companyName = company?.name ?? "";

    const title = `📋 Tâche: ${task.title}${contactName ? ` — ${contactName}` : ""}${companyName ? ` (${companyName})` : ""}`;

    // Parse due_date — stored as local time string from datetime-local input (e.g. "2026-04-01T15:30")
    const rawDue = task.due_date as string;
    const dateStr = rawDue.slice(0, 10);
    const timeStr = rawDue.includes("T") ? rawDue.slice(11, 16) : "09:00";

    const startDT = `${dateStr}T${timeStr}:00`;
    // Task duration: 30 min by default
    const [h, m] = timeStr.split(":").map(Number);
    const endMinutes = h * 60 + m + 30;
    const endDT = `${dateStr}T${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`;

    const deadlineStr = task.task_deadline
      ? new Date(task.task_deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "";

    const description = [
      `📋 Tâche: ${task.title}`,
      contactName ? `👤 Contact: ${contactName}` : "",
      companyName ? `🏢 Entreprise: ${companyName}` : "",
      deadlineStr ? `⏰ Échéance: ${deadlineStr}` : "",
      task.description ? `\n📝 ${task.description}` : "",
    ].filter(Boolean).join("\n");

    const existingEventId = task.gcal_event_id as string | null;

    if (existingEventId) {
      // Update existing Google Calendar event
      const gcalResult = await updateCalendarEvent({
        calendarId,
        eventId: existingEventId,
        summary: title,
        description,
        location: "",
        startDateTime: startDT,
        endDateTime: endDT,
      });
      return NextResponse.json({
        success: true,
        result: gcalResult.success ? "Mis à jour sur le calendrier" : gcalResult.error,
      });
    } else {
      // Create new Google Calendar event
      const gcalResult = await createCalendarEvent({
        calendarId,
        summary: title,
        description,
        location: "",
        startDateTime: startDT,
        endDateTime: endDT,
      });

      // Save the event ID for future updates
      if (gcalResult.success && gcalResult.eventId) {
        await supabase.from("activities").update({ gcal_event_id: gcalResult.eventId }).eq("id", taskId);
      }

      return NextResponse.json({
        success: true,
        result: gcalResult.success ? "Ajouté au calendrier" : gcalResult.error,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
