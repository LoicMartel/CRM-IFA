"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Building2, User, Handshake, GraduationCap, X, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentRoles } from "@/lib/use-current-roles";

const allTabs = [
  { label: "Dashboard", href: "/", restricted: true },
  { label: "Synthèse Commerciale", href: "/synthese-sales", restricted: true },
  { label: "Synthèse Production", href: "/synthese-service", restricted: false },
  { label: "Synthèse Finances", href: "/finances", restricted: true },
];

interface SearchResult {
  id: string;
  type: "contact" | "company" | "deal" | "learner";
  label: string;
  sub: string;
  href: string;
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isRestrictedExterne, isReadOnly } = useCurrentRoles();
  const tabs = isRestrictedExterne ? allTabs.filter((t) => !t.restricted) : allTabs;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userInitials, setUserInitials] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [avatarRefresh, setAvatarRefresh] = useState(0);

  // Load user initials & avatar — reload on navigation or avatar change
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase.from("team_members").select("first_name, last_name, avatar_url").or(`auth_user_id.eq.${user.id},email.eq.${user.email}`).limit(1).single();
      if (member) {
        setUserInitials(`${member.first_name[0]}${member.last_name[0]}`);
        setUserAvatarUrl(member.avatar_url ?? null);
      }
    })();
  }, [pathname, avatarRefresh]);

  // Listen for avatar updates from settings page
  useEffect(() => {
    const handler = () => setAvatarRefresh(n => n + 1);
    window.addEventListener("avatar-updated", handler);
    return () => window.removeEventListener("avatar-updated", handler);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); setOpen(false); return; }

    setLoading(true);
    const supabase = createClient();
    const searchTerm = `%${q}%`;

    const [
      { data: contacts },
      { data: companies },
      { data: deals },
      { data: learners },
    ] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, email, companies!contacts_company_id_fkey(name)").or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`).limit(5),
      supabase.from("companies").select("id, name, city").ilike("name", searchTerm).limit(5),
      supabase.from("deals").select("id, name, amount, companies(name)").ilike("name", searchTerm).limit(5),
      supabase.from("learners").select("id, first_name, last_name, email, companies(name)").or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`).limit(5),
    ]);

    const r: SearchResult[] = [];
    (companies ?? []).forEach((c) => r.push({
      id: c.id, type: "company", label: c.name,
      sub: c.city ?? "Entreprise", href: `/clients/${c.id}`,
    }));
    (contacts ?? []).forEach((c) => {
      const co = c.companies as unknown as { name: string } | null;
      r.push({
        id: c.id, type: "contact",
        label: `${c.first_name} ${c.last_name}`,
        sub: co?.name ?? c.email ?? "Contact",
        href: `/contacts/${c.id}`,
      });
    });
    (deals ?? []).forEach((d) => {
      const co = d.companies as unknown as { name: string } | null;
      r.push({
        id: d.id, type: "deal", label: d.name,
        sub: co?.name ?? (d.amount ? `${Number(d.amount).toLocaleString("fr-FR")} €` : "Deal"),
        href: `/deals`,
      });
    });
    (learners ?? []).forEach((l) => {
      const co = l.companies as unknown as { name: string } | null;
      r.push({
        id: l.id, type: "learner",
        label: `${l.first_name} ${l.last_name}`,
        sub: co?.name ?? l.email ?? "Apprenant",
        href: `/learners/${l.id}`,
      });
    });

    setResults(r);
    setOpen(r.length > 0);
    setLoading(false);
  }

  function handleSelect(result: SearchResult) {
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(result.href);
  }

  const iconMap = { contact: User, company: Building2, deal: Handshake, learner: GraduationCap };
  const colorMap = { contact: "#2d7dd2", company: "#1b2a4a", deal: "#e8632b", learner: "#27ae60" };

  return (
    <header
      style={{
        background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 60%, #0d4f7a 100%)",
        boxShadow: "0 4px 30px rgba(10,61,95,0.25)",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 20px",
        gap: 16,
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "absolute", left: 20 }}>
        <SidebarTrigger style={{ color: "white" }} />
      </div>

      {/* Search Bar */}
      <div ref={wrapperRef} style={{ position: "absolute", left: 358, width: 400 }}>

        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#5a7099" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Rechercher contacts, entreprises, deals..."
            style={{
              width: "100%",
              height: 36,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.12)",
              color: "white",
              paddingLeft: 34,
              paddingRight: query ? 34 : 12,
              fontSize: 13,
              outline: "none",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2 }}
            >
              <X style={{ width: 14, height: 14, color: "#5a7099" }} />
            </button>
          )}
        </div>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "white", borderRadius: 8, boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            border: "1px solid #d0d7e3", zIndex: 50, maxHeight: 360, overflowY: "auto",
          }}>
            {loading ? (
              <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "#7a8bab" }}>Recherche...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "#7a8bab" }}>Aucun résultat</div>
            ) : (
              results.map((r) => {
                const Icon = iconMap[r.type];
                const color = colorMap[r.type];
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "10px 14px", border: "none", background: "transparent",
                      cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f0f2f5",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f7fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ background: color + "12", borderRadius: 6, padding: 6, flexShrink: 0 }}>
                      <Icon style={{ width: 14, height: 14, color }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1b2a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#7a8bab", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.sub}
                      </div>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#7a8bab", letterSpacing: "0.05em", flexShrink: 0 }}>
                      {r.type === "contact" ? "Contact" : r.type === "company" ? "Entreprise" : r.type === "learner" ? "Apprenant" : "Deal"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <nav style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                background: isActive ? "#FF6B35" : "transparent",
                color: isActive ? "white" : "rgba(255,255,255,0.7)",
                borderRadius: 10,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                whiteSpace: "nowrap",
                boxShadow: isActive ? "0 2px 12px rgba(255,107,53,0.4)" : "none",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.color = "white";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,255,255,0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* User avatar menu */}
      <div ref={userMenuRef} style={{ position: "relative", flexShrink: 0, marginLeft: 8 }}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          style={{
            width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)",
            background: userAvatarUrl ? "transparent" : "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s", overflow: "hidden", padding: 0,
            boxShadow: userMenuOpen ? "0 0 0 3px rgba(255,107,53,0.4)" : "none",
          }}
        >
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            userInitials || <User className="h-4 w-4" />
          )}
        </button>

        {userMenuOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 200,
            background: "white", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            border: "1px solid #e8ecf1", zIndex: 50, overflow: "hidden",
          }}>
            <button
              onClick={() => { setUserMenuOpen(false); router.push("/settings"); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px",
                border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
                fontSize: 13, color: "#1a2a3a", borderBottom: "1px solid #f0f2f5",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f7fa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Settings className="h-4 w-4" style={{ color: "#8399a9" }} />
              Paramètres
            </button>
            <button
              onClick={() => { setUserMenuOpen(false); handleLogout(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px",
                border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
                fontSize: 13, color: "#e74c3c",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fff5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
