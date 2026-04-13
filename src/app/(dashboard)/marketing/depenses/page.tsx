import { Header } from "@/components/layout/header";
import { MarketingExpensesView } from "@/components/marketing/marketing-expenses-view";
import { createClient } from "@/lib/supabase/server";

export default async function DepensesPage() {
  const supabase = await createClient();

  const [{ data: expenses }, { data: weeklyStats }, { data: wonDeals }, { data: leads }] = await Promise.all([
    supabase
      .from("marketing_expenses")
      .select("*, marketing_expense_documents(*)")
      .order("period_start", { ascending: false }),
    supabase
      .from("marketing_weekly_stats")
      .select("*, marketing_providers(name)")
      .order("period_start", { ascending: false }),
    supabase
      .from("deals")
      .select("id, amount, close_date, created_at, source_id, lead_sources(name), contacts!deals_contact_id_fkey(source_id, lead_sources!contacts_source_id_fkey(name))")
      .in("stage", ["closed_won", "quote_signed"]),
    supabase
      .from("contacts")
      .select("id, created_at, source_id, lead_sources!contacts_source_id_fkey(name)")
      .not("source_id", "is", null),
  ]);

  return (
    <>
      <Header title="Dépenses Marketing" />
      <div className="p-6 space-y-6">
        <MarketingExpensesView expenses={expenses ?? []} tunnelStats={weeklyStats ?? []} wonDeals={wonDeals ?? []} leads={leads ?? []} />
      </div>
    </>
  );
}
