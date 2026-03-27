import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { TeamView } from "@/components/admin/team-view";

export default async function TeamPage() {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("team_members")
    .select("*")
    .order("last_name");

  return (
    <>
      <Header title="Équipe" />
      <div className="p-6">
        <TeamView members={(members ?? []) as any} />
      </div>
    </>
  );
}
