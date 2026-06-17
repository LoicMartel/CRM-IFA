import { createClient } from "@supabase/supabase-js";
import { upsertCalendarEvent } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";
import { generateICS } from "@/lib/ics";
import { toParisDateTime } from "@/lib/timezone";
import { loadWorkflow, isStepActive } from "@/lib/automations";
import { createNotification } from "@/lib/notifications";
import { getProspectEmailBody, getProspectEmailSubject } from "@/lib/meeting-email-templates";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface NotificationResult {
  success: boolean;
  title: string;
  results: { action: string; status: string }[];
  error?: string;
}

export async function processMeetingNotifications(params: {
  meetingId: string;
  contactIds?: string[];
  managerIds?: string[];
  isReschedule?: boolean;
}): Promise<NotificationResult> {
  const { meetingId, contactIds, managerIds, isReschedule = false } = params;

  // Fetch meeting
  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    return { success: false, title: "", results: [], error: "Meeting not found" };
  }

  // Resolve participant lists (fallback to single contact/manager for backward compat)
  const resolvedContactIds: string[] = contactIds?.length
    ? contactIds
    : meeting.contact_id ? [meeting.contact_id] : [];

  const resolvedManagerIds: string[] = managerIds?.length
    ? managerIds
    : meeting.assigned_to ? [meeting.assigned_to] : [];

  // Fetch all contacts
  let allContacts: any[] = [];
  if (resolvedContactIds.length > 0) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, email, companies!contacts_company_id_fkey(name)")
      .in("id", resolvedContactIds);
    allContacts = data ?? [];
  }

  // Fetch all managers
  let allManagers: any[] = [];
  if (resolvedManagerIds.length > 0) {
    const { data } = await supabase
      .from("team_members")
      .select("id, first_name, last_name, google_calendar_id, google_calendar_id_commercial, zoom_link, email, slack_user_id, roles")
      .in("id", resolvedManagerIds);
    allManagers = data ?? [];
  }

  // Primary contact for display
  const primaryContact = allContacts.find(c => c.id === meeting.contact_id) ?? allContacts[0];
  const contactName = primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : "Contact";
  const companyName = primaryContact?.companies?.name ?? "";

  // Build contact names list for notifications
  const allContactNames = allContacts.map(c => `${c.first_name} ${c.last_name}`);
  const allManagerNames = allManagers.map(m => `${m.first_name} ${m.last_name}`);

  // Meeting type labels
  const typeLabels: Record<string, string> = {
    R0: "R0 -- Premier echange",
    "R0+R1": "R0+R1 -- Decouverte",
    R1: "R1 -- Decouverte",
    R2: "R2 -- Solution",
    R3: "R3 -- Negociation",
  };
  const typeLabel = typeLabels[meeting.meeting_type] ?? meeting.meeting_type;

  const modeLabels: Record<string, string> = { visio: "Visio", phone: "Telephone", in_person: "Presentiel" };
  const modeLabel = modeLabels[meeting.meeting_mode] ?? meeting.meeting_mode ?? "Visio";

  const durationMin = meeting.duration_minutes ?? 60;
  const durationLabel = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? String(durationMin % 60).padStart(2, "0") : ""}` : `${durationMin}min`;

  // Parse scheduled_at
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
    return { success: true, title, results: [{ action: "skip", status: "workflow disabled" }] };
  }

  if (allManagers.length === 0) {
    return { success: true, title, results: [{ action: "skip", status: "No assigned members" }] };
  }

  // Compute time blocks once
  const startDT = `${dateStr}T${timeStr}:00`;
  const [startH, startM] = timeStr.split(":").map(Number);
  const totalMinutes = startH * 60 + startM + durationMin;
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  const endDT = `${dateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

  // Build attendees list for Google Calendar (all managers + all contacts with email)
  const gcalAttendees: { email: string; displayName?: string }[] = [];
  for (const m of allManagers) {
    if (m.email) gcalAttendees.push({ email: m.email, displayName: `${m.first_name} ${m.last_name}` });
  }
  for (const c of allContacts) {
    if (c.email) gcalAttendees.push({ email: c.email, displayName: `${c.first_name} ${c.last_name}` });
  }

  // Contact list for display in messages
  const contactsListDisplay = allContactNames.length > 1
    ? allContactNames.join(", ")
    : contactName;

  const primaryManager = allManagers[0];

  // Existing GCal event IDs (for upsert on reschedule)
  const existingEventIds: Record<string, string> = (meeting.gcal_event_ids as Record<string, string>) ?? {};
  const updatedEventIds: Record<string, string> = { ...existingEventIds };

  const notifPrefix = isReschedule ? "Modifie" : "Nouveau";

  // ============================================================
  // LOOP OVER MANAGERS
  // ============================================================
  for (const manager of allManagers) {
    const memberRoles = (manager.roles as string[]) ?? [];
    const isExterne = memberRoles.includes("Externe");
    const zoomLink = manager.zoom_link ?? "";
    const location = meeting.meeting_mode === "in_person"
      ? (meeting.location ?? "Lieu non renseigne")
      : meeting.meeting_mode === "visio" ? zoomLink : "";

    // In-app notification
    await createNotification({
      recipientId: manager.id,
      type: "meeting_assigned",
      title: `${notifPrefix} ${meeting.meeting_type} : ${contactsListDisplay}`,
      body: `${dateDisplay} a ${timeStr}${companyName ? ` — ${companyName}` : ""}`,
      linkUrl: `/contacts/${primaryContact?.id ?? ""}`,
      relatedEntityType: "meeting",
      relatedEntityId: meetingId,
    });

    // 1. Google Calendar (upsert: update existing event or create new one)
    const commercialCalId = manager.google_calendar_id_commercial || manager.google_calendar_id;
    if (commercialCalId && isStepActive(wf, "google-calendar").active) {
      try {
        const description = [
          `📋 ${typeLabel}`,
          `👤 Contacts : ${contactsListDisplay}`,
          companyName ? `🏢 Entreprise : ${companyName}` : "",
          ...allContacts.map(c => c.phone ? `📞 ${c.first_name} ${c.last_name} : ${c.phone}` : "").filter(Boolean),
          ...allContacts.map(c => c.email ? `✉️ ${c.first_name} ${c.last_name} : ${c.email}` : "").filter(Boolean),
          `🖥️ Mode : ${modeLabel}`,
          `⏱️ Duree : ${durationLabel}`,
          "",
          meeting.meeting_mode === "visio" && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
          meeting.location ? `📍 Lieu : ${meeting.location}` : "",
          meeting.notes ? `\n📝 Notes : ${meeting.notes}` : "",
        ].filter(Boolean).join("\n");

        const gcalResult = await upsertCalendarEvent({
          calendarId: commercialCalId,
          existingEventId: existingEventIds[manager.first_name] ?? null,
          summary: title,
          description,
          location,
          startDateTime: startDT,
          endDateTime: endDT,
        });

        if (gcalResult.success && gcalResult.eventId) {
          updatedEventIds[manager.first_name] = gcalResult.eventId;
        }

        const statusLabel = gcalResult.success
          ? (gcalResult.status === "updated" ? "Mis a jour" : "Ajoute")
          : (gcalResult.error ?? "Erreur");
        results.push({ action: `Google Calendar (${manager.first_name})`, status: statusLabel });
      } catch (e: any) {
        results.push({ action: `Google Calendar (${manager.first_name})`, status: `Erreur: ${e.message}` });
      }
    }

    // 2. Slack DM
    if (manager.slack_user_id && slackToken && isStepActive(wf, "slack-dm").active) {
      const slackHeading = isReschedule
        ? `🔄 *RDV commercial modifie*`
        : `📅 *Nouveau RDV commercial planifie*`;
      const gcalNote = isReschedule
        ? (commercialCalId ? `✅ L'evenement a ete mis a jour dans ton agenda Google.` : "")
        : (commercialCalId ? `✅ L'evenement a ete ajoute a ton agenda Google.` : "");
      const slackMsg = [
        `Bonjour ${manager.first_name},`,
        "",
        slackHeading,
        "",
        `*${title}*`,
        `📋 ${typeLabel}`,
        `👤 ${contactsListDisplay}`,
        companyName ? `🏢 ${companyName}` : "",
        ...allContacts.map(c => c.phone ? `📞 ${c.first_name} : ${c.phone}` : "").filter(Boolean),
        `📆 ${dateDisplay} a ${timeStr} (${durationLabel})`,
        `🖥️ ${modeLabel}`,
        meeting.meeting_mode === "visio" && zoomLink ? `🔗 Zoom : ${zoomLink}` : "",
        meeting.location ? `📍 ${meeting.location}` : "",
        allManagers.length > 1 ? `\n👥 Managers : ${allManagerNames.join(", ")}` : "",
        "",
        gcalNote,
      ].filter(Boolean).join("\n");

      try {
        const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${slackToken}` },
          body: JSON.stringify({ channel: manager.slack_user_id, text: slackMsg }),
        });
        const slackData = await slackRes.json();
        results.push({ action: `Slack (${manager.first_name})`, status: slackData.ok ? "Envoye" : slackData.error });
      } catch (e: any) {
        results.push({ action: `Slack (${manager.first_name})`, status: `Erreur: ${e.message}` });
      }
    }

    // 3. Email (Externe only) with .ics
    if (isExterne && manager.email && isStepActive(wf, "email-externe-ics").active) {
      try {
        const icsContentExt = generateICS({
          summary: title,
          description: [
            typeLabel,
            `Contacts : ${contactsListDisplay}`,
            companyName ? `Entreprise : ${companyName}` : "",
            ...allContacts.map(c => c.phone ? `Tel ${c.first_name} : ${c.phone}` : "").filter(Boolean),
            `Mode : ${modeLabel}`,
            `Duree : ${durationLabel}`,
            meeting.meeting_mode === "visio" && zoomLink ? `Lien Zoom : ${zoomLink}` : "",
            meeting.location ? `Lieu : ${meeting.location}` : "",
          ].filter(Boolean).join("\n"),
          location: meeting.meeting_mode === "visio" ? (zoomLink || "Visioconference") : (meeting.location || ""),
          startDateTime: startDT,
          endDateTime: endDT,
          organizerName: primaryManager ? `${primaryManager.first_name} ${primaryManager.last_name}` : "La Closing Academie",
          organizerEmail: primaryManager?.email ?? "noreply@closing-academie.com",
          attendeeEmail: manager.email!,
          attendeeName: `${manager.first_name} ${manager.last_name}`,
        });

        const emailBody = [
          `Bonjour ${manager.first_name},`,
          "",
          isReschedule
            ? "Un rendez-vous commercial a ete modifie :"
            : "Un rendez-vous commercial vient d'etre planifie :",
          "",
          `📋 ${typeLabel}`,
          `👤 Contacts : ${contactsListDisplay}`,
          companyName ? `🏢 Entreprise : ${companyName}` : "",
          ...allContacts.map(c => c.phone ? `📞 ${c.first_name} : ${c.phone}` : "").filter(Boolean),
          `📅 Date : ${dateDisplay} a ${timeStr} (${durationLabel})`,
          `🖥️ Mode : ${modeLabel}`,
          meeting.meeting_mode === "visio" && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
          meeting.location ? `📍 Lieu : ${meeting.location}` : "",
          "",
          "Vous trouverez en piece jointe une invitation calendrier (.ics) a ajouter a votre agenda.",
          "",
          "Belle journee,",
          "",
          "L'equipe La Closing Academie",
        ].filter(Boolean).join("\n");

        const emailResult = await sendSessionEmail({
          to: manager.email,
          subject: `${isReschedule ? "RDV modifie" : "Nouveau RDV"} — ${title}`,
          body: emailBody,
          attachments: [{ filename: "invitation.ics", content: icsContentExt }],
        });
        results.push({ action: `Email (${manager.first_name})`, status: emailResult.success ? "Envoye" : emailResult.error ?? "Erreur" });
      } catch (e: any) {
        results.push({ action: `Email (${manager.first_name})`, status: `Erreur: ${e.message}` });
      }
    }
  }

  // ============================================================
  // LOOP OVER CONTACTS — send prospect emails
  // ============================================================
  const zoomLinkForProspect = primaryManager?.zoom_link ?? "";

  if (isStepActive(wf, "email-prospect-ics").active) {
    for (const ct of allContacts) {
      if (!ct.email) continue;

      try {
        const ctName = `${ct.first_name} ${ct.last_name}`;
        const prospectLocation = meeting.meeting_mode === "visio"
          ? (zoomLinkForProspect || "Visioconference")
          : (meeting.location || "");

        const icsContent = generateICS({
          summary: title,
          description: [
            typeLabel,
            `Contact : ${ctName}`,
            companyName ? `Entreprise : ${companyName}` : "",
            `Mode : ${modeLabel}`,
            `Duree : ${durationLabel}`,
            meeting.meeting_mode === "visio" && zoomLinkForProspect ? `Lien Zoom : ${zoomLinkForProspect}` : "",
            meeting.location ? `Lieu : ${meeting.location}` : "",
          ].filter(Boolean).join("\n"),
          location: prospectLocation,
          startDateTime: startDT,
          endDateTime: endDT,
          organizerName: primaryManager ? `${primaryManager.first_name} ${primaryManager.last_name}` : "La Closing Academie",
          organizerEmail: primaryManager?.email ?? "noreply@closing-academie.com",
          attendeeEmail: ct.email,
          attendeeName: ctName,
        });

        // Use new templates
        const emailBody = getProspectEmailBody({
          contactFirstName: ct.first_name,
          meetingType: meeting.meeting_type,
          dateDisplay,
          timeStr,
          durationLabel,
          modeLabel,
          zoomLink: meeting.meeting_mode === "visio" ? zoomLinkForProspect : undefined,
          location: meeting.location ?? undefined,
          managerNames: allManagerNames,
          isReschedule,
        });

        const emailSubject = getProspectEmailSubject(meeting.meeting_type, ctName, companyName, isReschedule);

        // BCC all managers so they have a copy
        const managerEmails = allManagers.map(m => m.email).filter(Boolean) as string[];

        const emailResult = await sendSessionEmail({
          to: ct.email,
          subject: emailSubject,
          body: emailBody,
          attachments: [{ filename: "invitation.ics", content: icsContent }],
          bcc: managerEmails,
        });
        results.push({ action: `Email prospect (${ct.first_name})`, status: emailResult.success ? "Envoye" : emailResult.error ?? "Erreur" });
      } catch (e: any) {
        results.push({ action: `Email prospect (${ct.first_name})`, status: `Erreur: ${e.message}` });
      }
    }
  }

  // Persist GCal event IDs back to the meeting for future upserts
  if (Object.keys(updatedEventIds).length > 0) {
    await supabase.from("meetings").update({ gcal_event_ids: updatedEventIds }).eq("id", meetingId);
  }

  return { success: true, title, results };
}
