import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWorkflow } from "@/lib/automations";

/**
 * Syncs a training_session to the delivery `sessions` table.
 * - When status is "done" or "no_show": upsert a delivery session record with all info
 * - Includes: participants, theme, learner count, trainer, hours, amounts
 */
export async function POST(req: NextRequest) {
  const { trainingSessionId } = await req.json();
  if (!trainingSessionId) {
    return NextResponse.json({ error: "Missing trainingSessionId" }, { status: 400 });
  }

  const wf = await loadWorkflow("session-completed");
  if (wf && !wf.is_active) {
    return NextResponse.json({ skipped: true, reason: "workflow disabled" });
  }

  const supabase = await createClient();

  // Fetch the training session with service plan, company, and linked learners
  const { data: ts, error: tsError } = await supabase
    .from("training_sessions")
    .select(`
      *,
      service_plans(
        id, company_id, hourly_rate, format, mode,
        companies(id, name)
      ),
      training_session_learners(
        learner_id,
        learners(first_name, last_name)
      )
    `)
    .eq("id", trainingSessionId)
    .single();

  if (tsError || !ts) {
    return NextResponse.json({ error: "Training session not found" }, { status: 404 });
  }

  const plan = ts.service_plans as { id: string; company_id: string | null; hourly_rate: number | null; format: string | null; mode: string | null } | null;

  // If status is "done" or "no_show" (billable), upsert into delivery sessions
  if (ts.status === "done" || ts.status === "no_show") {
    const hours = Number(ts.duration_hours) || 0;
    const rate = Number(plan?.hourly_rate) || 0;
    const isBillable = ts.is_billable !== false;
    const billableAmt = isBillable ? hours * rate : 0;
    const nonBillableAmt = !isBillable ? hours * rate : 0;

    // Resolve trainer IDs from trainer names
    const trainerNames = (ts.trainers as string[]) ?? [];
    const trainerIds: (string | null)[] = [];
    for (const name of trainerNames) {
      const { data: member } = await supabase
        .from("team_members")
        .select("id")
        .eq("first_name", name)
        .limit(1)
        .maybeSingle();
      trainerIds.push(member?.id ?? null);
    }
    // Fallback: if no trainers, still create one line
    if (trainerIds.length === 0) trainerIds.push(null);

    // Build attendee names from linked learners
    const learnerLinks = (ts.training_session_learners ?? []) as { learner_id: string; learners: { first_name: string; last_name: string } | null }[];
    const attendeeNames = learnerLinks
      .map(l => l.learners ? `${l.learners.first_name}` : "")
      .filter(Boolean)
      .join(", ");
    const learnersCount = learnerLinks.length;

    const deliveryMode = ts.session_type === "journee" ? "présentiel" : (plan?.mode === "présentiel" ? "présentiel" : "distanciel");

    // Build theme/label from session type + notes
    const typeLabel = ts.session_type === "journee" ? "J" : "VT";
    const durationLabel = hours >= 8 ? "" : hours >= 1 ? ` ${hours}H` : ` ${Math.round(hours * 60)}min`;
    const sessionLabel = `${typeLabel}${durationLabel}`;

    // Create one delivery line per trainer:
    // - First trainer: facturable (billable)
    // - Additional trainers: non facturable (co-animation)
    for (let i = 0; i < trainerIds.length; i++) {
      const trainerId = trainerIds[i];
      const isFirstTrainer = i === 0;
      const trainerBillable = isFirstTrainer ? isBillable : false;
      const trainerBillableAmt = trainerBillable ? hours * rate : 0;
      const trainerNonBillableAmt = !trainerBillable ? hours * rate : 0;

      // Check if a delivery record already exists for this trainer + session
      const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("session_date", ts.session_date)
        .eq("company_id", plan?.company_id ?? "")
        .eq("trainer_id", trainerId ?? "")
        .eq("hours_delivered", hours)
        .maybeSingle();

      const sessionData = {
        session_date: ts.session_date,
        company_id: plan?.company_id ?? null,
        delivery_mode: deliveryMode,
        is_billable: trainerBillable,
        hours_planned: hours,
        hours_delivered: hours,
        hourly_rate: rate,
        billable_amount: trainerBillableAmt,
        non_billable_amount: trainerNonBillableAmt,
        trainer_id: trainerId,
        session_label: isFirstTrainer ? sessionLabel : `${sessionLabel} (co-animation)`,
        attendee_names: attendeeNames || null,
        learners_planned: learnersCount > 0 ? learnersCount : null,
        learners_delivered: learnersCount > 0 ? learnersCount : null,
        notes: ts.notes,
      };

      if (existing) {
        await supabase.from("sessions").update({
          ...sessionData,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("sessions").insert(sessionData);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
