import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Public routes — no auth required
  const publicPrefixes = [
    "/login", "/auth", "/reset-password",
    "/booking", "/landing-page", "/landing-book-financement", "/book-financement-vsl", "/vsl", "/confirmation-reservation", "/confirmation-decouverte", "/confirmation-achat-book-financement", "/embed-form",
    "/api/auth", "/api/booking", "/api/leads", "/api/meetings/notify", "/api/webhooks", "/api/voice", "/api/book-download",
    "/api/cron", // self-authed via CRON_SECRET / vercel-cron user-agent — must bypass the login redirect (sinon le cron Vercel sans cookie est redirigé)
  ];
  const isPublic = publicPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!isPublic) {
    // ── Session gate: browser-close + 3 h inactivity ──────────────
    // crm-session-ts is a session cookie (no Max-Age / Expires) so the
    // browser deletes it on close → forces re-login on next launch.
    // Its value is the epoch-ms of the last request; if older than 3 h
    // the user must re-authenticate.
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const sessionTs = request.cookies.get("crm-session-ts")?.value;
    const now = Date.now();

    if (!sessionTs || now - parseInt(sessionTs, 10) > THREE_HOURS) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      // Clear Supabase auth cookies so a stale refresh-token can't silently restore the session
      request.cookies.getAll().forEach((c) => {
        if (c.name.startsWith("sb-")) response.cookies.delete(c.name);
      });
      response.cookies.delete("crm-session-ts");
      return response;
    }

    // Validate the JWT locally (asymmetric ES256) — avoids a network round-trip per request.
    const { data: claims } = await supabase.auth.getClaims();

    if (!claims) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Refresh the activity timestamp
    supabaseResponse.cookies.set("crm-session-ts", String(now), {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      // No maxAge / expires → session cookie, deleted when browser closes
    });
  }

  return supabaseResponse;
}
