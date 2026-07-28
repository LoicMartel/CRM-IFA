import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type OAuthProvider = "google" | "microsoft" | "zoom" | "slack";

interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  scopes: string;
  authUrl: string;
  tokenUrl: string;
}

const PROVIDER_CONFIGS: Record<OAuthProvider, () => OAuthProviderConfig> = {
  google: () => ({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    scopes:
      "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  }),
  microsoft: () => ({
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    scopes:
      "Calendars.ReadWrite OnlineMeetings.ReadWrite User.Read offline_access",
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  }),
  zoom: () => ({
    clientId: process.env.ZOOM_CLIENT_ID ?? "",
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? "",
    scopes: "meeting:write:meeting meeting:read:meeting user:read:user",
    authUrl: "https://zoom.us/oauth/authorize",
    tokenUrl: "https://zoom.us/oauth/token",
  }),
  slack: () => ({
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
    scopes: "chat:write channels:read users:read",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
  }),
};

const VALID_PROVIDERS = new Set<string>(["google", "microsoft", "zoom", "slack"]);

export function isValidProvider(p: string): p is OAuthProvider {
  return VALID_PROVIDERS.has(p);
}

export function getOAuthConfig(provider: OAuthProvider): OAuthProviderConfig {
  const cfg = PROVIDER_CONFIGS[provider]();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error(`Missing env vars for OAuth provider "${provider}"`);
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Token helpers (server-side, uses service role)
// ---------------------------------------------------------------------------

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Refresh an access token for a given provider using the stored refresh_token.
 * Returns the new access_token (and updates the DB row).
 */
export async function refreshAccessToken(
  provider: OAuthProvider,
  refreshToken: string,
  memberId: string,
): Promise<string> {
  const cfg = getOAuthConfig(provider);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed for ${provider}: ${text}`);
  }

  const data = await res.json();
  const accessToken: string = data.access_token;
  const expiresIn: number | undefined = data.expires_in; // seconds

  const updates: Record<string, unknown> = {
    access_token: accessToken,
    updated_at: new Date().toISOString(),
  };
  if (expiresIn) {
    updates.token_expires_at = new Date(
      Date.now() + expiresIn * 1000,
    ).toISOString();
  }
  if (data.refresh_token) {
    updates.refresh_token = data.refresh_token;
  }

  await adminSupabase()
    .from("oauth_tokens")
    .update(updates)
    .eq("team_member_id", memberId)
    .eq("provider", provider);

  return accessToken;
}

/**
 * Get a valid (non-expired) access token for a member + provider.
 * Automatically refreshes if expired and a refresh_token is available.
 * Returns null when no token row exists.
 */
export async function getValidToken(
  memberId: string,
  provider: OAuthProvider,
): Promise<string | null> {
  const { data: row } = await adminSupabase()
    .from("oauth_tokens")
    .select("*")
    .eq("team_member_id", memberId)
    .eq("provider", provider)
    .maybeSingle();

  if (!row) return null;

  // Check expiry (with 5-min buffer)
  const expiresAt = row.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : null;
  const isExpired = expiresAt ? expiresAt < Date.now() + 5 * 60 * 1000 : false;

  if (!isExpired) return row.access_token;

  // Try refresh
  if (row.refresh_token) {
    return refreshAccessToken(provider, row.refresh_token, memberId);
  }

  // Expired with no refresh token
  return row.access_token; // Return anyway; caller will handle 401
}

/**
 * Get a Slack token for sending messages.
 * Uses the member's OAuth token if connected, falls back to SLACK_BOT_TOKEN.
 */
export async function getSlackToken(
  memberId?: string | null,
): Promise<string | null> {
  if (memberId) {
    try {
      const token = await getValidToken(memberId, "slack");
      if (token) return token;
    } catch {
      // OAuth not available — fall through
    }
  }
  return process.env.SLACK_BOT_TOKEN ?? null;
}
