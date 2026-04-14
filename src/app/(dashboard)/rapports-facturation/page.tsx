import { Header } from "@/components/layout/header";
import { RapportsFacturationView } from "@/components/finance/rapports-facturation-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Rapports Facturation" };

export default async function RapportsFacturationPage() {
  const supabase = await createClient();

  const [
    { data: entries },
    { data: companies },
  ] = await Promise.all([
    supabase
      .from("billing_entries")
      .select("*, billing_months(*), companies(id, name)")
      .order("client_name"),
    supabase
      .from("companies")
      .select("id, name")
      .order("name"),
  ]);

  return (
    <>
      <Header title="Rapports Facturation" />
      <div className="p-6">
        <RapportsFacturationView
          entries={(entries ?? []) as any}
          companies={(companies ?? []) as any}
        />
      </div>
    </>
  );
}
