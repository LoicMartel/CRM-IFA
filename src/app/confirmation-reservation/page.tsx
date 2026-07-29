"use client";

import { CheckCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function ConfirmationReservation() {
  return <Suspense><ConfirmationReservationContent /></Suspense>;
}

function ConfirmationReservationContent() {
  const searchParams = useSearchParams();
  const assignedName = searchParams.get("name");
  const assignedPhoto = searchParams.get("photo");

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
            LA<br />CLOSING<br />ACADÉMIE<span style={{ fontSize: 7, verticalAlign: "super" }}>®</span>
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
          Votre bilan commercial est réservé.
        </h1>
        <p style={{
          fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.85)",
          maxWidth: 580, margin: "0 auto", fontWeight: 500,
        }}>
          Merci pour votre confiance. Vous allez bénéficier d&apos;un bilan commercial offert,
          entièrement dédié à la performance commerciale de votre entreprise.
        </p>

        {assignedName && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 14,
            background: "rgba(255,255,255,0.15)", borderRadius: 14,
            padding: "12px 24px", marginTop: 28,
          }}>
            {assignedPhoto && (
              <img
                src={assignedPhoto}
                alt={assignedName}
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  objectFit: "cover", objectPosition: "top",
                  border: "2px solid rgba(255,255,255,0.6)",
                }}
              />
            )}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Votre interlocuteur
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "white" }}>
                {assignedName}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== CE QUE NOUS ALLONS FAIRE ===== */}
      <section style={{ background: "white", padding: "60px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>
            Voici ce que nous allons faire ensemble
          </h2>
          <p style={{ fontSize: 16, color: "#5a6f80", marginBottom: 20, lineHeight: 1.6 }}>
            Durant ce bilan commercial, nous allons :
          </p>
          <ul style={{
            listStyle: "none", padding: 0, margin: "0 0 28px 0",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {[
              "Analyser vos performances actuelles (vos KPIs commerciaux)",
              "Étudier votre organisation commerciale",
              "Analyser les standards de votre marché",
              "Définir ensemble comment accroître vos performances",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 16, color: "#1a2a3a", lineHeight: 1.6, paddingLeft: 20, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#E8732A" }}>—</span>
                {item}
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 18 }}>
            L&apos;objectif est simple : comprendre précisément votre situation et déterminer les leviers prioritaires d&apos;amélioration.
          </p>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 18 }}>
            Si nous estimons pouvoir vous aider, nous vous expliquerons comment déployer une culture commerciale plus performante et structurée au sein de votre organisme.
          </p>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7 }}>
            Vous repartirez également avec une première vision claire d&apos;une stratégie commerciale adaptée à votre entreprise.
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
            Un engagement réciproque
          </h2>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7 }}>
            Nous sommes une entreprise à taille humaine. Chaque session stratégique est préparée avec attention.
            Nous comptons donc sur votre présence. En cas d&apos;imprévu, merci de nous prévenir à l&apos;avance
            afin que nous puissions réattribuer ce créneau.
          </p>
        </div>
      </section>

      {/* ===== VIDÉO TÉMOIGNAGE ===== */}
      <section style={{ background: "white", padding: "60px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>
            En attendant notre échange...
          </h2>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 10 }}>
            Prenez 2 minutes pour découvrir le témoignage d&apos;un dirigeant accompagné par la IFA Formatio.
          </p>
          <p style={{ fontSize: 16, color: "#1a2a3a", fontWeight: 600, lineHeight: 1.7, marginBottom: 10 }}>
            Il est passé de 1,5 M€ à 2,7 M€ de chiffre d&apos;affaires en 12 mois après avoir structuré son approche commerciale.
          </p>
          <p style={{ fontSize: 16, color: "#5a6f80", lineHeight: 1.7, marginBottom: 28 }}>
            Cette vidéo vous permettra d&apos;aborder notre session avec une vision plus concrète des résultats possibles.
          </p>

          {/* YouTube embed */}
          <div style={{
            position: "relative", paddingBottom: "56.25%", height: 0,
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}>
            <iframe
              src="https://www.youtube.com/embed/qxPHiC96_ss"
              title="Témoignage - IFA Formatio"
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
        <a href="https://www.ifagroupe.com/cgv" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Conditions générales de vente</a>
        <a href="https://www.ifagroupe.com/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Politique de confidentialité</a>
        <a href="https://www.ifagroupe.com/mentions-legales" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>Mentions légales</a>
      </footer>
    </div>
    </>
  );
}
