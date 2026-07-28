import { getValidToken } from "./oauth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Get a valid Microsoft access token for a team member.
 * Returns null if the member has no Microsoft OAuth connection.
 * (No service account fallback — Microsoft requires user OAuth.)
 */
async function getMsToken(memberId?: string | null): Promise<string | null> {
  if (!memberId) return null;
  try {
    return await getValidToken(memberId, "microsoft");
  } catch {
    return null;
  }
}

async function graphFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res;
}

// ---------------------------------------------------------------------------
// List calendars
// ---------------------------------------------------------------------------

export async function listOutlookCalendars(
  memberId: string,
): Promise<{ calendars: { id: string; name: string; isDefault: boolean; color: string }[]; error?: string }> {
  const token = await getMsToken(memberId);
  if (!token) return { calendars: [], error: "Microsoft not connected" };

  try {
    const res = await graphFetch(token, "/me/calendars?$select=id,name,isDefaultCalendar,hexColor&$top=50");
    if (!res.ok) {
      const text = await res.text();
      return { calendars: [], error: `Graph API ${res.status}: ${text}` };
    }
    const data = await res.json();
    return {
      calendars: (data.value ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        isDefault: c.isDefaultCalendar ?? false,
        color: c.hexColor ?? "",
      })),
    };
  } catch (err: any) {
    return { calendars: [], error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Get events
// ---------------------------------------------------------------------------

export async function getOutlookEvents({
  calendarId,
  timeMin,
  timeMax,
  memberId,
}: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  memberId: string;
}): Promise<{ events: { start: string; end: string; summary?: string }[]; error?: string }> {
  const token = await getMsToken(memberId);
  if (!token) return { events: [], error: "Microsoft not connected" };

  try {
    const filter = `start/dateTime ge '${timeMin}' and end/dateTime le '${timeMax}'`;
    const path = `/me/calendars/${calendarId}/events?$filter=${encodeURIComponent(filter)}&$select=subject,start,end&$top=250&$orderby=start/dateTime`;
    const res = await graphFetch(token, path);
    if (!res.ok) {
      const text = await res.text();
      return { events: [], error: `Graph API ${res.status}: ${text}` };
    }
    const data = await res.json();
    return {
      events: (data.value ?? []).map((e: any) => ({
        start: e.start?.dateTime ?? "",
        end: e.end?.dateTime ?? "",
        summary: e.subject ?? undefined,
      })),
    };
  } catch (err: any) {
    return { events: [], error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Create event
// ---------------------------------------------------------------------------

export async function createOutlookEvent({
  calendarId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  timeZone = "Europe/Paris",
  memberId,
}: {
  calendarId: string;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  memberId: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const token = await getMsToken(memberId);
  if (!token) return { success: false, error: "Microsoft not connected" };

  try {
    const body = {
      subject: summary,
      body: { contentType: "Text", content: description },
      start: { dateTime: startDateTime, timeZone },
      end: { dateTime: endDateTime, timeZone },
      location: location ? { displayName: location } : undefined,
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
    };

    const res = await graphFetch(token, `/me/calendars/${calendarId}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Graph API ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, eventId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Update event
// ---------------------------------------------------------------------------

export async function updateOutlookEvent({
  eventId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  timeZone = "Europe/Paris",
  memberId,
}: {
  eventId: string;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const token = await getMsToken(memberId);
  if (!token) return { success: false, error: "Microsoft not connected" };

  try {
    const body = {
      subject: summary,
      body: { contentType: "Text", content: description },
      start: { dateTime: startDateTime, timeZone },
      end: { dateTime: endDateTime, timeZone },
      location: location ? { displayName: location } : undefined,
    };

    const res = await graphFetch(token, `/me/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Graph API ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Upsert event (update if exists, create otherwise)
// ---------------------------------------------------------------------------

export async function upsertOutlookEvent({
  calendarId,
  existingEventId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  timeZone = "Europe/Paris",
  memberId,
}: {
  calendarId: string;
  existingEventId?: string | null;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  memberId: string;
}): Promise<{ success: boolean; eventId?: string; status: "created" | "updated" | "failed"; error?: string }> {
  if (existingEventId) {
    const upd = await updateOutlookEvent({
      eventId: existingEventId,
      summary, description, location, startDateTime, endDateTime, timeZone, memberId,
    });
    if (upd.success) return { success: true, eventId: existingEventId, status: "updated" };

    const errMsg = (upd.error ?? "").toLowerCase();
    const isMissing = errMsg.includes("not found") || errMsg.includes("404") || errMsg.includes("resourcenotfound");
    if (!isMissing) return { success: false, status: "failed", error: upd.error };
  }

  const created = await createOutlookEvent({
    calendarId, summary, description, location, startDateTime, endDateTime, timeZone, memberId,
  });
  if (created.success && created.eventId) return { success: true, eventId: created.eventId, status: "created" };
  return { success: false, status: "failed", error: created.error };
}

// ---------------------------------------------------------------------------
// Patch event subject only
// ---------------------------------------------------------------------------

export async function patchOutlookEventSubject({
  eventId,
  summary,
  memberId,
}: {
  eventId: string;
  summary: string;
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const token = await getMsToken(memberId);
  if (!token) return { success: false, error: "Microsoft not connected" };

  try {
    const res = await graphFetch(token, `/me/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ subject: summary }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Graph API ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Delete event
// ---------------------------------------------------------------------------

export async function deleteOutlookEvent({
  eventId,
  memberId,
}: {
  eventId: string;
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const token = await getMsToken(memberId);
  if (!token) return { success: false, error: "Microsoft not connected" };

  try {
    const res = await graphFetch(token, `/me/events/${eventId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      return { success: false, error: `Graph API ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
