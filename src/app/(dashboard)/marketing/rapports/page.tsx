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
    supabase.from("contacts").select("id, lead_status, source_id, created_at, lead_sources!contacts_source_id_fkey(name)").order("created_at", { ascending: false }),
    supabase.from("marketing_providers").select("*").order("name"),
    supabase.from("deals").select("id, stage, amount, close_date, source_id, created_at, lead_sources(name), contacts!deals_contact_id_fkey(source_id, lead_sources!contacts_source_id_fkey(name))").in("stage", ["closed_won", "quote_signed"]),
  ]);

  return (
    <>
      <Header title="Rapports Marketing" />
      <div className="p-6 space-y-6">
        <MarketingReportsView
          weeklyStats={weeklyStats ?? []}
          expenses={expenses ?? []}
          leads={contacts ?? []}
          providers={providers ?? []}
          wonDeals={wonDeals ?? []}
        />
      </div>
    </>
  );
}
