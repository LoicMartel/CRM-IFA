import { Header } from "@/components/layout/header";
import { RapportsFacturationView } from "@/components/finance/rapports-facturation-view";
import { createClient } from "@/lib/supabase/server";

export default async function RapportsFacturationPage() {
  const supabase = await createClient();

  const [
    { data: invoices },
    { data: wonDeals },
    { data: companies },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from("invoices").select("*, companies(id, name), deals(id, name, amount, owner_id, team_members(first_name, last_name))").order("month", { ascending: false }),
    supabase.from("deals").select("id, name, amount, company_id, owner_id, close_date, team_members(first_name, last_name), companies(id, name)").eq("stage", "closed_won"),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("team_members").select("id, first_name, last_name").eq("is_active", true),
  ]);

  return (
    <>
      <Header title="Rapports Facturation" />
      <div className="p-6">
        <RapportsFacturationView
          invoices={(invoices ?? []) as any}
          wonDeals={(wonDeals ?? []) as any}
          companies={(companies ?? []) as any}
          teamMembers={(teamMembers ?? []) as any}
        />
      </div>
    </>
  );
}
