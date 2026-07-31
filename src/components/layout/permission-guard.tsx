"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentRoles } from "@/lib/use-current-roles";

// Map paths to their required section permission
const PATH_SECTIONS: Record<string, string> = {
  "/marketing/leads": "canViewMarketing",
  "/marketing/setting": "canViewMarketing",
  "/marketing/depenses": "canViewMarketing",
  "/marketing/rapports": "canViewMarketing",
  "/agenda-commercial": "canViewCommercial",
  "/inbox": "canViewCommercial",
  "/contacts": "canViewCommercial",
  "/companies": "canViewCommercial",
  "/ressources-commercial": "canViewCommercial",
  "/deals": "canViewCommercial",
  "/opportunities": "canViewCommercial",
  "/orders": "canViewCommercial",
  "/leads": "canViewReports",
  "/invoices": "canViewFinance",
  "/suivi-financier": "canViewFinance",
  "/rapports-facturation": "canViewFinance",
  "/home": "canViewDashboard",
};

export function PermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loaded, isAdmin, canViewCommercial, canViewFinance, canViewMarketing, canViewReports, canViewDashboard, permissions } = useCurrentRoles();

  useEffect(() => {
    if (!loaded || isAdmin) return;

    // Find the matching path (exact or prefix for dynamic routes like /contacts/[id])
    const matchedPath = Object.keys(PATH_SECTIONS).find(p => pathname === p || pathname.startsWith(p + "/"));
    if (!matchedPath) return; // No restriction for this path

    const sectionKey = PATH_SECTIONS[matchedPath];
    const sectionPerms: Record<string, boolean> = {
      canViewMarketing, canViewCommercial, canViewFinance, canViewReports, canViewDashboard
    };

    // Check section permission
    if (!sectionPerms[sectionKey]) {
      router.replace("/posts");
      return;
    }

    // Check page-level permission
    if (permissions.pages?.[matchedPath] === false) {
      router.replace("/posts");
    }
  }, [loaded, pathname, isAdmin, canViewCommercial, canViewFinance, canViewMarketing, canViewReports, canViewDashboard, permissions, router]);

  return <>{children}</>;
}
