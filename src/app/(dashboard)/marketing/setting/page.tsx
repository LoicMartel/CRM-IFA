import { Header } from "@/components/layout/header";
import { SettingBoard } from "@/components/marketing/setting-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Setting" };

export default async function SettingPage() {
  const supabase = await createClient();

  // Fetch all marketing leads that are still being worked (lead or contacted or booked)
  const { data: leads } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, company_id, lifecycle_stage, lead_status, created_at, last_contacted_at, owner_id, companies!contacts_company_id_fkey(name), lead_sources!contacts_source_id_fkey(name), team_members!contacts_owner_id_fkey(id, first_name, last_name)"
    )
    .eq("was_lead_marketing", true)
    .eq("is_client", false)
    .not("lifecycle_stage", "in", '("customer","former_customer")')
    .in("lead_status", ["lead", "contacted", "booked"])
    .order("created_at", { ascending: false });

  // Fetch activities for these leads to determine their column
  const leadIds = (leads ?? []).map((l) => l.id);

  let activities: { contact_id: string; type: string; description: string | null; created_at: string; team_member_id: string | null; team_members: { id: string; first_name: string; last_name: string } | null }[] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("activities")
      .select("contact_id, type, description, created_at, team_member_id, team_members:team_member_id(id, first_name, last_name)")
      .in("contact_id", leadIds)
      .order("created_at", { ascending: false });
    activities = (data as unknown as typeof activities) ?? [];
  }

  // Fetch all active team members for the Account Manager filter
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("last_name");

  return (
    <>
      <Header title="Setting" />
      <div className="p-6 space-y-6">
        <SettingBoard leads={leads ?? []} activities={activities} teamMembers={teamMembers ?? []} />
      </div>
    </>
  );
}
