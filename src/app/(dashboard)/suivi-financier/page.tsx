import { Header } from "@/components/layout/header";
import { SuiviFinancierView } from "@/components/finance/suivi-financier-view";
import { createClient } from "@/lib/supabase/server";

export default async function SuiviFinancierPage() {
  const supabase = await createClient();

  const [
    { data: salesTargets },
    { data: wonDeals },
    { data: invoices },
    { data: monthlyCharges },
  ] = await Promise.all([
    supabase.from("sales_targets").select("month, target_amount").order("month", { ascending: true }),
    supabase.from("deals").select("id, amount, close_date, created_at").eq("stage", "closed_won"),
    supabase.from("invoices").select("id, amount, month, status, deal_id"),
    supabase.from("monthly_charges").select("*"),
  ]);

  return (
    <>
      <Header title="Suivi Financier Mensuel" />
      <div className="p-6">
        <SuiviFinancierView
          salesTargets={(salesTargets ?? []) as any}
          wonDeals={(wonDeals ?? []) as any}
          invoices={(invoices ?? []) as any}
          monthlyCharges={(monthlyCharges ?? []) as any}
        />
      </div>
    </>
  );
}
