import { Header } from "@/components/layout/header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function FinancesPage() {
  const supabase = await createClient();

  const [
    { data: wonDeals },
    { data: invoices },
    { data: trainingSessions },
    { data: monthlyCharges },
    { data: salesTargets },
  ] = await Promise.all([
    supabase.from("deals").select("id, amount, close_date, created_at").eq("stage", "closed_won"),
    supabase.from("invoices").select("id, amount, month, status, deal_id"),
    supabase.from("training_sessions").select("*, service_plans(hourly_rate)").eq("status", "done"),
    supabase.from("monthly_charges").select("*"),
    supabase.from("sales_targets").select("month, target_amount").order("month", { ascending: true }),
  ]);

  return (
    <>
      <Header title="Dashboard Financier" />
      <div className="p-6">
        <FinanceDashboard
          wonDeals={(wonDeals ?? []) as any}
          invoices={(invoices ?? []) as any}
          trainingSessions={(trainingSessions ?? []) as any}
          monthlyCharges={(monthlyCharges ?? []) as any}
          salesTargets={(salesTargets ?? []) as any}
        />
      </div>
    </>
  );
}
