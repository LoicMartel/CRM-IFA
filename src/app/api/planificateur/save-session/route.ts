import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      service_plan_id,
      session_type,
      session_date,
      session_time,
      duration_hours,
      session_location,
      trainer_name,
      learner_ids,
      is_billable,
    } = await req.json();

    if (!service_plan_id || !session_date || !session_time) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Insert session
    const { data: newSession, error: insertError } = await supabase
      .from("training_sessions")
      .insert({
        service_plan_id,
        session_type: session_type || "vt",
        session_date,
        session_time,
        duration_hours: duration_hours || 1,
        session_location: session_type === "journee" ? (session_location || null) : null,
        trainers: trainer_name ? [trainer_name] : null,
        is_billable: is_billable ?? true,
        status: "planned",
      })
      .select("id")
      .single();

    if (insertError || !newSession) {
      return NextResponse.json({ success: false, error: insertError?.message || "Insert failed" }, { status: 500 });
    }

    // Link learners
    if (learner_ids && learner_ids.length > 0) {
      await supabase.from("training_session_learners").insert(
        learner_ids.map((lid: string) => ({ training_session_id: newSession.id, learner_id: lid }))
      );
    }

    // Sync Google Calendar + Slack + Email via gcal/notify
    let syncResults = null;
    try {
      const baseUrl = req.nextUrl.origin;
      const notifyRes = await fetch(`${baseUrl}/api/gcal/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSession.id }),
      });
      const notifyData = await notifyRes.json();
      if (notifyData.success) {
        syncResults = { title: notifyData.title, results: notifyData.results };
      }
    } catch {
      // Notifications are non-blocking — session is saved even if sync fails
    }

    return NextResponse.json({
      success: true,
      sessionId: newSession.id,
      syncResults,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
