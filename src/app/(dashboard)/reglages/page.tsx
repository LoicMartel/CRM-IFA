import { Header } from "@/components/layout/header";
import { ReglagesView } from "@/components/admin/reglages-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Réglages" };

export default async function ReglagesPage() {
  const supabase = await createClient();

  const [{ data: leadSources }, { data: trainingPrograms }, { data: trainingTypes }, { data: fundingTypes }, { data: marketingProviders }] = await Promise.all([
    supabase.from("lead_sources").select("id, name, created_at").order("name"),
    supabase.from("training_programs").select("id, name, created_at").order("name"),
    supabase.from("training_types").select("id, name, created_at").order("name"),
    supabase.from("funding_types").select("id, name, created_at").order("name"),
    supabase.from("marketing_providers").select("id, name, created_at").order("name"),
  ]);

  return (
    <>
      <Header title="Réglages" />
      <div className="p-6 space-y-6">
        <ReglagesView
          leadSources={leadSources ?? []}
          trainingPrograms={trainingPrograms ?? []}
          trainingTypes={trainingTypes ?? []}
          fundingTypes={fundingTypes ?? []}
          marketingProviders={marketingProviders ?? []}
        />
      </div>
    </>
  );
}
