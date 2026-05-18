import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/home";

  const supabase = await createClient();

  if (code) {
    // PKCE flow: exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // For password recovery, redirect to reset-password page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (token_hash && type) {
    // Magic link / OTP flow: verify the token
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "recovery" | "email" | "signup",
    });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If we get here, something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=Le+lien+a+expiré+ou+est+invalide.+Veuillez+réessayer.`);
}
