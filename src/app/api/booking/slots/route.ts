import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google-calendar";
import { getParisOffset } from "@/lib/timezone";
import { isFrenchHoliday } from "@/lib/french-holidays";

// Rafi is priority; Naznine is fallback
const MEMBERS = [
  {
    id: "93469203-fa59-4ffb-8877-7486a82addab",
    name: "Rafi MOUHAMAD",
    calendarIds: [
      "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com", // RA:Rdv commerciaux/suivi
      "rafi.mouhamad.nmfconsulting@gmail.com",                  // RA:F Visio
      "lm5dnmkg9k8jpk2eeb009e2ev4@group.calendar.google.com", // RA:Admin et prépa
      "qnat0fo43j8hn7369kld0vnv1c@group.calendar.google.com", // RA:Team NMF Consulting
      "j2d3ldvcaj4c76lmefv6qjr0lk@group.calendar.google.com", // RA:Perso
      "r4df33kl5s8mnk2sd0ipird7fg@group.calendar.google.com", // RA:F Présentiel (blocks entire day)
      "eea3flj6iqn5stu896e2tubo4o@group.calendar.google.com", // RA:Trajets
    ],
    bookingCalendarId: "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com", // where to create events
  },
  {
    id: "9bcd91e5-0c11-44ba-9bc8-1de4bad9c040",
    name: "Naznine MOUHAMAD",
    calendarIds: [
      "naznine@closing-academie.com", // will be updated with proper calendar ID
    ],
    bookingCalendarId: "naznine@closing-academie.com",
  },
];

const SLOT_DURATION = 30; // minutes
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20; // last slot can start at 19:30
const TZ = "Europe/Paris";

function generateSlots(dateStr: string): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (const m of [0, 30]) {
      if (h === DAY_END_HOUR - 1 && m > 30) continue; // last slot 19:30
      const start = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const endH = m + SLOT_DURATION >= 60 ? h + 1 : h;
      const endM = (m + SLOT_DURATION) % 60;
      const end = `${dateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
      slots.push({ start, end });
    }
  }
  return slots;
}

function isOverlapping(
  slotStart: string,
  slotEnd: string,
  busyPeriods: { start: string; end: string }[]
): boolean {
  const ss = new Date(slotStart).getTime();
  const se = new Date(slotEnd).getTime();
  return busyPeriods.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return ss < be && se > bs;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
  }

  if (isFrenchHoliday(date)) {
    return NextResponse.json({ slots: [], assignedTo: null, assignedName: null });
  }

  // Use ISO format with timezone name — Google API handles the conversion
  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();

  const allSlots = generateSlots(date);

  const PRESENTIEL_CALENDAR_ID = "r4df33kl5s8mnk2sd0ipird7fg@group.calendar.google.com";

  // Try Rafi first, then Naznine
  for (const member of MEMBERS) {
    // Fetch busy times from ALL calendars of this member (skip inaccessible ones)
    const allBusy: { start: string; end: string }[] = [];
    let accessibleCount = 0;
    let hasPresentielEvent = false;

    for (const calId of member.calendarIds) {
      const { events, error } = await getCalendarEvents({
        calendarId: calId,
        timeMin,
        timeMax,
        timeZone: TZ,
      });
      if (!error) {
        accessibleCount++;
        // If any event exists on the Présentiel calendar, block the entire day
        if (calId === PRESENTIEL_CALENDAR_ID && events.length > 0) {
          hasPresentielEvent = true;
        }
        allBusy.push(...events);
      }
    }

    // Skip this member entirely if they have a présentiel event that day
    if (hasPresentielEvent) continue;

    // If no calendar is accessible, still show all slots (calendar not yet linked)
    // This allows Naznine to serve as fallback even before her calendar is configured

    const offset = getParisOffset(date);
    const BUFFER = 15 * 60 * 1000; // 15 min buffer before and after each event
    const availableSlots = allSlots.filter((s) => {
      const slotStart = new Date(`${s.start}${offset}`);
      const slotEnd = new Date(`${s.end}${offset}`);
      return !allBusy.some((b) => {
        const bs = new Date(b.start).getTime() - BUFFER;
        const be = new Date(b.end).getTime() + BUFFER;
        return slotStart.getTime() < be && slotEnd.getTime() > bs;
      });
    });

    // Filter out past slots if date is today
    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
    const filtered = date === todayStr
      ? availableSlots.filter((s) => {
          const slotTime = new Date(`${s.start}${offset}`);
          return slotTime > now;
        })
      : availableSlots;

    if (filtered.length > 0) {
      return NextResponse.json({
        slots: filtered.map((s) => ({
          start: s.start,
          end: s.end,
        })),
        assignedTo: member.id,
        assignedName: member.name,
      });
    }
  }

  // No slots available with either member
  return NextResponse.json({ slots: [], assignedTo: null, assignedName: null });
}
