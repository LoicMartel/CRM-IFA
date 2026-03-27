import { Header } from "@/components/layout/header";
import { CommercialAgendaView } from "@/components/commercial/commercial-agenda-view";
import { createClient } from "@/lib/supabase/server";

export default async function CommercialAgendaPage() {
  const supabase = await createClient();

  const [
    { data: meetings },
    { data: teamMembers },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*, contacts(id, first_name, last_name), companies(id, name), team_members(id, first_name, last_name)")
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("team_members")
      .select("id, first_name, last_name, roles")
      .eq("is_active", true)
      .order("first_name"),
    supabase
      .from("activities")
      .select("*, contacts:contact_id(id, first_name, last_name), companies:company_id(id, name)")
      .eq("type", "tâche")
      .order("due_date", { ascending: true }),
  ]);

  return (
    <>
      <Header title="Agenda Commercial" />
      <div className="p-6">
        <CommercialAgendaView
          meetings={(meetings ?? []) as any}
          teamMembers={((teamMembers ?? []).filter((m: any) => ((m.roles as string[]) ?? []).includes("Account Manager"))) as any}
          tasks={(tasks ?? []) as any}
        />
      </div>
    </>
  );
}
