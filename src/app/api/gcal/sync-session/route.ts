import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWorkflow } from "@/lib/automations";

// This API route is called after a training session is created
// It prepares the data needed for Google Calendar sync
// The actual Google Calendar creation is handled via the MCP tools or a service account

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const wf = await loadWorkflow("session-created");
    if (wf && !wf.is_active) {
      return NextResponse.json({ skipped: true, reason: "workflow disabled" });
    }

    const supabase = await createClient();

    // Fetch the session with all related data
    const { data: session, error: sessError } = await supabase
      .from("training_sessions")
      .select(`
        *,
        training_session_learners(learner_id, learners(first_name, last_name)),
        service_plans(
          id, company_id, vt_planned, days_planned,
          companies(name, address, city),
          training_programs(name)
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const plan = session.service_plans as any;
    const companyName = plan?.companies?.name ?? "Client";
    const trainers = (session.trainers as string[]) ?? [];

    // Count session number within plan (same type)
    const { data: allPlanSessions } = await supabase
      .from("training_sessions")
      .select("id, session_type, session_date")
      .eq("service_plan_id", session.service_plan_id)
      .eq("session_type", session.session_type)
      .neq("status", "cancelled")
      .order("session_date", { ascending: true });

    const totalSessions = session.session_type === "vt"
      ? (plan?.vt_planned ?? allPlanSessions?.length ?? 0)
      : (plan?.days_planned ?? allPlanSessions?.length ?? 0);

    const sessionIndex = (allPlanSessions ?? []).findIndex(s => s.id === sessionId) + 1;

    // Get learner names
    const learners = ((session.training_session_learners ?? []) as any[])
      .map(sl => sl.learners)
      .filter(Boolean);
    const learnerNames = learners.map((l: any) => l.first_name).join(", ");

    // Build title: VT 3/6 Pierre LCA Dream Team x Loïc
    const typeLabel = session.session_type === "vt" ? "VT" : "Journée";
    const isJournee = session.session_type === "journee";
    const trainerFirstNames = trainers.join(", ");
    const title = `${typeLabel} ${sessionIndex}/${totalSessions} ${learnerNames} ${companyName}${trainerFirstNames ? " x " + trainerFirstNames : ""}`;

    // Get zoom links and calendar IDs for trainers
    const { data: trainerMembers } = await supabase
      .from("team_members")
      .select("first_name, last_name, google_calendar_id, google_calendar_id_presentiel, zoom_link, email, slack_user_id")
      .in("first_name", trainers.length > 0 ? trainers : ["__none__"]);

    const calendarTargets = (trainerMembers ?? []).filter(t => t.google_calendar_id).map(t => {
      // For journée sessions, use présentiel calendar if available
      const calId = isJournee && t.google_calendar_id_presentiel
        ? t.google_calendar_id_presentiel
        : t.google_calendar_id;
      return {
        calendarId: calId,
        trainerName: `${t.first_name} ${t.last_name}`,
        firstName: t.first_name,
        email: t.email,
        slackUserId: t.slack_user_id,
        hasGoogleCalendar: !!t.google_calendar_id,
      };
    });

    // Trainers without Google Calendar (like Guillaume) → need email notification
    const emailTargets = (trainerMembers ?? []).filter(t => !t.google_calendar_id && t.email).map(t => ({
      email: t.email,
      firstName: t.first_name,
      trainerName: `${t.first_name} ${t.last_name}`,
    }));

    const zoomLink = (trainerMembers ?? []).find(t => t.zoom_link)?.zoom_link ?? "";

    // Build event data
    const durationHours = Number(session.duration_hours) || 1;
    const startDate = session.session_date; // "2026-03-26"

    // Location: Zoom link for VT, company address for Journée
    const companyAddress = plan?.companies?.address ?? "";
    const companyCity = plan?.companies?.city ?? "";
    const fullAddress = [companyAddress, companyCity].filter(Boolean).join(", ");
    const location = isJournee ? (fullAddress || companyName) : zoomLink;

    // Build description
    const description = [
      `📋 ${typeLabel} ${sessionIndex}/${totalSessions}`,
      `🏢 Entreprise : ${companyName}`,
      plan?.training_programs?.name ? `📚 Programme : ${plan.training_programs.name}` : "",
      `👥 Apprenants : ${learnerNames || "Non assignés"}`,
      `🎓 Expert(s) : ${trainerFirstNames || "Non assigné"}`,
      `⏱️ Durée : ${durationHours}h`,
      session.is_billable === false ? "⚠️ Non facturable" : "",
      "",
      isJournee && fullAddress ? `📍 Adresse : ${fullAddress}` : "",
      !isJournee && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
      isJournee && zoomLink ? `🔗 Lien Zoom (si besoin) : ${zoomLink}` : "",
      session.notes ? `\n📝 Notes : ${session.notes}` : "",
    ].filter(Boolean).join("\n");

    // Build Slack message
    const slackMessage = (firstName: string) => [
      `Bonjour ${firstName},`,
      "",
      `📅 *Nouvelle session planifiée*`,
      "",
      `*${title}*`,
      `🏢 ${companyName}`,
      `👥 ${learnerNames || "Apprenants non assignés"}`,
      `📆 ${startDate} (${durationHours}h)`,
      !isJournee && zoomLink ? `🔗 Zoom : ${zoomLink}` : "",
      isJournee && fullAddress ? `📍 ${fullAddress}` : "",
      "",
      `✅ L'événement a été ajouté à ton agenda Google.`,
    ].filter(Boolean).join("\n");

    // Build email body for Guillaume (no Google Calendar)
    const emailBody = (firstName: string) => [
      `Bonjour ${firstName},`,
      "",
      "Une session de formation vient d'être planifiée pour toi :",
      "",
      `📋 ${typeLabel} ${sessionIndex}/${totalSessions}`,
      `🏢 Entreprise : ${companyName}`,
      `👥 Apprenants : ${learnerNames || "Non assignés"}`,
      `📅 Date : ${startDate} (${durationHours}h)`,
      isJournee && fullAddress ? `📍 Lieu : ${fullAddress}` : "",
      !isJournee && zoomLink ? `🔗 Lien Zoom : ${zoomLink}` : "",
      "",
      "⚠️ Pense à vérifier ta disponibilité et à te préparer en amont.",
      "",
      "Belle journée,",
      "",
      "L'équipe IFA Formatio",
      "",
      "IFA Formatio ®",
      "✉️ contact@ifagroupe.com",
      "🔗 www.ifagroupe.com",
    ].filter(Boolean).join("\n");

    // Store the sync data for later use
    const syncData = {
      sessionId,
      title,
      description,
      location,
      startDate,
      durationHours,
      calendarTargets,
      emailTargets,
      zoomLink,
      trainers,
      isJournee,
      slackMessage: slackMessage("Expert"),
      emailSubject: `Nouvelle session planifiée — ${title}`,
      emailBody: emailBody("Expert"),
    };

    return NextResponse.json({ success: true, syncData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
