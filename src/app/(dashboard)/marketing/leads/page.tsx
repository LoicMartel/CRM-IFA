import { Header } from "@/components/layout/header";
import { LeadsTable } from "@/components/marketing/leads-table";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Leads" };

export default async function MarketingLeadsPage() {
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_id, lifecycle_stage, lead_status, created_at, owner_id, companies!contacts_company_id_fkey(name), lead_sources!contacts_source_id_fkey(name), team_members!contacts_owner_id_fkey(id, first_name, last_name)")
    .eq("was_lead_marketing", true)
    .order("created_at", { ascending: false });

  const leadsList = leads ?? [];

  return (
    <>
      <Header title="Leads" />
      <div className="p-6 space-y-6">
        <LeadsTable leads={leadsList} />
      </div>
    </>
  );
}
