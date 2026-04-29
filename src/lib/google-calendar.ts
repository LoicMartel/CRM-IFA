import { google } from "googleapis";

let cachedAuth: any = null;

function getAuth() {
  if (cachedAuth) return cachedAuth;

  // Try GOOGLE_SA_KEY_B64 (base64-encoded, Vercel-safe) first, then fallback to GOOGLE_SERVICE_ACCOUNT_KEY
  const b64 = process.env.GOOGLE_SA_KEY_B64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!b64 && !raw) return null;

  try {
    let parsed: any;

    // Strategy 1: base64-encoded key (Vercel production)
    if (b64) {
      const clean = b64.replace(/^["']|["']$/g, "").replace(/\s/g, "");
      const decoded = Buffer.from(clean, "base64").toString("utf-8");
      parsed = JSON.parse(decoded);
    }

    // Strategy 2: direct JSON (local dev with .env.local)
    if (!parsed && raw) {
      try { parsed = JSON.parse(raw); } catch {
        parsed = JSON.parse(raw.replace(/\r?\n/g, "\\n"));
      }
    }

    if (!parsed) return null;
    const auth = new google.auth.GoogleAuth({
      credentials: parsed,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    cachedAuth = auth;
    return auth;
  } catch {
    return null;
  }
}

/**
 * Get all events from a calendar (not just "busy" ones).
 * Unlike FreeBusy, this catches events marked as "available/free".
 */
export async function getCalendarEvents({
  calendarId,
  timeMin,
  timeMax,
  timeZone = "Europe/Paris",
}: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}): Promise<{ events: { start: string; end: string }[]; error?: string }> {
  const auth = getAuth();
  if (!auth) return { events: [], error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      timeZone,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events: { start: string; end: string }[] = [];
    for (const e of res.data.items ?? []) {
      if (e.start?.dateTime && e.end?.dateTime) {
        // Timed event
        events.push({ start: e.start.dateTime, end: e.end.dateTime });
      } else if (e.start?.date) {
        // All-day event → block entire day(s) using ISO format with Z
        // end date in Google is exclusive (next day), so we use it directly
        const startDate = e.start.date;
        const endDate = e.end?.date ?? e.start.date;
        events.push({
          start: `${startDate}T00:00:00+00:00`,
          end: `${endDate}T23:59:59+00:00`,
        });
      }
    }

    return { events };
  } catch (err: any) {
    return { events: [], error: err.message };
  }
}

/**
 * Get all events from a calendar with pagination (for long date ranges).
 */
export async function getCalendarEventsAllPages({
  calendarId,
  timeMin,
  timeMax,
  timeZone = "Europe/Paris",
}: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}): Promise<{ events: { start: string; end: string; summary?: string }[]; error?: string }> {
  const auth = getAuth();
  if (!auth) return { events: [], error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const events: { start: string; end: string; summary?: string }[] = [];
    let pageToken: string | undefined;

    do {
      const res = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        timeZone,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        pageToken,
      });

      for (const e of res.data.items ?? []) {
        if (e.start?.dateTime && e.end?.dateTime) {
          events.push({ start: e.start.dateTime, end: e.end.dateTime, summary: e.summary ?? undefined });
        } else if (e.start?.date) {
          const startDate = e.start.date;
          const endDate = e.end?.date ?? e.start.date;
          events.push({
            start: `${startDate}T00:00:00+00:00`,
            end: `${endDate}T23:59:59+00:00`,
            summary: e.summary ?? undefined,
          });
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { events };
  } catch (err: any) {
    return { events: [], error: err.message };
  }
}

export async function getFreeBusy({
  calendarId,
  timeMin,
  timeMax,
  timeZone = "Europe/Paris",
}: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}): Promise<{ busy: { start: string; end: string }[]; error?: string }> {
  const auth = getAuth();
  if (!auth) return { busy: [], error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone,
        items: [{ id: calendarId }],
      },
    });

    const busySlots = res.data.calendars?.[calendarId]?.busy ?? [];
    return {
      busy: busySlots.map((b) => ({
        start: b.start ?? "",
        end: b.end ?? "",
      })),
    };
  } catch (err: any) {
    return { busy: [], error: err.message };
  }
}

export async function createCalendarEvent({
  calendarId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  timeZone = "Europe/Paris",
  attendees = [],
}: {
  calendarId: string;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: { email: string; displayName?: string }[];
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const auth = getAuth();
  if (!auth) return { success: false, error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const event = await calendar.events.insert({
      calendarId,
      sendUpdates: attendees.length > 0 ? "all" : "none",
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        attendees: attendees.length > 0 ? attendees : undefined,
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
      },
    });

    return { success: true, eventId: event.data.id ?? undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateCalendarEvent({
  calendarId,
  eventId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  timeZone = "Europe/Paris",
}: {
  calendarId: string;
  eventId: string;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = getAuth();
  if (!auth) return { success: false, error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Upsert : tente de mettre à jour un évènement existant ; si l'évènement
 * est introuvable sur l'agenda cible (trainer changé, évènement supprimé
 * manuellement, agenda différent de l'origine…), crée un nouvel évènement.
 *
 * Retourne toujours l'ID final de l'évènement (à stocker en base) pour que
 * les prochains updates visent le bon évènement.
 */
export async function upsertCalendarEvent({
  calendarId,
  existingEventId,
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  timeZone = "Europe/Paris",
  attendees = [],
}: {
  calendarId: string;
  existingEventId?: string | null;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: { email: string; displayName?: string }[];
}): Promise<{ success: boolean; eventId?: string; status: "created" | "updated" | "failed"; error?: string }> {
  // 1. Tentative d'update si on a un ID existant
  if (existingEventId) {
    const upd = await updateCalendarEvent({
      calendarId,
      eventId: existingEventId,
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      timeZone,
    });
    if (upd.success) {
      return { success: true, eventId: existingEventId, status: "updated" };
    }
    // Si l'erreur n'est PAS un "not found", on ne tente pas de créer.
    const errMsg = (upd.error ?? "").toLowerCase();
    const isMissing =
      errMsg.includes("not found") ||
      errMsg.includes("notfound") ||
      errMsg.includes("404") ||
      errMsg.includes("deleted") ||
      errMsg.includes("resource") ||
      errMsg.includes("gone");
    if (!isMissing) {
      return { success: false, status: "failed", error: upd.error };
    }
    // Sinon : l'évènement n'existe plus sur cet agenda → on enchaîne sur create.
  }

  // 2. Création
  const created = await createCalendarEvent({
    calendarId,
    summary,
    description,
    location,
    startDateTime,
    endDateTime,
    timeZone,
    attendees,
  });
  if (created.success && created.eventId) {
    return { success: true, eventId: created.eventId, status: "created" };
  }
  return { success: false, status: "failed", error: created.error };
}

export async function patchCalendarEventSummary({
  calendarId,
  eventId,
  summary,
}: {
  calendarId: string;
  eventId: string;
  summary: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = getAuth();
  if (!auth) return { success: false, error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: { summary },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCalendarEvent({
  calendarId,
  eventId,
}: {
  calendarId: string;
  eventId: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = getAuth();
  if (!auth) return { success: false, error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId, eventId });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
