"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  });
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // If "Rester connecté" is not checked, set shorter session
      if (!rememberMe) {
        // Default Supabase session is already persistent; we'll handle logout on browser close via a flag
        localStorage.setItem("crm_session_persistent", "false");
      } else {
        localStorage.setItem("crm_session_persistent", "true");
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Identifiants incorrects. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("Une erreur inattendue est survenue.");
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        setForgotError(data.error || "Une erreur est survenue.");
        setForgotLoading(false);
        return;
      }

      setForgotSent(true);
      setForgotLoading(false);
    } catch {
      setForgotError("Une erreur est survenue.");
      setForgotLoading(false);
    }
  }

  return (
    <div className="login-page" style={{
      minHeight: "100vh", display: "flex",
      background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 40%, #0d4f7a 70%, #0a3d5f 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Left side - Branding with powder explosion */}
      <div className="login-branding" style={{
        flex: 1.2, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: 60, position: "relative", zIndex: 1, overflow: "hidden",
      }}>
        {/* CSS Powder explosions */}
        <div className="powder powder-red" />
        <div className="powder powder-orange" />
        <div className="powder powder-pink" />
        <div className="powder powder-cyan" />
        <div className="powder powder-green" />
        <div className="powder powder-purple" />
        <div className="powder powder-gold" />
        <div className="powder powder-magenta" />
        <div className="powder powder-teal" />
        <div className="powder powder-lime" />

        {/* Content on top */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Logo with glow */}
          <div className="login-logo-container">
            <div className="login-logo-glow" />
            <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative", zIndex: 2 }}>
              <div className="login-logo-box">
                <span style={{
                  color: "white", fontSize: 13, fontWeight: 700, lineHeight: 1.2,
                  textAlign: "center", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
                  letterSpacing: "-0.02em",
                }}>
                  LA<br />CLOSING<br />ACADÉMIE<span style={{ fontSize: 8, verticalAlign: "super" }}>®</span>
                </span>
              </div>
              <div>
                <p className="login-title">
                  La Closing Académie
                </p>
                <p className="login-subtitle">
                  Vendez comme vous êtes
                </p>
              </div>
            </div>
          </div>

          {/* Separator line */}
          <div className="login-separator" />

          {/* Tagline */}
          <div className="login-tagline">
            <p style={{ fontSize: 20, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, fontWeight: 300 }}>
              Votre CRM commercial & production pour piloter vos ventes, vos formations et vos résultats.
            </p>
          </div>

          {/* Feature pills */}
          <div className="login-features">
            <span className="login-feature-pill">📊 Pilotage commercial</span>
            <span className="login-feature-pill">🎓 Gestion des formations</span>
            <span className="login-feature-pill">📈 Rapports & KPIs</span>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="login-form-wrapper" style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40, position: "relative", zIndex: 1,
      }}>
        <div className="login-card" style={{
          width: 420, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.3)",
          overflow: "hidden",
        }}>
          {/* Card gradient bar */}
          <div style={{ height: 5, background: "linear-gradient(90deg, #FF6B35, #e65100, #FF6B35)" }} />

          <div style={{ padding: "36px 36px 28px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a", marginBottom: 4 }}>
              Connexion
            </h2>
            <p style={{ fontSize: 14, color: "#8399a9", marginBottom: 28 }}>
              Accédez à votre espace CRM
            </p>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 6 }}>
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  style={{
                    width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #dce8f0",
                    padding: "0 14px", fontSize: 14, color: "#1a2a3a", outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    background: "#f8fbfd",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#1a6b9c"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(26,107,156,0.1)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 6 }}>
                  Mot de passe
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    required
                    style={{
                      width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #dce8f0",
                      padding: "0 44px 0 14px", fontSize: 14, color: "#1a2a3a", outline: "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                      background: "#f8fbfd",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#1a6b9c"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(26,107,156,0.1)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 2,
                    }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#5a6f80" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#1a6b9c", cursor: "pointer" }}
                  />
                  Rester connecté
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: "#1a6b9c", fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  Mot de passe oublié ?
                </button>
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
                  background: loading ? "#8399a9" : "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
                  color: "white", fontSize: 15, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: loading ? "none" : "0 4px 15px rgba(255,107,53,0.3)",
                  transition: "all 0.3s",
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Se connecter
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div style={{
            padding: "14px 36px", borderTop: "1px solid rgba(232,236,241,0.5)", background: "rgba(248,251,253,0.5)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 11, color: "#8399a9" }}>
              © {new Date().getFullYear()} La Closing Académie® — CRM interne
            </p>
          </div>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotMode && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={() => { if (!forgotLoading) setForgotMode(false); }}
        >
          <div
            style={{
              width: 420, background: "white", borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ height: 5, background: "linear-gradient(90deg, #1a6b9c, #0d4f7a, #1a6b9c)" }} />
            <div style={{ padding: "36px 36px 28px" }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a", marginBottom: 4 }}>
                Mot de passe oublié
              </h2>
              <p style={{ fontSize: 14, color: "#8399a9", marginBottom: 28 }}>
                Entrez votre email pour recevoir un lien de réinitialisation
              </p>

              {forgotSent ? (
                <div style={{ padding: "14px", borderRadius: 8, background: "#e8f5e9", color: "#2e7d32", fontSize: 13, fontWeight: 500 }}>
                  Un email de réinitialisation a été envoyé à <strong>{forgotEmail}</strong>. Vérifiez votre boîte mail (et vos spams).
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 6 }}>
                      Adresse email
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="votre@email.com"
                      required
                      style={{
                        width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #dce8f0",
                        padding: "0 14px", fontSize: 14, color: "#1a2a3a", outline: "none",
                        background: "#f8fbfd",
                      }}
                    />
                  </div>

                  {forgotError && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, marginBottom: 20,
                      background: "#fde8e8", borderLeft: "4px solid #e74c3c",
                      color: "#c62828", fontSize: 13, fontWeight: 500,
                    }}>
                      {forgotError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setForgotMode(false)}
                      style={{
                        flex: 1, height: 46, borderRadius: 10, border: "1.5px solid #dce8f0",
                        background: "white", color: "#5a6f80", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{
                        flex: 1, height: 46, borderRadius: 10, border: "none", cursor: "pointer",
                        background: forgotLoading ? "#8399a9" : "linear-gradient(135deg, #1a6b9c 0%, #0d4f7a 100%)",
                        color: "white", fontSize: 14, fontWeight: 700,
                        boxShadow: forgotLoading ? "none" : "0 4px 15px rgba(26,107,156,0.3)",
                      }}
                    >
                      {forgotLoading ? "Envoi..." : "Envoyer le lien"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Powder explosion particles */
        .powder {
          position: absolute;
          border-radius: 50%;
          filter: blur(35px);
          opacity: 0;
          z-index: 0;
          mix-blend-mode: screen;
        }

        /* Each powder color - different positions, sizes, delays */
        .powder-red {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(231,44,44,0.9) 0%, rgba(231,44,44,0) 70%);
          top: 20%; left: 5%;
          animation: powderThrow1 2s cubic-bezier(0.22,1,0.36,1) 0.2s forwards, powderDrift 6s ease-in-out 2.5s infinite;
        }
        .powder-orange {
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(255,140,0,0.85) 0%, rgba(255,140,0,0) 70%);
          top: 35%; left: 15%;
          animation: powderThrow2 2.2s cubic-bezier(0.22,1,0.36,1) 0.4s forwards, powderDrift2 7s ease-in-out 2.8s infinite;
        }
        .powder-pink {
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(255,20,147,0.8) 0%, rgba(255,20,147,0) 70%);
          top: 45%; left: 35%;
          animation: powderThrow3 1.8s cubic-bezier(0.22,1,0.36,1) 0.1s forwards, powderDrift 8s ease-in-out 2.2s infinite;
        }
        .powder-cyan {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(0,200,220,0.8) 0%, rgba(0,200,220,0) 70%);
          bottom: 15%; right: 5%;
          animation: powderThrow4 2.4s cubic-bezier(0.22,1,0.36,1) 0.5s forwards, powderDrift2 9s ease-in-out 3s infinite;
        }
        .powder-green {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(80,200,50,0.75) 0%, rgba(80,200,50,0) 70%);
          top: 15%; right: 10%;
          animation: powderThrow2 2s cubic-bezier(0.22,1,0.36,1) 0.6s forwards, powderDrift 7s ease-in-out 2.8s infinite;
        }
        .powder-purple {
          width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(130,40,200,0.8) 0%, rgba(130,40,200,0) 70%);
          bottom: 25%; left: 10%;
          animation: powderThrow3 2.1s cubic-bezier(0.22,1,0.36,1) 0.3s forwards, powderDrift2 6s ease-in-out 2.5s infinite;
        }
        .powder-gold {
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(200,160,50,0.7) 0%, rgba(200,160,50,0) 70%);
          bottom: 35%; left: 30%;
          animation: powderThrow1 2.3s cubic-bezier(0.22,1,0.36,1) 0.7s forwards, powderDrift 8s ease-in-out 3.2s infinite;
        }
        .powder-magenta {
          width: 330px; height: 330px;
          background: radial-gradient(circle, rgba(255,0,100,0.75) 0%, rgba(255,0,100,0) 70%);
          top: 55%; right: 15%;
          animation: powderThrow4 1.9s cubic-bezier(0.22,1,0.36,1) 0.35s forwards, powderDrift2 7s ease-in-out 2.6s infinite;
        }
        .powder-teal {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(0,150,180,0.75) 0%, rgba(0,150,180,0) 70%);
          top: 10%; left: 40%;
          animation: powderThrow2 2.5s cubic-bezier(0.22,1,0.36,1) 0.55s forwards, powderDrift 9s ease-in-out 3.1s infinite;
        }
        .powder-lime {
          width: 250px; height: 250px;
          background: radial-gradient(circle, rgba(180,230,30,0.7) 0%, rgba(180,230,30,0) 70%);
          bottom: 10%; right: 25%;
          animation: powderThrow1 2.2s cubic-bezier(0.22,1,0.36,1) 0.8s forwards, powderDrift2 6s ease-in-out 3.3s infinite;
        }

        /* Throw animations - different directions */
        @keyframes powderThrow1 {
          0% { opacity: 0; transform: scale(0.1) translate(100px, 50px); filter: blur(60px); }
          60% { opacity: 1; filter: blur(25px); }
          100% { opacity: 0.85; transform: scale(1) translate(0, 0); filter: blur(35px); }
        }
        @keyframes powderThrow2 {
          0% { opacity: 0; transform: scale(0.1) translate(-80px, 80px); filter: blur(60px); }
          60% { opacity: 0.95; filter: blur(25px); }
          100% { opacity: 0.8; transform: scale(1) translate(0, 0); filter: blur(35px); }
        }
        @keyframes powderThrow3 {
          0% { opacity: 0; transform: scale(0.1) translate(60px, -70px); filter: blur(60px); }
          60% { opacity: 1; filter: blur(20px); }
          100% { opacity: 0.85; transform: scale(1) translate(0, 0); filter: blur(35px); }
        }
        @keyframes powderThrow4 {
          0% { opacity: 0; transform: scale(0.1) translate(-100px, -40px); filter: blur(60px); }
          60% { opacity: 0.95; filter: blur(25px); }
          100% { opacity: 0.8; transform: scale(1) translate(0, 0); filter: blur(35px); }
        }

        /* Continuous drift animations */
        @keyframes powderDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(15px, -20px) scale(1.05); }
          50% { transform: translate(-10px, 15px) scale(0.95); }
          75% { transform: translate(20px, 10px) scale(1.03); }
        }
        @keyframes powderDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-20px, -15px) scale(1.04); }
          66% { transform: translate(15px, 20px) scale(0.96); }
        }

        /* Logo container */
        .login-logo-container {
          position: relative;
          margin-bottom: 32px;
          animation: logoSlideIn 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          opacity: 0;
        }
        @keyframes logoSlideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Logo glow */
        .login-logo-glow {
          position: absolute;
          top: 50%; left: 50%;
          width: 200px; height: 200px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(255,107,53,0.2) 0%, transparent 60%);
          animation: glowPulse 4s ease-in-out infinite;
          z-index: 1;
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
        }

        /* Logo box */
        .login-logo-box {
          width: 90px; height: 90px;
          border: 2.5px solid rgba(255,255,255,0.5);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          padding: 8px 10px; flex-shrink: 0;
          backdrop-filter: blur(10px);
          background: rgba(255,255,255,0.05);
          animation: boxShimmer 3s ease-in-out infinite;
        }
        @keyframes boxShimmer {
          0%, 100% { border-color: rgba(255,255,255,0.4); box-shadow: 0 0 20px rgba(255,107,53,0); }
          50% { border-color: rgba(255,255,255,0.7); box-shadow: 0 0 30px rgba(255,107,53,0.15); }
        }

        /* Title */
        .login-title {
          font-weight: 700; font-size: 42px; color: white;
          font-family: var(--font-caveat), 'Caveat', cursive;
          white-space: nowrap; margin: 0;
          text-shadow: 0 2px 20px rgba(0,0,0,0.2);
        }
        .login-subtitle {
          font-size: 26px; color: rgba(255,255,255,0.5);
          margin-top: 4px; font-family: var(--font-caveat), 'Caveat', cursive;
          font-style: italic;
        }

        /* Separator */
        .login-separator {
          width: 60px; height: 3px; border-radius: 2px;
          background: linear-gradient(90deg, transparent, #FF6B35, transparent);
          margin-bottom: 28px;
          animation: separatorGrow 1.2s ease-out 0.5s forwards;
          opacity: 0; transform: scaleX(0);
        }
        @keyframes separatorGrow {
          from { opacity: 0; transform: scaleX(0); width: 0; }
          to { opacity: 1; transform: scaleX(1); width: 80px; }
        }

        /* Tagline */
        .login-tagline {
          max-width: 460px; text-align: center; margin-bottom: 32px;
          animation: taglineIn 1s ease-out 0.7s forwards;
          opacity: 0;
        }
        @keyframes taglineIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Feature pills */
        .login-features {
          display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
        }
        .login-feature-pill {
          padding: 8px 18px; border-radius: 30px; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.8);
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(8px);
          animation: pillIn 0.8s ease-out forwards;
          opacity: 0;
        }
        .login-feature-pill:nth-child(1) { animation-delay: 1s; }
        .login-feature-pill:nth-child(2) { animation-delay: 1.2s; }
        .login-feature-pill:nth-child(3) { animation-delay: 1.4s; }
        @keyframes pillIn {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-feature-pill:hover {
          background: rgba(255,255,255,0.15);
          border-color: rgba(255,255,255,0.25);
          transform: translateY(-2px);
          transition: all 0.3s;
        }
      `}</style>
    </div>
  );
}
