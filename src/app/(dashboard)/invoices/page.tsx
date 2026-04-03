import { Header } from "@/components/layout/header";
import { BillingGrid } from "@/components/finance/billing-grid";
import { createClient } from "@/lib/supabase/server";

export default async function InvoicesPage() {
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
      <Header title="Facturation" />
      <div className="p-6 space-y-6">
        <BillingGrid
          entries={entries ?? []}
          companies={companies ?? []}
        />
      </div>
    </>
  );
}
