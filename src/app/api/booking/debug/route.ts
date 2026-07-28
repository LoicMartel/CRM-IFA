import { NextResponse } from "next/server";
import { getFreeBusy, getCalendarEvents } from "@/lib/google-calendar";

// Rafi's member ID for OAuth
const RAFI_MEMBER_ID = "93469203-fa59-4ffb-8877-7486a82addab";

const CALENDARS = [
  { name: "RA:Rdv commerciaux/suivi", id: "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com" },
  { name: "RA:F Visio", id: "rafi.mouhamad.nmfconsulting@gmail.com" },
  { name: "RA:Admin et Prépa", id: "lm5dnmkg9k8jpk2eeb009e2ev4@group.calendar.google.com" },
  { name: "RA:Team NMF Consulting", id: "qnat0fo43j8hn7369kld0vnv1c@group.calendar.google.com" },
  { name: "RA:Perso", id: "j2d3ldvcaj4c76lmefv6qjr0lk@group.calendar.google.com" },
  { name: "RA:Présentiel", id: "r4df33kl5s8mnk2sd0ipird7fg@group.calendar.google.com" },
  { name: "RA:Trajets", id: "eea3flj6iqn5stu896e2tubo4o@group.calendar.google.com" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "2026-04-07";

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();

  const results = [];
  for (const cal of CALENDARS) {
    const [fb, ev] = await Promise.all([
      getFreeBusy({ calendarId: cal.id, timeMin, timeMax, timeZone: "Europe/Paris", memberId: RAFI_MEMBER_ID }),
      getCalendarEvents({ calendarId: cal.id, timeMin, timeMax, timeZone: "Europe/Paris", memberId: RAFI_MEMBER_ID }),
    ]);
    results.push({
      name: cal.name,
      freeBusyCount: fb.busy.length,
      eventsCount: ev.events.length,
      events: ev.events.slice(0, 10),
      freeBusy: fb.busy.slice(0, 10),
      error: fb.error ?? ev.error ?? null,
    });
  }

  return NextResponse.json({ date, results });
}
