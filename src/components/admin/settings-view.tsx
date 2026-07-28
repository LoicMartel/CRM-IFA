"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, User, Mail, Check, Camera, Link, MessageSquare, Calendar, ChevronDown, ChevronRight, Copy } from "lucide-react";
import Cropper from "react-easy-crop";

interface CropArea { x: number; y: number; width: number; height: number; }

// Utility: crop image on canvas and return a Blob
async function getCroppedImg(imageSrc: string, crop: CropArea): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve) => { image.onload = () => resolve(); image.src = imageSrc; });

  const canvas = document.createElement("canvas");
  const size = 256; // output size
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9);
  });
}

export function SettingsView() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [pendingRemoveAvatar, setPendingRemoveAvatar] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Integration fields
  const [zoomLink, setZoomLink] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [initialIntegrations, setInitialIntegrations] = useState({ zoom: "", slack: "", gcal: "" });
  const [showTutorial, setShowTutorial] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // OAuth tokens
  const [oauthTokens, setOauthTokens] = useState<{ provider: string; provider_email: string | null }[]>([]);

  // Crop state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  useEffect(() => {
    setMounted(true);
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? "");
        const { data: member } = await supabase.from("team_members").select("id, first_name, last_name, avatar_url, zoom_link, slack_user_id, google_calendar_id")
          .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`).limit(1).single();
        if (member) {
          setMemberName(`${member.first_name} ${member.last_name}`);
          setMemberId(member.id);
          setInitials(`${member.first_name[0]}${member.last_name[0]}`);
          setAvatarUrl(member.avatar_url ?? null);
          setZoomLink(member.zoom_link ?? "");
          setSlackUserId(member.slack_user_id ?? "");
          setGoogleCalendarId(member.google_calendar_id ?? "");
          setInitialIntegrations({
            zoom: member.zoom_link ?? "",
            slack: member.slack_user_id ?? "",
            gcal: member.google_calendar_id ?? "",
          });
          // Fetch OAuth tokens for this member
          const { data: tokens } = await supabase
            .from("oauth_tokens")
            .select("provider, provider_email")
            .eq("team_member_id", member.id);
          if (tokens) setOauthTokens(tokens);
        }
      }
    })();
  }, []);

  async function handleDisconnectOAuth(provider: string) {
    if (!memberId) return;
    if (!window.confirm(`Déconnecter ${provider} ?`)) return;
    const supabase = createClient();
    await supabase.from("oauth_tokens").delete().eq("team_member_id", memberId).eq("provider", provider);
    setOauthTokens(oauthTokens.filter(t => t.provider !== provider));
  }

  const onCropComplete = useCallback((_: any, croppedPixels: CropArea) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  async function handleCropSave() {
    if (!cropImage || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(cropImage, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(blob);
      setPendingAvatarBlob(blob);
      setPendingAvatarPreview(previewUrl);
      setPendingRemoveAvatar(false);
      setCropImage(null);
      setHasChanges(true);
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  }

  function handleRemoveAvatar() {
    setPendingAvatarBlob(null);
    setPendingAvatarPreview(null);
    setPendingRemoveAvatar(true);
    setHasChanges(true);
  }

  async function handleSaveAll() {
    setMessage(null);
    setSaving(true);

    let success = true;
    const messages: string[] = [];

    // 1. Upload pending avatar
    if (pendingAvatarBlob && memberId) {
      const formData = new FormData();
      formData.append("file", pendingAvatarBlob, "avatar.jpg");
      formData.append("memberId", memberId);
      try {
        const res = await fetch("/api/admin/upload-avatar", { method: "POST", body: formData });
        const result = await res.json();
        if (result.url) {
          setAvatarUrl(result.url);
          setPendingAvatarBlob(null);
          setPendingAvatarPreview(null);
          messages.push("Photo de profil mise à jour");
        } else {
          messages.push("Erreur photo: " + (result.error ?? "échec"));
          success = false;
        }
      } catch { messages.push("Erreur upload photo"); success = false; }
    }

    // 2. Remove avatar if requested
    if (pendingRemoveAvatar && memberId) {
      const supabase = createClient();
      await supabase.from("team_members").update({ avatar_url: null }).eq("id", memberId);
      setAvatarUrl(null);
      setPendingRemoveAvatar(false);
      messages.push("Photo de profil supprimée");
    }

    // 3. Change password if filled
    if (newPassword || confirmPassword) {
      if (!newPassword || !confirmPassword) {
        setMessage({ type: "error", text: "Veuillez remplir les deux champs de mot de passe." });
        setSaving(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
        setSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setMessage({ type: "error", text: "Le mot de passe doit contenir au moins 6 caractères." });
        setSaving(false);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        messages.push("Erreur mot de passe: " + error.message);
        success = false;
      } else {
        setNewPassword("");
        setConfirmPassword("");
        messages.push("Mot de passe modifié");
      }
    }

    // 4. Save integration fields if changed
    const intChanged = zoomLink !== initialIntegrations.zoom
      || slackUserId !== initialIntegrations.slack
      || googleCalendarId !== initialIntegrations.gcal;
    if (intChanged && memberId) {
      const supabase = createClient();
      const { error } = await supabase.from("team_members").update({
        zoom_link: zoomLink.trim() || null,
        slack_user_id: slackUserId.trim() || null,
        google_calendar_id: googleCalendarId.trim() || null,
      }).eq("id", memberId);
      if (error) {
        messages.push("Erreur intégrations: " + error.message);
        success = false;
      } else {
        setInitialIntegrations({ zoom: zoomLink, slack: slackUserId, gcal: googleCalendarId });
        messages.push("Intégrations mises à jour");
      }
    }

    // Notify header
    window.dispatchEvent(new Event("avatar-updated"));

    if (messages.length > 0) {
      setMessage({ type: success ? "success" : "error", text: messages.join(" · ") });
    } else {
      setMessage({ type: "success", text: "Aucune modification à sauvegarder." });
    }

    setHasChanges(false);
    setSaving(false);
    router.refresh();
  }

  if (!mounted) return <div style={{ maxWidth: 600, padding: 40, textAlign: "center", color: "#8399a9" }}>Chargement...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="space-y-6">
        {/* Photo de profil */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #0a3d5f 0%, #1a6b9c 50%, #FF6B35 100%)" }} />
          <div style={{ padding: "20px 24px" }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Camera className="h-5 w-5" style={{ color: "#1a6b9c" }} /> Photo de profil
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ position: "relative" }}>
                {(pendingAvatarPreview || (!pendingRemoveAvatar && avatarUrl)) ? (
                  <img src={pendingAvatarPreview ?? avatarUrl!} alt="Avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #e8ecf1" }} />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%", border: "3px solid #e8ecf1",
                    background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24, fontWeight: 700,
                  }}>
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: "50%",
                    background: "#1a6b9c", border: "2px solid white", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  }}
                >
                  <Camera className="h-3 w-3" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
              </div>
              <div className="space-y-2">
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>{memberName}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ height: 32, borderRadius: 8, background: "#1a6b9c", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "0 14px" }}>
                    Changer la photo
                  </button>
                  {(pendingAvatarPreview || (!pendingRemoveAvatar && avatarUrl)) && (
                    <button onClick={handleRemoveAvatar}
                      style={{ height: 32, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "0 14px" }}>
                      Supprimer
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#8399a9" }}>JPG, PNG ou GIF. Max 2 Mo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profil */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #0a3d5f 0%, #1a6b9c 50%, #FF6B35 100%)" }} />
          <div style={{ padding: "20px 24px" }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <User className="h-5 w-5" style={{ color: "#1a6b9c" }} /> Mon profil
            </h3>
            <div className="space-y-3">
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f5f7fa", borderRadius: 8 }}>
                <User className="h-4 w-4" style={{ color: "#8399a9" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#8399a9", fontWeight: 600 }}>Nom</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>{memberName || "—"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f5f7fa", borderRadius: 8 }}>
                <Mail className="h-4 w-4" style={{ color: "#8399a9" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#8399a9", fontWeight: 600 }}>Email (identifiant)</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>{userEmail || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "#FF6B35" }} />
          <div style={{ padding: "20px 24px" }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <KeyRound className="h-5 w-5" style={{ color: "#FF6B35" }} /> Changer le mot de passe
            </h3>
            {message && (
              <div style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 16,
                background: message.type === "success" ? "#e8f5e9" : "#fde8e8",
                borderLeft: `4px solid ${message.type === "success" ? "#27ae60" : "#e74c3c"}`,
                color: message.type === "success" ? "#2e7d32" : "#c62828",
                fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8,
              }}>
                {message.type === "success" && <Check className="h-4 w-4" />}
                {message.text}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Nouveau mot de passe</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>
              <div className="space-y-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Confirmer le mot de passe</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>
            </div>
          </div>
        </div>
        {/* Intégrations — connexion OAuth */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #1a6b9c 0%, #00695c 100%)" }} />
          <div style={{ padding: "20px 24px" }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Link className="h-5 w-5" style={{ color: "#1a6b9c" }} /> Intégrations
            </h3>

            {/* Agenda */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 10 }}>
                <Calendar className="h-3 w-3" style={{ display: "inline", marginRight: 4 }} /> Agenda
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <OAuthConnectButton provider="google" label="Google Calendar" memberId={memberId} token={oauthTokens.find(t => t.provider === "google")} onDisconnect={handleDisconnectOAuth} />
                <OAuthConnectButton provider="microsoft" label="Outlook" memberId={memberId} token={oauthTokens.find(t => t.provider === "microsoft")} onDisconnect={handleDisconnectOAuth} />
              </div>
            </div>

            {/* Messagerie */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 10 }}>
                <MessageSquare className="h-3 w-3" style={{ display: "inline", marginRight: 4 }} /> Messagerie
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <OAuthConnectButton provider="slack" label="Slack" memberId={memberId} token={oauthTokens.find(t => t.provider === "slack")} onDisconnect={handleDisconnectOAuth} />
                <OAuthConnectButton provider="microsoft" label="Microsoft Teams" memberId={memberId} token={oauthTokens.find(t => t.provider === "microsoft")} onDisconnect={handleDisconnectOAuth} />
              </div>
            </div>

            {/* Visioconférence */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 10 }}>
                📹 Visioconférence
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Lien de visio personnel (Zoom, Google Meet, Teams...)</label>
                  <input type="url" value={zoomLink} onChange={(e) => setZoomLink(e.target.value)}
                    placeholder="https://zoom.us/j/... ou https://meet.google.com/..."
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                  <p style={{ fontSize: 11, color: "#8399a9" }}>Ce lien sera utilisé dans les emails de confirmation des RDV et sessions de formation.</p>
                </div>
              </div>
            </div>

            {/* Champs manuels (rétrocompatibilité) */}
            <details style={{ borderTop: "1px solid #e8ecf1", paddingTop: 12 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: "#8399a9", cursor: "pointer" }}>Configuration manuelle (avancé)</summary>
              <div className="space-y-4" style={{ marginTop: 12 }}>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Slack User ID</label>
                  <input type="text" value={slackUserId} onChange={(e) => setSlackUserId(e.target.value)}
                    placeholder="U0XXXXXXXXX" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div className="space-y-2">
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80" }}>Google Calendar ID</label>
                  <input type="text" value={googleCalendarId} onChange={(e) => setGoogleCalendarId(e.target.value)}
                    placeholder="email@gmail.com" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Tutoriel partage Google Calendar */}
        <div className="lca-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #2e7d32 0%, #81c784 100%)" }} />
          <div style={{ padding: "20px 24px" }}>
            <button
              onClick={() => setShowTutorial(!showTutorial)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <Calendar className="h-5 w-5" style={{ color: "#2e7d32" }} />
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0, flex: 1, textAlign: "left" }}>
                Partager mon Google Calendar avec le CRM
              </h3>
              {showTutorial
                ? <ChevronDown className="h-5 w-5" style={{ color: "#8399a9" }} />
                : <ChevronRight className="h-5 w-5" style={{ color: "#8399a9" }} />
              }
            </button>

            {showTutorial && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, color: "#3a4a5a", lineHeight: 1.6, marginBottom: 16 }}>
                  Pour que le CRM puisse lire et creer des evenements dans votre agenda, vous devez partager votre Google Calendar avec notre compte de service. Voici comment faire :
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <StepItem step={1} title="Ouvrir Google Calendar">
                    Allez sur <strong>calendar.google.com</strong> depuis votre navigateur.
                  </StepItem>

                  <StepItem step={2} title="Acceder aux parametres du calendrier">
                    Dans la barre laterale gauche, survolez votre calendrier principal, cliquez sur les <strong>trois points</strong> (⋮) puis sur <strong>&quot;Parametres et partage&quot;</strong>.
                  </StepItem>

                  <StepItem step={3} title="Ajouter le compte CRM">
                    Descendez jusqu&apos;a la section <strong>&quot;Partager avec des personnes ou des groupes specifiques&quot;</strong> et cliquez sur <strong>&quot;Ajouter des personnes et des groupes&quot;</strong>.
                  </StepItem>

                  <StepItem step={4} title="Entrer l'adresse du CRM">
                    <span>Copiez et collez cette adresse :</span>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, marginTop: 8,
                      padding: "8px 12px", background: "#f0f7f0", borderRadius: 8,
                      border: "1px solid #c8e6c9",
                    }}>
                      <code style={{ fontSize: 12, color: "#2e7d32", flex: 1, wordBreak: "break-all" }}>
                        lca-crm-2026@crm-lca.iam.gserviceaccount.com
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText("lca-crm-2026@crm-lca.iam.gserviceaccount.com");
                          setCopiedEmail(true);
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                          borderRadius: 6, border: "1px solid #c8e6c9", background: copiedEmail ? "#2e7d32" : "white",
                          color: copiedEmail ? "white" : "#2e7d32", cursor: "pointer",
                          fontSize: 11, fontWeight: 600, transition: "all 0.2s",
                        }}
                      >
                        {copiedEmail ? <><Check className="h-3 w-3" /> Copie !</> : <><Copy className="h-3 w-3" /> Copier</>}
                      </button>
                    </div>
                  </StepItem>

                  <StepItem step={5} title="Definir les autorisations">
                    Dans le menu deroulant des autorisations, selectionnez <strong>&quot;Apporter des modifications aux evenements&quot;</strong>, puis cliquez sur <strong>&quot;Envoyer&quot;</strong>.
                  </StepItem>

                  <StepItem step={6} title="Renseigner votre Calendar ID ci-dessus">
                    Revenez sur cette page et entrez votre Google Calendar ID dans le champ ci-dessus (en general votre adresse Gmail).
                  </StepItem>
                </div>

                <div style={{
                  marginTop: 16, padding: "12px 14px", background: "#fff8e1", borderRadius: 8,
                  border: "1px solid #ffe082", fontSize: 12, color: "#f57f17", lineHeight: 1.5,
                }}>
                  <strong>Important :</strong> Sans ce partage, le CRM ne pourra pas synchroniser vos sessions de formation ni consulter vos disponibilites.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global save button */}
        <div style={{ paddingTop: 8 }}>
          <button
            onClick={handleSaveAll}
            disabled={saving || (!hasChanges && !newPassword && !confirmPassword && zoomLink === initialIntegrations.zoom && slackUserId === initialIntegrations.slack && googleCalendarId === initialIntegrations.gcal)}
            style={{
              width: "100%", height: 44, borderRadius: 10, border: "none", cursor: "pointer",
              background: (!hasChanges && !newPassword && !confirmPassword && zoomLink === initialIntegrations.zoom && slackUserId === initialIntegrations.slack && googleCalendarId === initialIntegrations.gcal) ? "#e8ecf1" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
              color: (!hasChanges && !newPassword && !confirmPassword && zoomLink === initialIntegrations.zoom && slackUserId === initialIntegrations.slack && googleCalendarId === initialIntegrations.gcal) ? "#8399a9" : "white",
              fontSize: 15, fontWeight: 700,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Sauvegarde en cours..." : "Sauvegarder les modifications"}
          </button>
        </div>
      </div>

      {/* Crop modal */}
      {cropImage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", margin: 0 }}>Recadrer la photo</h3>
              <button onClick={() => setCropImage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", fontSize: 20 }}>✕</button>
            </div>

            <div style={{ position: "relative", width: "100%", height: 350, background: "#1a2a3a" }}>
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: "#8399a9", flexShrink: 0 }}>Zoom</span>
                <input
                  type="range" min={1} max={3} step={0.1} value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setCropImage(null)}
                  style={{ height: 36, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                  Annuler
                </button>
                <button onClick={handleCropSave} disabled={uploadingAvatar}
                  style={{ height: 36, borderRadius: 8, background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)", color: "white", fontSize: 13, fontWeight: 700, padding: "0 24px", border: "none", cursor: "pointer", opacity: uploadingAvatar ? 0.6 : 1 }}>
                  {uploadingAvatar ? "Upload..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OAuthConnectButton({
  provider, label, memberId, token, onDisconnect,
}: {
  provider: string;
  label: string;
  memberId: string;
  token?: { provider: string; provider_email: string | null };
  onDisconnect: (provider: string) => void;
}) {
  const isConnected = !!token;

  if (isConnected) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        borderRadius: 8, border: "1px solid #a5d6a7", background: "#f1f8e9",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2e7d32", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{label}</div>
          {token.provider_email && <div style={{ fontSize: 11, color: "#5a6f80" }}>{token.provider_email}</div>}
        </div>
        <button
          type="button"
          onClick={() => onDisconnect(provider)}
          style={{ fontSize: 11, color: "#c62828", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Déconnecter
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { window.location.href = `/api/auth/${provider}?memberId=${memberId}`; }}
      disabled={!memberId}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        borderRadius: 8, border: "1px solid #dce8f0", background: "white",
        cursor: memberId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, color: "#1a6b9c",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; e.currentTarget.style.borderColor = "#1a6b9c"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#dce8f0"; }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ccc", flexShrink: 0 }} />
      Connecter {label}
    </button>
  );
}

function StepItem({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: "#2e7d32", color: "white", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
      }}>
        {step}
      </div>
      <div style={{ flex: 1, paddingTop: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#5a6f80", lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
