import { Header } from "@/components/layout/header";
import { LearnersTable } from "@/components/production/learners-table";
import { createClient } from "@/lib/supabase/server";

export default async function LearnersPage() {
  const supabase = await createClient();

  const { data: learners } = await supabase
    .from("learners")
    .select("*, companies(name), training_programs(name), training_types(name)")
    .order("last_name");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  const { data: programs } = await supabase
    .from("training_programs")
    .select("id, name");

  const { data: trainingTypes } = await supabase
    .from("training_types")
    .select("id, name");

  const { data: experts } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, roles")
    .eq("is_active", true)
    .order("first_name");

  return (
    <>
      <Header title="Apprenants" />
      <div className="p-6 space-y-6">
        <LearnersTable
          learners={(learners ?? []) as any}
          companies={companies ?? []}
          programs={programs ?? []}
          trainingTypes={trainingTypes ?? []}
          experts={((experts ?? []).filter((e: any) => ((e.roles as string[]) ?? []).some(r => r === "Expert" || r === "Experte"))) as any}
        />
      </div>
    </>
  );
}
