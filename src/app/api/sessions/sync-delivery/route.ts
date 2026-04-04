import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Syncs a training_session to the delivery `sessions` table.
 * - When status is "done": upsert a delivery session record
 * - When status is anything else: remove the delivery record if it exists
 */
export async function POST(req: NextRequest) {
  const { trainingSessionId } = await req.json();
  if (!trainingSessionId) {
    return NextResponse.json({ error: "Missing trainingSessionId" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch the training session with its service plan
  const { data: ts, error: tsError } = await supabase
    .from("training_sessions")
    .select(`
      *,
      service_plans(
        id, company_id, hourly_rate, format, mode,
        companies(id, name)
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

    // Resolve trainer_id from trainer name
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

    const deliveryMode = ts.session_type === "journee" ? "présentiel" : (plan?.mode === "présentiel" ? "présentiel" : "distanciel");

    // Check if a delivery record already exists for this training session
    const { data: existing } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_date", ts.session_date)
      .eq("company_id", plan?.company_id ?? "")
      .eq("hours_delivered", hours)
      .eq("trainer_id", trainerId ?? "")
      .maybeSingle();

    if (existing) {
      // Update existing
      await supabase.from("sessions").update({
        hours_planned: hours,
        hours_delivered: hours,
        hourly_rate: rate,
        is_billable: isBillable,
        billable_amount: billableAmt,
        non_billable_amount: nonBillableAmt,
        delivery_mode: deliveryMode,
        session_label: `${ts.session_type === "journee" ? "Journée" : "VT"} — Plan #${plan?.id?.slice(0, 8) ?? ""}`,
        notes: ts.notes,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      // Insert new
      await supabase.from("sessions").insert({
        session_date: ts.session_date,
        company_id: plan?.company_id ?? null,
        delivery_mode: deliveryMode,
        is_billable: isBillable,
        hours_planned: hours,
        hours_delivered: hours,
        hourly_rate: rate,
        billable_amount: billableAmt,
        non_billable_amount: nonBillableAmt,
        trainer_id: trainerId,
        session_label: `${ts.session_type === "journee" ? "Journée" : "VT"} — Plan #${plan?.id?.slice(0, 8) ?? ""}`,
        notes: ts.notes,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
