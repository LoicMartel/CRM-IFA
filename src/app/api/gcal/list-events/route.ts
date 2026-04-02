import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getAuth() {
  const b64 = process.env.GOOGLE_SA_KEY_B64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!b64 && !raw) return null;
  try {
    let parsed: any;
    if (b64) {
      const clean = b64.replace(/^["']|["']$/g, "").replace(/\s/g, "");
      parsed = JSON.parse(Buffer.from(clean, "base64").toString("utf-8"));
    }
    if (!parsed && raw) {
      try { parsed = JSON.parse(raw); } catch { parsed = JSON.parse(raw.replace(/\r?\n/g, "\\n")); }
    }
    if (!parsed) return null;
    return new google.auth.GoogleAuth({ credentials: parsed, scopes: ["https://www.googleapis.com/auth/calendar.readonly"] });
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 500 });

  const calendarId = req.nextUrl.searchParams.get("calendarId");
  const timeMin = req.nextUrl.searchParams.get("timeMin");
  const timeMax = req.nextUrl.searchParams.get("timeMax");

  if (!calendarId || !timeMin || !timeMax) {
    return NextResponse.json({ error: "calendarId, timeMin, timeMax required" }, { status: 400 });
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const events: any[] = [];
    let pageToken: string | undefined;

    do {
      const res = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        timeZone: "Europe/Paris",
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        pageToken,
      });
      events.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    const simplified = events.map(e => ({
      id: e.id,
      summary: e.summary ?? "",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      location: e.location ?? "",
    }));

    return NextResponse.json({ events: simplified, count: simplified.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
