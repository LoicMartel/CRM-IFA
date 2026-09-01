import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getFiscalMode } from "@/lib/get-fiscal-mode";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const [supabase, fiscalMode] = await Promise.all([createClient(), getFiscalMode()]);

  const [
    { data: allDeals },
    { data: salesTargets },
    { data: trainingSessions },
    { data: servicePlans },
    { data: billingMonthsData },
    { data: monthlyChargesData },
  ] = await Promise.all([
    supabase.from("deals").select("*, team_members(first_name, last_name), contacts(first_name, last_name)"),
    supabase.from("sales_targets").select("*").order("month", { ascending: true }),
    supabase.from("training_sessions").select("*, service_plans(hourly_rate)").order("session_date", { ascending: true }),
    supabase.from("service_plans").select("id, budget, vt_planned, days_planned"),
    supabase.from("billing_months").select("id, amount, month, status"),
    supabase.from("monthly_charges").select("month, charges_ttc, encaisse_ttc, facture_ht, tresorerie"),
  ]);

  return (
    <>
      <Header title="Tableau de bord" />
      <DashboardContent
        deals={allDeals ?? []}
        salesTargets={salesTargets ?? []}
        trainingSessions={trainingSessions ?? []}
        servicePlans={servicePlans ?? []}
        billingMonths={billingMonthsData ?? []}
        monthlyCharges={monthlyChargesData ?? []}
        fiscalMode={fiscalMode}
      />
    </>
  );
}
