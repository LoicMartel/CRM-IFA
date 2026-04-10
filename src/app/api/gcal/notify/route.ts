import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";
import { generateICS } from "@/lib/ics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, isUpdate, customTitle } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch session with all related data
    const { data: session } = await supabase
      .from("training_sessions")
      .select(`
        *,
        training_session_learners(learner_id, learners(first_name, last_name, email)),
        service_plans(
          id, company_id, vt_planned, days_planned,
          companies(name, address, city),
          training_programs(name)
        )
      `)
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const plan = session.service_plans as any;
    const companyName = plan?.companies?.name ?? "Client";
    const companyAddress = plan?.companies?.address ?? "";
    const companyCity = plan?.companies?.city ?? "";
    const fullAddress = [companyAddress, companyCity].filter(Boolean).join(", ");
    const trainers = (session.trainers as string[]) ?? [];
    const isJournee = session.session_type === "journee";
    const typeLabel = isJournee ? "Journée" : "VT";
    const durationHours = Number(session.duration_hours) || 1;

    // Count session number
    const { data: allPlanSessions } = await supabase
      .from("training_sessions")
      .select("id, session_type, session_date")
      .eq("service_plan_id", session.service_plan_id)
      .eq("session_type", session.session_type)
      .neq("status", "cancelled")
      .order("session_date", { ascending: true });

    const totalSessions = isJournee
      ? (plan?.days_planned ?? allPlanSessions?.length ?? 0)
      : (plan?.vt_planned ?? allPlanSessions?.length ?? 0);
    const sessionIndex = (allPlanSessions ?? []).findIndex(s => s.id === sessionId) + 1;

    // Learner names
    const learners = ((session.training_session_learners ?? []) as any[])
      .map(sl => sl.learners).filter(Boolean);
    const learnerNames = learners.map((l: any) => l.first_name).join(", ");
    const learnerFullNames = learners.map((l: any) => `${l.first_name} ${l.last_name}`).join(", ");

    // Title
    const trainerFirstNames = trainers.join(", ");
    const autoTitle = `${typeLabel} ${sessionIndex}/${totalSessions} ${learnerNames} ${companyName}${trainerFirstNames ? " x " + trainerFirstNames : ""}`;
    const title = customTitle || autoTitle;

    // Get trainer details
    const { data: trainerMembers } = await supabase
      .from("team_members")
      .select("first_name, last_name, google_calendar_id, google_calendar_id_presentiel, zoom_link, email, slack_user_id, roles")
      .in("first_name", trainers.length > 0 ? trainers : ["__none__"]);

    const slackToken = process.env.SLACK_BOT_TOKEN;
    const results: { trainer: string; slack?: string; gcal?: string; email?: string }[] = [];

    for (const trainer of (trainerMembers ?? [])) {
      const zoomLink = trainer.zoom_link ?? "";
      const sessionLoc = (session as any).session_location ?? "";
      const location = isJournee ? (sessionLoc || fullAddress || companyName) : zoomLink;
      const calendarId = isJournee && trainer.google_calendar_id_presentiel
        ? trainer.google_calendar_id_presentiel
        : trainer.google_calendar_id;
      const trainerRoles = (trainer.roles as string[]) ?? [];
      const isExterne = trainerRoles.includes("Externe");
      const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
      const timeDisplay = `${session.session_date} à ${sessionTime}`;

      // 1. Google Calendar (for everyone with a calendar configured)
      if (calendarId) {
        const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
        const [startH, startM] = sessionTime.split(":").map(Number);
        const startDT = `${session.session_date}T${sessionTime}:00`;
        const totalMinutes = startH * 60 + startM + durationHours * 60;
        const endH = Math.floor(totalMinutes / 60);
        const endM = totalMinutes % 60;
        const endDT = `${session.session_date}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

        const description = [
          `📋 ${typeLabel} ${sessionIndex}/${totalSessions}`,
          `🏢 Entreprise : ${companyName}`,
          plan?.training_programs?.name ? `📚 Programme : ${plan.training_programs.name}` : "",
          `👥 Apprenants : ${learnerFullNames || "Non assignés"}`,
          `🎓 Expert : ${trainer.first_name}`,
          `⏱️ Durée : ${durationHours}h`,
          "",
          isJournee ? `📍 Adresse : ${sessionLoc || fullAddress || "Non renseignée"}` : "",
          !isJournee && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
          isJournee && zoomLink ? `🔗 Lien Zoom (si besoin) : ${zoomLink}` : "",
          session.notes ? `\n📝 Notes : ${session.notes}` : "",
        ].filter(Boolean).join("\n");

        const existingEventId = isUpdate ? (session as any).gcal_event_id : null;

        if (existingEventId) {
          // Update existing Google Calendar event
          const gcalResult = await updateCalendarEvent({
            calendarId,
            eventId: existingEventId,
            summary: title,
            description,
            location,
            startDateTime: startDT,
            endDateTime: endDT,
          });
          results.push({ trainer: trainer.first_name, gcal: gcalResult.success ? "updated" : gcalResult.error });
        } else {
          // Create new Google Calendar event
          const gcalResult = await createCalendarEvent({
            calendarId,
            summary: title,
            description,
            location,
            startDateTime: startDT,
            endDateTime: endDT,
          });
          if (gcalResult.success && gcalResult.eventId) {
            await supabase.from("training_sessions").update({ gcal_event_id: gcalResult.eventId }).eq("id", sessionId);
          }
          results.push({ trainer: trainer.first_name, gcal: gcalResult.success ? "created" : gcalResult.error });
        }
      }

      // 2. Slack DM (for everyone with a Slack user ID)
      if (trainer.slack_user_id && slackToken) {
        const slackMsg = [
          `Bonjour ${trainer.first_name},`,
          "",
          `📅 *${isUpdate ? "Session mise à jour" : "Nouvelle session planifiée"}*`,
          "",
          `*${title}*`,
          `🏢 ${companyName}`,
          `👥 ${learnerFullNames || "Apprenants non assignés"}`,
          `📆 ${timeDisplay} (${durationHours}h)`,
          !isJournee && zoomLink ? `🔗 Zoom : ${zoomLink}` : "",
          isJournee ? `📍 ${sessionLoc || fullAddress || "Lieu non renseigné"}` : "",
          "",
          calendarId ? `✅ L'événement a été ajouté à ton agenda Google.` : "",
        ].filter(Boolean).join("\n");

        try {
          const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${slackToken}` },
            body: JSON.stringify({ channel: trainer.slack_user_id, text: slackMsg }),
          });
          const slackData = await slackRes.json();
          results.push({ trainer: trainer.first_name, slack: slackData.ok ? "sent" : slackData.error });
        } catch (e: any) {
          results.push({ trainer: trainer.first_name, slack: `error: ${e.message}` });
        }
      }

      // 3. Email for "Externe" trainers with .ics
      if (isExterne && trainer.email) {
        const icsStartExt = `${session.session_date}T${sessionTime}:00`;
        const [extH, extM] = sessionTime.split(":").map(Number);
        const extTotalMin = extH * 60 + extM + durationHours * 60;
        const icsEndExt = `${session.session_date}T${String(Math.floor(extTotalMin / 60)).padStart(2, "0")}:${String(extTotalMin % 60).padStart(2, "0")}:00`;

        const icsContentExt = generateICS({
          summary: title,
          description: [
            `${typeLabel} ${sessionIndex}/${totalSessions}`,
            `Entreprise : ${companyName}`,
            `Apprenants : ${learnerFullNames || "Non assignés"}`,
            `Durée : ${durationHours}h`,
            isJournee ? `Lieu : ${sessionLoc || fullAddress || "Non renseigné"}` : "",
            !isJournee && zoomLink ? `Lien Zoom : ${zoomLink}` : "",
          ].filter(Boolean).join("\n"),
          location: isJournee ? (sessionLoc || fullAddress || companyName) : (zoomLink || "Visioconférence"),
          startDateTime: icsStartExt,
          endDateTime: icsEndExt,
          organizerName: "La Closing Académie",
          organizerEmail: "contact@closing-academie.com",
        });

        const emailBody = [
          `Bonjour ${trainer.first_name},`,
          "",
          isUpdate ? "Une session de formation a été mise à jour :" : "Une session de formation vient d'être planifiée pour toi :",
          "",
          `📋 ${typeLabel} ${sessionIndex}/${totalSessions}`,
          `🏢 Entreprise : ${companyName}`,
          `👥 Apprenants : ${learnerFullNames || "Non assignés"}`,
          `📅 Date : ${timeDisplay} (${durationHours}h)`,
          isJournee ? `📍 Lieu : ${sessionLoc || fullAddress || "Non renseigné"}` : "",
          !isJournee && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
          "",
          "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
          "",
          "Belle journée,",
          "",
          "L'équipe La Closing Académie",
        ].filter(Boolean).join("\n");

        const emailResult = await sendSessionEmail({
          to: trainer.email,
          subject: `${isUpdate ? "Session mise à jour" : "Nouvelle session planifiée"} — ${title}`,
          body: emailBody,
          attachments: [{ filename: "invitation.ics", content: icsContentExt }],
        });
        results.push({ trainer: trainer.first_name, email: emailResult.success ? "sent" : emailResult.error });
      }
    }

    // 4. Send .ics invitation emails to learners
    const learnersWithEmail = learners.filter((l: any) => l.email);
    if (learnersWithEmail.length > 0) {
      const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
      const icsStartDT = `${session.session_date}T${sessionTime}:00`;
      const [sH, sM] = sessionTime.split(":").map(Number);
      const totalMin = sH * 60 + sM + durationHours * 60;
      const icsEndDT = `${session.session_date}T${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}:00`;

      const icsContent = generateICS({
        summary: title,
        description: [
          `${typeLabel} ${sessionIndex}/${totalSessions}`,
          `Entreprise : ${companyName}`,
          `Apprenants : ${learnerFullNames || "Non assignés"}`,
          `Durée : ${durationHours}h`,
          isJournee ? `Lieu : ${(session as any).session_location || fullAddress || "Non renseigné"}` : "",
          !isJournee && trainers.length > 0 ? `Expert : ${trainers.join(", ")}` : "",
        ].filter(Boolean).join("\n"),
        location: isJournee ? ((session as any).session_location || fullAddress || companyName) : "Visioconférence",
        startDateTime: icsStartDT,
        endDateTime: icsEndDT,
        organizerName: "La Closing Académie",
        organizerEmail: "contact@closing-academie.com",
      });

      for (const learner of learnersWithEmail) {
        const emailBody = [
          `Bonjour ${(learner as any).first_name},`,
          "",
          isUpdate ? "Votre session de formation a été mise à jour :" : "Votre prochaine session de formation est planifiée :",
          "",
          `📋 ${title}`,
          `📆 ${session.session_date} à ${sessionTime} (${durationHours}h)`,
          isJournee ? `📍 ${(session as any).session_location || fullAddress || "Lieu à confirmer"}` : "🖥️ Visioconférence",
          "",
          "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
          "",
          "Belle journée,",
          "",
          "L'équipe La Closing Académie",
        ].filter(Boolean).join("\n");

        const emailResult = await sendSessionEmail({
          to: (learner as any).email,
          subject: `${isUpdate ? "Mise à jour" : "Invitation"} : ${title} — ${session.session_date}`,
          body: emailBody,
          attachments: [{ filename: "invitation.ics", content: icsContent }],
        });
        results.push({ trainer: `${(learner as any).first_name} ${(learner as any).last_name}`, email: emailResult.success ? "ics_sent" : emailResult.error });
      }
    }

    return NextResponse.json({ success: true, title, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
