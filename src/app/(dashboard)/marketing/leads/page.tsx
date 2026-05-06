import { Header } from "@/components/layout/header";
import { LeadsTable } from "@/components/marketing/leads-table";
import { createClient } from "@/lib/supabase/server";
import { UserPlus } from "lucide-react";

export const metadata = { title: "Leads" };

export default async function MarketingLeadsPage() {
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_id, lifecycle_stage, lead_status, created_at, owner_id, companies!contacts_company_id_fkey(name), lead_sources!contacts_source_id_fkey(name), team_members!contacts_owner_id_fkey(id, first_name, last_name)")
    .eq("lifecycle_stage", "lead_marketing")
    .order("created_at", { ascending: false });

  const leadsList = leads ?? [];
  const marketingCount = leadsList.length;

  return (
    <>
      <Header title="Leads" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-1" style={{ maxWidth: 250 }}>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Leads Marketing</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#e65100" }}>{marketingCount}</div>
            </div>
            <UserPlus style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
        </div>
        <LeadsTable leads={leadsList} />
      </div>
    </>
  );
}
