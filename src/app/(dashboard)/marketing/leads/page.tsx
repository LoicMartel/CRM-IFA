import { Header } from "@/components/layout/header";
import { LeadsTable } from "@/components/marketing/leads-table";
import { createClient } from "@/lib/supabase/server";
import { UserPlus } from "lucide-react";

export default async function MarketingLeadsPage() {
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_id, created_at, companies!contacts_company_id_fkey(name), lead_sources!contacts_source_id_fkey(name)")
    .eq("lead_status", "lead")
    .order("last_name");

  const leadsList = leads ?? [];

  return (
    <>
      <Header title="Leads" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-1" style={{ maxWidth: 300 }}>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total leads</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{leadsList.length}</div>
            </div>
            <UserPlus style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
        </div>
        <LeadsTable leads={leadsList} />
      </div>
    </>
  );
}
