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
    "/booking", "/landing-page", "/landing-book-financement", "/vsl", "/confirmation-reservation", "/confirmation-decouverte", "/embed-form",
    "/api/booking", "/api/leads", "/api/meetings/notify", "/api/webhooks", "/api/voice",
  ];
  const isPublic = publicPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!isPublic) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Only redirect if no user AND no Supabase auth cookies present (avoids flash on token refresh)
    if (!user) {
      const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
      if (!hasAuthCookie) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
