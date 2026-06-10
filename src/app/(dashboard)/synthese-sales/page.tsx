import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { SyntheseSalesContent } from "@/components/commercial/synthese-sales-content";

export const metadata = { title: "Synth\u00e8se Sales" };

export default async function SyntheseSalesPage() {
  const supabase = await createClient();

  const [
    { data: salesTargets },
    { data: wonDeals },
    { data: pipeDeals },
  ] = await Promise.all([
    supabase.from("sales_targets").select("*").order("month", { ascending: true }),
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
      <Header title="Synth\u00e8se Sales" />
      <SyntheseSalesContent
        targets={targets}
        orders={wonDeals ?? []}
        pipe={pipeDeals ?? []}
      />
    </>
  );
}
