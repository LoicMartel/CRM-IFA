import { Header } from "@/components/layout/header";
import { ReglagesView } from "@/components/admin/reglages-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Réglages" };

export default async function ReglagesPage() {
  const supabase = await createClient();

  const { data: leadSources } = await supabase
    .from("lead_sources")
    .select("id, name, created_at")
    .order("name");

  return (
    <>
      <Header title="Réglages" />
      <div className="p-6 space-y-6">
        <ReglagesView leadSources={leadSources ?? []} />
      </div>
    </>
  );
}
