import { NextResponse } from "next/server";
import { getFreeBusy } from "@/lib/google-calendar";

export async function GET() {
  const calendars = [
    { name: "RA:Rdv commerciaux", id: "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com" },
    { name: "RA:F Visio", id: "rafi.mouhamad.nmfconsulting@gmail.com" },
    { name: "RA:Admin et prépa", id: "lm5dnmkg9k8jpk2eeb009e2ev4@group.calendar.google.com" },
    { name: "RA:Team NMF", id: "qnat0fo43j8hn7369kld0vnv1c@group.calendar.google.com" },
  ];

  const results: Record<string, unknown>[] = [];
  const hasKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPreview = hasKey ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.slice(0, 30) + "..." : "MISSING";

  for (const cal of calendars) {
    const { busy, error } = await getFreeBusy({
      calendarId: cal.id,
      timeMin: "2026-03-31T00:00:00Z",
      timeMax: "2026-03-31T23:59:59Z",
      timeZone: "Europe/Paris",
    });
    results.push({ name: cal.name, busyCount: busy.length, error: error || null });
  }

  return NextResponse.json({ hasKey, keyPreview, results });
}
