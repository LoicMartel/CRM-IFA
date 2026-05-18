import { NextRequest, NextResponse } from "next/server";
import { processMeetingNotifications } from "@/lib/process-meeting-notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId, contactIds, managerIds } = body;

    if (!meetingId) {
      return NextResponse.json({ error: "meetingId required" }, { status: 400 });
    }

    const result = await processMeetingNotifications({ meetingId, contactIds, managerIds });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
