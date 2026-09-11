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

  // Resolve result meetings onto their originals, then remove duplicates.
  // Prefer result_of_meeting_id link; fall back to heuristic for legacy data.
  const allMeetings = meetings ?? [];
  const resultIds = new Set<string>();

  // 1. Link via result_of_meeting_id (new data)
  const resultsByOriginalId = new Map<string, any>();
  for (const m of allMeetings) {
    if ((m as any).result_of_meeting_id) {
      resultsByOriginalId.set((m as any).result_of_meeting_id, m);
      resultIds.add(m.id as string);
    }
  }

  // 2. Heuristic fallback for legacy data without result_of_meeting_id
  const completedMeetings = allMeetings.filter((m: any) =>
    m.next_step === "completed" && m.status === "booked" && !resultsByOriginalId.has(m.id)
  );
  for (const cm of completedMeetings) {
    const result = allMeetings.find((m: any) =>
      m.id !== cm.id &&
      !resultIds.has(m.id) &&
      m.contact_id === cm.contact_id &&
      m.meeting_type === cm.meeting_type &&
      ["done", "cancelled", "no_show"].includes(m.status) &&
      new Date(m.created_at) >= new Date(cm.created_at)
    );
    if (result) {
      resultsByOriginalId.set(cm.id as string, result);
      resultIds.add(result.id as string);
    }
  }

  // 3. Project result status onto originals
  for (const [originalId, result] of resultsByOriginalId) {
    const original = allMeetings.find((m: any) => m.id === originalId);
    if (original) {
      (original as any).status = result.status;
      (original as any).outcome = result.outcome;
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
