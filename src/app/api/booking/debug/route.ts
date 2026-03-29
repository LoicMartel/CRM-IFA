import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is missing" });
  }

  // Show the exact bytes around position 126
  const charCodes = Array.from(raw.slice(120, 135)).map((c, i) => ({
    pos: 120 + i,
    char: c,
    code: c.charCodeAt(0),
  }));

  // Try multiple parse strategies
  let parsed: any = null;
  let parseMethod = "";
  const trimmed = raw.trim();

  try { parsed = JSON.parse(trimmed); parseMethod = "direct"; } catch {}
  if (!parsed) { try { parsed = JSON.parse(trimmed.replace(/\r?\n/g, "\\n")); parseMethod = "replace-newlines"; } catch {} }
  if (!parsed) { try { const u = trimmed.replace(/^["']|["']$/g, ""); parsed = JSON.parse(u); parseMethod = "unwrap-quotes"; } catch {} }
  if (!parsed) { try { const u = trimmed.replace(/^["']|["']$/g, "").replace(/\r?\n/g, "\\n"); parsed = JSON.parse(u); parseMethod = "unwrap+replace"; } catch {} }

  if (!parsed) {
    return NextResponse.json({
      error: "All parse strategies failed",
      length: raw.length,
      charCodes,
      first80: raw.slice(0, 80),
    });
  }

  // Try freebusy
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: parsed,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
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
      parseMethod,
      clientEmail: parsed.client_email,
      busy: calData?.busy ?? [],
      errors: calData?.errors ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({
      error: "FreeBusy failed",
      parseMethod,
      message: e.message,
    });
  }
}
