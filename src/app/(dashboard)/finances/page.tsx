import { Header } from "@/components/layout/header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getFiscalMode } from "@/lib/get-fiscal-mode";

export const metadata = { title: "Dashboard Financier" };

export default async function FinancesPage() {
  const [supabase, fiscalMode] = await Promise.all([createClient(), getFiscalMode()]);

  const [
    { data: wonDeals },
    { data: billingMonths },
    { data: trainingSessions },
    { data: monthlyCharges },
    { data: salesTargets },
    { data: monthlyFinances },
    { data: deliverySessions },
  ] = await Promise.all([
    supabase.from("deals").select("id, amount, close_date, created_at").eq("stage", "closed_won"),
    supabase.from("billing_months").select("id, amount, month, status"),
    supabase.from("training_sessions").select("*, service_plans(hourly_rate)").in("status", ["done", "no_show"]),
    supabase.from("monthly_charges").select("*"),
    supabase.from("sales_targets").select("month, target_amount").order("month", { ascending: true }),
    supabase.from("monthly_finances").select("month, client_receivables"),
    supabase.from("sessions").select("session_date, billable_amount, non_billable_amount, is_billable, hours_delivered").not("company_id", "is", null),
  ]);

  return (
    <>
      <Header title="Dashboard Financier" />
      <div className="p-6">
        <FinanceDashboard
          wonDeals={(wonDeals ?? []) as any}
          billingMonths={(billingMonths ?? []) as any}
          trainingSessions={(trainingSessions ?? []) as any}
          monthlyCharges={(monthlyCharges ?? []) as any}
          salesTargets={(salesTargets ?? []) as any}
          monthlyFinances={(monthlyFinances ?? []) as any}
          deliverySessions={(deliverySessions ?? []) as any}
          fiscalMode={fiscalMode}
        />
      </div>
    </>
  );
}
