import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOAuthConfig, isValidProvider } from "@/lib/oauth";

/**
 * GET /api/auth/[provider]/callback
 * Handles the OAuth callback: exchanges the authorization code for tokens
 * and stores them in the oauth_tokens table.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const teamUrl = `${appUrl}/team`;

  try {
    const { provider } = await params;

    if (!isValidProvider(provider)) {
      return NextResponse.redirect(
        `${teamUrl}?oauth_error=${encodeURIComponent("Fournisseur invalide")}`,
      );
    }

    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${teamUrl}?oauth_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${teamUrl}?oauth_error=${encodeURIComponent("Code d'autorisation manquant")}`,
      );
    }

    // Retrieve memberId from state param or cookie
    const memberId =
      req.nextUrl.searchParams.get("state") ||
      req.cookies.get("oauth_member_id")?.value;

    if (!memberId) {
      return NextResponse.redirect(
        `${teamUrl}?oauth_error=${encodeURIComponent("Session expirée, veuillez réessayer")}`,
      );
    }

    const cfg = getOAuthConfig(provider);
    const redirectUri = `${appUrl}/api/auth/${provider}/callback`;

    // Exchange authorization code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });

    const tokenHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Zoom requires Basic auth header
    if (provider === "zoom") {
      const basicAuth = Buffer.from(
        `${cfg.clientId}:${cfg.clientSecret}`,
      ).toString("base64");
      tokenHeaders["Authorization"] = `Basic ${basicAuth}`;
    }

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[OAuth ${provider}] Token exchange failed:`, errText);
      return NextResponse.redirect(
        `${teamUrl}?oauth_error=${encodeURIComponent("Erreur lors de l'échange du token")}`,
      );
    }

    const tokenData = await tokenRes.json();

    // Extract tokens (Slack has a different structure)
    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresIn: number | null = null;
    let providerEmail: string | null = null;
    let scopes: string | null = null;

    if (provider === "slack") {
      // Slack v2 OAuth returns tokens under authed_user for user tokens
      const authedUser = tokenData.authed_user;
      accessToken = authedUser?.access_token ?? tokenData.access_token;
      scopes = authedUser?.scope ?? tokenData.scope ?? null;
      // Slack doesn't provide refresh tokens in standard flow
    } else {
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token ?? null;
      expiresIn = tokenData.expires_in ?? null;
      scopes = tokenData.scope ?? null;
    }

    // Try to get the provider email for display purposes
    providerEmail = await fetchProviderEmail(provider, accessToken);

    // Upsert into oauth_tokens
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const upsertData: Record<string, unknown> = {
      team_member_id: memberId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      scopes,
      provider_email: providerEmail,
      updated_at: new Date().toISOString(),
    };

    if (expiresIn) {
      upsertData.token_expires_at = new Date(
        Date.now() + expiresIn * 1000,
      ).toISOString();
    }

    const { error: dbError } = await supabase
      .from("oauth_tokens")
      .upsert(upsertData, {
        onConflict: "team_member_id,provider",
      });

    if (dbError) {
      console.error(`[OAuth ${provider}] DB upsert error:`, dbError);
      return NextResponse.redirect(
        `${teamUrl}?oauth_error=${encodeURIComponent("Erreur lors de la sauvegarde du token")}`,
      );
    }

    // Clear the cookie and redirect with success
    const response = NextResponse.redirect(
      `${teamUrl}?oauth_success=${encodeURIComponent(provider)}`,
    );
    response.cookies.delete("oauth_member_id");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[OAuth callback] Error:", message);
    return NextResponse.redirect(
      `${teamUrl}?oauth_error=${encodeURIComponent(message)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers to fetch the email associated with the connected account
// ---------------------------------------------------------------------------

async function fetchProviderEmail(
  provider: string,
  accessToken: string,
): Promise<string | null> {
  try {
    switch (provider) {
      case "google": {
        const res = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.ok) {
          const d = await res.json();
          return d.email ?? null;
        }
        return null;
      }
      case "microsoft": {
        const res = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const d = await res.json();
          return d.mail ?? d.userPrincipalName ?? null;
        }
        return null;
      }
      case "zoom": {
        const res = await fetch("https://api.zoom.us/v2/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const d = await res.json();
          return d.email ?? null;
        }
        return null;
      }
      case "slack": {
        const res = await fetch(
          "https://slack.com/api/users.identity",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.ok) {
          const d = await res.json();
          return d.user?.email ?? null;
        }
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
