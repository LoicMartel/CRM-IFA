import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return NextResponse.json({ error: "KEY MISSING" });

  const trimmed = raw.trim();
  let parsed: any;
  try { parsed = JSON.parse(trimmed); } catch {
    try { parsed = JSON.parse(trimmed.replace(/\r?\n/g, "\\n")); } catch (e: any) {
      return NextResponse.json({ error: "parse failed", msg: e.message });
    }
  }

  // Show what private_key looks like
  const pk = parsed.private_key || "";
  const hasRealNewlines = pk.includes("\n");
  const hasEscapedNewlines = pk.includes("\\n");
  const startsCorrectly = pk.startsWith("-----BEGIN");
  const pkFirst60 = pk.slice(0, 60);
  const pkLength = pk.length;

  // Force fix: ensure real newlines in PEM
  if (!hasRealNewlines && hasEscapedNewlines) {
    parsed.private_key = pk.replace(/\\n/g, "\n");
  }

  const pkAfterFix = parsed.private_key.slice(0, 60);
  const hasRealNewlinesAfter = parsed.private_key.includes("\n");

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
      busy: calData?.busy ?? [],
      pkDebug: { hasRealNewlines, hasEscapedNewlines, startsCorrectly, pkLength, pkFirst60, hasRealNewlinesAfter, pkAfterFix },
    });
  } catch (e: any) {
    return NextResponse.json({
      error: "auth/freebusy failed",
      message: e.message,
      pkDebug: { hasRealNewlines, hasEscapedNewlines, startsCorrectly, pkLength, pkFirst60, hasRealNewlinesAfter, pkAfterFix },
    });
  }
}
