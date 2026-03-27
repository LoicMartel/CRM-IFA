"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Receipt,
  Target,
  TrendingUp,
  User,
  Users,
  Wallet,
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
  { title: "Contacts", href: "/contacts", icon: User },
  { title: "Entreprises", href: "/companies", icon: Building2 },
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
  { title: "Rapports Production", href: "/rapports-production", icon: Target },
];


const financeItems = [
  { title: "Facturation", href: "/invoices", icon: Receipt },
  { title: "Suivi Financier", href: "/suivi-financier", icon: TrendingUp },
  { title: "Rapports Facturation", href: "/rapports-facturation", icon: Target },
];

const adminItems = [
  { title: "Équipe", href: "/team", icon: Users },
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
              LA<br />CLOSING<br />ACADÉMIE<span style={{ fontSize: 4.5, verticalAlign: "super" }}>®</span>
            </span>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 20, color: "white", fontFamily: "var(--font-caveat), 'Caveat', cursive", whiteSpace: "nowrap" }}>
              La Closing Académie
            </p>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.6)", marginTop: 2, fontFamily: "var(--font-caveat), 'Caveat', cursive", fontStyle: "italic" }}>
              Vendez comme vous êtes
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent style={{ paddingTop: 16 }}>
        <NavSection label="Commercial" items={commercialItems} pathname={pathname} />
        <NavSection label="Production" items={productionItemsList} pathname={pathname} />
        <NavSection label="Finance" items={financeItems} pathname={pathname} />
        <NavSection label="Admin" items={adminItems} pathname={pathname} />
      </SidebarContent>
    </Sidebar>
  );
}
