import { google } from "googleapis";

let cachedAuth: any = null;

function getAuth() {
  if (cachedAuth) return cachedAuth;

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) return null;

  try {
    const parsed = JSON.parse(credentials);
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
