import { Header } from "@/components/layout/header";
import { SettingBoard } from "@/components/marketing/setting-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Setting" };

export default async function SettingPage() {
  const supabase = await createClient();

  // Fetch all marketing leads that are still being worked (lead or contacted)
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

  let activities: { contact_id: string; type: string; description: string | null; created_at: string }[] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("activities")
      .select("contact_id, type, description, created_at")
      .in("contact_id", leadIds)
      .order("created_at", { ascending: false });
    activities = data ?? [];
  }

  return (
    <>
      <Header title="Setting" />
      <div className="p-6 space-y-6">
        <SettingBoard leads={leads ?? []} activities={activities} />
      </div>
    </>
  );
}
