"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface MemberInfo {
  id: string;
  roles: string[];
  firstName: string;
  lastName: string;
}

export function useCurrentRoles() {
  const [info, setInfo] = useState<MemberInfo | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, roles")
        .eq("auth_user_id", user.id)
        .single();

      if (member) {
        setInfo({
          id: member.id,
          roles: (member.roles as string[]) ?? [],
          firstName: member.first_name,
          lastName: member.last_name,
        });
        return;
      }

      const { data: memberByEmail } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, roles")
        .eq("email", user.email)
        .single();

      if (memberByEmail) {
        setInfo({
          id: memberByEmail.id,
          roles: (memberByEmail.roles as string[]) ?? [],
          firstName: memberByEmail.first_name,
          lastName: memberByEmail.last_name,
        });
      }
    }
    load();
  }, []);

  const isAdmin = info?.roles.includes("Admin") ?? false;
  const isExterne = info?.roles.includes("Externe") ?? false;
  // Pauline exception: Externe but with full access
  const isPauline = info?.firstName === "Pauline" && info?.lastName === "BECQUERELLE";
  const isRestrictedExterne = isExterne && !isPauline && !isAdmin;

  return {
    memberId: info?.id ?? null,
    firstName: info?.firstName ?? "",
    lastName: info?.lastName ?? "",
    roles: info?.roles ?? [],
    isAdmin,
    isExterne,
    isRestrictedExterne,
    canDelete: isAdmin,
    canEditTeam: isAdmin,
    canViewFinance: !isRestrictedExterne,
    canViewReports: !isRestrictedExterne,
    canViewDashboard: !isRestrictedExterne,
    loaded: info !== null,
  };
}
