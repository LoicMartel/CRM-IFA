import { google } from "googleapis";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const b64 = process.env.GOOGLE_SA_KEY_B64?.trim();
let parsed;
if (b64) {
  const clean = b64.replace(/^["']|["']$/g, "").replace(/\s/g, "");
  parsed = JSON.parse(Buffer.from(clean, "base64").toString("utf-8"));
}
const auth = new google.auth.GoogleAuth({ credentials: parsed, scopes: ["https://www.googleapis.com/auth/calendar.readonly"] });
const calendar = google.calendar({ version: "v3", auth });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get ALL calendar events (not just VT) for the unmatched dates
const events = [];
let pageToken;
do {
  const res = await calendar.events.list({
    calendarId: "alexandre@closing-academie.com",
    timeMin: "2025-09-01T00:00:00+02:00",
    timeMax: "2026-07-01T23:59:59+02:00",
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
    pageToken,
  });
  for (const e of res.data.items ?? []) {
    if (!e.start?.dateTime) continue;
    events.push({
      summary: e.summary ?? "",
      date: e.start.dateTime.slice(0, 10),
      startTime: e.start.dateTime.slice(11, 16),
      endTime: e.end?.dateTime?.slice(11, 16) ?? "",
      startDT: e.start.dateTime,
      endDT: e.end?.dateTime ?? "",
    });
  }
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken);

// Unmatched dates with "no calendar match" or multiple matches
const unmatchedDates = [
  "2025-09-30", "2025-10-15", "2025-11-04", "2025-11-05", "2025-11-12",
  "2025-11-27", "2025-11-28", "2025-12-04", "2025-12-12", "2025-12-23",
  "2025-12-26", "2025-12-30", "2025-12-31", "2026-01-06", "2026-01-07",
  "2026-01-14", "2026-01-20", "2026-01-22", "2026-01-28", "2026-02-02",
  "2026-02-04", "2026-02-10", "2026-02-13", "2026-02-18", "2026-02-24",
  "2026-03-03", "2026-03-11", "2026-03-17", "2026-03-18", "2026-03-26",
  "2026-04-02", "2026-04-08", "2026-04-15", "2026-04-29", "2026-05-07",
  "2026-05-28", "2026-06-11", "2026-06-20",
];

console.log("=== ALL CALENDAR EVENTS ON UNMATCHED DATES ===\n");
for (const date of unmatchedDates) {
  const dayEvents = events.filter(e => e.date === date);
  const vtOnly = dayEvents.filter(e => {
    const s = e.summary.toLowerCase();
    return s.includes("vt") || s.includes("session");
  });
  if (vtOnly.length > 0) {
    console.log(`📅 ${date}:`);
    for (const e of vtOnly) {
      const durMin = (new Date(e.endDT) - new Date(e.startDT)) / 60000;
      console.log(`   ${e.startTime}-${e.endTime} (${(durMin/60).toFixed(2)}h) "${e.summary}"`);
    }
  }
}
