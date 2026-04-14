import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { OpportunitiesView } from "@/components/commercial/opportunities-view";

export const metadata = { title: "Opportunités & Pipe" };

export default async function OpportunitiesPage() {
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("deals")
    .select("*, contacts(first_name, last_name), companies(id, name), team_members(first_name, last_name)")
    .in("stage", ["opportunities", "quote_to_send", "quote_sent", "opco_deposit", "quote_signed"])
    .order("created_at", { ascending: false });

  return (
    <>
      <Header title="Opportunités & Pipe" />
      <div className="p-6">
        <OpportunitiesView deals={(deals ?? []) as any} />
      </div>
    </>
  );
}
