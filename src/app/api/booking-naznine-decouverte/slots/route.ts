import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google-calendar";
import { getParisOffset } from "@/lib/timezone";
import { isFrenchHoliday } from "@/lib/french-holidays";

const NAZNINE = {
  id: "9bcd91e5-0c11-44ba-9bc8-1de4bad9c040",
  name: "Naznine MOUHAMAD",
  calendarIds: [
    "nazninemouhamad@gmail.com",
    "te0dovkg65qhgpnk6jgq044ol0@group.calendar.google.com",
    "g3riosgeldlc8tka3554md01bo@group.calendar.google.com",
    "97bvpqcqfrd638kotnhgu41pv0@group.calendar.google.com",
  ],
};

const SLOT_DURATION = 15;
const DAY_START_HOUR = 8;
const DAY_START_MIN = 30;
const DAY_END_HOUR = 18;
const DAY_END_MIN = 30;
const TZ = "Europe/Paris";

function generateSlots(dateStr: string): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const startTotal = DAY_START_HOUR * 60 + DAY_START_MIN;
  const endTotal = DAY_END_HOUR * 60 + DAY_END_MIN;
  for (let t = startTotal; t + SLOT_DURATION <= endTotal; t += 30) {
    const sH = Math.floor(t / 60);
    const sM = t % 60;
    const eH = Math.floor((t + SLOT_DURATION) / 60);
    const eM = (t + SLOT_DURATION) % 60;
    const start = `${dateStr}T${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}:00`;
    const end = `${dateStr}T${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}:00`;
    slots.push({ start, end });
  }
  return slots;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
  }

  if (isFrenchHoliday(date)) {
    return NextResponse.json({ slots: [], assignedTo: NAZNINE.id, assignedName: NAZNINE.name });
  }

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();
  const allSlots = generateSlots(date);

  // Check ALL calendars for busy times
  const allBusy: { start: string; end: string }[] = [];
  const calendarErrors: string[] = [];
  for (const calId of NAZNINE.calendarIds) {
    const { events, error } = await getCalendarEvents({ calendarId: calId, timeMin, timeMax, timeZone: TZ });
    if (error) {
      calendarErrors.push(`${calId}: ${error}`);
    } else {
      allBusy.push(...events);
    }
  }

  const offset = getParisOffset(date);
  const BUFFER = 30 * 60 * 1000;
  const availableSlots = allSlots.filter((s) => {
    const slotStart = new Date(`${s.start}${offset}`);
    const slotEnd = new Date(`${s.end}${offset}`);
    return !allBusy.some((b) => {
      const bs = new Date(b.start).getTime() - BUFFER;
      const be = new Date(b.end).getTime() + BUFFER;
      return slotStart.getTime() < be && slotEnd.getTime() > bs;
    });
  });

  // Filter past slots if today
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: TZ });
  const filtered = date === todayStr
    ? availableSlots.filter((s) => new Date(`${s.start}${offset}`) > now)
    : availableSlots;

  return NextResponse.json({
    slots: filtered.map((s) => ({ start: s.start, end: s.end })),
    assignedTo: NAZNINE.id,
    assignedName: NAZNINE.name,
    _debug: { busyCount: allBusy.length, calendarErrors: calendarErrors.length > 0 ? calendarErrors : undefined },
  });
}
