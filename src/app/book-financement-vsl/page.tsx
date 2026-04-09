"use client";

export default function BookFinancementTyp() {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Montserrat', sans-serif" }}>

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

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 14, lineHeight: 1.3 }}>
          Aidez vos clients &agrave; s&apos;offrir vos formations !
        </h1>
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.85)",
          maxWidth: 600, margin: "0 auto 28px", fontWeight: 400,
        }}>
          Ma&icirc;trisez les dispositifs de prise en charge de la formation professionnelle et continue (CPF, OPCO, FAF, France Travail...). Vous pouvez acc&eacute;der imm&eacute;diatement &agrave; la version offerte :
        </p>

        <a
          href="/book-financement-download.pdf"
          download
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 6,
            border: "2px solid white", color: "white", fontSize: 14, fontWeight: 600,
            textDecoration: "none", transition: "all 0.2s",
          }}
        >
          T&eacute;l&eacute;charger la version offerte
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
            "Un premier dispositif cl\u00e9 (PDC OPCO)",
            "Comment int\u00e9grer ce levier dans votre approche commerciale",
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

      {/* ===== POUR ALLER PLUS LOIN ===== */}
      <section style={{ background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)", padding: "60px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#2e7ab5", marginBottom: 6 }}>Pour aller plus loin</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2a3a", marginBottom: 28 }}>
          La version compl&egrave;te vous donne acc&egrave;s &agrave; :
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", maxWidth: 800, margin: "0 auto 28px" }}>
          {[
            "Tous les dispositifs (OPCO, FAF, CPF, France Travail...)",
            "Une m\u00e9thode claire pour identifier le bon financement",
            "Les cl\u00e9s pour monter et s\u00e9curiser vos dossiers",
            "Une strat\u00e9gie commerciale fond\u00e9e sur les financements",
          ].map((item, i) => (
            <div key={i} style={{
              flex: "1 1 170px", maxWidth: 200, padding: "24px 14px", borderRadius: 12,
              border: "1px solid #e8ecf1", background: "white", textAlign: "center",
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

        <a
          href="https://buy.stripe.com/bJedR8dso89x6vd2MqfYY07"
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 6,
            background: "#2e7ab5", color: "white", fontSize: 14, fontWeight: 600,
            textDecoration: "none", transition: "all 0.2s",
          }}
        >
          Acc&eacute;der au Book complet
        </a>
      </section>

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
