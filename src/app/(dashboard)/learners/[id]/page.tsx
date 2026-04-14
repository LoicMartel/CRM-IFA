import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { notFound } from "next/navigation";
import { LearnerDetailView } from "@/components/production/learner-detail-view";
import { LmsProgressBar } from "@/components/learners/lms-progress-bar";

export const metadata = { title: "Fiche Apprenant" };

export default async function LearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: learner } = await supabase
    .from("learners")
    .select("*, companies(id, name), training_programs(id, name), training_types(id, name), team_members!learners_expert_id_fkey(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (!learner) notFound();

  // Fetch training sessions linked to this learner via training_session_learners
  const { data: sessionLinks } = await supabase
    .from("training_session_learners")
    .select("training_session_id")
    .eq("learner_id", id);

  const sessionIds = (sessionLinks ?? []).map((sl) => sl.training_session_id);

  let sessions: Record<string, unknown>[] = [];
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from("training_sessions")
      .select("*, service_plans(id, company_id, budget, budget_remaining, vt_planned, days_planned, hourly_rate, start_date, end_date, companies(name), training_programs(name), training_types(name))")
      .in("id", sessionIds)
      .order("session_date", { ascending: false });
    sessions = data ?? [];
  }

  // Extract unique service plan IDs from sessions
  const servicePlanIds = [...new Set(sessions.map((s) => (s as any).service_plan_id).filter(Boolean))];

  let servicePlans: Record<string, unknown>[] = [];
  if (servicePlanIds.length > 0) {
    const { data } = await supabase
      .from("service_plans")
      .select("*, companies(name), training_programs(name), training_types(name), training_sessions(id, session_type, duration_hours, status)")
      .in("id", servicePlanIds);
    servicePlans = data ?? [];
  }

  // Fetch activities for this learner
  const { data: activities } = await supabase
    .from("activities")
    .select("*, team_members:team_member_id(first_name, last_name)")
    .eq("learner_id", id)
    .order("created_at", { ascending: false });

  // Fetch reference data for the edit form
  const [
    { data: companies },
    { data: programs },
    { data: trainingTypes },
    { data: allExperts },
  ] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("training_programs").select("id, name"),
    supabase.from("training_types").select("id, name"),
    supabase.from("team_members").select("id, first_name, last_name, roles").eq("is_active", true).order("first_name"),
  ]);

  return (
    <>
      <Header title={`${learner.first_name} ${learner.last_name}`} />
      <div style={{ padding: "0 24px", marginBottom: 16 }}>
        <LmsProgressBar learnerId={id} />
      </div>
      <LearnerDetailView
        learner={learner}
        sessions={sessions}
        servicePlans={servicePlans}
        activities={activities ?? []}
        companies={companies ?? []}
        programs={programs ?? []}
        trainingTypes={trainingTypes ?? []}
        experts={((allExperts ?? []).filter((e: any) => ((e.roles as string[]) ?? []).some((r: string) => r === "Expert" || r === "Experte")).map((e: any) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name }))) as any}
      />
    </>
  );
}
