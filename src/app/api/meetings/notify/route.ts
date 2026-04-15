import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCalendarEvent } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";
import { generateICS } from "@/lib/ics";
import { toParisDateTime } from "@/lib/timezone";
import { loadWorkflow, isStepActive } from "@/lib/automations";
import { createNotification } from "@/lib/notifications";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId } = body;

    if (!meetingId) {
      return NextResponse.json({ error: "meetingId required" }, { status: 400 });
    }

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
    const contactFirstName = contact?.first_name ?? "Contact";
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

    // Parse scheduled_at — convert to Europe/Paris local time
    const rawScheduled = meeting.scheduled_at as string;
    const scheduledDate = new Date(rawScheduled);
    const { date: dateStr, time: timeStr } = toParisDateTime(rawScheduled);
    const dateDisplay = scheduledDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

    // Title
    const title = `${meeting.meeting_type} — ${contactName}${companyName ? ` (${companyName})` : ""}`;

    const slackToken = process.env.SLACK_BOT_TOKEN;
    const results: { action: string; status: string }[] = [];

    const wf = await loadWorkflow("meeting-notification");
    if (wf && !wf.is_active) {
      return NextResponse.json({ success: true, title, results: [{ action: "skip", status: "workflow disabled" }] });
    }

    if (!assignedMember) {
      return NextResponse.json({ success: true, title, results: [{ action: "skip", status: "No assigned member" }] });
    }

    // In-app notification for the commercial owner
    if (meeting.assigned_to) {
      await createNotification({
        recipientId: meeting.assigned_to as string,
        type: "meeting_assigned",
        title: `Nouveau ${meeting.meeting_type} : ${contactName}`,
        body: `${dateDisplay} à ${timeStr}${companyName ? ` — ${companyName}` : ""}`,
        linkUrl: `/contacts/${contact?.id ?? ""}`,
        relatedEntityType: "meeting",
        relatedEntityId: meetingId,
      });
    }

    const memberRoles = (assignedMember.roles as string[]) ?? [];
    const isExterne = memberRoles.includes("Externe");
    const zoomLink = assignedMember.zoom_link ?? "";
    const location = meeting.meeting_mode === "in_person"
      ? (meeting.location ?? "Lieu non renseigné")
      : meeting.meeting_mode === "visio" ? zoomLink : "";

    // 1. Google Calendar (for everyone with a calendar configured)
    const commercialCalId = assignedMember.google_calendar_id_commercial || assignedMember.google_calendar_id;
    if (commercialCalId && isStepActive(wf, "google-calendar").active) {
      try {
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
      } catch (e: any) {
        results.push({ action: "Google Calendar", status: `Erreur: ${e.message}` });
      }
    }

    // 2. Slack DM (for everyone with a Slack user ID)
    if (assignedMember.slack_user_id && slackToken && isStepActive(wf, "slack-dm").active) {
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

    // 3. Email (Externe only) with .ics
    if (isExterne && assignedMember.email && isStepActive(wf, "email-externe-ics").active) {
      try {
        const icsStartExt = `${dateStr}T${timeStr}:00`;
        const [eH, eM] = timeStr.split(":").map(Number);
        const eTotalMin = eH * 60 + eM + durationMin;
        const icsEndExt = `${dateStr}T${String(Math.floor(eTotalMin / 60)).padStart(2, "0")}:${String(eTotalMin % 60).padStart(2, "0")}:00`;

        const icsContentExt = generateICS({
          summary: title,
          description: [
            typeLabel,
            `Contact : ${contactName}`,
            companyName ? `Entreprise : ${companyName}` : "",
            contactPhone ? `Tél : ${contactPhone}` : "",
            `Mode : ${modeLabel}`,
            `Durée : ${durationLabel}`,
            meeting.meeting_mode === "visio" && zoomLink ? `Lien Zoom : ${zoomLink}` : "",
            meeting.location ? `Lieu : ${meeting.location}` : "",
          ].filter(Boolean).join("\n"),
          location: meeting.meeting_mode === "visio" ? (zoomLink || "Visioconférence") : (meeting.location || ""),
          startDateTime: icsStartExt,
          endDateTime: icsEndExt,
          organizerName: "La Closing Académie",
          organizerEmail: "contact@closing-academie.com",
        });

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
          "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
          "",
          "Belle journée,",
          "",
          "L'équipe La Closing Académie",
        ].filter(Boolean).join("\n");

        const emailResult = await sendSessionEmail({
          to: assignedMember.email,
          subject: `Nouveau RDV — ${title}`,
          body: emailBody,
          attachments: [{ filename: "invitation.ics", content: icsContentExt }],
        });
        results.push({ action: "Email", status: emailResult.success ? "Envoyé" : emailResult.error ?? "Erreur" });
      } catch (e: any) {
        results.push({ action: "Email", status: `Erreur: ${e.message}` });
      }
    }

    // 4. Send .ics invitation to prospect
    if (contactEmail && isStepActive(wf, "email-prospect-ics").active) {
      try {
        const icsStart = `${dateStr}T${timeStr}:00`;
        const [iH, iM] = timeStr.split(":").map(Number);
        const iTotalMin = iH * 60 + iM + durationMin;
        const icsEnd = `${dateStr}T${String(Math.floor(iTotalMin / 60)).padStart(2, "0")}:${String(iTotalMin % 60).padStart(2, "0")}:00`;

        const icsContent = generateICS({
          summary: title,
          description: [
            typeLabel,
            `Contact : ${contactName}`,
            companyName ? `Entreprise : ${companyName}` : "",
            `Mode : ${modeLabel}`,
            `Durée : ${durationLabel}`,
            meeting.meeting_mode === "visio" && zoomLink ? `Lien Zoom : ${zoomLink}` : "",
            meeting.location ? `Lieu : ${meeting.location}` : "",
          ].filter(Boolean).join("\n"),
          location: meeting.meeting_mode === "visio" ? (zoomLink || "Visioconférence") : (meeting.location || ""),
          startDateTime: icsStart,
          endDateTime: icsEnd,
          organizerName: assignedMember ? `${assignedMember.first_name} ${assignedMember.last_name}` : "La Closing Académie",
          organizerEmail: (assignedMember?.email as string) || "contact@closing-academie.com",
        });

        const emailBody = [
          `Bonjour ${contactFirstName},`,
          "",
          "Votre rendez-vous est confirmé :",
          "",
          `📋 ${typeLabel}`,
          `📆 ${dateDisplay} à ${timeStr} (${durationLabel})`,
          `🖥️ ${modeLabel}`,
          meeting.meeting_mode === "visio" && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
          meeting.location ? `📍 Lieu : ${meeting.location}` : "",
          "",
          "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
          "",
          "À très bientôt,",
          "",
          "L'équipe La Closing Académie",
        ].filter(Boolean).join("\n");

        const emailResult = await sendSessionEmail({
          to: contactEmail,
          subject: `Confirmation RDV : ${title}`,
          body: emailBody,
          attachments: [{ filename: "invitation.ics", content: icsContent }],
        });
        results.push({ action: "Email prospect (.ics)", status: emailResult.success ? "Envoyé" : emailResult.error ?? "Erreur" });
      } catch (e: any) {
        results.push({ action: "Email prospect (.ics)", status: `Erreur: ${e.message}` });
      }
    }

    return NextResponse.json({ success: true, title, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
