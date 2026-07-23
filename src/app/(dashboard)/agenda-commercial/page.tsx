import { Header } from "@/components/layout/header";
import { CommercialAgendaView } from "@/components/commercial/commercial-agenda-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Agenda Commercial" };

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

  // For meetings closed via report: the original (booked, next_step=completed) keeps the
  // correct date, and a result record (done/cancelled/no_show) is created with today's date.
  // Resolve the real outcome onto the original, then remove result duplicates.
  const allMeetings = meetings ?? [];
  const resultIds = new Set<string>();
  const completedMeetings = allMeetings.filter((m: any) => m.next_step === "completed" && m.status === "booked");
  for (const cm of completedMeetings) {
    const result = allMeetings.find((m: any) =>
      m.id !== cm.id &&
      m.contact_id === cm.contact_id &&
      m.meeting_type === cm.meeting_type &&
      ["done", "cancelled", "no_show"].includes(m.status) &&
      new Date(m.created_at) >= new Date(cm.created_at)
    );
    if (result) {
      (cm as any).status = result.status;
      (cm as any).outcome = result.outcome;
      resultIds.add(result.id as string);
    }
  }
  const cleanMeetings = allMeetings.filter((m: any) => !resultIds.has(m.id as string));

  return (
    <>
      <Header title="Agenda Commercial" />
      <div className="p-6">
        <CommercialAgendaView
          meetings={cleanMeetings as any}
          teamMembers={((teamMembers ?? []).filter((m: any) => ((m.roles as string[]) ?? []).includes("Account Manager"))) as any}
          tasks={(tasks ?? []) as any}
        />
      </div>
    </>
  );
}
