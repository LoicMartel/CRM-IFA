import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];
    const updates: { learnerId: string; from: string; to: string }[] = [];

    // Get all learners linked to sessions via training_session_learners
    const { data: learners } = await supabase
      .from("learners")
      .select("id, status")
      .in("status", ["actuel", "futur"]);

    if (!learners || learners.length === 0) {
      return NextResponse.json({ success: true, updates: [] });
    }

    for (const learner of learners) {
      // Get all session links for this learner
      const { data: sessionLinks } = await supabase
        .from("training_session_learners")
        .select("training_session_id")
        .eq("learner_id", learner.id);

      if (!sessionLinks || sessionLinks.length === 0) continue;

      const sessionIds = sessionLinks.map(sl => sl.training_session_id);

      // Get sessions with their service plan info
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("id, status, service_plan_id, service_plans(start_date)")
        .in("id", sessionIds)
        .neq("status", "cancelled");

      if (!sessions || sessions.length === 0) continue;

      // Group sessions by service plan
      const planSessions: Record<string, { sessions: typeof sessions; startDate: string | null }> = {};
      sessions.forEach(s => {
        const pid = s.service_plan_id;
        if (!planSessions[pid]) {
          const sp = s.service_plans as unknown as { start_date: string } | null;
          planSessions[pid] = { sessions: [], startDate: sp?.start_date ?? null };
        }
        planSessions[pid].sessions.push(s);
      });

      // Check each plan
      let shouldBeActuel = false;
      let allPlansDone = true;
      let hasActivePlan = false;

      for (const [, plan] of Object.entries(planSessions)) {
        const allDone = plan.sessions.every(s => s.status === "done");
        const hasStarted = plan.startDate ? plan.startDate <= today : true;

        if (allDone) {
          // This plan is complete
        } else {
          allPlansDone = false;
          if (hasStarted) {
            shouldBeActuel = true;
          }
        }
        hasActivePlan = true;
      }

      if (!hasActivePlan) continue;

      // Determine target status
      let targetStatus: string | null = null;

      if (allPlansDone && hasActivePlan) {
        // All plans are done → ancien
        targetStatus = "ancien";
      } else if (shouldBeActuel && learner.status === "futur") {
        // At least one plan has started and not all done → actuel
        targetStatus = "actuel";
      } else if (!shouldBeActuel && !allPlansDone && learner.status !== "futur") {
        // No plan has started yet → futur
        // Only if ALL plans haven't started
        const anyStarted = Object.values(planSessions).some(p => p.startDate ? p.startDate <= today : true);
        if (!anyStarted) {
          targetStatus = "futur";
        }
      }

      if (targetStatus && targetStatus !== learner.status) {
        await supabase.from("learners").update({ status: targetStatus }).eq("id", learner.id);
        updates.push({ learnerId: learner.id, from: learner.status, to: targetStatus });
      }
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
