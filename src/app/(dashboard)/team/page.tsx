import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { TeamView } from "@/components/admin/team-view";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: activeMembers }, { data: inactiveMembers }, { data: oauthTokens }] = await Promise.all([
    supabase.from("team_members").select("*").eq("is_active", true).order("last_name"),
    supabase.from("team_members").select("*").eq("is_active", false).order("last_name"),
    supabase.from("oauth_tokens").select("team_member_id, provider, provider_email"),
  ]);

  return (
    <>
      <Header title="Équipe" />
      <div className="p-6">
        <TeamView members={(activeMembers ?? []) as any} inactiveMembers={(inactiveMembers ?? []) as any} oauthTokens={oauthTokens ?? []} />
      </div>
    </>
  );
}
