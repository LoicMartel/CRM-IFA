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
  // Batch in chunks of 200 to avoid URL length limits with large lead sets
  const leadIds = (leads ?? []).map((l) => l.id);

  type ActivityRow = { contact_id: string; type: string; description: string | null; created_at: string; team_member_id: string | null; team_members: { id: string; first_name: string; last_name: string } | null };
  let activities: ActivityRow[] = [];
  if (leadIds.length > 0) {
    const CHUNK = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < leadIds.length; i += CHUNK) chunks.push(leadIds.slice(i, i + CHUNK));
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("activities")
          .select("contact_id, type, description, created_at, team_member_id, team_members:team_member_id(id, first_name, last_name)")
          .in("contact_id", ids)
          .order("created_at", { ascending: false })
      )
    );
    for (const { data } of results) {
      if (data) activities.push(...(data as unknown as ActivityRow[]));
    }
  }

  // Fetch Account Managers + Marketing Managers for the filter dropdown
  const { data: allMembers } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, roles")
    .eq("is_active", true)
    .order("last_name");
  const teamMembers = (allMembers ?? []).filter((m) => {
    const roles = (m.roles as string[]) ?? [];
    return roles.includes("Account Manager") || roles.includes("Marketing Manager");
  });

  return (
    <>
      <Header title="Setting" />
      <div className="p-6 space-y-6">
        <SettingBoard leads={leads ?? []} activities={activities} teamMembers={teamMembers ?? []} />
      </div>
    </>
  );
}
