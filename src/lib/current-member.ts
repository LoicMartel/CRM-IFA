import { createClient } from "@/lib/supabase/client";

export interface CurrentMember {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: Record<string, unknown> | null;
}

// Module-level promise cache — shared across all hook instances on a page.
// Concurrent calls return the same in-flight promise (dedupes parallel fetches).
let cached: Promise<CurrentMember | null> | null = null;

// Guard so we only bind the auth listener once.
let authListenerBound = false;

function bindAuthListener() {
  if (authListenerBound) return;
  authListenerBound = true;

  const supabase = createClient();
  supabase.auth.onAuthStateChange((event) => {
    // Only clear on sign-out. SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION
    // fire at startup or on token rotation — clearing there would cause a
    // refetch loop that defeats the whole cache.
    if (event === "SIGNED_OUT") {
      cached = null;
    }
  });
}

async function fetchCurrentMember(): Promise<CurrentMember | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Primary lookup: by auth_user_id
  const { data: byAuthId } = await supabase
    .from("team_members")
    .select("id, email, first_name, last_name, roles, permissions")
    .eq("auth_user_id", user.id)
    .single();

  const row = byAuthId ?? (
    await supabase
      .from("team_members")
      .select("id, email, first_name, last_name, roles, permissions")
      .eq("email", user.email)
      .single()
  ).data;

  if (!row) return null;

  return {
    id: row.id as string,
    email: (row.email as string | null) ?? user.email ?? null,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    roles: (row.roles as string[]) ?? [],
    permissions: row.permissions as Record<string, unknown> | null,
  };
}

export function getCurrentMember(): Promise<CurrentMember | null> {
  // Bind the auth listener on first call (browser-only, safe — createClient
  // is a no-op in environments that don't have window).
  bindAuthListener();

  if (!cached) {
    cached = fetchCurrentMember().catch((err) => {
      cached = null; // allow retry on next call after a transient failure
      throw err;
    });
  }
  return cached;
}
