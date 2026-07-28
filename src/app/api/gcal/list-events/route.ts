import { NextRequest, NextResponse } from "next/server";
import { getCalendarEventsAllPages } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const calendarId = req.nextUrl.searchParams.get("calendarId");
  const timeMin = req.nextUrl.searchParams.get("timeMin");
  const timeMax = req.nextUrl.searchParams.get("timeMax");
  const memberId = req.nextUrl.searchParams.get("memberId");

  if (!calendarId || !timeMin || !timeMax) {
    return NextResponse.json({ error: "calendarId, timeMin, timeMax required" }, { status: 400 });
  }

  const { events, error } = await getCalendarEventsAllPages({
    calendarId,
    timeMin,
    timeMax,
    timeZone: "Europe/Paris",
    memberId,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const simplified = events.map(e => ({
    summary: e.summary ?? "",
    start: e.start,
    end: e.end,
  }));

  return NextResponse.json({ events: simplified, count: simplified.length });
}
