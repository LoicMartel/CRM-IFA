"use client";

import { CheckCircle } from "lucide-react";

export default function ConfirmationDecouverte() {
  return (
    <>
    <style>{`
      @media (max-width: 640px) {
        .confirm-h1 { font-size: 24px !important; }
      }
    `}</style>
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', Arial, sans-serif" }}>

      {/* ===== HERO HEADER ===== */}
      <section style={{
        background: "#2e7ab5",
        padding: "60px 24px 80px",
        textAlign: "center",
        color: "white",
      }}>
        {/* Logo */}
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 72, height: 72, border: "2px solid rgba(255,255,255,0.7)", borderRadius: 10,
          padding: "6px 8px", marginBottom: 40,
        }}>
          <span style={{
            color: "white", fontSize: 11, fontWeight: 700, lineHeight: 1.2,
            textAlign: "center", fontFamily: "'Montserrat', sans-serif",
            letterSpacing: "-0.02em",
          }}>
            LA<br />CLOSING<br />ACAD&Eacute;MIE<span style={{ fontSize: 7, verticalAlign: "super" }}>&reg;</span>
          </span>
        </div>

        {/* Check icon */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <CheckCircle style={{ width: 40, height: 40, color: "#4caf50" }} />
        </div>

        <h1 className="confirm-h1" style={{
          fontSize: 32, fontWeight: 700, marginBottom: 18,
          lineHeight: 1.3,
        }}>
          Votre appel d&eacute;couverte est r&eacute;serv&eacute;.
        </h1>
        <p style={{
          fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.85)",
          maxWidth: 580, margin: "0 auto", fontWeight: 500,
        }}>
          Merci pour votre confiance. Vous allez b&eacute;n&eacute;ficier d&apos;un appel offert,
          enti&egrave;rement d&eacute;di&eacute; aux solutions de financement et de prise en charge
          disponibles pour vos apprenants.
        </p>
      </section>

      {/* ===== CE QUE NOUS ALLONS FAIRE ===== */}
      <section style={{ background: "white", padding: "60px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>
            Voici ce que nous allons faire ensemble
          </h2>
          <p style={{ fontSize: 16, color: "#5a6f80", marginBottom: 20, lineHeight: 1.6 }}>
            Durant cet appel, nous allons :
          </p>
          <ul style={{
            listStyle: "none", padding: 0, margin: "0 0 28px 0",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {[
              "Analyser le profil de vos apprenants et leur \u00e9ligibilit\u00e9 aux dispositifs existants",
              "Identifier les financements mobilisables (CPF, OPCO, France Travail, R\u00e9gion, etc.)",
              "\u00c9tudier comment structurer vos offres pour maximiser les prises en charge",
              "D\u00e9finir ensemble les leviers pour lever les freins financiers \u00e0 l\u2019inscription",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 16, color: "#1a2a3a", lineHeight: 1.6, paddingLeft: 20, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#FF6B35" }}>&mdash;</span>
                {item}
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 18 }}>
            L&apos;objectif est simple : comprendre pr&eacute;cis&eacute;ment votre situation et d&eacute;terminer
            quels dispositifs de financement sont accessibles &agrave; vos clients pour s&apos;offrir vos formations.
          </p>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 18 }}>
            Si nous estimons pouvoir vous aider, nous vous expliquerons comment int&eacute;grer ces solutions
            dans votre parcours de vente pour augmenter vos taux de conversion et votre chiffre d&apos;affaires.
          </p>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7 }}>
            Vous repartirez avec une premi&egrave;re vision claire des financements adapt&eacute;s &agrave; votre organisme.
          </p>
        </div>
      </section>

      {/* ===== ENGAGEMENT RÉCIPROQUE ===== */}
      <section style={{
        background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)",
        padding: "60px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>
            Un engagement r&eacute;ciproque
          </h2>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7 }}>
            Nous sommes une entreprise &agrave; taille humaine. Chaque &eacute;change est pr&eacute;par&eacute;
            avec attention pour vous apporter des solutions concr&egrave;tes et actionnables directement.
            Nous comptons donc sur votre pr&eacute;sence. En cas d&apos;impr&eacute;vu, merci de nous pr&eacute;venir
            &agrave; l&apos;avance afin que nous puissions r&eacute;attribuer ce cr&eacute;neau.
          </p>
        </div>
      </section>

      {/* ===== VIDÉO TÉMOIGNAGE ===== */}
      <section style={{ background: "white", padding: "60px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>
            En attendant notre &eacute;change...
          </h2>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 10 }}>
            Prenez 2 minutes pour d&eacute;couvrir le t&eacute;moignage d&apos;une dirigeante accompagn&eacute;e par la Closing Acad&eacute;mie.
          </p>
          <p style={{ fontSize: 16, color: "#1a2a3a", fontWeight: 600, lineHeight: 1.7, marginBottom: 10 }}>
            Fondatrice et dirigeante de l&apos;organisme de formation &quot;French As You Like It&quot;,
            Marguerite est pass&eacute;e de 300 K&euro; &agrave; 600 K&euro; de chiffre d&apos;affaires
            avec notre accompagnement commercial.
          </p>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 28 }}>
            Cette vid&eacute;o vous permettra d&apos;aborder notre appel avec une vision plus concr&egrave;te des r&eacute;sultats possibles.
          </p>

          {/* YouTube embed */}
          <div style={{
            position: "relative", paddingBottom: "56.25%", height: 0,
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}>
            <iframe
              src="https://www.youtube.com/embed/k9TUjjsDe6A"
              title="T&eacute;moignage - La Closing Acad&eacute;mie"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: "absolute", top: 0, left: 0,
                width: "100%", height: "100%", border: "none",
              }}
            />
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{
        borderTop: "1px solid #e8ecf1",
        padding: "20px 24px",
        textAlign: "center",
        fontSize: 11, color: "#8399a9",
        display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap",
      }}>
        <a href="https://www.closing-academie.com/cgv" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Conditions g&eacute;n&eacute;rales de vente</a>
        <a href="https://www.closing-academie.com/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Politique de confidentialit&eacute;</a>
        <a href="https://www.closing-academie.com/mentions-legales" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Mentions l&eacute;gales</a>
      </footer>
    </div>
    </>
  );
}
