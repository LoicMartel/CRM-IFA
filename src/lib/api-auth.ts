/**
 * Server-side auth guards pour les routes API (sécu P0).
 *
 * Le middleware (src/lib/supabase/middleware.ts) ne suffit PAS : il laisse
 * passer toute requête portant un cookie `sb-*` arbitraire (cf bypass ligne
 * 42-44). Chaque endpoint sensible doit donc vérifier l'auth explicitement.
 *
 * Pattern d'usage dans une route :
 *   const auth = await requireMember();
 *   if (auth instanceof NextResponse) return auth;   // 401/403
 *   // auth est le AuthedMember
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface AuthedMember {
  id: string;
  authUserId: string;
  email: string | null;
  roles: string[];
  firstName: string | null;
  lastName: string | null;
}

/**
 * Résout le team_member courant depuis la session SSR (cookie Supabase).
 * Retourne null si non authentifié ou pas de match team_members.
 */
export async function getAuthedMember(): Promise<AuthedMember | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: byAuth } = await serviceClient
    .from("team_members")
    .select("id, auth_user_id, email, roles, first_name, last_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let member = byAuth;
  if (!member && user.email) {
    const { data: byEmail } = await serviceClient
      .from("team_members")
      .select("id, auth_user_id, email, roles, first_name, last_name")
      .eq("email", user.email)
      .maybeSingle();
    member = byEmail;
  }
  if (!member) return null;

  return {
    id: member.id,
    authUserId: member.auth_user_id ?? user.id,
    email: member.email,
    roles: (member.roles as string[]) ?? [],
    firstName: member.first_name,
    lastName: member.last_name,
  };
}

/**
 * Exige un membre d'équipe authentifié.
 * Retourne le membre, ou une NextResponse 401 à renvoyer telle quelle.
 */
export async function requireMember(): Promise<AuthedMember | NextResponse> {
  const member = await getAuthedMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return member;
}

/**
 * Exige un membre avec le rôle Admin.
 * Retourne le membre, ou une NextResponse 401/403 à renvoyer telle quelle.
 */
export async function requireAdmin(): Promise<AuthedMember | NextResponse> {
  const member = await getAuthedMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!member.roles.includes("Admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return member;
}
