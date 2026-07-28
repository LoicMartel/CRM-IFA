import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { TeamView } from "@/components/admin/team-view";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: activeMembers }, { data: inactiveMembers }] = await Promise.all([
    supabase.from("team_members").select("*").eq("is_active", true).order("last_name"),
    supabase.from("team_members").select("*").eq("is_active", false).order("last_name"),
  ]);

  return (
    <>
      <Header title="Équipe" />
      <div className="p-6">
        <TeamView members={(activeMembers ?? []) as any} inactiveMembers={(inactiveMembers ?? []) as any} />
      </div>
    </>
  );
}
