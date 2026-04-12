import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * One-time backfill: sync all training_sessions with status "done" or "no_show"
 * that are missing from the delivery `sessions` table.
 */
export async function POST() {
  const supabase = await createClient();

  // Fetch all done/no_show training sessions
  const { data: allTs, error } = await supabase
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
    .in("status", ["done", "no_show"])
    .order("session_date", { ascending: true });

  if (error || !allTs) {
    return NextResponse.json({ error: "Failed to fetch training sessions" }, { status: 500 });
  }

  let synced = 0;
  let skipped = 0;

  for (const ts of allTs) {
    const plan = ts.service_plans as { id: string; company_id: string | null; hourly_rate: number | null; format: string | null; mode: string | null } | null;
    if (!plan?.company_id) { skipped++; continue; }

    const hours = Number(ts.duration_hours) || 0;
    const rate = Number(plan.hourly_rate) || 0;
    const isBillable = ts.is_billable !== false;
    const billableAmt = isBillable ? hours * rate : 0;
    const nonBillableAmt = !isBillable ? hours * rate : 0;

    // Resolve trainer_id
    let trainerId: string | null = null;
    const trainers = (ts.trainers as string[]) ?? [];
    if (trainers.length > 0) {
      const { data: member } = await supabase
        .from("team_members")
        .select("id")
        .eq("first_name", trainers[0])
        .limit(1)
        .maybeSingle();
      trainerId = member?.id ?? null;
    }

    // Build attendee names
    const learnerLinks = (ts.training_session_learners ?? []) as { learner_id: string; learners: { first_name: string; last_name: string } | null }[];
    const attendeeNames = learnerLinks.map(l => l.learners ? l.learners.first_name : "").filter(Boolean).join(", ");
    const learnersCount = learnerLinks.length;

    const deliveryMode = ts.session_type === "journee" ? "présentiel" : (plan.mode === "présentiel" ? "présentiel" : "distanciel");
    const typeLabel = ts.session_type === "journee" ? "J" : "VT";
    const durationLabel = hours >= 8 ? "" : hours >= 1 ? ` ${hours}H` : ` ${Math.round(hours * 60)}min`;
    const sessionLabel = `${typeLabel}${durationLabel}`;

    // Check if delivery record already exists
    const { data: existing } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_date", ts.session_date)
      .eq("company_id", plan.company_id)
      .eq("hours_delivered", hours)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    await supabase.from("sessions").insert({
      session_date: ts.session_date,
      company_id: plan.company_id,
      delivery_mode: deliveryMode,
      is_billable: isBillable,
      hours_planned: hours,
      hours_delivered: hours,
      hourly_rate: rate,
      billable_amount: billableAmt,
      non_billable_amount: nonBillableAmt,
      trainer_id: trainerId,
      session_label: sessionLabel,
      attendee_names: attendeeNames || null,
      learners_planned: learnersCount > 0 ? learnersCount : null,
      learners_delivered: learnersCount > 0 ? learnersCount : null,
      notes: ts.notes,
    });
    synced++;
  }

  return NextResponse.json({ ok: true, total: allTs.length, synced, skipped });
}
