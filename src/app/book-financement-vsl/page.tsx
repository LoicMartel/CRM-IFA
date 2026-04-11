"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BookFinancementTypContent() {
  const searchParams = useSearchParams();
  const cid = searchParams.get("cid");

  function handleDownloadClick() {
    if (cid) {
      fetch("/api/book-download/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: cid }),
      }).catch(() => {});
    }
  }

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Montserrat', sans-serif" }}>

      {/* ===== HERO — Merci + Upsell ===== */}
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

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 14, lineHeight: 1.3 }}>
          Regardez d&egrave;s maintenant votre bo&icirc;te mail 😉
        </h1>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 32, marginBottom: 6 }}>Pour aller plus loin</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 28 }}>
          La version compl&egrave;te vous donne acc&egrave;s &agrave; :
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", maxWidth: 800, margin: "0 auto 28px" }}>
          {[
            "Tous les dispositifs (OPCO, FAF, CPF, France Travail...)",
            "Une méthode claire pour identifier le bon financement",
            "Les clés pour monter et sécuriser vos dossiers",
            "Une stratégie commerciale fondée sur les financements",
          ].map((item, i) => (
            <div key={i} style={{
              flex: "1 1 170px", maxWidth: 200, padding: "24px 14px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", textAlign: "center",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", border: "2px solid #27ae60",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", color: "#27ae60",
              }}>
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "white", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 14, fontWeight: 600 }}>
          Acc&eacute;dez d&egrave;s aujourd&apos;hui au book complet en pr&eacute;-vente pour <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>39&nbsp;&euro;</span> <span style={{ textDecoration: "line-through", opacity: 0.7 }}>49&nbsp;&euro;</span>
        </p>
        <a
          href="https://buy.stripe.com/bJedR8dso89x6vd2MqfYY07"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block", padding: "14px 32px", borderRadius: 6,
            background: "white", color: "#2e7ab5", fontSize: 15, fontWeight: 700,
            textDecoration: "none", transition: "all 0.2s",
          }}
        >
          Acc&eacute;der au Book complet
        </a>
      </section>

      {/* ===== PROMO FINANCES FINDER ===== */}
      <section style={{ background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)", padding: "60px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#2e7ab5", marginBottom: 6 }}>Notre outil en ligne</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 10, lineHeight: 1.3 }}>
          D&eacute;couvrez Finances Finder
        </h2>
        <p style={{ fontSize: 14, color: "#5a6f80", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 28px" }}>
          Identifiez automatiquement les financements disponibles pour vos apprenants.
          En quelques clics, trouvez les dispositifs adapt&eacute;s (CPF, OPCO, France Travail, R&eacute;gion...)
          et maximisez les prises en charge pour vos clients.
        </p>

        <div style={{ maxWidth: 700, margin: "0 auto 28px", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
          <img
            src="/finances-finder-preview.png"
            alt="Finances Finder — potentiel de financement et dispositifs applicables"
            style={{ width: "100%", display: "block" }}
          />
        </div>

        <a
          href="/booking-pauline"
          style={{
            display: "inline-block", padding: "14px 28px", borderRadius: 8,
            background: "#2e7ab5", color: "white", fontSize: 14, fontWeight: 700,
            textDecoration: "none", transition: "all 0.2s",
          }}
        >
          Essayer Finances Finder
        </a>
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

export default function BookFinancementTyp() {
  return (
    <Suspense>
      <BookFinancementTypContent />
    </Suspense>
  );
}
