import { createClient } from "@supabase/supabase-js";
import { upsertOutlookEvent, deleteOutlookEvent, patchOutlookEventSubject } from "./microsoft-calendar";

const supabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Get the Outlook calendar ID for a given event type from integration_config.
 */
async function getOutlookCalId(
  memberId: string,
  type: "commercial" | "formation" | "presentiel" | "tasks",
): Promise<string | null> {
  const { data } = await supabase()
    .from("team_members")
    .select("integration_config")
    .eq("id", memberId)
    .single();
  if (!data) return null;
  const cfg = (data.integration_config as Record<string, string>) ?? {};
  return cfg[`outlook_cal_${type}`] ?? null;
}

/**
 * Sync a calendar event to Outlook if the member has an Outlook calendar configured.
 * Returns the Outlook event ID (for storage), or null if not applicable.
 */
export async function syncOutlookEvent({
  memberId,
  calType,
  existingEventId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
}: {
  memberId: string;
  calType: "commercial" | "formation" | "presentiel" | "tasks";
  existingEventId?: string | null;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
}): Promise<{ eventId?: string; status: string } | null> {
  const calId = await getOutlookCalId(memberId, calType);
  if (!calId) return null;

  const result = await upsertOutlookEvent({
    calendarId: calId,
    existingEventId,
    summary,
    description,
    location,
    startDateTime,
    endDateTime,
    memberId,
  });

  return {
    eventId: result.eventId,
    status: result.success ? result.status : (result.error ?? "failed"),
  };
}

/**
 * Patch the subject of an Outlook event (e.g. for cancellation).
 */
export async function patchOutlookSubject({
  memberId,
  eventId,
  summary,
}: {
  memberId: string;
  eventId: string;
  summary: string;
}): Promise<{ success: boolean; error?: string }> {
  return patchOutlookEventSubject({ eventId, summary, memberId });
}

/**
 * Delete an Outlook event.
 */
export async function removeOutlookEvent({
  memberId,
  eventId,
}: {
  memberId: string;
  eventId: string;
}): Promise<{ success: boolean; error?: string }> {
  return deleteOutlookEvent({ eventId, memberId });
}
