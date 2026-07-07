import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { DealsBoard } from "@/components/commercial/deals-board";

export const metadata = { title: "Pipeline" };

export default async function DealsPage() {
  const supabase = await createClient();

  const [
    { data: deals },
    { data: teamMembers },
    { data: companies },
    { data: contacts },
    { data: sources },
  ] = await Promise.all([
    supabase.from("deals").select("*, contacts(first_name, last_name), companies(name), team_members(first_name, last_name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("team_members").select("id, first_name, last_name, roles").eq("is_active", true),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("contacts").select("id, first_name, last_name, company_id").order("last_name").range(0, 4999),
    supabase.from("lead_sources").select("id, name"),
  ]);

  return (
    <>
      <Header title="Pipeline Commercial" />
      <DealsBoard
        deals={deals ?? []}
        teamMembers={(teamMembers ?? []).filter((m: any) => ((m.roles as string[]) ?? []).includes("Account Manager"))}
        companies={companies ?? []}
        contacts={contacts ?? []}
        sources={sources ?? []}
      />
    </>
  );
}
