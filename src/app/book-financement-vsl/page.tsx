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
          Merci de votre int&eacute;r&ecirc;t
        </h1>
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.85)",
          maxWidth: 600, margin: "0 auto 32px", fontWeight: 400,
        }}>
          Vous allez recevoir votre book Financements gratuit par email dans quelques instants.
        </p>

        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>Pour aller plus loin</p>
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

        <a
          href="https://buy.stripe.com/bJedR8dso89x6vd2MqfYY07"
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 6,
            background: "white", color: "#2e7ab5", fontSize: 14, fontWeight: 600,
            textDecoration: "none", transition: "all 0.2s",
          }}
        >
          Acc&eacute;der au Book complet
        </a>
      </section>

      {/* ===== CE QUE VOUS VENEZ DE DÉBLOQUER ===== */}
      <section style={{ background: "white", padding: "60px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#2e7ab5", marginBottom: 6 }}>Ce que vous venez de d&eacute;bloquer</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2a3a", marginBottom: 28 }}>
          Dans cette version, vous d&eacute;couvrez :
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", maxWidth: 700, margin: "0 auto" }}>
          {[
            "La logique des financements publics",
            "Un premier dispositif clé (PDC OPCO)",
            "Comment intégrer ce levier dans votre approche commerciale",
          ].map((item, i) => (
            <div key={i} style={{
              flex: "1 1 180px", maxWidth: 220, padding: "24px 16px", borderRadius: 12,
              border: "1px solid #e8ecf1", background: "#f8fbfd", textAlign: "center",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", border: "2px solid #27ae60",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", color: "#27ae60",
              }}>
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* spacer between sections */}

      {/* ===== FOOTER ===== */}
      <footer style={{
        borderTop: "1px solid #e8ecf1", padding: "20px 24px",
        textAlign: "center", fontSize: 11, color: "#8399a9",
        display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap",
      }}>
        <span>Conditions g&eacute;n&eacute;rales de vente</span>
        <span>Politique de confidentialit&eacute;</span>
        <span>Mentions l&eacute;gales</span>
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
