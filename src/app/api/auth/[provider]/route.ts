import { NextRequest, NextResponse } from "next/server";
import { getOAuthConfig, isValidProvider } from "@/lib/oauth";

/**
 * GET /api/auth/[provider]?memberId=xxx
 * Initiates the OAuth flow by redirecting to the provider's authorization page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 },
      );
    }

    const memberId = req.nextUrl.searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json(
        { error: "Missing memberId query parameter" },
        { status: 400 },
      );
    }

    const cfg = getOAuthConfig(provider);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not configured" },
        { status: 500 },
      );
    }

    const redirectUri = `${appUrl}/api/auth/${provider}/callback`;

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      state: memberId, // we also store in cookie as backup
    });

    // Provider-specific param names
    if (provider === "slack") {
      // Slack uses "user_scope" for user tokens (not "scope")
      authParams.set("user_scope", cfg.scopes);
    } else {
      authParams.set("scope", cfg.scopes);
    }

    // Google: request offline access for refresh token
    if (provider === "google") {
      authParams.set("access_type", "offline");
      authParams.set("prompt", "consent");
    }

    const authorizationUrl = `${cfg.authUrl}?${authParams.toString()}`;

    // Store memberId in a cookie so the callback can read it
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("oauth_member_id", memberId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
