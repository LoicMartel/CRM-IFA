import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";
import { generateICS } from "@/lib/ics";
import { loadWorkflow, isStepActive } from "@/lib/automations";
import { createNotification } from "@/lib/notifications";
import { getSlackToken } from "@/lib/oauth";
import { syncOutlookEvent, removeOutlookEvent } from "@/lib/outlook-sync";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, isUpdate, customTitle, removedTrainerNames, removedLearnerIds } = body as {
      sessionId: string;
      isUpdate?: boolean;
      customTitle?: string;
      removedTrainerNames?: string[];
      removedLearnerIds?: string[];
    };

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
      .select("id, first_name, last_name, google_calendar_id, google_calendar_id_presentiel, zoom_link, email, slack_user_id, roles")
      .in("first_name", trainers.length > 0 ? trainers : ["__none__"]);

    const results: { trainer: string; slack?: string; gcal?: string; email?: string }[] = [];

    const wf = await loadWorkflow("session-notification");
    if (wf && !wf.is_active) {
      return NextResponse.json({ success: true, title, results: [{ trainer: "skip", gcal: "workflow disabled" }] });
    }

    const primaryTrainer = (trainerMembers ?? [])[0];
    const primaryOrganizerName = primaryTrainer ? `${primaryTrainer.first_name} ${primaryTrainer.last_name}` : "IFA Formation";
    const primaryOrganizerEmail = primaryTrainer?.email ?? "noreply@ifagroupe.com";
    // Single Zoom link for the whole session (first trainer that has one)
    const sessionZoomLink = (trainerMembers ?? []).find(t => t.zoom_link)?.zoom_link ?? "";
    // Shared map across iterations so trainers don't overwrite each other
    const eventIdsMap = ((session as any).gcal_event_ids as Record<string, string>) ?? {};

    for (const trainer of (trainerMembers ?? [])) {
      const sessionLoc = (session as any).session_location ?? "";
      const location = isJournee ? (sessionLoc || fullAddress || companyName) : sessionZoomLink;
      const calendarId = isJournee && trainer.google_calendar_id_presentiel
        ? trainer.google_calendar_id_presentiel
        : trainer.google_calendar_id;
      const trainerRoles = (trainer.roles as string[]) ?? [];
      const isExterne = trainerRoles.includes("Externe");
      const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
      const timeDisplay = `${session.session_date} à ${sessionTime}`;

      // In-app notification for the trainer (new assignment OR updated session)
      if (trainer.id) {
        await createNotification({
          recipientId: trainer.id as string,
          type: isUpdate ? "session_assigned" : "session_assigned",
          title: isUpdate
            ? `Session modifiée : ${title}`
            : `Nouvelle session pour toi : ${title}`,
          body: `${timeDisplay} — ${companyName} (${durationHours}h)`,
          linkUrl: `/planning?planId=${session.service_plan_id}`,
          relatedEntityType: "training_session",
          relatedEntityId: sessionId,
        });
      }

      // 1. Google Calendar (for everyone with a calendar configured)
      if (calendarId && isStepActive(wf, "google-calendar-trainers").active) {
        const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
        const [startH, startM] = sessionTime.split(":").map(Number);
        const startDT = `${session.session_date}T${sessionTime}:00`;
        const lunchBreak = isJournee ? 60 : 0; // 1h lunch break for full-day sessions
        const totalMinutes = startH * 60 + startM + durationHours * 60 + lunchBreak;
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
          !isJournee && sessionZoomLink ? `🔗 Lien Zoom : ${sessionZoomLink}` : "",
          isJournee && sessionZoomLink ? `🔗 Lien Zoom (si besoin) : ${sessionZoomLink}` : "",
          session.notes ? `\n📝 Notes : ${session.notes}` : "",
        ].filter(Boolean).join("\n");

        const existingEventId = isUpdate ? (eventIdsMap[trainer.first_name] ?? null) : null;

        const upsert = await upsertCalendarEvent({
          calendarId,
          existingEventId,
          summary: title,
          description,
          location,
          startDateTime: startDT,
          endDateTime: endDT,
          memberId: trainer.id as string,
        });

        // Persist per-trainer event ID in the JSONB map
        if (upsert.success && upsert.eventId) {
          eventIdsMap[trainer.first_name] = upsert.eventId;
          await supabase.from("training_sessions")
            .update({ gcal_event_ids: eventIdsMap })
            .eq("id", sessionId);
        }

        results.push({ trainer: trainer.first_name, gcal: upsert.success ? upsert.status : upsert.error });

        // Outlook sync (same event data, different calendar)
        const olCalType = isJournee ? "presentiel" as const : "formation" as const;
        const olResult = await syncOutlookEvent({
          memberId: trainer.id as string,
          calType: olCalType,
          summary: title,
          description,
          location,
          startDateTime: startDT,
          endDateTime: endDT,
        });
        if (olResult) {
          results.push({ trainer: trainer.first_name, gcal: `outlook: ${olResult.status}` });
        }
      }

      // 2. Slack DM (for everyone with a Slack user ID)
      const trainerSlackToken = trainer.slack_user_id ? await getSlackToken(trainer.id as string) : null;
      if (trainer.slack_user_id && trainerSlackToken && isStepActive(wf, "slack-dm-trainers").active) {
        const slackMsg = [
          `Bonjour ${trainer.first_name},`,
          "",
          `📅 *${isUpdate ? "Session mise à jour" : "Nouvelle session planifiée"}*`,
          "",
          `*${title}*`,
          `🏢 ${companyName}`,
          `👥 ${learnerFullNames || "Apprenants non assignés"}`,
          `📆 ${timeDisplay} (${durationHours}h)`,
          !isJournee && sessionZoomLink ? `🔗 Zoom : ${sessionZoomLink}` : "",
          isJournee ? `📍 ${sessionLoc || fullAddress || "Lieu non renseigné"}` : "",
          "",
          calendarId ? `✅ L'événement a été ajouté à ton agenda Google.` : "",
        ].filter(Boolean).join("\n");

        try {
          const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${trainerSlackToken}` },
            body: JSON.stringify({ channel: trainer.slack_user_id, text: slackMsg }),
          });
          const slackData = await slackRes.json();
          results.push({ trainer: trainer.first_name, slack: slackData.ok ? "sent" : slackData.error });
        } catch (e: any) {
          results.push({ trainer: trainer.first_name, slack: `error: ${e.message}` });
        }
      }

      // 3. Email for "Externe" trainers with .ics
      if (isExterne && trainer.email && isStepActive(wf, "email-externe-ics").active) {
        const icsStartExt = `${session.session_date}T${sessionTime}:00`;
        const [extH, extM] = sessionTime.split(":").map(Number);
        const extLunchBreak = isJournee ? 60 : 0;
        const extTotalMin = extH * 60 + extM + durationHours * 60 + extLunchBreak;
        const icsEndExt = `${session.session_date}T${String(Math.floor(extTotalMin / 60)).padStart(2, "0")}:${String(extTotalMin % 60).padStart(2, "0")}:00`;

        const icsContentExt = generateICS({
          summary: title,
          description: [
            `${typeLabel} ${sessionIndex}/${totalSessions}`,
            `Entreprise : ${companyName}`,
            `Apprenants : ${learnerFullNames || "Non assignés"}`,
            `Durée : ${durationHours}h`,
            isJournee ? `Lieu : ${sessionLoc || fullAddress || "Non renseigné"}` : "",
            !isJournee && sessionZoomLink ? `Lien Zoom : ${sessionZoomLink}` : "",
          ].filter(Boolean).join("\n"),
          location: isJournee ? (sessionLoc || fullAddress || companyName) : (sessionZoomLink || "Visioconférence"),
          startDateTime: icsStartExt,
          endDateTime: icsEndExt,
          organizerName: primaryOrganizerName,
          organizerEmail: primaryOrganizerEmail,
          attendeeEmail: trainer.email!,
          attendeeName: `${trainer.first_name} ${trainer.last_name}`,
        });

        const emailBody = [
          `Bonjour ${trainer.first_name},`,
          "",
          isUpdate ? "Une session de formation a été mise à jour :" : "Une session de formation vient d'être planifiée pour vous :",
          "",
          `📋 ${typeLabel} ${sessionIndex}/${totalSessions}`,
          `🏢 Entreprise : ${companyName}`,
          `👥 Apprenants : ${learnerFullNames || "Non assignés"}`,
          `📅 Date : ${timeDisplay} (${durationHours}h)`,
          isJournee ? `📍 Lieu : ${sessionLoc || fullAddress || "Non renseigné"}` : "",
          !isJournee && sessionZoomLink ? `🔗 Lien Zoom : ${sessionZoomLink}` : "",
          "",
          "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
          "",
          "Belle journée,",
          "",
          "L'équipe IFA Formation",
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
    if (learnersWithEmail.length > 0 && isStepActive(wf, "email-learners-ics").active) {
      const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
      const icsStartDT = `${session.session_date}T${sessionTime}:00`;
      const [sH, sM] = sessionTime.split(":").map(Number);
      const learnerLunchBreak = isJournee ? 60 : 0;
      const totalMin = sH * 60 + sM + durationHours * 60 + learnerLunchBreak;
      const icsEndDT = `${session.session_date}T${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}:00`;

      for (const learner of learnersWithEmail) {
        const icsContent = generateICS({
          summary: title,
          description: [
            `${typeLabel} ${sessionIndex}/${totalSessions}`,
            `Entreprise : ${companyName}`,
            `Apprenants : ${learnerFullNames || "Non assignés"}`,
            `Durée : ${durationHours}h`,
            isJournee ? `Lieu : ${(session as any).session_location || fullAddress || "Non renseigné"}` : "",
            !isJournee && trainers.length > 0 ? `Expert : ${trainers.join(", ")}` : "",
            !isJournee && sessionZoomLink ? `Lien Zoom : ${sessionZoomLink}` : "",
          ].filter(Boolean).join("\n"),
          location: isJournee ? ((session as any).session_location || fullAddress || companyName) : (sessionZoomLink || "Visioconférence"),
          startDateTime: icsStartDT,
          endDateTime: icsEndDT,
          organizerName: primaryOrganizerName,
          organizerEmail: primaryOrganizerEmail,
          attendeeEmail: (learner as any).email,
          attendeeName: `${(learner as any).first_name} ${(learner as any).last_name}`,
        });
        const emailBody = [
          `Bonjour ${(learner as any).first_name},`,
          "",
          isUpdate ? "Votre session de formation a été mise à jour :" : "Votre prochaine session de formation est planifiée :",
          "",
          `📋 ${title}`,
          `📆 ${session.session_date} à ${sessionTime} (${durationHours}h)`,
          isJournee ? `📍 ${(session as any).session_location || fullAddress || "Lieu à confirmer"}` : (sessionZoomLink ? `🖥️ Visioconférence — Lien Zoom : ${sessionZoomLink}` : "🖥️ Visioconférence"),
          "",
          "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
          "",
          "Belle journée,",
          "",
          "L'équipe IFA Formation",
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

    // =====================================================================
    // Notifications de RETRAIT : experts et apprenants retirés de la session
    // =====================================================================
    const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
    const timeDisplay = `${session.session_date} à ${sessionTime}`;

    // Experts retirés
    if (removedTrainerNames && removedTrainerNames.length > 0) {
      const { data: removedTrainers } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, google_calendar_id, google_calendar_id_presentiel, email, slack_user_id, roles")
        .in("first_name", removedTrainerNames);

      for (const trainer of removedTrainers ?? []) {
        const trainerRoles = (trainer.roles as string[]) ?? [];
        const isExterne = trainerRoles.includes("Externe");
        const calId = isJournee && trainer.google_calendar_id_presentiel
          ? trainer.google_calendar_id_presentiel
          : trainer.google_calendar_id;

        // In-app notification for the removed trainer
        if (trainer.id) {
          await createNotification({
            recipientId: trainer.id as string,
            type: "session_cancelled",
            title: `Session annulée : ${title}`,
            body: `Tu as été retiré(e) de la session du ${timeDisplay} (${companyName})`,
            linkUrl: `/planning?planId=${session.service_plan_id}`,
            relatedEntityType: "training_session",
            relatedEntityId: sessionId,
          });
        }

        // 1. Supprimer l'évènement sur son agenda via le mapping per-trainer
        let gcalStatus: string | undefined;
        const eventIdsMap = ((session as any).gcal_event_ids as Record<string, string>) ?? {};
        const trainerEventId = eventIdsMap[trainer.first_name];
        if (calId && trainerEventId) {
          const del = await deleteCalendarEvent({ calendarId: calId, eventId: trainerEventId, memberId: trainer.id as string });
          gcalStatus = del.success ? "removed" : (del.error?.toLowerCase().includes("not found") ? "already_absent" : del.error);
          // Remove from the map
          if (del.success) {
            delete eventIdsMap[trainer.first_name];
            await supabase.from("training_sessions")
              .update({ gcal_event_ids: eventIdsMap })
              .eq("id", sessionId);
          }
        }

        // 2. Slack DM de retrait
        let slackStatus: string | undefined;
        const removedSlackToken = trainer.slack_user_id ? await getSlackToken(trainer.id as string) : null;
        if (trainer.slack_user_id && removedSlackToken) {
          const msg = [
            `Bonjour ${trainer.first_name},`,
            "",
            `🚫 *Session retirée de ton planning*`,
            "",
            `La session *${title}* prévue le ${timeDisplay} t'a été retirée.`,
            `Elle est désormais assignée à un autre expert (ou a été annulée).`,
            calId ? `L'événement a été supprimé de ton agenda Google.` : "",
            "",
            `Belle journée,`,
          ].filter(Boolean).join("\n");
          try {
            const res = await fetch("https://slack.com/api/chat.postMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${removedSlackToken}` },
              body: JSON.stringify({ channel: trainer.slack_user_id, text: msg }),
            });
            const data = await res.json();
            slackStatus = data.ok ? "sent" : data.error;
          } catch (e: any) { slackStatus = `error: ${e.message}`; }
        }

        // 3. Email (externes, ou fallback si pas de Slack)
        let emailStatus: string | undefined;
        if (trainer.email && (isExterne || !trainer.slack_user_id)) {
          const emailBody = [
            `Bonjour ${trainer.first_name},`,
            "",
            `La session ${title} prévue le ${timeDisplay} vous a été retirée.`,
            `Elle est désormais assignée à un autre expert (ou a été annulée).`,
            calId ? `L'événement a été supprimé de votre agenda Google.` : "",
            "",
            "Belle journée,",
            "",
            "L'équipe IFA Formation",
          ].filter(Boolean).join("\n");
          const emailRes = await sendSessionEmail({
            to: trainer.email,
            subject: `Session retirée de votre planning — ${title}`,
            body: emailBody,
          });
          emailStatus = emailRes.success ? "sent" : emailRes.error;
        }

        results.push({ trainer: `${trainer.first_name} (retiré)`, gcal: gcalStatus, slack: slackStatus, email: emailStatus });
      }
    }

    // Apprenants retirés
    if (removedLearnerIds && removedLearnerIds.length > 0) {
      const { data: removedLearners } = await supabase
        .from("learners")
        .select("id, first_name, last_name, email")
        .in("id", removedLearnerIds);

      for (const learner of removedLearners ?? []) {
        if (!learner.email) {
          results.push({ trainer: `${learner.first_name} ${learner.last_name} (retiré)`, email: "no_email" });
          continue;
        }
        const emailBody = [
          `Bonjour ${learner.first_name},`,
          "",
          `La session de formation ${title} prévue le ${timeDisplay} a été annulée ou vous y avez été retiré(e).`,
          "",
          "Vous n'avez plus besoin d'y participer.",
          "",
          "Belle journée,",
          "",
          "L'équipe IFA Formation",
        ].filter(Boolean).join("\n");
        const emailRes = await sendSessionEmail({
          to: learner.email,
          subject: `Session annulée — ${title}`,
          body: emailBody,
        });
        results.push({
          trainer: `${learner.first_name} ${learner.last_name} (retiré)`,
          email: emailRes.success ? "sent" : emailRes.error,
        });
      }
    }

    return NextResponse.json({ success: true, title, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
