"use client";

import Image from "next/image";
import { CheckCircle } from "lucide-react";

export default function ConfirmationAchatBookFinancement() {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', Arial, sans-serif" }}>

      {/* ===== HERO ===== */}
      <section style={{ background: "#2e7ab5", padding: "50px 24px 60px", textAlign: "center", color: "white" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 64, height: 64, border: "2px solid rgba(255,255,255,0.7)", borderRadius: 10,
          padding: "5px 7px", marginBottom: 30,
        }}>
          <span style={{
            color: "white", fontSize: 10, fontWeight: 700, lineHeight: 1.2,
            textAlign: "center", letterSpacing: "-0.02em",
          }}>
            LA<br />CLOSING<br />ACAD&Eacute;MIE<span style={{ fontSize: 6, verticalAlign: "super" }}>&reg;</span>
          </span>
        </div>

        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <CheckCircle style={{ width: 40, height: 40, color: "#4caf50" }} />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 14, lineHeight: 1.3 }}>
          Merci pour votre achat !
        </h1>
        <p style={{
          fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.85)",
          maxWidth: 580, margin: "0 auto 24px", fontWeight: 400,
        }}>
          Votre book 2026 sera bient&ocirc;t pr&ecirc;t !
        </p>
        <p style={{
          fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.7)",
          maxWidth: 580, margin: "0 auto", fontStyle: "italic",
        }}>
          *Le book 2026 sera disponible mi-avril en raison des r&eacute;centes r&eacute;glementations en vigueur. Vous le recevrez par email sit&ocirc;t disponible.
        </p>
      </section>

      {/* ===== CE QUE VOUS AVEZ DÉBLOQUÉ ===== */}
      <section style={{ background: "white", padding: "60px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#2e7ab5", marginBottom: 6 }}>Ce que vous avez d&eacute;bloqu&eacute;</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 28 }}>
          Dans la version compl&egrave;te, vous d&eacute;couvrez :
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", maxWidth: 800, margin: "0 auto" }}>
          {[
            "Tous les dispositifs (OPCO, FAF, CPF, France Travail...)",
            "Une m\u00e9thode claire pour identifier le bon financement",
            "Les cl\u00e9s pour monter et s\u00e9curiser vos dossiers",
            "Une strat\u00e9gie commerciale fond\u00e9e sur les financements",
          ].map((item, i) => (
            <div key={i} style={{
              flex: "1 1 170px", maxWidth: 200, padding: "24px 14px", borderRadius: 12,
              border: "1px solid #e8ecf1", background: "#f8fbfd", textAlign: "center",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", border: "2px solid #27ae60",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", color: "#27ae60",
              }}>
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1a2a3a", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== POURQUOI MAÎTRISER LES FINANCEMENTS ===== */}
      <section style={{ background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)", padding: "60px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <Image
            src="/confirmation-financement-pourquoi.png"
            alt="Pourquoi ma\u00eetriser les financements est un levier strat\u00e9gique"
            width={800}
            height={400}
            className="w-full h-auto rounded-xl shadow-md"
          />
        </div>
      </section>

      {/* ===== BESOIN D'ACCOMPAGNEMENT ===== */}
      <section style={{ background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#2e7ab5", marginBottom: 6 }}>Pour aller plus loin</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>
            Besoin d&apos;un accompagnement personnalis&eacute; ?
          </h2>
          <p style={{ fontSize: 15, color: "#5a6f80", lineHeight: 1.7, marginBottom: 24 }}>
            Nos experts vous aident &agrave; int&eacute;grer les financements dans votre strat&eacute;gie commerciale
            et &agrave; maximiser les prises en charge pour vos clients.
          </p>
          <a
            href="/booking-pauline"
            style={{
              display: "inline-block", padding: "14px 28px", borderRadius: 8,
              background: "#2e7ab5", color: "white", fontSize: 14, fontWeight: 700,
              textDecoration: "none",
            }}
          >
            R&eacute;server un appel de d&eacute;couverte gratuit
          </a>
        </div>
      </section>

      {/* ===== CTA FINAL — Finances Finder ===== */}
      <section style={{ background: "white", padding: "50px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ borderRadius: 16, padding: "40px 32px", textAlign: "center", background: "#2e7ab5" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 12, lineHeight: 1.3 }}>
              D&eacute;couvrez Finances Finder
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 8px" }}>
              L&apos;outil qui identifie automatiquement les financements disponibles pour vos apprenants.
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 20px" }}>
              En quelques clics, trouvez les dispositifs adapt&eacute;s (CPF, OPCO, France Travail, R&eacute;gion...)
              et maximisez les prises en charge pour vos clients.
            </p>
            <a
              href="/booking-pauline"
              style={{
                display: "inline-block", padding: "14px 28px", borderRadius: 8,
                background: "white", color: "#2e7ab5", fontSize: 14, fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Essayer Finances Finder
            </a>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{
        borderTop: "1px solid #e8ecf1", padding: "20px 24px",
        textAlign: "center", fontSize: 11, color: "#8399a9",
        display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap",
      }}>
        <a href="https://www.closing-academie.com/cgv" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Conditions g&eacute;n&eacute;rales de vente</a>
        <a href="https://www.closing-academie.com/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Politique de confidentialit&eacute;</a>
        <a href="https://www.closing-academie.com/mentions-legales" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Mentions l&eacute;gales</a>
      </footer>
    </div>
  );
}
