import { Header } from "@/components/layout/header";
import { ContactsTable } from "@/components/commercial/contacts-table";
import { createClient } from "@/lib/supabase/server";
import { User, UserCheck } from "lucide-react";

export default async function ContactsPage() {
  const supabase = await createClient();

  const [
    { data: contacts },
    { data: companies },
    { data: teamMembers },
    { data: sources },
  ] = await Promise.all([
    supabase.from("contacts").select("*, companies!contacts_company_id_fkey(name), team_members!contacts_owner_id_fkey(first_name, last_name)").order("last_name"),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("team_members").select("id, first_name, last_name, roles").eq("is_active", true),
    supabase.from("lead_sources").select("id, name").order("name"),
  ]);

  const accountManagers = (teamMembers ?? []).filter((m: any) => ((m.roles as string[]) ?? []).includes("Account Manager"));
  const contactsList = contacts ?? [];
  const clientsCount = contactsList.filter((c) => c.is_client).length;

  return (
    <>
      <Header title="Contacts" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total contacts</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{contactsList.length}</div>
            </div>
            <User style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients actifs</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{clientsCount}</div>
            </div>
            <UserCheck style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Prospects</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{contactsList.length - clientsCount}</div>
            </div>
            <User style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
        </div>
        <ContactsTable contacts={contactsList} companies={companies ?? []} teamMembers={accountManagers} sources={sources ?? []} />
      </div>
    </>
  );
}
