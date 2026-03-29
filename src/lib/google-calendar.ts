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
}: {
  calendarId: string;
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const auth = getAuth();
  if (!auth) return { success: false, error: "Google Calendar not configured" };

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
      },
    });

    return { success: true, eventId: event.data.id ?? undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
