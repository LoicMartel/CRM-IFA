import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth";

/**
 * GET /api/auth/google/calendars?memberId=xxx
 * Returns the list of Google Calendars for the connected member.
 */
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
  }

  const accessToken = await getValidToken(memberId, "google");
  if (!accessToken) {
    return NextResponse.json({ error: "Google non connecté" }, { status: 401 });
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Erreur Google: " + text }, { status: res.status });
  }

  const data = await res.json();
  const calendars = (data.items ?? []).map((cal: any) => ({
    id: cal.id,
    summary: cal.summary ?? cal.id,
    primary: cal.primary ?? false,
    backgroundColor: cal.backgroundColor ?? null,
  }));

  return NextResponse.json({ calendars });
}
