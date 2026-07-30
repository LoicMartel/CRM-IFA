import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { SyntheseSalesContent } from "@/components/commercial/synthese-sales-content";
import { getFiscalMode } from "@/lib/get-fiscal-mode";
import { getFiscalMonths, getFiscalRange } from "@/lib/fiscal-year";

export const metadata = { title: "Synthèse Sales" };

export default async function SyntheseSalesPage() {
  const [supabase, fiscalMode] = await Promise.all([createClient(), getFiscalMode()]);
  const fiscalMonths = getFiscalMonths(fiscalMode);
  const { start, end } = getFiscalRange(fiscalMode);

  // Ensure all fiscal months exist in sales_targets
  const { data: existingTargets } = await supabase.from("sales_targets").select("month").in("month", fiscalMonths);
  const existingMonths = new Set((existingTargets ?? []).map((t: any) => (t.month as string).slice(0, 10)));
  const missingMonths = fiscalMonths.filter(m => !existingMonths.has(m));
  if (missingMonths.length > 0) {
    await supabase.from("sales_targets").insert(missingMonths.map(m => ({ month: m, target_amount: 0 })));
  }

  // Get current user info
  const { data: { user } } = await supabase.auth.getUser();
  let currentMemberId: string | null = null;
  let currentMemberRoles: string[] = [];
  if (user) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id, roles")
      .eq("auth_user_id", user.id)
      .single();
    if (member) {
      currentMemberId = member.id;
      currentMemberRoles = (member.roles as string[]) ?? [];
    } else if (user.email) {
      const { data: byEmail } = await supabase
        .from("team_members")
        .select("id, roles")
        .eq("email", user.email)
        .single();
      if (byEmail) {
        currentMemberId = byEmail.id;
        currentMemberRoles = (byEmail.roles as string[]) ?? [];
      }
    }
  }

  const isAdmin = currentMemberRoles.includes("Admin") || currentMemberRoles.includes("Dirigeant");
  const isAccountManager = currentMemberRoles.includes("Account Manager");

  const [
    { data: salesTargets },
    { data: wonDeals },
    { data: pipeDeals },
    { data: userTargets },
    { data: accountManagers },
  ] = await Promise.all([
    supabase.from("sales_targets").select("*").in("month", fiscalMonths).order("month", { ascending: true }),
    supabase.from("deals").select("*, team_members(first_name, last_name), lead_sources(name)").eq("stage", "closed_won").gte("close_date", start).lte("close_date", end).order("close_date", { ascending: false }),
    supabase.from("deals").select("id, amount, stage, owner_id").not("stage", "in", '("closed_won","closed_lost")'),
    supabase.from("user_sales_targets").select("id, team_member_id, month, target_amount").in("month", fiscalMonths),
    isAdmin
      ? supabase.from("team_members").select("id, first_name, last_name").contains("roles", ["Account Manager"]).eq("is_active", true).order("first_name")
      : Promise.resolve({ data: [] }),
  ]);

  // Deduplicate targets by month and sort by fiscal order
  const targetsSeen = new Set<string>();
  const targets = (salesTargets ?? []).filter((t: any) => {
    const mKey = (t.month as string).slice(0, 7);
    if (targetsSeen.has(mKey)) return false;
    targetsSeen.add(mKey);
    return true;
  }).sort((a: any, b: any) => fiscalMonths.indexOf(a.month.slice(0, 10)) - fiscalMonths.indexOf(b.month.slice(0, 10)));

  return (
    <>
      <Header title="Synthèse Sales" />
      <SyntheseSalesContent
        targets={targets}
        orders={wonDeals ?? []}
        pipe={pipeDeals ?? []}
        fiscalMode={fiscalMode}
        currentMemberId={currentMemberId}
        isAdmin={isAdmin}
        isAccountManager={isAccountManager}
        userTargets={(userTargets ?? []) as any}
        accountManagers={(accountManagers ?? []) as any}
      />
    </>
  );
}
