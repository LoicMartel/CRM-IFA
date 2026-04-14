import { Header } from "@/components/layout/header";
import { SyntheseServiceView } from "@/components/production/synthese-service-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Synthèse Service" };

export default async function SyntheseServicePage() {
  const supabase = await createClient();

  const [
    { data: sessions },
    { data: servicePlans },
    { data: deals },
    { data: teamMembersData },
    { data: deliverySessions },
  ] = await Promise.all([
    supabase.from("training_sessions").select(`
      *,
      training_session_learners(learner_id),
      service_plans(
        id, company_id, hourly_rate, format, mode, budget, deal_id,
        vt_planned, days_planned,
        companies(id, name),
        training_programs(name)
      )
    `).order("session_date", { ascending: true }),
    supabase.from("service_plans").select(`
      *, companies(name), training_programs(name)
    `),
    supabase.from("deals").select("id, company_id, amount, stage, owner_id, name, training_days"),
    supabase.from("team_members").select("first_name, roles").eq("is_active", true),
    supabase.from("sessions").select("*, team_members(first_name, last_name), companies(id, name)").not("company_id", "is", null),
  ]);

  const expertNames = (teamMembersData ?? []).filter((m: any) => ((m.roles as string[]) ?? []).some(r => r === "Expert" || r === "Experte")).map((m: any) => m.first_name as string);

  return (
    <>
      <Header title="Synthèse Service" />
      <div className="p-6">
        <SyntheseServiceView
          sessions={(sessions ?? []) as any}
          servicePlans={(servicePlans ?? []) as any}
          deals={(deals ?? []) as any}
          expertNames={expertNames}
          deliverySessions={(deliverySessions ?? []) as any}
        />
      </div>
    </>
  );
}
