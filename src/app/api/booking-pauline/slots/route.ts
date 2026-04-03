import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google-calendar";
import { getParisOffset } from "@/lib/timezone";

const PAULINE = {
  id: "55e425cb-5041-4ea4-92c3-ce2f1dbce6a0",
  name: "Pauline BECQUERELLE",
  calendarIds: [
    "pauline.becquerelle@gmail.com",
    "d5338ed9e648d81ad3ef5fcbea38b7a91df6992ba69628c1946410039833d4a5@group.calendar.google.com",
    "12cd9085ed10a2ad840d9e6d02ef8f040de488342e66cffe57a0f2130713b026@group.calendar.google.com",
    "cba1425b9af40c252017aae0d83ec52e93494fc4cb1e1807208bb931e5270d93@group.calendar.google.com",
  ],
  // RDV commerciaux créés sur l'agenda "Closing Académie"
  bookingCalendarId: "d5338ed9e648d81ad3ef5fcbea38b7a91df6992ba69628c1946410039833d4a5@group.calendar.google.com",
};

const SLOT_DURATION = 30;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;
const TZ = "Europe/Paris";

function generateSlots(dateStr: string): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (const m of [0, 30]) {
      if (h === DAY_END_HOUR - 1 && m > 0) continue;
      const start = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const endH = m + SLOT_DURATION >= 60 ? h + 1 : h;
      const endM = (m + SLOT_DURATION) % 60;
      const end = `${dateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
      slots.push({ start, end });
    }
  }
  return slots;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
  }

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();
  const allSlots = generateSlots(date);

  // Check ALL calendars for busy times
  const allBusy: { start: string; end: string }[] = [];
  for (const calId of PAULINE.calendarIds) {
    const { events, error } = await getCalendarEvents({ calendarId: calId, timeMin, timeMax, timeZone: TZ });
    if (!error) allBusy.push(...events);
  }

  const offset = getParisOffset(date);
  const availableSlots = allSlots.filter((s) => {
    const slotStart = new Date(`${s.start}${offset}`);
    const slotEnd = new Date(`${s.end}${offset}`);
    return !allBusy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
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
    assignedTo: PAULINE.id,
    assignedName: PAULINE.name,
  });
}
