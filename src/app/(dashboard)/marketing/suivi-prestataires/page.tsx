import { Header } from "@/components/layout/header";
import { ProviderTrackingView } from "@/components/marketing/provider-tracking-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Suivi Tunnels" };

export default async function SuiviPrestatairesPage() {
  const supabase = await createClient();

  const [
    { data: providers },
    { data: stats },
  ] = await Promise.all([
    supabase.from("marketing_providers").select("*").order("name"),
    supabase.from("marketing_weekly_stats").select("*, marketing_providers(name)").order("period_start", { ascending: false }),
  ]);

  return (
    <>
      <Header title="Suivi Tunnels" />
      <div className="p-6 space-y-6">
        <ProviderTrackingView
          providers={providers ?? []}
          stats={stats ?? []}
        />
      </div>
    </>
  );
}
