import { NextRequest, NextResponse } from "next/server";
import { listOutlookCalendars } from "@/lib/microsoft-calendar";

/**
 * GET /api/auth/microsoft/calendars?memberId=xxx
 * Returns the list of Outlook calendars for the connected member.
 */
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
  }

  const { calendars, error } = await listOutlookCalendars(memberId);

  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  return NextResponse.json({ calendars });
}
