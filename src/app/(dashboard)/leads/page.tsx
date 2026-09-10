import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/commercial/reports-view";
import { getFiscalMode } from "@/lib/get-fiscal-mode";

export const metadata = { title: "Rapports Commerciaux" };

/** Fetch all rows from a table using pagination (Supabase caps each request at 1000 rows). */
async function fetchAll<T = Record<string, unknown>>(
  query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await query.range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default async function ReportsPage() {
  const [supabase, fiscalMode] = await Promise.all([createClient(), getFiscalMode()]);

  const [
    salesTargets,
    orders,
    deals,
    contacts,
    activities,
    rawMeetings,
    companies,
    tasks,
    meetingContactRows,
  ] = await Promise.all([
    fetchAll(supabase.from("sales_targets").select("*").order("month", { ascending: true })),
    fetchAll(supabase.from("deals").select("*, team_members(first_name, last_name), lead_sources(name)").eq("stage", "closed_won").order("close_date", { ascending: false })),
    fetchAll(supabase.from("deals").select("*, team_members(first_name, last_name)")),
    fetchAll(supabase.from("contacts").select("*, companies!contacts_company_id_fkey(name), team_members!contacts_owner_id_fkey(first_name, last_name)").order("last_name")),
    fetchAll(supabase.from("activities").select("contact_id, type, description, created_at, team_member_id, team_members:team_member_id(first_name, last_name)").order("created_at", { ascending: false })),
    fetchAll(supabase.from("meetings").select("*, contacts!meetings_contact_id_fkey(id, first_name, last_name, email, phone, companies!contacts_company_id_fkey(id, name)), team_members!meetings_assigned_to_fkey(first_name, last_name)").order("scheduled_at", { ascending: false })),
    fetchAll(supabase.from("companies").select("*, team_members!companies_owner_id_fkey(first_name, last_name)").order("name")),
    fetchAll(supabase.from("activities").select("*, contacts:contact_id(id, first_name, last_name), companies:company_id(id, name), team_members:team_member_id(first_name, last_name)").eq("type", "tâche").order("due_date", { ascending: false })),
    fetchAll(supabase.from("meeting_contacts").select("meeting_id, contact_id, is_primary, contacts(id, first_name, last_name, email, phone, companies!contacts_company_id_fkey(id, name))")),
  ]);

  // Expand meetings: for multi-participant meetings, create one entry per contact
  // so that all participants appear in KPIs (booked, done, etc.)
  const mcByMeeting = new Map<string, typeof meetingContactRows>();
  for (const mc of meetingContactRows) {
    const mid = mc.meeting_id as string;
    if (!mcByMeeting.has(mid)) mcByMeeting.set(mid, []);
    mcByMeeting.get(mid)!.push(mc);
  }

  const meetings: Record<string, unknown>[] = [];
  for (const m of rawMeetings) {
    const mid = m.id as string;
    const participants = mcByMeeting.get(mid);
    if (participants && participants.length > 1) {
      // Multi-participant: create one meeting entry per contact
      for (const mc of participants) {
        meetings.push({
          ...m,
          contact_id: mc.contact_id,
          contacts: mc.contacts,
        });
      }
    } else {
      // Single participant or no junction rows: keep as-is
      meetings.push(m);
    }
  }

  return (
    <>
      <Header title="Reports" />
      <ReportsView
        salesTargets={salesTargets}
        orders={orders}
        deals={deals}
        contacts={contacts}
        activities={activities}
        meetings={meetings}
        companies={companies}
        tasks={tasks}
        fiscalMode={fiscalMode}
      />
    </>
  );
}
