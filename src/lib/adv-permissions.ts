/**
 * Server-side RBAC helpers pour les endpoints ADV (devis, facturation, statut).
 *
 * Aligné sur le pattern `verifyAdmin` de src/app/api/admin/automations/route.ts.
 * Utilise le SSR cookie-based Supabase client (createClient de @/lib/supabase/server)
 * pour identifier l'utilisateur authentifié, puis service role pour lookup team_members.
 */

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface CurrentMember {
  id: string;
  authUserId: string;
  email: string | null;
  roles: string[];
  firstName: string | null;
  lastName: string | null;
}

/**
 * Récupère le team_member courant (auth SSR + lookup Supabase).
 * Retourne null si pas authentifié ou pas de match team_members.
 */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export function isAdmin(member: CurrentMember | null): boolean {
  return !!member && member.roles.includes("Admin");
}

/**
 * Peut créer un devis sur ce deal ?
 * - Admin : oui
 * - Owner du deal : oui
 * - Sinon : non
 */
export function canCreateQuote(
  member: CurrentMember | null,
  deal: { owner_id: string | null },
): boolean {
  if (!member) return false;
  if (isAdmin(member)) return true;
  return !!deal.owner_id && deal.owner_id === member.id;
}

/**
 * Peut déclencher la facturation ?
 * - Admin : oui
 * - Rôle "Finance" : oui (Naznine en pratique)
 * - Sinon : non
 *
 * Note : "Finance" est un rôle métier dans team_members.roles, distinct de
 * MemberPermissions.canViewFinance (qui contrôle la visibilité de la section
 * Finance dans l'UI).
 */
export function canInvoice(member: CurrentMember | null): boolean {
  if (!member) return false;
  if (isAdmin(member)) return true;
  return member.roles.includes("Finance");
}

/**
 * Peut valider/rejeter une pièce ADV dans l'inbox "Pièces à valider" ?
 * Même périmètre que la facturation : Admin OU rôle "Finance" (Naznine).
 */
export function canValidateAdv(member: CurrentMember | null): boolean {
  return canInvoice(member);
}

/**
 * Peut consulter le statut ADV (lecture seule) ?
 * Tout team_member authentifié.
 */
export function canViewADVStatus(member: CurrentMember | null): boolean {
  return !!member;
}
