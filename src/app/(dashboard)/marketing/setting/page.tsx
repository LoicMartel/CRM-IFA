import { Header } from "@/components/layout/header";
import { SettingBoard } from "@/components/marketing/setting-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Setting" };

export default async function SettingPage() {
  const supabase = await createClient();

  // Fetch marketing leads: non-booked (still being worked) + booked (worked through setting)
  const [{ data: activeLeads }, { data: bookedLeads }] = await Promise.all([
    // Leads still being worked (not yet booked)
    supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, phone, company_id, lifecycle_stage, lead_status, created_at, last_contacted_at, owner_id, companies!contacts_company_id_fkey(name), lead_sources!contacts_source_id_fkey(name), team_members!contacts_owner_id_fkey(id, first_name, last_name)"
      )
      .eq("was_lead_marketing", true)
      .eq("is_client", false)
      .eq("lifecycle_stage", "lead_marketing")
      .in("lead_status", ["lead", "contacted"])
      .order("created_at", { ascending: false }),
    // Leads who booked (may include direct-bookers — filtered below)
    supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, phone, company_id, lifecycle_stage, lead_status, created_at, last_contacted_at, owner_id, companies!contacts_company_id_fkey(name), lead_sources!contacts_source_id_fkey(name), team_members!contacts_owner_id_fkey(id, first_name, last_name)"
      )
      .eq("was_lead_marketing", true)
      .eq("is_client", false)
      .eq("lead_status", "booked")
      .not("lifecycle_stage", "in", '("customer","former_customer")')
      .order("created_at", { ascending: false }),
  ]);

  // Fetch activities for all candidate leads
  const allCandidateIds = [
    ...(activeLeads ?? []).map((l) => l.id),
    ...(bookedLeads ?? []).map((l) => l.id),
  ];

  type ActivityRow = { contact_id: string; type: string; description: string | null; created_at: string; team_member_id: string | null; team_members: { id: string; first_name: string; last_name: string } | null };
  let activities: ActivityRow[] = [];
  if (allCandidateIds.length > 0) {
    const CHUNK = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < allCandidateIds.length; i += CHUNK) chunks.push(allCandidateIds.slice(i, i + CHUNK));
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

  // Exclude booked leads who booked via the booking page (direct-bookers).
  // The booking routes automatically add "Réservé via la booking page" in meeting notes.
  const bookedIds = (bookedLeads ?? []).map((l) => l.id);
  let directBookerIds = new Set<string>();
  if (bookedIds.length > 0) {
    const { data: bookingMeetings } = await supabase
      .from("meetings")
      .select("contact_id, notes")
      .in("contact_id", bookedIds)
      .ilike("notes", "%Réservé via la booking page%");
    directBookerIds = new Set((bookingMeetings ?? []).map((m) => m.contact_id));
  }
  const filteredBookedLeads = (bookedLeads ?? []).filter((l) => !directBookerIds.has(l.id));
  const leads = [...(activeLeads ?? []), ...filteredBookedLeads];

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
