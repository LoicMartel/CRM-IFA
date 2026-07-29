import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { SyntheseSalesContent } from "@/components/commercial/synthese-sales-content";

export const metadata = { title: "Synthèse Sales" };

export default async function SyntheseSalesPage() {
  const supabase = await createClient();

  // Rolling 12-month window: current month → +11 months
  const now = new Date();
  const rollingMonths: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    rollingMonths.push(d.toISOString().slice(0, 10)); // YYYY-MM-01
  }

  // Ensure all 12 months exist in sales_targets (upsert missing ones)
  const { data: existingTargets } = await supabase.from("sales_targets").select("month").in("month", rollingMonths);
  const existingMonths = new Set((existingTargets ?? []).map((t: any) => (t.month as string).slice(0, 10)));
  const missingMonths = rollingMonths.filter(m => !existingMonths.has(m));
  if (missingMonths.length > 0) {
    await supabase.from("sales_targets").insert(missingMonths.map(m => ({ month: m, target_amount: 0 })));
  }

  const [
    { data: salesTargets },
    { data: wonDeals },
    { data: pipeDeals },
  ] = await Promise.all([
    supabase.from("sales_targets").select("*").in("month", rollingMonths).order("month", { ascending: true }),
    supabase.from("deals").select("*, team_members(first_name, last_name), lead_sources(name)").eq("stage", "closed_won").order("close_date", { ascending: false }),
    supabase.from("deals").select("id, amount, stage").not("stage", "in", '("closed_won","closed_lost")'),
  ]);

  // Deduplicate targets by month (YYYY-MM)
  const targetsSeen = new Set<string>();
  const targets = (salesTargets ?? []).filter((t: any) => {
    const mKey = (t.month as string).slice(0, 7);
    if (targetsSeen.has(mKey)) return false;
    targetsSeen.add(mKey);
    return true;
  });

  return (
    <>
      <Header title="Synthèse Sales" />
      <SyntheseSalesContent
        targets={targets}
        orders={wonDeals ?? []}
        pipe={pipeDeals ?? []}
      />
    </>
  );
}
