import { Header } from "@/components/layout/header";
import { SuiviFinancierView } from "@/components/finance/suivi-financier-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Suivi Financier" };

export default async function SuiviFinancierPage() {
  const supabase = await createClient();

  const [
    { data: salesTargets },
    { data: wonDeals },
    { data: billingMonths },
    { data: monthlyCharges },
  ] = await Promise.all([
    supabase.from("sales_targets").select("month, target_amount").order("month", { ascending: true }),
    supabase.from("deals").select("id, amount, close_date, created_at").eq("stage", "closed_won"),
    supabase.from("billing_months").select("id, amount, month, status"),
    supabase.from("monthly_charges").select("*"),
  ]);

  return (
    <>
      <Header title="Suivi Financier Mensuel" />
      <div className="p-6">
        <SuiviFinancierView
          salesTargets={(salesTargets ?? []) as any}
          wonDeals={(wonDeals ?? []) as any}
          billingMonths={(billingMonths ?? []) as any}
          monthlyCharges={(monthlyCharges ?? []) as any}
        />
      </div>
    </>
  );
}
