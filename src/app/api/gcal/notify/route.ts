import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCalendarEvent } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

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
    const title = `${typeLabel} ${sessionIndex}/${totalSessions} ${learnerNames} ${companyName}${trainerFirstNames ? " x " + trainerFirstNames : ""}`;

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

      // 1. Google Calendar (only for non-Externe)
      if (calendarId && !isExterne) {
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

        const attendees = learners
          .filter((l: any) => l.email)
          .map((l: any) => ({ email: l.email, displayName: `${l.first_name} ${l.last_name}` }));

        const gcalResult = await createCalendarEvent({
          calendarId,
          summary: title,
          description,
          location,
          startDateTime: startDT,
          endDateTime: endDT,
          attendees,
        });

        if (gcalResult.success && gcalResult.eventId) {
          await supabase.from("training_sessions").update({ gcal_event_id: gcalResult.eventId }).eq("id", sessionId);
        }
        results.push({ trainer: trainer.first_name, gcal: gcalResult.success ? "created" : gcalResult.error });
      }

      // 2. Slack DM (only for non-Externe)
      if (trainer.slack_user_id && slackToken && !isExterne) {
        const slackMsg = [
          `Bonjour ${trainer.first_name},`,
          "",
          `📅 *Nouvelle session planifiée*`,
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

      // 3. Email for "Externe" trainers (like Guillaume)
      if (isExterne && trainer.email) {
        const emailBody = [
          `Bonjour ${trainer.first_name},`,
          "",
          "Une session de formation vient d'être planifiée pour toi :",
          "",
          `📋 ${typeLabel} ${sessionIndex}/${totalSessions}`,
          `🏢 Entreprise : ${companyName}`,
          `👥 Apprenants : ${learnerFullNames || "Non assignés"}`,
          `📅 Date : ${timeDisplay} (${durationHours}h)`,
          isJournee ? `📍 Lieu : ${sessionLoc || fullAddress || "Non renseigné"}` : "",
          !isJournee && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
          "",
          "⚠️ Pense à vérifier ta disponibilité et à te préparer en amont.",
          "",
          "Belle journée,",
          "",
          "Loïc ⚡",
        ].filter(Boolean).join("\n");

        const emailResult = await sendSessionEmail({
          to: trainer.email,
          subject: `Nouvelle session planifiée — ${title}`,
          body: emailBody,
        });
        results.push({ trainer: trainer.first_name, email: emailResult.success ? "sent" : emailResult.error });
      }
    }

    return NextResponse.json({ success: true, title, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
