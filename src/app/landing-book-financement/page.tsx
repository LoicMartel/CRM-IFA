"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";

const testimonials = [
  {
    name: "Natanael Wright",
    company: "Wall Street English France",
    photo: "/temoins/Natael Wright.jpeg",
    quote:
      "Gr\u00e2ce \u00e0 une analyse pointue et des solutions ad-hoc, les programmes d\u00e9ploy\u00e9s par M. Rafi MOUHAMAD ont eu un impact cons\u00e9quent et significatif sur nos performances commerciales. Il s\u2019est inscrit de mani\u00e8re durable au sein de notre r\u00e9seau comme un partenaire de confiance.",
  },
  {
    name: "Alexandra Attalauziti",
    company: "ADNR Formations",
    photo: "/temoins/Alexandra.jpeg",
    quote:
      "La technique de Rafi pour closer des prospects s\u2019est av\u00e9r\u00e9e extr\u00eamement efficace, port\u00e9e par une p\u00e9dagogie claire et une \u00e9nergie contagieuse. Mon \u00e9quipe a beaucoup appris gr\u00e2ce \u00e0 ses enseignements et aux pr\u00e9cieux conseils de son \u00e9quipe.",
  },
  {
    name: "Camille Barel",
    company: "ADREC",
    photo: "/temoins/Camille.jpeg",
    quote:
      "Un Bootcamp au top gr\u00e2ce \u00e0 Rafi et Alexandre de la Closing Acad\u00e9mie : un contenu riche, des recommandations pr\u00e9cises et un accompagnement personnalis\u00e9 de grande qualit\u00e9. Si vous aspirez \u00e0 exceller dans le closing, je recommande vivement cette \u00e9quipe d\u2019experts passionn\u00e9s.",
  },
  {
    name: "Nicholas Galtos",
    company: "Swiss Language Group",
    photo: "/temoins/Nicholas.jpeg",
    quote:
      "Rafi is one of the great Wall Street English success stories, becoming a major sales trainer thanks to his positivity, energy and commitment. I fully recommend him both for his professional sales skills and as a genuine, trustworthy person.",
  },
  {
    name: "Genevi\u00e8ve Machicote",
    company: "EDC",
    photo: "/temoins/Genevieve.jpeg",
    quote:
      "Rafi insuffle une nouvelle approche commerciale, \u00e0 la fois ax\u00e9e sur le client et sur la performance. Ses qualit\u00e9s humaines et p\u00e9dagogiques permettent une assimilation optimale de sa m\u00e9thode.",
  },
  {
    name: "Constance Herrmann",
    company: "Great Place to Work",
    photo: "/temoins/Constance.jpeg",
    quote:
      "Les formations de Rafi et de son \u00e9quipe nous ont donn\u00e9 les bons outils et r\u00e9flexes pour devenir de meilleurs commerciaux. Gr\u00e2ce \u00e0 lui, nous sommes plus motiv\u00e9s que jamais : je recommande \u00e0 100 % !!",
  },
  {
    name: "C\u00e9dric Jarre",
    company: "Coca-Cola Europacific Partners",
    photo: "/temoins/C\u00e9dric.jpeg",
    quote:
      "Rafi est devenu un acteur majeur de nos plans de formation et de coaching, ainsi qu\u2019une v\u00e9ritable r\u00e9f\u00e9rence pour nos \u00e9quipes. C\u2019est un grand professionnel qui challenge avec bienveillance pour faire grandir chacun. Un grand MERCI de notre part \u00e0 tous !!",
  },
  {
    name: "Th\u00e9o Becker",
    company: "RP France",
    photo: "/temoins/Th\u00e9o.jpeg",
    quote:
      "Une \u00e9quipe d\u2019experts tr\u00e8s \u00e0 l\u2019\u00e9coute, dont les conseils en management ont concr\u00e8tement am\u00e9lior\u00e9 l\u2019organisation et la coh\u00e9sion de notre \u00e9quipe. Un investissement que je recommande sans h\u00e9siter.",
  },
  {
    name: "Gautier Fabr\u00e8gues",
    company: "Wall Street English",
    photo: "/temoins/Gautier.jpeg",
    quote:
      "Rafi partage son savoir-faire avec exp\u00e9rience, bienveillance et des outils qui fonctionnent r\u00e9ellement. C\u2019est un partenaire de confiance qui fait grandir les gens, et c\u2019est un vrai plaisir de travailler avec lui.",
  },
];

const bookPoints = [
  "Comment int\u00e9grer les financements dans votre discours commercial",
  "Comment identifier les bons dispositifs selon vos prospects",
  "Comment transformer un \u00ab je n\u2019ai pas le budget \u00bb en solution",
  "Un premier dispositif d\u00e9taill\u00e9 : le PDC OPCO",
];

const benefits = [
  { icon: "\u2705", text: "Vous levez l\u2019objection budget" },
  { icon: "\u2705", text: "Vous augmentez votre taux de conversion" },
  { icon: "\u2705", text: "Vous raccourcissez vos cycles de vente" },
  { icon: "\u2705", text: "Vous vous diff\u00e9renciez clairement" },
];

export default function LandingBookFinancement() {
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
        body: JSON.stringify({ ...form, source: "landing-book-financement" }),
      });
      if (!res.ok) throw new Error("Erreur");
      window.location.href = "/book-financement-vsl";
    } catch {
      setError("Une erreur est survenue. Veuillez r\u00e9essayer.");
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen scroll-smooth bg-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* ===== HERO ===== */}
      <section style={{ background: "#2e7ab5" }}>
        <div className="mx-auto max-w-[960px] px-6 py-16 md:py-20">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-5">
              <Image
                src="/lca-white-logo.png"
                alt="La Closing Acad\u00e9mie"
                width={110}
                height={82}
                className="w-[110px] h-auto"
              />
              <h1 className="text-[26px] font-bold leading-[1.25] text-white md:text-[32px]">
                Aidez vos clients &agrave; s&apos;offrir vos formations !
              </h1>
              <p className="text-[14px] leading-[1.7] text-white/80">
                Ma&icirc;trisez les dispositifs de prise en charge de la formation professionnelle et continue (CPF, OPCO, FAF, France Travail...).
              </p>
              <p className="text-[14px] leading-[1.7] text-white/80">
                T&eacute;l&eacute;chargez gratuitement l&apos;&eacute;dition 2026 de notre Book Financements et d&eacute;couvrez comment transformer les prises en charge publiques en levier de vente.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-5 text-[18px] font-bold text-[#1a2a3a]">
                Obtenir le book &eacute;dition 2026 gratuitement
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    Pr&eacute;nom<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" name="firstName" required placeholder="ex: John"
                    value={form.firstName} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    Nom<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" name="lastName" required placeholder="ex: Doe"
                    value={form.lastName} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    Email<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email" name="email" required placeholder="ex: johndoe@gmail.com"
                    value={form.email} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    Num&eacute;ro de t&eacute;l&eacute;phone<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel" name="phone" required placeholder="+33"
                    value={form.phone} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    URL de la soci&eacute;t&eacute;
                  </label>
                  <input
                    type="text" name="website" placeholder="ex: www.url-de-la-societe.com"
                    value={form.website} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    Vous &ecirc;tes<span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, clientType: "particulier" })}
                      className={`flex-1 rounded border px-3 py-2.5 text-[14px] font-medium transition ${
                        form.clientType === "particulier"
                          ? "border-[#2e7ab5] bg-[#2e7ab5]/10 text-[#2e7ab5]"
                          : "border-gray-200 text-[#1a2a3a] hover:border-[#2e7ab5]/50"
                      }`}
                    >
                      Particulier
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, clientType: "entreprise" })}
                      className={`flex-1 rounded border px-3 py-2.5 text-[14px] font-medium transition ${
                        form.clientType === "entreprise"
                          ? "border-[#2e7ab5] bg-[#2e7ab5]/10 text-[#2e7ab5]"
                          : "border-gray-200 text-[#1a2a3a] hover:border-[#2e7ab5]/50"
                      }`}
                    >
                      Entreprise
                    </button>
                  </div>
                </div>
                <button
                  type="submit" disabled={loading || !form.clientType}
                  className="mt-1 w-full rounded bg-[#2e7ab5] py-3 text-[14px] font-semibold text-white transition hover:bg-[#256a9e] disabled:opacity-60"
                >
                  {loading ? "Envoi en cours\u2026" : "T\u00e9l\u00e9charger le book offert"}
                </button>
                {error && <p className="text-center text-[13px] text-red-500">{error}</p>}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ACCROCHE ===== */}
      <section style={{ background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)" }}>
        <div className="mx-auto max-w-[960px] px-6 py-14 text-center">
          <p className="text-[16px] font-bold leading-[1.6] text-[#1a2a3a] md:text-[18px]">
            80% des organismes de formation n&apos;utilisent pas les financements disponibles.
            Non pas parce qu&apos;ils n&apos;existent pas... Mais parce qu&apos;ils ne savent pas les mobiliser.
          </p>
        </div>
      </section>

      {/* ===== LE PROBLÈME ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14 text-center">
          <p className="mb-2 text-[13px] font-semibold text-[#2e7ab5]">Le probl&egrave;me</p>
          <h2 className="mb-3 text-[22px] font-bold text-[#1a2a3a]">
            Vos prospects veulent acheter...<br />mais ne passent pas &agrave; l&apos;action
          </h2>
          <p className="mx-auto mb-8 max-w-[600px] text-[14px] leading-[1.7] text-[#555]">
            Ils ont besoin de vos formations. Ils reconnaissent la valeur. Mais au moment de signer : le budget bloque.
          </p>
          <p className="mb-4 text-[13px] font-semibold text-[#1a2a3a]">R&eacute;sultat :</p>
          <div className="mx-auto flex max-w-[500px] justify-center gap-4">
            {[
              { icon: "\u274c", text: "Devis non sign\u00e9s" },
              { icon: "\u274c", text: "Ventes report\u00e9es" },
              { icon: "\u274c", text: "Opportunit\u00e9s perdues" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-[#f8fbfd] px-5 py-4">
                <span className="text-[20px]">{item.icon}</span>
                <span className="text-[12px] font-semibold text-[#1a2a3a]">{item.text}</span>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-[600px] text-[13px] leading-[1.7] text-[#555]">
            Le probl&egrave;me n&apos;est pas la demande. C&apos;est votre capacit&eacute; &agrave; activer les financements.
          </p>
        </div>
      </section>

      {/* ===== CE QUE VOUS ALLEZ DÉCOUVRIR ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 pb-14">
          <div className="mx-auto max-w-[700px] rounded-xl border border-gray-100 bg-[#f8fbfd] p-8 md:p-10">
            <p className="mb-2 text-[13px] font-semibold text-[#2e7ab5]">Le sommaire</p>
            <h3 className="mb-6 text-[22px] font-bold text-[#1a2a3a]">
              Ce que vous allez d&eacute;couvrir dans ce book
            </h3>
            <ul className="mb-8 flex flex-col gap-4">
              {bookPoints.map((item, i) => (
                <li key={i} className="flex items-center gap-4 text-[15px] text-[#1a2a3a]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-green-500 text-green-500">
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mb-8 text-[14px] leading-[1.7] text-[#555]">
              Aux dirigeants d&apos;organismes de formation et aux responsables commerciaux qui souhaitent aider leurs clients &agrave; s&apos;offrir leurs formations.
            </p>
            <Image
              src="/book-cover-financement.png"
              alt="Book Financements 2026 - Ten Steps"
              width={500}
              height={350}
              className="mx-auto h-auto w-full max-w-[500px] rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* ===== POUR QUI + CTA ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative h-[400px] w-[300px] overflow-hidden rounded-2xl bg-[#EFF5F9]">
                <Image
                  src="/photo-rafi-loic.png"
                  alt="Rafi et Lo\u00efc - La Closing Acad\u00e9mie"
                  width={300}
                  height={400}
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">Pour qui est ce book ?</p>
              <h3 className="mb-3 text-[18px] font-bold text-[#1a2a3a]">
                Ce book s&apos;adresse...
              </h3>
              <p className="mb-5 text-[14px] leading-[1.7] text-[#555]">
                Aux dirigeants d&apos;organismes de formation et aux responsables commerciaux qui souhaitent aider leurs clients &agrave; s&apos;offrir leurs formations.
              </p>
              <button
                onClick={scrollToTop}
                className="rounded bg-[#2e7ab5] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#256a9e]"
              >
                T&eacute;l&eacute;charger le book offert
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== BÉNÉFICES ===== */}
      <section style={{ background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 100%)" }}>
        <div className="mx-auto max-w-[960px] px-6 py-14 text-center">
          <p className="mb-2 text-[12px] font-semibold text-[#2e7ab5]">Les b&eacute;n&eacute;fices de ce book</p>
          <h2 className="mb-8 text-[22px] font-bold text-[#1a2a3a]">
            Ce que cela change concr&egrave;tement<br />quand vous ma&icirc;trisez les financements :
          </h2>
          <div className="mx-auto flex max-w-[700px] flex-wrap justify-center gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-white px-5 py-5" style={{ minWidth: 150, flex: "1 1 140px" }}>
                <span className="text-[24px]">{b.icon}</span>
                <span className="text-[12px] font-semibold text-[#1a2a3a] text-center">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== QUI SOMMES-NOUS ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative h-[450px] w-[320px] overflow-hidden rounded-2xl bg-[#EFF5F9]">
                <Image
                  src="/photo-rafi.png"
                  alt="Rafi Mouhamad - La Closing Acad\u00e9mie"
                  width={320}
                  height={450}
                  className="h-full w-full object-cover object-top"
                />
                <div className="absolute bottom-4 left-0 right-0 flex items-end justify-center gap-2">
                  <Image src="/logos/Qualiopi.webp" alt="Qualiopi" width={140} height={70} className="h-[55px] w-auto rounded-md shadow-md" />
                  <Image src="/logos/Edtech 2.png" alt="EdTech France" width={120} height={60} className="h-[55px] w-auto rounded-md shadow-md" />
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">Qui sommes-nous ?</p>
              <h3 className="mb-3 text-[22px] font-bold text-[#1a2a3a]">La Closing Acad&eacute;mie &reg;</h3>
              <p className="mb-5 text-[14px] leading-[1.7] text-[#555]">
                La Closing Acad&eacute;mie &reg; est le fruit de plus de 25 ans d&apos;accompagnement d&apos;entrepreneurs, de dirigeants, de managers et de commerciaux sur + 20 pays.
              </p>
              <button
                onClick={scrollToTop}
                className="rounded bg-[#2e7ab5] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#256a9e]"
              >
                T&eacute;l&eacute;charger le book offert
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOGOS CLIENTS ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-8">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-8">
            {[
              { src: "/logos/ADREC.png", alt: "ADREC" },
              { src: "/logos/Cartesia.png", alt: "Cartesia Education" },
              { src: "/logos/Business France.png", alt: "Business France" },
              { src: "/logos/Leyton.png", alt: "Leyton" },
              { src: "/logos/Traning academy.png", alt: "Training Academy" },
              { src: "/logos/Great place to work.png", alt: "Great Place to Work" },
            ].map((logo, i) => (
              <Image key={i} src={logo.src} alt={logo.alt} width={120} height={50} className="h-[40px] w-auto object-contain" />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { src: "/logos/Wall street english.png", alt: "Wall Street English" },
              { src: "/logos/ABC Formation.png", alt: "ABC Cours Particuliers" },
              { src: "/logos/CCI Gironde.png", alt: "CCI Bordeaux Gironde" },
              { src: "/logos/Edtech.png", alt: "EdTech France" },
            ].map((logo, i) => (
              <Image key={i} src={logo.src} alt={logo.alt} width={120} height={50} className="h-[40px] w-auto object-contain" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== TÉMOIGNAGES ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14">
          <div className="mb-8 text-center">
            <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">T&eacute;moignages</p>
            <h2 className="mb-2 text-[22px] font-bold text-[#1a2a3a]">Ils nous ont fait confiance</h2>
            <Image src="/logos/Google.png" alt="Google 5 \u00e9toiles" width={150} height={40} className="mx-auto h-[35px] w-auto" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-lg border border-gray-100 bg-[#f8fbfd] p-5"
              >
                <p className="mb-4 text-[12px] leading-[1.7] text-[#444]">
                  {t.quote}
                </p>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                  <Image src={t.photo} alt={t.name} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  <div>
                    <p className="text-[12px] font-bold text-[#1a2a3a]">{t.name}</p>
                    <p className="text-[11px] text-[#888]">{t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[700px] px-6 py-14">
          <div className="rounded-xl px-8 py-10 text-center" style={{ background: "#2e7ab5" }}>
            <h2 className="mb-3 text-[20px] font-bold leading-tight text-white md:text-[24px]">
              Aidez vos clients &agrave; s&apos;offrir vos formations !
            </h2>
            <p className="mx-auto mb-6 max-w-lg text-[12px] leading-[1.7] text-white/80">
              Ma&icirc;trisez les dispositifs de prise en charge de la formation professionnelle et continue (CPF, OPCO, FAF, France Travail...). T&eacute;l&eacute;chargez gratuitement l&apos;&eacute;dition 2026 de notre Book Financements et d&eacute;couvrez comment transformer les prises en charge publiques en levier de vente.
            </p>
            <button
              onClick={scrollToTop}
              className="rounded bg-white px-5 py-2.5 text-[13px] font-semibold text-[#2e7ab5] transition hover:bg-gray-100"
            >
              T&eacute;l&eacute;charger le book 2026
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-white border-t border-gray-100">
        <div className="mx-auto max-w-[960px] px-6 py-6 text-center text-[12px] text-[#999]">
          <div className="mb-2 flex flex-wrap justify-center gap-4">
            <a href="https://www.ifagroupe.com/cgv" target="_blank" rel="noopener noreferrer" className="transition hover:text-[#555]">Conditions g&eacute;n&eacute;rales de vente</a>
            <span>|</span>
            <a href="https://www.ifagroupe.com/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" className="transition hover:text-[#555]">Politique de confidentialit&eacute;</a>
            <span>|</span>
            <a href="https://www.ifagroupe.com/mentions-legales" target="_blank" rel="noopener noreferrer" className="transition hover:text-[#555]">Mentions l&eacute;gales</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
