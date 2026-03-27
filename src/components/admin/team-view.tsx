"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils";

type R = Record<string, unknown>;

const ALL_ROLES = [
  "Expert", "Experte", "Account Manager", "Admin", "Dirigeant",
  "Coordinatrice Pédagogique", "Marketing Manager", "Interne", "Externe",
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
};

const TABS = [
  { key: "all", label: "Tous" },
  { key: "expert", label: "Experts" },
  { key: "am", label: "Account Managers" },
  { key: "externe", label: "Externe" },
];

const emptyForm = {
  first_name: "", last_name: "", email: "", phone: "", role: "sales",
  roles: [] as string[], is_active: true, availability: "", notes: "",
  google_calendar_id: "", zoom_link: "", slack_user_id: "",
  create_account: true, password: "",
};

export function TeamView({ members }: { members: R[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [popup, setPopup] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [passwordPopup, setPasswordPopup] = useState<R | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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
                      {!!(member.auth_user_id) && (
                        <button onClick={() => { setPasswordPopup(member); setNewPassword(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#1a6b9c" }} title="Changer le mot de passe">
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => openEdit(member)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#8399a9" }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteConfirm(member.id as string)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#e74c3c" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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

              {/* Disponibilités (si Expert) */}
              {isExpert && (
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Disponibilités préférées</label>
                  <textarea value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })}
                    placeholder="Ex: Lundi et mercredi matin, vendredi après-midi..."
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
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
    </div>
  );
}
