import { Header } from "@/components/layout/header";
import { MarketingExpensesView } from "@/components/marketing/marketing-expenses-view";
import { createClient } from "@/lib/supabase/server";

export default async function DepensesPage() {
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("marketing_expenses")
    .select("*, marketing_expense_documents(*)")
    .order("period_start", { ascending: false });

  return (
    <>
      <Header title="Dépenses Marketing" />
      <div className="p-6 space-y-6">
        <MarketingExpensesView expenses={expenses ?? []} />
      </div>
    </>
  );
}
