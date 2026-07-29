import { Header } from "@/components/layout/header";
import { CompaniesTable } from "@/components/commercial/companies-table";
import { createClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";

export const metadata = { title: "Entreprises" };

export default async function CompaniesPage() {
  const supabase = await createClient();

  const [
    { data: companies },
    { data: companyTypes },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from("companies").select("*, company_types(name), contacts!contacts_company_id_fkey(count), deals(count), signed_deals:deals!deals_company_id_fkey(amount, stage, close_date), team_members!companies_owner_id_fkey(first_name, last_name)").order("name"),
    supabase.from("company_types").select("id, name").order("name"),
    supabase.from("team_members").select("id, first_name, last_name").eq("is_active", true),
  ]);

  const companiesList = companies ?? [];
  const customers = companiesList.filter((c) => c.lifecycle_stage === "customer").length;
  const prospects = companiesList.filter((c) => c.lifecycle_stage === "prospect" || c.lifecycle_stage === "lead").length;

  return (
    <>
      <Header title="Entreprises" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total entreprises</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{companiesList.length}</div>
            </div>
            <Building2 style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{customers}</div>
            </div>
            <Building2 style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Prospects / Leads</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1E2A5A" }}>{prospects}</div>
            </div>
            <Building2 style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
        </div>
        <CompaniesTable companies={companiesList} companyTypes={companyTypes ?? []} teamMembers={teamMembers ?? []} />
      </div>
    </>
  );
}
