import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const trimmed = raw?.trim();

  if (!trimmed) {
    return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is missing" });
  }

  // Try to parse
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e: any) {
    return NextResponse.json({
      error: "JSON parse failed",
      message: e.message,
      firstChars: trimmed.slice(0, 50),
      length: trimmed.length,
    });
  }

  // Try to create auth
  let auth;
  try {
    auth = new google.auth.GoogleAuth({
      credentials: parsed,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Auth creation failed", message: e.message });
  }

  // Try freebusy on one calendar
  try {
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: "2026-03-31T00:00:00Z",
        timeMax: "2026-03-31T23:59:59Z",
        timeZone: "Europe/Paris",
        items: [{ id: "tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com" }],
      },
    });
    const calData = res.data.calendars?.["tukqgipr5abfsco5a7hql7k0m8@group.calendar.google.com"];
    return NextResponse.json({
      success: true,
      clientEmail: parsed.client_email,
      busy: calData?.busy ?? [],
      errors: calData?.errors ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({
      error: "FreeBusy query failed",
      message: e.message,
      clientEmail: parsed.client_email,
    });
  }
}
