import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/commercial/reports-view";

export const metadata = { title: "Rapports Commerciaux" };

export default async function ReportsPage() {
  const supabase = await createClient();

  const [
    { data: salesTargets },
    { data: orders },
    { data: deals },
    { data: contacts },
    { data: activities },
    { data: meetings },
    { data: companies },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("sales_targets").select("*").order("month", { ascending: true }),
    supabase.from("deals").select("*, team_members(first_name, last_name), lead_sources(name)").eq("stage", "closed_won").order("close_date", { ascending: false }),
    supabase.from("deals").select("*, team_members(first_name, last_name)"),
    supabase.from("contacts").select("*, companies!contacts_company_id_fkey(name), team_members!contacts_owner_id_fkey(first_name, last_name)").order("last_name"),
    supabase.from("activities").select("contact_id, type, created_at, team_member_id, team_members:team_member_id(first_name, last_name)").order("created_at", { ascending: false }),
    supabase.from("meetings").select("*, contacts!meetings_contact_id_fkey(id, first_name, last_name, email, phone, companies!contacts_company_id_fkey(id, name)), team_members!meetings_assigned_to_fkey(first_name, last_name)").order("scheduled_at", { ascending: false }),
    supabase.from("companies").select("*, team_members!companies_owner_id_fkey(first_name, last_name)").order("name"),
    supabase.from("activities").select("*, contacts:contact_id(id, first_name, last_name), companies:company_id(id, name), team_members:team_member_id(first_name, last_name)").eq("type", "tâche").order("due_date", { ascending: false }),
  ]);

  return (
    <>
      <Header title="Reports" />
      <ReportsView
        salesTargets={salesTargets ?? []}
        orders={orders ?? []}
        deals={deals ?? []}
        contacts={contacts ?? []}
        activities={activities ?? []}
        meetings={meetings ?? []}
        companies={companies ?? []}
        tasks={tasks ?? []}
      />
    </>
  );
}
