import { Header } from "@/components/layout/header";
import { RapportsProductionView } from "@/components/production/rapports-production-view";
import { createClient } from "@/lib/supabase/server";

export default async function RapportsProductionPage() {
  const supabase = await createClient();

  const [
    { data: servicePlans },
    { data: sessions },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("service_plans").select(`
      *,
      companies(id, name),
      training_programs(name),
      deals(id, name, amount)
    `),
    supabase.from("training_sessions").select(`
      *,
      training_session_learners(learner_id, learners(id, first_name, last_name)),
      service_plans(id, company_id, hourly_rate, companies(id, name))
    `),
    supabase.from("invoices").select("id, amount, status, deal_id"),
  ]);

  return (
    <>
      <Header title="Rapports Production" />
      <div className="p-6">
        <RapportsProductionView
          servicePlans={(servicePlans ?? []) as any}
          sessions={(sessions ?? []) as any}
          invoices={(invoices ?? []) as any}
        />
      </div>
    </>
  );
}
