import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SessionPayload {
  servicePlanId: string;
  sessionType: "vt" | "journee";
  sessionDate: string;
  durationHours: number;
  status: "planned" | "done" | "cancelled";
  trainers: string[];
  notes: string;
  learnerIds: string[];
  sessionLocation: string;
}

export async function POST(request: Request) {
  const { sessions } = (await request.json()) as { sessions: SessionPayload[] };

  let created = 0;
  const errors: string[] = [];

  for (const session of sessions) {
    try {
      const { data: newSession, error } = await supabase
        .from("training_sessions")
        .insert({
          service_plan_id: session.servicePlanId,
          session_type: session.sessionType,
          session_date: session.sessionDate,
          session_time: "09:00",
          duration_hours: session.durationHours,
          status: session.status,
          trainers: session.trainers.length > 0 ? session.trainers : null,
          is_billable: true,
          notes: session.notes || null,
          session_location: session.sessionLocation || null,
        })
        .select("id")
        .single();

      if (error) {
        errors.push(`Session ${session.sessionDate}: ${error.message}`);
        continue;
      }

      if (newSession && session.learnerIds.length > 0) {
        const { error: linkError } = await supabase
          .from("training_session_learners")
          .insert(
            session.learnerIds.map((lid) => ({
              training_session_id: newSession.id,
              learner_id: lid,
            }))
          );

        if (linkError) {
          errors.push(`Learner link for ${session.sessionDate}: ${linkError.message}`);
        }
      }

      created++;
    } catch (e: any) {
      errors.push(`Session ${session.sessionDate}: ${e.message}`);
    }
  }

  return NextResponse.json({ created, errors });
}
