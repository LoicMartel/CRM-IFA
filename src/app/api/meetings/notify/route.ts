import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCalendarEvent } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId } = body;

    if (!meetingId) {
      return NextResponse.json({ error: "meetingId required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch meeting with related data
    const { data: meeting } = await supabase
      .from("meetings")
      .select(`
        *,
        contacts!meetings_contact_id_fkey(id, first_name, last_name, phone, email,
          companies!contacts_company_id_fkey(name)
        )
      `)
      .eq("id", meetingId)
      .single();

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Get assigned team member
    let assignedMember: any = null;
    if (meeting.assigned_to) {
      const { data: member } = await supabase
        .from("team_members")
        .select("first_name, last_name, google_calendar_id, google_calendar_id_commercial, zoom_link, email, slack_user_id, roles")
        .eq("id", meeting.assigned_to)
        .single();
      assignedMember = member;
    }

    const contact = meeting.contacts as any;
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Contact";
    const companyName = contact?.companies?.name ?? "";
    const contactPhone = contact?.phone ?? "";
    const contactEmail = contact?.email ?? "";

    // Meeting type labels
    const typeLabels: Record<string, string> = {
      R0: "R0 — Qualification",
      R1: "R1 — Découverte",
      R2: "R2 — Solution",
      R3: "R3 — Négociation",
    };
    const typeLabel = typeLabels[meeting.meeting_type] ?? meeting.meeting_type;

    const modeLabels: Record<string, string> = { visio: "Visio", phone: "Téléphone", in_person: "Présentiel" };
    const modeLabel = modeLabels[meeting.meeting_mode] ?? meeting.meeting_mode ?? "Visio";

    const durationMin = meeting.duration_minutes ?? 60;
    const durationLabel = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? String(durationMin % 60).padStart(2, "0") : ""}` : `${durationMin}min`;

    // Parse scheduled_at
    // Parse scheduled_at — keep raw string to avoid timezone shift
    const rawScheduled = meeting.scheduled_at as string;
    const scheduledDate = new Date(rawScheduled);
    const dateStr = rawScheduled.slice(0, 10);
    const timeStr = rawScheduled.includes("T") ? rawScheduled.slice(11, 16) : scheduledDate.toISOString().slice(11, 16);
    const dateDisplay = scheduledDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

    // Title
    const title = `${meeting.meeting_type} — ${contactName}${companyName ? ` (${companyName})` : ""}`;

    const slackToken = process.env.SLACK_BOT_TOKEN;
    const results: { action: string; status: string }[] = [];

    if (!assignedMember) {
      return NextResponse.json({ success: true, title, results: [{ action: "skip", status: "No assigned member" }] });
    }

    const memberRoles = (assignedMember.roles as string[]) ?? [];
    const isExterne = memberRoles.includes("Externe");
    const zoomLink = assignedMember.zoom_link ?? "";
    const location = meeting.meeting_mode === "in_person"
      ? (meeting.location ?? "Lieu non renseigné")
      : meeting.meeting_mode === "visio" ? zoomLink : "";

    // 1. Google Calendar (non-Externe only)
    const commercialCalId = assignedMember.google_calendar_id_commercial || assignedMember.google_calendar_id;
    if (commercialCalId && !isExterne) {
      const startDT = `${dateStr}T${timeStr}:00`;
      const [startH, startM] = timeStr.split(":").map(Number);
      const totalMinutes = startH * 60 + startM + durationMin;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      const endDT = `${dateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

      const description = [
        `📋 ${typeLabel}`,
        `👤 Contact : ${contactName}`,
        companyName ? `🏢 Entreprise : ${companyName}` : "",
        contactPhone ? `📞 Tél : ${contactPhone}` : "",
        contactEmail ? `✉️ Email : ${contactEmail}` : "",
        `🖥️ Mode : ${modeLabel}`,
        `⏱️ Durée : ${durationLabel}`,
        "",
        meeting.meeting_mode === "visio" && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
        meeting.location ? `📍 Lieu : ${meeting.location}` : "",
        meeting.notes ? `\n📝 Notes : ${meeting.notes}` : "",
      ].filter(Boolean).join("\n");

      const gcalResult = await createCalendarEvent({
        calendarId: commercialCalId,
        summary: title,
        description,
        location,
        startDateTime: startDT,
        endDateTime: endDT,
      });

      results.push({ action: "Google Calendar", status: gcalResult.success ? "Ajouté" : gcalResult.error ?? "Erreur" });
    }

    // 2. Slack DM (non-Externe only)
    if (assignedMember.slack_user_id && slackToken && !isExterne) {
      const slackMsg = [
        `Bonjour ${assignedMember.first_name},`,
        "",
        `📅 *Nouveau RDV commercial planifié*`,
        "",
        `*${title}*`,
        `📋 ${typeLabel}`,
        `👤 ${contactName}`,
        companyName ? `🏢 ${companyName}` : "",
        contactPhone ? `📞 ${contactPhone}` : "",
        `📆 ${dateDisplay} à ${timeStr} (${durationLabel})`,
        `🖥️ ${modeLabel}`,
        meeting.meeting_mode === "visio" && zoomLink ? `🔗 Zoom : ${zoomLink}` : "",
        meeting.location ? `📍 ${meeting.location}` : "",
        "",
        commercialCalId ? `✅ L'événement a été ajouté à ton agenda Google.` : "",
      ].filter(Boolean).join("\n");

      try {
        const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${slackToken}` },
          body: JSON.stringify({ channel: assignedMember.slack_user_id, text: slackMsg }),
        });
        const slackData = await slackRes.json();
        results.push({ action: "Slack", status: slackData.ok ? "Envoyé" : slackData.error });
      } catch (e: any) {
        results.push({ action: "Slack", status: `Erreur: ${e.message}` });
      }
    }

    // 3. Email (Externe only)
    if (isExterne && assignedMember.email) {
      const emailBody = [
        `Bonjour ${assignedMember.first_name},`,
        "",
        "Un rendez-vous commercial vient d'être planifié :",
        "",
        `📋 ${typeLabel}`,
        `👤 Contact : ${contactName}`,
        companyName ? `🏢 Entreprise : ${companyName}` : "",
        contactPhone ? `📞 Tél : ${contactPhone}` : "",
        `📅 Date : ${dateDisplay} à ${timeStr} (${durationLabel})`,
        `🖥️ Mode : ${modeLabel}`,
        meeting.meeting_mode === "visio" && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
        meeting.location ? `📍 Lieu : ${meeting.location}` : "",
        "",
        "⚠️ Pense à vérifier ta disponibilité.",
        "",
        "Belle journée,",
        "",
        "Loïc ⚡",
      ].filter(Boolean).join("\n");

      const emailResult = await sendSessionEmail({
        to: assignedMember.email,
        subject: `Nouveau RDV — ${title}`,
        body: emailBody,
      });
      results.push({ action: "Email", status: emailResult.success ? "Envoyé" : emailResult.error ?? "Erreur" });
    }

    return NextResponse.json({ success: true, title, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
