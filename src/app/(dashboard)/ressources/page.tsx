import { Header } from "@/components/layout/header";
import { ResourcesView } from "@/components/production/resources-view";
import { createClient } from "@/lib/supabase/server";

export default async function RessourcesPage() {
  const supabase = await createClient();

  const { data: resources } = await supabase
    .from("resources")
    .select("*")
    .order("category")
    .order("subcategory")
    .order("name");

  return (
    <>
      <Header title="Ressources Pédagogiques" />
      <div className="p-6 space-y-6">
        <ResourcesView resources={resources ?? []} />
      </div>
    </>
  );
}
