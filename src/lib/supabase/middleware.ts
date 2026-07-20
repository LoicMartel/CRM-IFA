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
    "/api/booking", "/api/leads", "/api/meetings/notify", "/api/webhooks", "/api/voice", "/api/book-download",
    "/api/cron", // self-authed via CRON_SECRET / vercel-cron user-agent — must bypass the login redirect (sinon le cron Vercel sans cookie est redirigé)
  ];
  const isPublic = publicPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!isPublic) {
    // Validate the session by verifying the JWT locally (asymmetric ES256 keys) instead of
    // calling getUser(), which makes a network round-trip to Supabase Auth on EVERY request
    // (including each RSC prefetch — ~26 per dashboard load). getClaims() verifies the signature
    // against the cached JWKS public key and only hits the network to refresh an expired token.
    const { data: claims } = await supabase.auth.getClaims();

    if (!claims) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
