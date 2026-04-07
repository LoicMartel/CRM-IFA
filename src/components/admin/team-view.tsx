"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Pencil, Trash2, KeyRound, Shield } from "lucide-react";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";
import { useCurrentRoles, DEFAULT_PERMISSIONS, type MemberPermissions } from "@/lib/use-current-roles";

type R = Record<string, unknown>;

const ALL_ROLES = [
  "Expert", "Experte", "Account Manager", "Admin", "Dirigeant",
  "Coordinatrice Pédagogique", "Marketing Manager", "Ingénieure Pédagogique", "Interne", "Externe",
];

const badgeColors: Record<string, { bg: string; text: string }> = {
  Admin: { bg: "#fce4ec", text: "#c62828" },
  Expert: { bg: "#e8f0fe", text: "#0d4f7a" },
  Experte: { bg: "#e8f0fe", text: "#0d4f7a" },
  "Account Manager": { bg: "#fff3e0", text: "#e65100" },
  Dirigeant: { bg: "#f3e5f5", text: "#6a1b9a" },
  "Coordinatrice Pédagogique": { bg: "#e8f5e9", text: "#2e7d32" },
  "Marketing Manager": { bg: "#fce4ec", text: "#ad1457" },
  Interne: { bg: "#e3f2fd", text: "#1565c0" },
  Externe: { bg: "#fff8e1", text: "#f57f17" },
  "Ingénieure Pédagogique": { bg: "#e0f2f1", text: "#00695c" },
};

const TABS = [
  { key: "all", label: "Tous" },
  { key: "expert", label: "Experts" },
  { key: "am", label: "Account Managers" },
  { key: "externe", label: "Externe" },
];

const ALL_EXPERTISES = ["Inbound", "Outbound", "Stratégie", "Management", "Financements", "Fidélisation", "Pilotage", "Time Management", "Objections"];
const ALL_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const CITY_REGION_MAP: Record<string, string> = {
  "Paris": "Île-de-France", "Mérignac": "Nouvelle-Aquitaine", "Bordeaux": "Nouvelle-Aquitaine",
  "Montpellier": "Occitanie", "Toulouse": "Occitanie", "Lyon": "Auvergne-Rhône-Alpes",
  "Marseille": "Provence-Alpes-Côte d'Azur", "Nantes": "Pays de la Loire", "Lille": "Hauts-de-France",
  "Strasbourg": "Grand Est", "Rennes": "Bretagne", "Nice": "Provence-Alpes-Côte d'Azur",
  "Rouen": "Normandie", "Dijon": "Bourgogne-Franche-Comté", "Clermont-Ferrand": "Auvergne-Rhône-Alpes",
  "La Rochelle": "Nouvelle-Aquitaine", "Limoges": "Nouvelle-Aquitaine", "Poitiers": "Nouvelle-Aquitaine",
  "Orléans": "Centre-Val de Loire", "Tours": "Centre-Val de Loire", "Reims": "Grand Est",
  "Amiens": "Hauts-de-France", "Caen": "Normandie", "Angers": "Pays de la Loire",
  "Grenoble": "Auvergne-Rhône-Alpes", "Saint-Étienne": "Auvergne-Rhône-Alpes",
  "Toulon": "Provence-Alpes-Côte d'Azur", "Aix-en-Provence": "Provence-Alpes-Côte d'Azur",
  "Brest": "Bretagne", "Perpignan": "Occitanie", "Nîmes": "Occitanie", "Pau": "Nouvelle-Aquitaine",
  "Bayonne": "Nouvelle-Aquitaine", "Metz": "Grand Est", "Nancy": "Grand Est",
};
const WEEKS_PER_YEAR = 47;

const emptyForm = {
  first_name: "", last_name: "", email: "", phone: "", role: "sales",
  roles: [] as string[], is_active: true, availability: "", notes: "",
  google_calendar_id: "", zoom_link: "", slack_user_id: "",
  create_account: true, password: "",
  // Expert fields
  expertises: [] as string[], city: "", region: "", tjm: "",
  days_per_week: "", preferred_days: [] as string[], expert_status: "active",
  mobility: "Toute la France",
};

export function TeamView({ members }: { members: R[] }) {
  const router = useRouter();
  const { isAdmin } = useCurrentRoles();
  const [activeTab, setActiveTab] = useState("all");
  const [popup, setPopup] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const notesVoice = useVoiceDictation(() => form.notes, (t) => setForm((f) => ({ ...f, notes: t })));
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [passwordPopup, setPasswordPopup] = useState<R | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [permsMember, setPermsMember] = useState<R | null>(null);
  const [permsForm, setPermsForm] = useState<MemberPermissions>({ ...DEFAULT_PERMISSIONS });
  const [savingPerms, setSavingPerms] = useState(false);

  function openPerms(member: R) {
    const dbPerms = (member.permissions as Partial<MemberPermissions>) ?? {};
    const roles = (member.roles as string[]) ?? [];
    const isExterne = roles.includes("Externe");
    const isAdmin = roles.includes("Admin");
    // Show current effective permissions
    let effective: MemberPermissions;
    if (isAdmin) {
      effective = { ...DEFAULT_PERMISSIONS };
    } else if (Object.keys(dbPerms).length > 0) {
      effective = { ...DEFAULT_PERMISSIONS, ...dbPerms };
    } else if (isExterne) {
      effective = { canViewCommercial: false, canViewFinance: false, canViewDashboard: false, canViewReports: false, canEdit: false, canDelete: false, onlyOwnData: true };
    } else {
      effective = { ...DEFAULT_PERMISSIONS };
    }
    setPermsForm(effective);
    setPermsMember(member);
  }

  async function handleSavePerms() {
    if (!permsMember) return;
    setSavingPerms(true);
    const supabase = createClient();
    await supabase.from("team_members").update({ permissions: permsForm }).eq("id", permsMember.id as string);
    setSavingPerms(false);
    setPermsMember(null);
    router.refresh();
  }

  const filtered = members.filter(m => {
    if (activeTab === "all") return true;
    const roles = (m.roles as string[]) ?? [];
    if (activeTab === "expert") return roles.some(r => r === "Expert" || r === "Experte");
    if (activeTab === "am") return roles.includes("Account Manager");
    if (activeTab === "externe") return roles.includes("Externe");
    return true;
  });

  function openCreate() {
    setForm({ ...emptyForm });
    setEditId(null);
    setPopup("create");
  }

  function openEdit(m: R) {
    setForm({
      first_name: (m.first_name as string) || "",
      last_name: (m.last_name as string) || "",
      email: (m.email as string) || "",
      phone: (m.phone as string) || "",
      role: (m.role as string) || "sales",
      roles: (m.roles as string[]) ?? [],
      is_active: m.is_active !== false,
      availability: (m.availability as string) || "",
      notes: (m.notes as string) || "",
      google_calendar_id: (m.google_calendar_id as string) || "",
      zoom_link: (m.zoom_link as string) || "",
      slack_user_id: (m.slack_user_id as string) || "",
      create_account: false, password: "",
      expertises: (m.expertises as string[]) ?? [],
      city: (m.city as string) || "",
      region: (m.region as string) || "",
      tjm: m.tjm ? String(m.tjm) : "",
      days_per_week: m.days_per_week ? String(m.days_per_week) : "",
      preferred_days: (m.preferred_days as string[]) ?? [],
      expert_status: (m.expert_status as string) || "active",
      mobility: (m.mobility as string) || "Toute la France",
    });
    setEditId(m.id as string);
    setPopup("edit");
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const memberData: Record<string, any> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      roles: form.roles,
      is_active: form.is_active,
      availability: form.availability.trim() || null,
      notes: form.notes.trim() || null,
      google_calendar_id: form.google_calendar_id.trim() || null,
      zoom_link: form.zoom_link.trim() || null,
      slack_user_id: form.slack_user_id.trim() || null,
      expertises: form.expertises.length > 0 ? form.expertises : null,
      city: form.city.trim() || null,
      region: form.region.trim() || null,
      tjm: form.tjm ? parseFloat(form.tjm) : null,
      days_per_week: form.days_per_week ? parseFloat(form.days_per_week) : null,
      preferred_days: form.preferred_days.length > 0 ? form.preferred_days : null,
      expert_status: form.expert_status || "active",
      mobility: form.mobility.trim() || "Toute la France",
    };
    if (popup === "edit" && editId) {
      await supabase.from("team_members").update(memberData).eq("id", editId);
    } else {
      // Create auth account if requested
      let authUserId: string | null = null;
      if (form.create_account && form.email.trim() && form.password) {
        try {
          const res = await fetch("/api/admin/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email.trim(), password: form.password }),
          });
          const result = await res.json();
          if (result.userId) authUserId = result.userId;
          else if (result.error) alert("Erreur création compte: " + result.error);
        } catch {}
      }
      if (authUserId) memberData.auth_user_id = authUserId;
      await supabase.from("team_members").insert(memberData);

      // Send welcome email if account was created
      if (authUserId && form.email.trim()) {
        try {
          await fetch("/api/admin/welcome-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: form.first_name.trim(),
              email: form.email.trim(),
              password: form.password || null,
            }),
          });
        } catch {}
      }
    }
    setSaving(false);
    setPopup(null);
    router.refresh();
  }

  async function handleChangePassword() {
    if (!passwordPopup || !newPassword) return;
    setSavingPassword(true);
    const authId = passwordPopup.auth_user_id as string;
    if (!authId) { alert("Ce membre n'a pas de compte."); setSavingPassword(false); return; }
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId: authId, newPassword: newPassword }),
      });
      const result = await res.json();
      if (result.success) alert("Mot de passe modifié !");
      else alert("Erreur: " + result.error);
    } catch { alert("Erreur réseau"); }
    setSavingPassword(false);
    setPasswordPopup(null);
    setNewPassword("");
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("team_members").delete().eq("id", id);
    setDeleteConfirm(null);
    router.refresh();
  }

  function toggleRole(role: string) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  }

  const isExpert = form.roles.some(r => r === "Expert" || r === "Experte");

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users className="h-5 w-5" style={{ color: "#8399a9" }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a" }}>{filtered.length} membre{filtered.length > 1 ? "s" : ""}</h2>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  height: 32, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: isActive ? 700 : 500,
                  border: `1px solid ${isActive ? "#1a6b9c" : "#dce8f0"}`,
                  background: isActive ? "#1a6b9c" : "white",
                  color: isActive ? "white" : "#5a6f80",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {isAdmin && (
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={openCreate}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, height: 38, borderRadius: 10,
                padding: "0 20px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                background: "#FF6B35", color: "white",
              }}
            >
              <Plus className="h-4 w-4" /> Nouveau membre
            </button>
          </div>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((member) => {
          const roles: string[] = (member.roles as string[]) ?? [];
          const initials = `${(member.first_name as string)?.[0] ?? ""}${(member.last_name as string)?.[0] ?? ""}`;
          return (
            <div key={member.id as string} className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 4, background: "linear-gradient(90deg, #0a3d5f 0%, #1a6b9c 50%, #FF6B35 100%)" }} />
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{member.first_name as string} {member.last_name as string}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                        background: member.is_active ? "#e8f5e9" : "#f5f5f5",
                        color: member.is_active ? "#2e7d32" : "#999",
                      }}>
                        {member.is_active ? "Actif" : "Inactif"}
                      </span>
                      {isAdmin && (
                        <button onClick={() => openPerms(member)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#0d4f7a" }} title="Gérer les permissions">
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && !!(member.auth_user_id) && (
                        <button onClick={() => { setPasswordPopup(member); setNewPassword(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#1a6b9c" }} title="Changer le mot de passe">
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => openEdit(member)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#8399a9" }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setDeleteConfirm(member.id as string)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#e74c3c" }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    {roles.map(role => {
                      const bc = badgeColors[role] ?? { bg: "#f5f5f5", text: "#555" };
                      return (
                        <span key={role} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: bc.bg, color: bc.text }}>
                          {role}
                        </span>
                      );
                    })}
                  </div>
                  {String(member.email || "") && (
                    <div style={{ fontSize: 13, color: "#5a6f80" }}>{String(member.email)}</div>
                  )}
                  {String(member.phone || "") && (
                    <div style={{ fontSize: 13, color: "#5a6f80" }}>{formatPhone(String(member.phone))}</div>
                  )}
                  {/* Expert info */}
                  {(() => {
                    const exps: string[] = Array.isArray(member.expertises) ? member.expertises as string[] : [];
                    if (exps.length === 0) return null;
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                        {exps.map((exp: string) => (
                          <span key={exp} style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: "#fff3e0", color: "#e65100" }}>{exp}</span>
                        ))}
                      </div>
                    );
                  })()}
                  {(member.city || member.tjm) ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: "#8399a9" }}>
                      {member.city ? <span>{String(member.city)}</span> : null}
                      {member.tjm ? <span>{"TJM: " + String(member.tjm) + "€"}</span> : null}
                      {member.days_per_week ? <span>{String(member.days_per_week) + "j/sem"}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", marginBottom: 8 }}>Supprimer ce membre ?</h3>
            <p style={{ fontSize: 13, color: "#5a6f80", marginBottom: 20 }}>Cette action est irréversible. Le membre sera supprimé définitivement.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ height: 36, borderRadius: 8, background: "#e74c3c", color: "white", fontSize: 13, fontWeight: 700, padding: "0 18px", border: "none", cursor: "pointer" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit popup */}
      {popup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPopup(null); }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
                {popup === "create" ? "Nouveau membre" : "Modifier le membre"}
              </h3>
              <button onClick={() => setPopup(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4, fontSize: 20 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: 24 }} className="space-y-4">
              {/* Prénom / Nom */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Prénom *</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Nom *</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
              </div>

              {/* Email / Téléphone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Téléphone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
              </div>

              {/* Badges / Rôles */}
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Rôles / Badges</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_ROLES.map(role => {
                    const selected = form.roles.includes(role);
                    const bc = badgeColors[role] ?? { bg: "#f5f5f5", text: "#555" };
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                          border: selected ? `2px solid ${bc.text}` : "2px solid #dce8f0",
                          background: selected ? bc.bg : "white",
                          color: selected ? bc.text : "#8399a9",
                          transition: "all 0.15s",
                        }}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actif */}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border" />
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>Membre actif</label>
              </div>

              {/* Création de compte (uniquement à la création) */}
              {popup === "create" && (
                <>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={form.create_account} onChange={(e) => setForm({ ...form, create_account: e.target.checked })}
                      className="rounded border" />
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>Créer un compte d&apos;accès</label>
                  </div>
                  {form.create_account && (
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Mot de passe *</label>
                      <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Ex: Prénom2026"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                      <p style={{ fontSize: 11, color: "#8399a9" }}>L&apos;identifiant sera l&apos;adresse email du membre.</p>
                    </div>
                  )}
                </>
              )}

              {/* Section Expert (si Expert/Experte) */}
              {isExpert && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#FF6B35", borderBottom: "1px solid #dce8f0", paddingBottom: 4, marginTop: 8 }}>
                    Profil Expert
                  </div>

                  {/* Expertises */}
                  <div className="space-y-2">
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Expertises</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ALL_EXPERTISES.map(exp => {
                        const selected = form.expertises.includes(exp);
                        return (
                          <button key={exp} type="button"
                            onClick={() => setForm(f => ({ ...f, expertises: selected ? f.expertises.filter(e => e !== exp) : [...f.expertises, exp] }))}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                              border: selected ? "2px solid #FF6B35" : "2px solid #dce8f0",
                              background: selected ? "#fff3e0" : "white", color: selected ? "#e65100" : "#8399a9",
                            }}
                          >{exp}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ville + Région */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Ville de résidence</label>
                      <input value={form.city} onChange={(e) => {
                        const city = e.target.value;
                        const region = CITY_REGION_MAP[city] ?? form.region;
                        setForm({ ...form, city, region });
                      }} list="city-list"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="Ex: Paris" />
                      <datalist id="city-list">
                        {Object.keys(CITY_REGION_MAP).map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Région</label>
                      <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="Auto-détectée" readOnly
                        style={{ background: "#f8fbfd" }} />
                    </div>
                  </div>

                  {/* TJM + Jours/semaine */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>TJM (EUR)</label>
                      <input type="number" value={form.tjm} onChange={(e) => setForm({ ...form, tjm: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="546" />
                    </div>
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Jours/semaine</label>
                      <input type="number" step="0.5" value={form.days_per_week} onChange={(e) => setForm({ ...form, days_per_week: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="3" />
                    </div>
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Jours/an</label>
                      <input readOnly value={form.days_per_week ? Math.round(parseFloat(form.days_per_week) * WEEKS_PER_YEAR) : "—"}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        style={{ background: "#f8fbfd", fontWeight: 700 }} />
                    </div>
                  </div>

                  {/* Jours préférentiels */}
                  <div className="space-y-2">
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Jours préférentiels</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {ALL_DAYS.map(day => {
                        const selected = form.preferred_days.includes(day);
                        return (
                          <button key={day} type="button"
                            onClick={() => setForm(f => ({ ...f, preferred_days: selected ? f.preferred_days.filter(d => d !== day) : [...f.preferred_days, day] }))}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                              border: selected ? "2px solid #1a6b9c" : "2px solid #dce8f0",
                              background: selected ? "#e3f2fd" : "white", color: selected ? "#1565c0" : "#8399a9",
                            }}
                          >{day.slice(0, 3)}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobilité + Statut */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Mobilité</label>
                      <input value={form.mobility} onChange={(e) => setForm({ ...form, mobility: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Statut expert</label>
                      <select value={form.expert_status} onChange={(e) => setForm({ ...form, expert_status: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        <option value="active">Actif</option>
                        <option value="pending">En attente</option>
                        <option value="inactive">Inactif</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Intégrations (section repliée pour l'édition) */}
              {popup === "edit" && (
                <details style={{ borderTop: "1px solid #e8ecf1", paddingTop: 12 }}>
                  <summary style={{ fontSize: 12, fontWeight: 700, color: "#8399a9", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Intégrations
                  </summary>
                  <div className="space-y-3 mt-3">
                    <div className="space-y-1">
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#8399a9" }}>Google Calendar ID</label>
                      <input value={form.google_calendar_id} onChange={(e) => setForm({ ...form, google_calendar_id: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="email@example.com" />
                    </div>
                    <div className="space-y-1">
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#8399a9" }}>Lien Zoom</label>
                      <input value={form.zoom_link} onChange={(e) => setForm({ ...form, zoom_link: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="https://zoom.us/j/..." />
                    </div>
                    <div className="space-y-1">
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#8399a9" }}>Slack User ID</label>
                      <input value={form.slack_user_id} onChange={(e) => setForm({ ...form, slack_user_id: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="U0XXXXXXXX" />
                    </div>
                  </div>
                </details>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes internes..."
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} />
              </div>

              {/* Submit */}
              <button
                onClick={handleSave}
                disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
                style={{
                  width: "100%", height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#FF6B35", color: "white", fontSize: 14, fontWeight: 700,
                  opacity: saving || !form.first_name.trim() || !form.last_name.trim() ? 0.5 : 1,
                }}
              >
                {saving ? "Enregistrement..." : popup === "create" ? "Créer le membre" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password change popup */}
      {passwordPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPasswordPopup(null); }}>
          <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", marginBottom: 4 }}>Changer le mot de passe</h3>
            <p style={{ fontSize: 13, color: "#5a6f80", marginBottom: 16 }}>{passwordPopup.first_name as string} {passwordPopup.last_name as string} ({passwordPopup.email as string})</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Nouveau mot de passe</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setPasswordPopup(null)} style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                  Annuler
                </button>
                <button onClick={handleChangePassword} disabled={savingPassword || !newPassword.trim()}
                  style={{ height: 36, borderRadius: 8, background: "#FF6B35", color: "white", fontSize: 13, fontWeight: 700, padding: "0 18px", border: "none", cursor: "pointer", opacity: savingPassword || !newPassword.trim() ? 0.5 : 1 }}>
                  {savingPassword ? "..." : "Modifier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Permissions panel */}
      {permsMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPermsMember(null); }}>
          <div style={{ background: "white", borderRadius: 16, width: 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #0d4f7a 0%, #1a6b9c 50%, #FF6B35 100%)" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <Shield style={{ width: 20, height: 20, color: "#0d4f7a" }} />
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>
                    Permissions — {permsMember.first_name as string} {permsMember.last_name as string}
                  </h3>
                  <p style={{ fontSize: 12, color: "#8399a9", margin: 0 }}>
                    {((permsMember.roles as string[]) ?? []).join(", ")}
                  </p>
                </div>
              </div>

              {((permsMember.roles as string[]) ?? []).includes("Admin") ? (
                <div style={{ padding: 14, borderRadius: 8, background: "#e8f5e9", color: "#2e7d32", fontSize: 13, fontWeight: 500 }}>
                  Administrateur — accès total, les permissions ne s&apos;appliquent pas.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Visibilité</div>

                  {([
                    { key: "canViewCommercial" as const, label: "Section Commerciale", desc: "Contacts, Entreprises, Pipeline, Opportunités, Commandes" },
                    { key: "canViewFinance" as const, label: "Section Finance", desc: "Facturation, Suivi Financier, Rapports Facturation" },
                    { key: "canViewDashboard" as const, label: "Dashboard & Synthèses", desc: "Dashboard, Synthèse Commerciale, Synthèse Finances" },
                    { key: "canViewReports" as const, label: "Rapports Commerciaux", desc: "Reports Inbound, Outbound, etc." },
                  ]).map(({ key, label, desc }) => (
                    <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={permsForm[key]}
                        onChange={(e) => setPermsForm({ ...permsForm, [key]: e.target.checked })}
                        style={{ width: 18, height: 18, marginTop: 2, accentColor: "#1a6b9c", cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>{label}</div>
                        <div style={{ fontSize: 11, color: "#8399a9" }}>{desc}</div>
                      </div>
                    </label>
                  ))}

                  <div style={{ borderTop: "1px solid #e8ecf1", paddingTop: 12, marginTop: 4 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Actions</div>

                  {([
                    { key: "canEdit" as const, label: "Peut créer et modifier", desc: "Créer des contacts, modifier des fiches, ajouter des sessions..." },
                    { key: "canDelete" as const, label: "Peut supprimer", desc: "Supprimer des contacts, entreprises, sessions, etc." },
                  ]).map(({ key, label, desc }) => (
                    <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={permsForm[key]}
                        onChange={(e) => setPermsForm({ ...permsForm, [key]: e.target.checked })}
                        style={{ width: 18, height: 18, marginTop: 2, accentColor: "#1a6b9c", cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>{label}</div>
                        <div style={{ fontSize: 11, color: "#8399a9" }}>{desc}</div>
                      </div>
                    </label>
                  ))}

                  <div style={{ borderTop: "1px solid #e8ecf1", paddingTop: 12, marginTop: 4 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Données</div>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={permsForm.onlyOwnData}
                      onChange={(e) => setPermsForm({ ...permsForm, onlyOwnData: e.target.checked })}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "#e65100", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>Uniquement ses propres données</div>
                      <div style={{ fontSize: 11, color: "#8399a9" }}>Ne voit que ses contacts, entreprises, sessions et RDV</div>
                    </div>
                  </label>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                <button onClick={() => setPermsMember(null)} style={{ height: 38, borderRadius: 8, padding: "0 18px", border: "1px solid #dce8f0", background: "white", color: "#5a6f80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Annuler
                </button>
                {!((permsMember.roles as string[]) ?? []).includes("Admin") && (
                  <button onClick={handleSavePerms} disabled={savingPerms} style={{ height: 38, borderRadius: 8, padding: "0 18px", border: "none", background: savingPerms ? "#8399a9" : "#1a6b9c", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {savingPerms ? "Enregistrement..." : "Enregistrer"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
