import { Header } from "@/components/layout/header";
import { AgendaView } from "@/components/production/agenda-view";
import { createClient } from "@/lib/supabase/server";

export default async function AgendaPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select(`
      *,
      training_session_learners(learner_id, learners(id, first_name, last_name)),
      service_plans(
        id, company_id, hourly_rate, format, mode,
        companies(name),
        training_programs(name)
      )
    `)
    .order("session_date", { ascending: true });

  const { data: teamMembersData } = await supabase
    .from("team_members")
    .select("first_name, roles")
    .eq("is_active", true);

  const expertNames = (teamMembersData ?? []).filter((m: any) => ((m.roles as string[]) ?? []).some(r => r === "Expert" || r === "Experte")).map((m: any) => m.first_name as string);

  return (
    <>
      <Header title="Agenda des Formations" />
      <div className="p-6">
        <AgendaView sessions={(sessions ?? []) as any} expertNames={expertNames} />
      </div>
    </>
  );
}
