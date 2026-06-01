"use client";

import { useState, useEffect } from "react";
import { getCurrentMember } from "@/lib/current-member";

export interface MemberPermissions {
  canViewCommercial: boolean;
  canViewFinance: boolean;
  canViewMarketing: boolean;
  canViewDashboard: boolean;
  canViewReports: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onlyOwnData: boolean;
}

export const DEFAULT_PERMISSIONS: MemberPermissions = {
  canViewCommercial: true,
  canViewFinance: true,
  canViewMarketing: true,
  canViewDashboard: true,
  canViewReports: true,
  canEdit: true,
  canDelete: true,
  onlyOwnData: false,
};

// Permissions for restricted externes (default when no permissions set and role is Externe)
const RESTRICTED_EXTERNE_PERMISSIONS: MemberPermissions = {
  canViewCommercial: false,
  canViewFinance: false,
  canViewMarketing: false,
  canViewDashboard: false,
  canViewReports: false,
  canEdit: false,
  canDelete: false,
  onlyOwnData: true,
};

interface MemberInfo {
  id: string;
  roles: string[];
  firstName: string;
  lastName: string;
  permissions: MemberPermissions;
}

export function useCurrentRoles() {
  const [info, setInfo] = useState<MemberInfo | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentMember()
      .then((m) => {
        if (!active || !m) return;

        const roles = m.roles ?? [];
        const isAdmin = roles.includes("Admin");
        const isExterne = roles.includes("Externe");
        const dbPerms = m.permissions as Partial<MemberPermissions> | null;

        // Resolve permissions: DB > defaults based on role
        let perms: MemberPermissions;
        if (isAdmin) {
          perms = { ...DEFAULT_PERMISSIONS };
        } else if (dbPerms && Object.keys(dbPerms).length > 0) {
          perms = { ...DEFAULT_PERMISSIONS, ...dbPerms };
        } else if (isExterne) {
          perms = { ...RESTRICTED_EXTERNE_PERMISSIONS };
        } else {
          perms = { ...DEFAULT_PERMISSIONS };
        }

        setInfo({
          id: m.id,
          roles,
          firstName: m.firstName,
          lastName: m.lastName,
          permissions: perms,
        });
      })
      .catch(() => { /* transient failure: leave state unset, next mount retries */ });

    return () => {
      active = false;
    };
  }, []);

  const isAdmin = info?.roles.includes("Admin") ?? false;
  const isExterne = info?.roles.includes("Externe") ?? false;
  const perms = info?.permissions ?? DEFAULT_PERMISSIONS;

  const isRestrictedExterne = isExterne && !perms.canViewCommercial && !isAdmin;
  const isReadOnly = !perms.canEdit && !isAdmin;

  return {
    memberId: info?.id ?? null,
    firstName: info?.firstName ?? "",
    lastName: info?.lastName ?? "",
    roles: info?.roles ?? [],
    isAdmin,
    isExterne,
    isRestrictedExterne,
    isReadOnly,
    canDelete: isAdmin || perms.canDelete,
    canEditTeam: isAdmin,
    canViewCommercial: isAdmin || perms.canViewCommercial,
    canViewFinance: isAdmin || perms.canViewFinance,
    canViewMarketing: isAdmin || perms.canViewMarketing,
    canViewReports: isAdmin || perms.canViewReports,
    canViewDashboard: isAdmin || perms.canViewDashboard,
    onlyOwnData: !isAdmin && perms.onlyOwnData,
    loaded: info !== null,
  };
}
