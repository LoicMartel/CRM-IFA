import { Header } from "@/components/layout/header";
import { MarketingReportsView } from "@/components/marketing/marketing-reports-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Rapports Marketing" };

export default async function RapportsMarketingPage() {
  const supabase = await createClient();

  const [
    { data: weeklyStats },
    { data: expenses },
    { data: contacts },
    { data: providers },
    { data: wonDeals },
  ] = await Promise.all([
    supabase.from("marketing_weekly_stats").select("*, marketing_providers(name)").order("period_start", { ascending: false }),
    supabase.from("marketing_expenses").select("*").order("period_start", { ascending: false }),
    supabase.from("contacts").select("id, lead_status, source_id, created_at, lead_sources!contacts_source_id_fkey(name)").eq("was_lead_marketing", true).order("created_at", { ascending: false }),
    supabase.from("marketing_providers").select("*").order("name"),
    supabase.from("deals").select("id, stage, amount, close_date, source_id, created_at, lead_sources(name), contacts!deals_contact_id_fkey(source_id, lead_sources!contacts_source_id_fkey(name))").in("stage", ["closed_won", "quote_signed"]),
  ]);

  // --- Rapport Setting: fetch activities + meetings for marketing leads ---
  const allLeads = contacts ?? [];
  const allLeadIds = allLeads.map((c) => c.id);

  type SettingActivity = { contact_id: string; type: string; description: string | null; created_at: string };
  let settingActivities: SettingActivity[] = [];
  if (allLeadIds.length > 0) {
    const CHUNK = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < allLeadIds.length; i += CHUNK) chunks.push(allLeadIds.slice(i, i + CHUNK));
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("activities")
          .select("contact_id, type, description, created_at")
          .in("contact_id", ids)
          .eq("type", "appel")
          .order("created_at", { ascending: false })
      )
    );
    for (const { data } of results) {
      if (data) settingActivities.push(...(data as SettingActivity[]));
    }
  }

  type SettingMeeting = { id: string; contact_id: string; status: string; scheduled_at: string; created_at: string };
  let settingMeetings: SettingMeeting[] = [];
  if (allLeadIds.length > 0) {
    const CHUNK = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < allLeadIds.length; i += CHUNK) chunks.push(allLeadIds.slice(i, i + CHUNK));
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("meetings")
          .select("id, contact_id, status, scheduled_at, created_at")
          .in("contact_id", ids)
          .order("created_at", { ascending: false })
      )
    );
    for (const { data } of results) {
      if (data) settingMeetings.push(...(data as SettingMeeting[]));
    }
  }

  return (
    <>
      <Header title="Rapports Marketing" />
      <div className="p-6 space-y-6">
        <MarketingReportsView
          weeklyStats={weeklyStats ?? []}
          expenses={expenses ?? []}
          leads={allLeads}
          providers={providers ?? []}
          wonDeals={wonDeals ?? []}
          settingActivities={settingActivities}
          settingMeetings={settingMeetings}
        />
      </div>
    </>
  );
}
