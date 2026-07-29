import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { patchCalendarEventSummary } from "@/lib/google-calendar";
import { sendSessionEmail } from "@/lib/send-email";
import { getSlackToken } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, cancelledBy } = (await req.json()) as { sessionId: string; cancelledBy?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: session } = await supabase
      .from("training_sessions")
      .select(`
        *,
        training_session_learners(learner_id, learners(first_name, last_name, email)),
        service_plans(
          id, company_id,
          companies(name)
        )
      `)
      .eq("id", sessionId)
      .single();

    if (!session) {
      console.error("[cancel-session] Session not found:", sessionId);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    console.log("[cancel-session] Processing session:", sessionId, "trainers:", session.trainers);

    const plan = session.service_plans as any;
    const companyName = plan?.companies?.name ?? "Client";
    const trainers = (session.trainers as string[]) ?? [];
    const isJournee = session.session_type === "journee";
    const typeLabel = isJournee ? "Journée" : "VT";
    const sessionTime = (session as any).session_time ? String((session as any).session_time).slice(0, 5) : "09:00";
    const sessionDateFr = session.session_date
      ? new Date(session.session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "—";
    const durationHours = Number(session.duration_hours) || 1;

    const learnerNames = ((session.training_session_learners ?? []) as any[])
      .map(sl => sl.learners?.first_name).filter(Boolean).join(", ");

    const trainerSuffix = trainers.length > 0 ? " x " + trainers.join(", ") : "";
    const cancelledTitle = `${typeLabel} ANNULEE ${learnerNames} ${companyName}${trainerSuffix}`;

    // Fetch trainer details (calendar + slack)
    const trainerNamesToFetch = trainers.length > 0 ? trainers : ["__none__"];
    const { data: trainerMembers } = await supabase
      .from("team_members")
      .select("id, first_name, google_calendar_id, google_calendar_id_presentiel, slack_user_id")
      .in("first_name", trainerNamesToFetch);

    const eventIdsMap = ((session as any).gcal_event_ids as Record<string, string>) ?? {};
    const results: { trainer: string; gcal?: string; slack?: string }[] = [];

    for (const trainer of trainerMembers ?? []) {
      // 1. Patch Google Calendar title
      const eventId = eventIdsMap[trainer.first_name];
      if (eventId) {
        const calendarId = isJournee && trainer.google_calendar_id_presentiel
          ? trainer.google_calendar_id_presentiel
          : trainer.google_calendar_id;

        if (calendarId) {
          const res = await patchCalendarEventSummary({ calendarId, eventId, summary: cancelledTitle, memberId: trainer.id as string });
          results.push({ trainer: trainer.first_name, gcal: res.success ? "updated" : (res.error ?? "error") });
        } else {
          results.push({ trainer: trainer.first_name, gcal: "no_calendar" });
        }
      }

      // 2. Slack DM if the trainer is NOT the one who cancelled
      const cancelSlackToken = trainer.slack_user_id ? await getSlackToken(trainer.id as string) : null;
      if (
        trainer.slack_user_id &&
        cancelSlackToken &&
        cancelledBy &&
        trainer.first_name !== cancelledBy
      ) {
        const msg = [
          `Bonjour ${trainer.first_name},`,
          "",
          `🚫 *Session annulée*`,
          "",
          `La session *${cancelledTitle}* prévue le ${sessionDateFr} à ${sessionTime} (${durationHours}h) a été annulée par ${cancelledBy}.`,
          "",
          `L'événement a été mis à jour sur ton agenda Google.`,
        ].join("\n");

        try {
          const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${cancelSlackToken}` },
            body: JSON.stringify({ channel: trainer.slack_user_id, text: msg }),
          });
          const slackData = await slackRes.json();
          results.push({ trainer: trainer.first_name, slack: slackData.ok ? "sent" : slackData.error });
        } catch (e: any) {
          results.push({ trainer: trainer.first_name, slack: `error: ${e.message}` });
        }
      }
    }

    // 3. Email aux apprenants pour les avertir de l'annulation
    const learners = ((session.training_session_learners ?? []) as any[])
      .map(sl => sl.learners).filter(Boolean);

    let learnerEmailsSent = 0;
    for (const learner of learners) {
      if (!learner.email) continue;

      const emailBody = [
        `Bonjour ${learner.first_name},`,
        "",
        `La session de formation prévue le ${sessionDateFr} à ${sessionTime} (${durationHours}h) a été annulée.`,
        "",
        `📋 ${typeLabel} — ${companyName}`,
        trainers.length > 0 ? `🎓 Expert : ${trainers.join(", ")}` : "",
        "",
        "Vous n'avez plus besoin d'y participer. Une nouvelle session sera reprogrammée si nécessaire.",
        "",
        "Belle journée,",
        "",
        "L'équipe IFA Formation",
      ].filter(Boolean).join("\n");

      const emailRes = await sendSessionEmail({
        to: learner.email,
        subject: `Session annulée — ${typeLabel} du ${sessionDateFr}`,
        body: emailBody,
      });
      console.log("[cancel-session] Email to", learner.email, ":", emailRes.success ? "sent" : emailRes.error);
      if (emailRes.success) learnerEmailsSent++;
      results.push({ trainer: `${learner.first_name} ${learner.last_name}`, email: emailRes.success ? "sent" : emailRes.error } as any);
    }

    // Une SEULE activité company-level pour l'annulation (pas une par apprenant).
    const companyId = (plan?.company_id as string | undefined) ?? null;
    if (companyId && learnerEmailsSent > 0) {
      try {
        await supabase.from("activities").insert({
          type: "email",
          title: "Session annulée — apprenants prévenus",
          description: `${typeLabel} du ${sessionDateFr} annulée. ${learnerEmailsSent} apprenant(s) prévenu(s) par email.`,
          company_id: companyId,
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.error("[cancel-session] activity log failed:", logErr);
      }
    }

    console.log("[cancel-session] Done. Results:", JSON.stringify(results));
    return NextResponse.json({ success: true, title: cancelledTitle, results });
  } catch (err: any) {
    console.error("[cancel-session] Unhandled error:", err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
