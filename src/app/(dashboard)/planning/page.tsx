import { Header } from "@/components/layout/header";
import { PlanningList } from "@/components/production/planning-list";
import { createClient } from "@/lib/supabase/server";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

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
    .select("id, company_id, amount, name")
    .eq("stage", "closed_won");

  const { data: teamMembersData } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, roles")
    .eq("is_active", true);

  const experts = (teamMembersData ?? []).filter((m: any) => ((m.roles as string[]) ?? []).some(r => r === "Expert" || r === "Experte")).map((m: any) => m.first_name as string);

  const plans = servicePlans ?? [];
  const allLearners = learners ?? [];

  const totalBudget = plans.reduce((s, p) => s + (Number(p.budget) || 0), 0);

  // Count sessions across all plans
  const allSessions = plans.flatMap((p: Record<string, unknown>) => (p.training_sessions as Array<Record<string, unknown>>) ?? []);
  const totalVtDone = allSessions.filter((s: Record<string, unknown>) => s.session_type === "vt" && s.status === "done").length;
  const totalVtPlanned = allSessions.filter((s: Record<string, unknown>) => s.session_type === "vt" && s.status === "planned").length;
  const totalVt = plans.reduce((s, p) => s + (Number(p.vt_planned) || 0), 0);
  const totalDaysDone = allSessions.filter((s: Record<string, unknown>) => s.session_type === "journee" && s.status === "done").length;
  const totalDaysPlanned = allSessions.filter((s: Record<string, unknown>) => s.session_type === "journee" && s.status === "planned").length;
  const totalDays = plans.reduce((s, p) => s + (Number(p.days_planned) || 0), 0);

  const learnersActuel = allLearners.filter((l) => l.status === "actuel").length;

  return (
    <>
      <Header title="Planification des Formations" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Plans de formation</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{plans.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>VT (réalisées / total)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalVtDone} / {totalVt}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Journées (réalisées / total)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{totalDaysDone} / {totalDays}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Apprenants actuels</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#2ecc71" }}>{learnersActuel}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Budget total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalBudget)}</div>
          </div>
        </div>

        <PlanningList
          servicePlans={plans as any}
          allLearners={allLearners}
          programs={programs ?? []}
          trainingTypes={trainingTypes ?? []}
          companies={companies ?? []}
          wonDeals={(wonDeals ?? []) as any}
          expertNames={experts}
        />
      </div>
    </>
  );
}
