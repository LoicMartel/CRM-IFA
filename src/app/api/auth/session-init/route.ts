import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("crm-session-ts", String(Date.now()), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    // No maxAge / expires → session cookie, deleted when browser closes
  });
  return response;
}
