import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const b64 = process.env.GOOGLE_SA_KEY_B64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!b64 && !raw) return NextResponse.json({ error: "No key found" });

  let parsed: any;
  let method = "";

  if (b64) {
    try {
      const clean = b64.replace(/^["']|["']$/g, "").replace(/\s/g, "");
      const decoded = Buffer.from(clean, "base64").toString("utf-8");
      parsed = JSON.parse(decoded);
      method = "base64";
    } catch (e: any) {
      return NextResponse.json({ error: "base64 decode failed", msg: e.message, b64First40: b64.slice(0, 40) });
    }
  } else if (raw) {
    try { parsed = JSON.parse(raw); method = "direct"; } catch {
      try { parsed = JSON.parse(raw.replace(/\r?\n/g, "\\n")); method = "newline-fix"; } catch (e: any) {
        return NextResponse.json({ error: "parse failed", msg: e.message });
      }
    }
  }

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
      method,
      clientEmail: parsed.client_email,
      busy: calData?.busy ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: "auth failed", method, msg: e.message });
  }
}
