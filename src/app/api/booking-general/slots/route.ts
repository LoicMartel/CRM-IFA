import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google-calendar";
import { getParisOffset } from "@/lib/timezone";
import { isFrenchHoliday } from "@/lib/french-holidays";

// Priorité : Alexandre en premier, Loïc ensuite, Rafi en dernier recours
const TEAM = [
  {
    id: "dd7e0013-3f99-4a18-9f9c-609264ca0a52",
    firstName: "Alexandre",
    name: "Alexandre MANDEREAU",
    photo: "/photo-alexandre.jpeg",
    calendarIds: ["alexandre@closing-academie.com"],
  },
  {
    id: "b52b6563-1991-46e8-b718-0c16c641b21a",
    firstName: "Loïc",
    name: "Loïc MARTEL",
    photo: "/photo-loic.jpeg",
    calendarIds: [
      "loic@closing-academie.com",                                                              // Principal
      "5bd3cd57ce9939882f7db28b02bde52d2b4df03a0d1e857915e5ee8cf0b02ae2@group.calendar.google.com", // Admin
      "9277b4288fcbd2196a510de4772e430281e76afe5ee51eed82138455ae568a41@group.calendar.google.com", // Déjeuner
      "bbe2caa62aed64819928102ede03fa32096f7768c33a165a52c8306c18de59d2@group.calendar.google.com", // Fin de journée
      "b1d8e8cd626637bb6745ca2df63684a1f4ca9c6f1eef203c4cb97c7969dd8dc1@group.calendar.google.com", // Formation
      "3be8a67f38c6afb3e01313638c055a5e9b3bb2683feb93239922428a1351458d@group.calendar.google.com", // Point suivi
      "015d4f05da341be08adf23f8569d36a3d776441e1a66e8fb66cb397361730782@group.calendar.google.com", // Prépa Formation
      "cb8123ba95b1fc12828dc74674e1181aa9969740f7354d4035cb49b86b07f5a3@group.calendar.google.com", // Réunion interne
      "fe630945e4e8caab461781f5535f21e858a810697308243c59197c3d1e1bef6c@group.calendar.google.com", // Trajets
      "441346db26f434ea94f9ac0677b0e0d7a94cf478ccb2d1f1768b2115dad51754@group.calendar.google.com", // Personnel
    ],
  },
  {
    id: "93469203-fa59-4ffb-8877-7486a82addab",
    firstName: "Rafi",
    name: "Rafi MOUHAMAD",
    photo: "/photo-rafi.jpeg",
    calendarIds: [
      "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com", // Rdv commerciaux/suivi
      "rafi.mouhamad.nmfconsulting@gmail.com",                  // Visio
      "lm5dnmkg9k8jpk2eeb009e2ev4@group.calendar.google.com", // Admin et prépa
      "qnat0fo43j8hn7369kld0vnv1c@group.calendar.google.com", // Team NMF Consulting
      "j2d3ldvcaj4c76lmefv6qjr0lk@group.calendar.google.com", // Perso
      "r4df33kl5s8mnk2sd0ipird7fg@group.calendar.google.com", // Présentiel
      "eea3flj6iqn5stu896e2tubo4o@group.calendar.google.com", // Trajets
    ],
  },
];

const SLOT_DURATION = 15;
const DAY_START_HOUR = 9;
const DAY_START_MIN = 30;
const DAY_END_HOUR = 19;
const DAY_END_MIN = 0;
const TZ = "Europe/Paris";
const BUFFER = 30 * 60 * 1000; // 30 min buffer

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
    return NextResponse.json({ slots: [] });
  }

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();
  const offset = getParisOffset(date);
  const allSlots = generateSlots(date);

  // Fetch busy times for ALL team members in parallel
  const busyByMember: Map<string, { start: string; end: string }[]> = new Map();

  await Promise.all(
    TEAM.map(async (member) => {
      const allBusy: { start: string; end: string }[] = [];
      for (const calId of member.calendarIds) {
        const { events } = await getCalendarEvents({ calendarId: calId, timeMin, timeMax, timeZone: TZ });
        allBusy.push(...events);
      }
      busyByMember.set(member.id, allBusy);
    })
  );

  // If a member has an event lasting 4h+ (formation), block the entire day
  const blockedAllDay = new Set<string>();
  for (const member of TEAM) {
    const busy = busyByMember.get(member.id) ?? [];
    const hasLongEvent = busy.some((b) => {
      const duration = new Date(b.end).getTime() - new Date(b.start).getTime();
      return duration >= 4 * 60 * 60 * 1000; // 4h+
    });
    if (hasLongEvent) blockedAllDay.add(member.id);
  }

  function isMemberAvailable(memberId: string, slotStart: Date, slotEnd: Date): boolean {
    if (blockedAllDay.has(memberId)) return false;
    const busy = busyByMember.get(memberId) ?? [];
    return !busy.some((b) => {
      const bs = new Date(b.start).getTime() - BUFFER;
      const be = new Date(b.end).getTime() + BUFFER;
      return slotStart.getTime() < be && slotEnd.getTime() > bs;
    });
  }

  // For each slot, find the first available member by priority
  const result: { start: string; end: string; assignedTo: string; assignedName: string; assignedFirstName: string; assignedPhoto: string }[] = [];

  for (const slot of allSlots) {
    const slotStart = new Date(`${slot.start}${offset}`);
    const slotEnd = new Date(`${slot.end}${offset}`);

    for (const member of TEAM) {
      if (isMemberAvailable(member.id, slotStart, slotEnd)) {
        result.push({
          start: slot.start,
          end: slot.end,
          assignedTo: member.id,
          assignedName: member.name,
          assignedFirstName: member.firstName,
          assignedPhoto: member.photo,
        });
        break; // premier disponible par priorité
      }
    }
    // Si personne n'est dispo, le créneau n'apparaît pas
  }

  // Filter slots: must be at least 4h from now
  const now = new Date();
  const minTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // now + 4h
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: TZ });
  const filtered = date === todayStr
    ? result.filter((s) => new Date(`${s.start}${offset}`) >= minTime)
    : date < todayStr ? [] : result;

  return NextResponse.json({ slots: filtered });
}
