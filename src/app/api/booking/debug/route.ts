import { NextResponse } from "next/server";
import { getFreeBusy } from "@/lib/google-calendar";

const CALENDARS = [
  { name: "RA:Rdv commerciaux/suivi", id: "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com" },
  { name: "RA:F Visio", id: "rafi.mouhamad.nmfconsulting@gmail.com" },
  { name: "RA:Admin et Prépa", id: "lm5dnmkg9k8jpk2eeb009e2ev4@group.calendar.google.com" },
  { name: "RA:Team NMF Consulting", id: "qnat0fo43j8hn7369kld0vnv1c@group.calendar.google.com" },
  { name: "RA:Perso", id: "j2d3ldvcaj4c76lmefv6qjr0lk@group.calendar.google.com" },
  { name: "RA:Présentiel", id: "r4df33kl5s8mnk2sd0ipird7fg@group.calendar.google.com" },
  { name: "RA:Trajets", id: "eea3flj6iqn5stu896e2tubo4o@group.calendar.google.com" },
  { name: "Pauline Gmail", id: "pauline.becquerelle@gmail.com" },
  { name: "Pauline Closing Académie", id: "d5338ed9e648d81ad3ef5fcbea38b7a91df6992ba69628c1946410039833d4a5@group.calendar.google.com" },
  { name: "Pauline Cal 3", id: "12cd9085ed10a2ad840d9e6d02ef8f040de488342e66cffe57a0f2130713b026@group.calendar.google.com" },
  { name: "Pauline Cal 4", id: "cba1425b9af40c252017aae0d83ec52e93494fc4cb1e1807208bb931e5270d93@group.calendar.google.com" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "2026-04-07";

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();

  const results = [];
  for (const cal of CALENDARS) {
    const { busy, error } = await getFreeBusy({
      calendarId: cal.id,
      timeMin,
      timeMax,
      timeZone: "Europe/Paris",
    });
    results.push({
      name: cal.name,
      id: cal.id.slice(0, 20) + "...",
      busyCount: busy.length,
      busy: busy.slice(0, 5),
      error: error ?? null,
    });
  }

  return NextResponse.json({ date, results });
}
