"use client";

import { useState, FormEvent } from "react";

export default function EmbedFormBookPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    website: "",
    clientType: "" as "particulier" | "entreprise" | "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/leads/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "embed-form-book" }),
      });
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setSuccess(true);
      if (window.top !== window.self) {
        window.top?.postMessage({ type: "lca-form-success", clientType: form.clientType }, "*");
      }
      const cid = data.contactId || "";
      window.top!.location.href = `https://www.closing-academie.com/book-financement-2026-typ${cid ? `?cid=${cid}` : ""}`;
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ fontFamily: "'Montserrat', sans-serif", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#2e7ab5" }}>Merci ! Redirection en cours...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", padding: "0 8px", background: "transparent" }}>
      <div style={{ background: "white", borderRadius: 8, padding: "20px 16px", maxWidth: 440, margin: "0 auto", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", marginBottom: 20, marginTop: 0 }}>
          Obtenir le book &eacute;dition 2026 gratuitement
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
              Pr&eacute;nom<span style={{ color: "#e74c3c" }}>*</span>
            </label>
            <input
              type="text" name="firstName" required placeholder="ex: John"
              value={form.firstName} onChange={handleChange}
              style={{ width: "100%", borderRadius: 4, border: "1px solid #e0e0e0", padding: "10px 12px", fontSize: 14, color: "#1a2a3a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
              Nom<span style={{ color: "#e74c3c" }}>*</span>
            </label>
            <input
              type="text" name="lastName" required placeholder="ex: Doe"
              value={form.lastName} onChange={handleChange}
              style={{ width: "100%", borderRadius: 4, border: "1px solid #e0e0e0", padding: "10px 12px", fontSize: 14, color: "#1a2a3a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
              Email<span style={{ color: "#e74c3c" }}>*</span>
            </label>
            <input
              type="email" name="email" required placeholder="ex: johndoe@gmail.com"
              value={form.email} onChange={handleChange}
              style={{ width: "100%", borderRadius: 4, border: "1px solid #e0e0e0", padding: "10px 12px", fontSize: 14, color: "#1a2a3a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
              Num&eacute;ro de t&eacute;l&eacute;phone<span style={{ color: "#e74c3c" }}>*</span>
            </label>
            <input
              type="tel" name="phone" required placeholder="+33"
              value={form.phone} onChange={handleChange}
              style={{ width: "100%", borderRadius: 4, border: "1px solid #e0e0e0", padding: "10px 12px", fontSize: 14, color: "#1a2a3a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
              URL de la soci&eacute;t&eacute;<span style={{ color: "#e74c3c" }}>*</span>
            </label>
            <input
              type="text" name="website" required placeholder="ex: www.url-de-la-societe.com"
              value={form.website} onChange={handleChange}
              style={{ width: "100%", borderRadius: 4, border: "1px solid #e0e0e0", padding: "10px 12px", fontSize: 14, color: "#1a2a3a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>
              Vous &ecirc;tes<span style={{ color: "#e74c3c" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setForm({ ...form, clientType: "particulier" })}
                style={{
                  flex: 1, borderRadius: 4, padding: "10px 12px", fontSize: 14, fontWeight: 500, cursor: "pointer",
                  border: form.clientType === "particulier" ? "1px solid #2e7ab5" : "1px solid #e0e0e0",
                  background: form.clientType === "particulier" ? "rgba(46,122,181,0.1)" : "white",
                  color: form.clientType === "particulier" ? "#2e7ab5" : "#1a2a3a",
                }}
              >
                Particulier
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, clientType: "entreprise" })}
                style={{
                  flex: 1, borderRadius: 4, padding: "10px 12px", fontSize: 14, fontWeight: 500, cursor: "pointer",
                  border: form.clientType === "entreprise" ? "1px solid #2e7ab5" : "1px solid #e0e0e0",
                  background: form.clientType === "entreprise" ? "rgba(46,122,181,0.1)" : "white",
                  color: form.clientType === "entreprise" ? "#2e7ab5" : "#1a2a3a",
                }}
              >
                Entreprise
              </button>
            </div>
          </div>
          <button
            type="submit" disabled={loading || !form.clientType}
            style={{
              marginTop: 4, width: "100%", borderRadius: 4, border: "none", padding: "12px 0",
              fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer",
              background: "#2e7ab5", opacity: loading || !form.clientType ? 0.6 : 1,
            }}
          >
            {loading ? "Envoi en cours\u2026" : "T\u00e9l\u00e9charger le book offert"}
          </button>
          {error && <p style={{ textAlign: "center", fontSize: 13, color: "#e74c3c", margin: 0 }}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
