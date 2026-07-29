import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCalendarEventsAllPages } from "@/lib/google-calendar";

// Extract time (HH:MM) from ISO datetime
function extractTime(isoStr: string): string | null {
  if (!isoStr || !isoStr.includes("T")) return null;
  const match = isoStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

// Normalize company name for matching
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST() {
  const supabase = await createClient();

  // Get all VT training sessions with session_time = 09:00 (default)
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, session_date, session_time, session_type, status, trainers, duration_hours, service_plans(company_id, companies(name))")
    .eq("session_type", "vt") // Only VT sessions (journées are always 9h)
    .in("session_time", ["09:00:00", "09:00", null])
    .in("status", ["planned", "done"])
    .order("session_date");

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ message: "No sessions to update", updated: 0 });
  }

  // Calendars to scan per trainer
  const trainerCalendars: Record<string, string[]> = {
    "Rafi": [
      "rafi.mouhamad.nmfconsulting@gmail.com",
      "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com",
    ],
    "Alexandre": [
      "alexandre@ifagroupe.com",
    ],
    "Loïc": [
      "b1d8e8cd626637bb6745ca2df63684a1f4ca9c6f1eef203c4cb97c7969dd8dc1@group.calendar.google.com",
    ],
  };

  // Lookup member IDs by first_name for OAuth
  const { data: members } = await supabase
    .from("team_members")
    .select("id, first_name")
    .in("first_name", Object.keys(trainerCalendars));

  const memberIdByName: Record<string, string> = {};
  for (const m of members ?? []) {
    memberIdByName[m.first_name] = m.id;
  }

  // Determine date range
  const dates = sessions.map(s => s.session_date).filter(Boolean) as string[];
  const minDate = dates.sort()[0];
  const maxDate = dates.sort().reverse()[0];
  const { getParisOffset } = await import("@/lib/timezone");
  const timeMin = minDate + "T00:00:00" + getParisOffset(minDate);
  const timeMax = maxDate + "T23:59:59" + getParisOffset(maxDate);

  // Fetch all calendar events for all trainers
  const allEvents: { trainer: string; summary: string; date: string; time: string; calendarId: string }[] = [];

  for (const [trainer, calIds] of Object.entries(trainerCalendars)) {
    for (const calId of calIds) {
      const { events } = await getCalendarEventsAllPages({
        calendarId: calId,
        timeMin,
        timeMax,
        timeZone: "Europe/Paris",
        memberId: memberIdByName[trainer] ?? null,
      });
      for (const e of events) {
        const startTime = extractTime(e.start ?? "");
        const startDate = (e.start ?? "").slice(0, 10);
        if (startTime && startDate) {
          allEvents.push({
            trainer,
            summary: e.summary ?? "",
            date: startDate,
            time: startTime,
            calendarId: calId,
          });
        }
      }
    }
  }

  // Match sessions with calendar events
  const updates: { sessionId: string; newTime: string; matchedEvent: string; companyName: string; date: string; status: string }[] = [];
  const noMatch: { sessionId: string; companyName: string; date: string; trainers: string[]; status: string }[] = [];

  for (const session of sessions) {
    const sp = session.service_plans as any;
    const companyName = sp?.companies?.name ?? "";
    const sessionTrainers = (session.trainers as string[]) ?? [];
    const sessionDate = session.session_date as string;

    if (!companyName || !sessionDate) continue;

    const normalizedCompany = normalize(companyName);
    // Find calendar events on the same date by the same trainer that mention the company
    const candidateEvents = allEvents.filter(e => {
      if (e.date !== sessionDate) return false;
      if (!sessionTrainers.includes(e.trainer)) return false;
      const normalizedSummary = normalize(e.summary);
      // Match: company name appears in event summary (partial match)
      const companyWords = normalizedCompany.split(" ").filter(w => w.length > 2);
      return companyWords.some(w => normalizedSummary.includes(w));
    });

    if (candidateEvents.length > 0) {
      // Pick the best match (prefer VT-like events, or the one closest to company name)
      const best = candidateEvents[0];
      if (best.time !== "09:00") {
        updates.push({
          sessionId: session.id,
          newTime: best.time,
          matchedEvent: best.summary,
          companyName,
          date: sessionDate,
          status: session.status as string,
        });
      }
    } else {
      noMatch.push({
        sessionId: session.id,
        companyName,
        date: sessionDate,
        trainers: sessionTrainers,
        status: session.status as string,
      });
    }
  }

  // Apply updates — prioritize planned sessions
  const plannedUpdates = updates.filter(u => u.status === "planned");
  const doneUpdates = updates.filter(u => u.status === "done");
  const allUpdates = [...plannedUpdates, ...doneUpdates];

  let updatedCount = 0;
  for (const u of allUpdates) {
    const { error } = await supabase
      .from("training_sessions")
      .update({ session_time: u.newTime + ":00" })
      .eq("id", u.sessionId);
    if (!error) updatedCount++;
  }

  return NextResponse.json({
    totalSessions: sessions.length,
    calendarEvents: allEvents.length,
    updated: updatedCount,
    updates: allUpdates.map(u => ({ date: u.date, company: u.companyName, oldTime: "09:00", newTime: u.newTime, event: u.matchedEvent, status: u.status })),
    noMatch: noMatch.length,
    noMatchDetails: noMatch.slice(0, 20),
  });
}
