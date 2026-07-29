"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      } else if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setReady(true);
      }
    });

    // Fallback: check existing session (token already exchanged server-side)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/home"), 2000);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 40%, #161f45 70%, #0f1630 100%)",
    }}>
      <div style={{
        width: 420, background: "white", borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}>
        <div style={{ height: 5, background: "linear-gradient(90deg, #E8732A, #e65100, #E8732A)" }} />
        <div style={{ padding: "36px 36px 28px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a", marginBottom: 4 }}>
            Nouveau mot de passe
          </h2>
          <p style={{ fontSize: 14, color: "#8399a9", marginBottom: 28 }}>
            Choisissez votre nouveau mot de passe
          </p>

          {!ready && !success && (
            <div style={{ padding: "14px", borderRadius: 8, background: "#fff3e0", color: "#e65100", fontSize: 13, fontWeight: 500 }}>
              Chargement de la session de récupération...
            </div>
          )}

          {success ? (
            <div style={{ padding: "14px", borderRadius: 8, background: "#e8f5e9", color: "#2e7d32", fontSize: 13, fontWeight: 500 }}>
              Mot de passe modifié avec succès ! Redirection...
            </div>
          ) : ready && (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 6 }}>
                  Nouveau mot de passe
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    style={{
                      width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #dce8f0",
                      padding: "0 44px 0 14px", fontSize: 14, color: "#1a2a3a", outline: "none",
                      background: "#f8fbfd",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#8399a9",
                    }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 6 }}>
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  required
                  style={{
                    width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #dce8f0",
                    padding: "0 14px", fontSize: 14, color: "#1a2a3a", outline: "none",
                    background: "#f8fbfd",
                  }}
                />
              </div>

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, marginBottom: 20,
                  background: "#fde8e8", borderLeft: "4px solid #e74c3c",
                  color: "#c62828", fontSize: 13, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", height: 46, borderRadius: 10, border: "none", cursor: "pointer",
                  background: loading ? "#8399a9" : "linear-gradient(135deg, #E8732A 0%, #e65100 100%)",
                  color: "white", fontSize: 15, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: loading ? "none" : "0 4px 15px rgba(255,107,53,0.3)",
                }}
              >
                <KeyRound className="h-4 w-4" />
                {loading ? "Modification..." : "Modifier le mot de passe"}
              </button>
            </form>
          )}
        </div>

        <div style={{ padding: "14px 36px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#8399a9" }}>
            © {new Date().getFullYear()} IFA Formatio® — CRM interne
          </p>
        </div>
      </div>
    </div>
  );
}
