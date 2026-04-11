import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { AutomationsView } from "@/components/admin/automations-view";

export default async function AutomatisationsPage() {
  const supabase = await createClient();

  const { data: workflows } = await supabase
    .from("automation_workflows")
    .select("*, automation_steps(*)")
    .order("category")
    .order("name");

  // Sort steps by step_order within each workflow
  const sorted = (workflows ?? []).map((w: any) => ({
    ...w,
    automation_steps: (w.automation_steps ?? []).sort(
      (a: any, b: any) => a.step_order - b.step_order
    ),
  }));

  return (
    <>
      <Header title="Automatisations" />
      <div className="p-6">
        <AutomationsView workflows={sorted} />
      </div>
    </>
  );
}
