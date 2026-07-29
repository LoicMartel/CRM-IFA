"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentRoles } from "@/lib/use-current-roles";
import {
  Building2,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FolderOpen,
  GraduationCap,
  Handshake,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Receipt,
  Target,
  TrendingUp,
  User,
  UserPlus,
  Users,
  MessageSquare,
  PhoneOutgoing,
  Settings,
  Wallet,
  Webhook,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";


const commercialItems = [
  { title: "Agenda Commercial", href: "/agenda-commercial", icon: CalendarCheck },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Contacts", href: "/contacts", icon: User },
  { title: "Entreprises", href: "/companies", icon: Building2 },
  { title: "Ressources", href: "/ressources-commercial", icon: Calculator },
  { title: "Pipeline", href: "/deals", icon: Handshake },
  { title: "Opportunités", href: "/opportunities", icon: TrendingUp },
  { title: "Commandes (PDCO)", href: "/orders", icon: CreditCard },
  { title: "Rapports Commerciaux", href: "/leads", icon: Target },
];

const productionItemsList = [
  { title: "Agenda Production", href: "/agenda", icon: CalendarDays },
  { title: "Apprenants", href: "/learners", icon: Users },
  { title: "Planification", href: "/planning", icon: Calendar },
  { title: "Delivery", href: "/delivery", icon: GraduationCap },
  { title: "Ressources", href: "/ressources", icon: FolderOpen },
  { title: "Rapports Production", href: "/rapports-production", icon: Target },
  { title: "Rapport Formateurs", href: "/rapports-formateurs", icon: GraduationCap },
];


const marketingItems = [
  { title: "Leads", href: "/marketing/leads", icon: UserPlus },
  { title: "Setting", href: "/marketing/setting", icon: PhoneOutgoing },
  { title: "Suivi Tunnels", href: "/marketing/suivi-prestataires", icon: Megaphone },
  { title: "Campagnes", href: "/marketing/campagnes", icon: Mail },
  { title: "Dépenses Marketing", href: "/marketing/depenses", icon: Wallet },
  { title: "Rapports Marketing", href: "/marketing/rapports", icon: Target },
];

const financeItems = [
  { title: "Pièces à valider", href: "/a-valider", icon: ClipboardCheck },
  { title: "Facturation", href: "/invoices", icon: Receipt },
  { title: "Suivi Financier", href: "/suivi-financier", icon: TrendingUp },
  { title: "Rapports Facturation", href: "/rapports-facturation", icon: Target },
];

const generalItems = [
  { title: "Fil d'Actualité", href: "/posts", icon: MessageSquare },
];

const adminItems = [
  { title: "Équipe", href: "/team", icon: Users },
  { title: "Réglages", href: "/reglages", icon: Settings },
  { title: "Journal Emails", href: "/emails", icon: Mail },
];

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof commercialItems;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                render={<Link href={item.href} />}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { isRestrictedExterne, canViewReports, canViewFinance, canViewMarketing } = useCurrentRoles();

  const visibleCommercialItems = isRestrictedExterne ? [] : commercialItems;
  const visibleProductionItems = isRestrictedExterne
    ? productionItemsList.filter((i) => i.href !== "/delivery")
    : productionItemsList;
  const visibleMarketingItems = canViewMarketing ? marketingItems : [];
  const visibleFinanceItems = canViewFinance ? financeItems : [];
  // Le journal d'emails contient du contenu client (preuve Qualiopi) → masqué aux externes restreints.
  const visibleAdminItems = isRestrictedExterne ? adminItems.filter((i) => i.href !== "/emails") : adminItems;

  return (
    <Sidebar>
      <SidebarHeader style={{ borderBottom: "none", padding: "8px 16px", height: 64, display: "flex", alignItems: "center" }}>
        <Link href="/home" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div style={{
            width: 44, height: 44, border: "2px solid white", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, padding: "4px 6px",
          }}>
            <span style={{
              color: "white", fontSize: 6.5, fontWeight: 700, lineHeight: 1.2,
              textAlign: "center", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              letterSpacing: "-0.02em",
            }}>
              IFA<br />FORMATION
            </span>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 20, color: "white", fontFamily: "var(--font-caveat), 'Caveat', cursive", whiteSpace: "nowrap" }}>
              IFA Formation
            </p>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.6)", marginTop: 2, fontFamily: "var(--font-caveat), 'Caveat', cursive", fontStyle: "italic" }}>
              Formez-vous aux metiers du transport
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent style={{ paddingTop: 16 }}>
        <NavSection label="Général" items={generalItems} pathname={pathname} />
        {visibleMarketingItems.length > 0 && <NavSection label="Marketing" items={visibleMarketingItems} pathname={pathname} />}
        {visibleCommercialItems.length > 0 && <NavSection label="Commercial" items={visibleCommercialItems} pathname={pathname} />}
        <NavSection label="Production" items={visibleProductionItems} pathname={pathname} />
        {visibleFinanceItems.length > 0 && <NavSection label="Finance" items={visibleFinanceItems} pathname={pathname} />}
        <NavSection label="Admin" items={visibleAdminItems} pathname={pathname} />
      </SidebarContent>
    </Sidebar>
  );
}
