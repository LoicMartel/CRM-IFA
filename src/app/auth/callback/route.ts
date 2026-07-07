import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/home";

  const cookieStore = await cookies();
  // Collect cookies set during auth exchange so we can copy them onto the redirect response
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch { /* Server Component */ }
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  let authOk = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authOk = !error;
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "recovery" | "email" | "signup",
    });
    authOk = !error;
  }

  if (authOk) {
    const dest = type === "recovery"
      ? `${origin}/reset-password`
      : `${origin}${next}`;
    const response = NextResponse.redirect(dest);
    // Explicitly set session cookies on the redirect response
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as any);
    });
    return response;
  }

  return NextResponse.redirect(
    `${origin}/login?error=Le+lien+a+expiré+ou+est+invalide.+Veuillez+réessayer.`,
  );
}
