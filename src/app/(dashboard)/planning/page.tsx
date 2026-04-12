import { Header } from "@/components/layout/header";
import { PlanningList } from "@/components/production/planning-list";
import { createClient } from "@/lib/supabase/server";


export default async function PlanningPage() {
  const supabase = await createClient();

  const { data: servicePlans } = await supabase
    .from("service_plans")
    .select(`
      *,
      companies(name, address, city),
      training_programs(name),
      training_types(name),
      service_plan_learners(
        learner_id,
        learners(id, first_name, last_name, email, phone, position, status)
      ),
      training_sessions(*, training_session_learners(learner_id, learners(id, first_name, last_name)))
    `)
    .order("start_date", { ascending: false });

  const { data: learners } = await supabase
    .from("learners")
    .select("*, companies(name)")
    .order("last_name", { ascending: true });

  const { data: programs } = await supabase
    .from("training_programs")
    .select("id, name");

  const { data: trainingTypes } = await supabase
    .from("training_types")
    .select("id, name");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, primary_contact_id, contacts!companies_primary_contact_id_fkey(first_name, last_name, phone, email)")
    .order("name");

  const { data: wonDeals } = await supabase
    .from("deals")
    .select("id, company_id, amount, name, stage")
    .in("stage", ["closed_won", "quote_sent", "quote_signed", "opco_deposit"]);

  const { data: teamMembersData } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, roles, expertises, city, region, tjm, days_per_week, preferred_days, expert_status, mobility, google_calendar_id, google_calendar_id_presentiel")
    .eq("is_active", true);

  const experts = (teamMembersData ?? []).filter((m: any) => ((m.roles as string[]) ?? []).some(r => r === "Expert" || r === "Experte")).map((m: any) => m.first_name as string);

  const plans = servicePlans ?? [];
  const allLearners = learners ?? [];

  return (
    <>
      <Header title="Planification des Formations" />
      <div className="p-6 space-y-6">
        <PlanningList
          servicePlans={plans as any}
          allLearners={allLearners}
          programs={programs ?? []}
          trainingTypes={trainingTypes ?? []}
          companies={companies ?? []}
          wonDeals={(wonDeals ?? []) as any}
          expertNames={experts}
          expertMembers={(teamMembersData ?? []).filter((m: any) => ((m.roles as string[]) ?? []).some(r => r === "Expert" || r === "Experte"))}
        />
      </div>
    </>
  );
}
