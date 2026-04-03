"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";

const subtitleText =
  "Comme plus de 200 dirigeants \u2014 Wall Street English, Cartesia Education, ABC Cours Particuliers, Great Place To Work France, Leyton France, Berlitz France\u2026 Transformez vos leads en RDV, plus de clients et plus de croissance, sans augmenter VOTRE budget publicitaire.";

const challenges = [
  "Chiffre d\u2019affaires insuffisant",
  "Cycles de vente trop longs",
  "Taux de conversion trop faible",
  "Taux de closing insuffisant",
  "Trop peu de rendez-vous commerciaux par semaine",
  "Paniers moyens bas",
  "ROAS insuffisant",
  "Commerciaux démotivés",
  "Turnover élevé",
  "Difficultés à former et coacher vos commerciaux",
];

const goals = [
  "Accélérer votre croissance et vos ventes",
  "Augmenter vos marges et votre rentabilité",
  "Stabiliser votre trésorerie",
  "Développer votre chiffre d\u2019affaires",
  "Fiabiliser et motiver vos équipes commerciales",
  "Libérer du temps pour vous et vos projets personnels",
  "Valoriser votre entreprise pour préparer une transition réussie",
];

const testimonials = [
  {
    name: "Natanael Wright",
    company: "Wall Street English France",
    quote:
      "Grâce à une analyse pointue et des solutions ad-hoc, les programmes déployés par M. Rafi MOUHAMAD ont eu un impact conséquent et significatif sur nos performances commerciales. Il s\u2019est inscrit de manière durable au sein de notre réseau comme un partenaire de confiance.",
  },
  {
    name: "Alexandra Attalauziti",
    company: "ADNR Formations",
    quote:
      "La technique de Rafi pour closer des prospects s\u2019est avérée extrêmement efficace, portée par une pédagogie claire et une énergie contagieuse. Mon équipe a beaucoup appris grâce à ses enseignements et aux précieux conseils de son équipe.",
  },
  {
    name: "Camille Barel",
    company: "ADREC",
    quote:
      "Un Bootcamp au top grâce à Rafi et Alexandre de la Closing Académie : un contenu riche, des recommandations précises et un accompagnement personnalisé de grande qualité. Si vous aspirez à exceller dans le closing, je recommande vivement cette équipe d\u2019experts passionnés.",
  },
  {
    name: "Nicholas Galtos",
    company: "Swiss Language Group",
    quote:
      "Rafi is one of the great Wall Street English success stories, becoming a major sales trainer thanks to his positivity, energy and commitment. I fully recommend him both for his professional sales skills and as a genuine, trustworthy person.",
  },
  {
    name: "Geneviève Machicote",
    company: "EDC",
    quote:
      "Rafi insuffle une nouvelle approche commerciale, à la fois axée sur le client et sur la performance. Ses qualités humaines et pédagogiques permettent une assimilation optimale de sa méthode.",
  },
  {
    name: "Constance Herrmann",
    company: "Great Place to Work",
    quote:
      "Les formations de Rafi et de son équipe nous ont donné les bons outils et réflexes pour devenir de meilleurs commerciaux. Grâce à lui, nous sommes plus motivés que jamais : je recommande à 100 % !!",
  },
  {
    name: "Cédric Jarre",
    company: "Coca-Cola Europacific Partners",
    quote:
      "Rafi est devenu un acteur majeur de nos plans de formation et de coaching, ainsi qu\u2019une véritable référence pour nos équipes. C\u2019est un grand professionnel qui challenge avec bienveillance pour faire grandir chacun. Un grand MERCI de notre part à tous !!",
  },
  {
    name: "Théo Becker",
    company: "RP France",
    quote:
      "Une équipe d\u2019experts très à l\u2019écoute, dont les conseils en management ont concrètement amélioré l\u2019organisation et la cohésion de notre équipe. Un investissement que je recommande sans hésiter.",
  },
  {
    name: "Gautier Fabrègues",
    company: "Wall Street English",
    quote:
      "Rafi partage son savoir-faire avec expérience, bienveillance et des outils qui fonctionnent réellement. C\u2019est un partenaire de confiance qui fait grandir les gens, et c\u2019est un vrai plaisir de travailler avec lui.",
  },
];

export default function LandingPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    website: "",
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
        body: JSON.stringify({ ...form, source: "landing-page" }),
      });
      if (!res.ok) throw new Error("Erreur");
      window.location.href = "/vsl";
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
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
                alt="La Closing Académie"
                width={110}
                height={82}
                className="w-[110px] h-auto"
              />
              <h1 className="text-[26px] font-bold leading-[1.25] text-white md:text-[32px]">
                Doublez la performance commerciale de votre organisme de formation dès le prochain trimestre.
              </h1>
              <p className="text-[14px] leading-[1.7] text-white/80">
                {subtitleText}
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-5 text-[18px] font-bold text-[#1a2a3a]">
                Accédez gratuitement à la méthode
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    Prénom<span className="text-red-500">*</span>
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
                    Numéro de téléphone<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel" name="phone" required placeholder="+33"
                    value={form.phone} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#1a2a3a]">
                    URL de la société<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url" name="website" required placeholder="ex: www.url-de-la-societe.com"
                    value={form.website} onChange={handleChange}
                    className="w-full rounded border border-gray-200 px-3 py-2.5 text-[14px] text-[#1a2a3a] outline-none focus:border-[#2e7ab5]"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="mt-1 w-full rounded bg-[#2e7ab5] py-3 text-[14px] font-semibold text-white transition hover:bg-[#256a9e] disabled:opacity-60"
                >
                  {loading ? "Envoi en cours\u2026" : "Découvrir la méthode"}
                </button>
                {error && <p className="text-center text-[13px] text-red-500">{error}</p>}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== POUR QUI ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14 text-center">
          <p className="mb-2 text-[13px] font-semibold text-[#2e7ab5]">Pour qui est cette méthode ?</p>
          <h2 className="mb-3 text-[22px] font-bold text-[#1a2a3a]">Cette méthode s&apos;adresse...</h2>
          <p className="text-[14px] leading-[1.7] text-[#555]">
            Aux dirigeants et fondateurs d&apos;organismes de formation qui veulent augmenter la performance commerciale de leurs équipes.
          </p>
        </div>
      </section>

      {/* ===== CHALLENGES + OBJECTIFS (side by side) ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 pb-14">
          <div className="grid gap-12 md:grid-cols-2">
            {/* Challenges */}
            <div>
              <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">Vos challenges quotidiens</p>
              <h3 className="mb-5 text-[18px] font-bold leading-tight text-[#1a2a3a]">
                Vos équipes ou votre activité souffrent de...
              </h3>
              <ul className="flex flex-col gap-3.5">
                {challenges.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[14px] text-[#333]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-red-400 text-red-400">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Objectifs */}
            <div>
              <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">Vos objectifs finaux</p>
              <h3 className="mb-5 text-[18px] font-bold leading-tight text-[#1a2a3a]">
                Avec la bonne stratégie commerciale, vous pouvez :
              </h3>
              <ul className="flex flex-col gap-3.5">
                {goals.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[14px] text-[#333]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-green-500 text-green-500">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== QUI SOMMES-NOUS ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative h-[380px] w-[280px] overflow-hidden rounded-lg bg-[#EFF5F9]">
                <Image
                  src="/photo-rafi.png"
                  alt="Rafi Mouhamad - La Closing Académie"
                  width={280}
                  height={380}
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>

            {/* Text */}
            <div>
              <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">Qui sommes-nous ?</p>
              <h3 className="mb-3 text-[22px] font-bold text-[#1a2a3a]">La Closing Académie ®</h3>
              <p className="mb-5 text-[14px] leading-[1.7] text-[#555]">
                La Closing Académie ® est le fruit de plus de 25 ans d&apos;accompagnement d&apos;entrepreneurs, de dirigeants, de managers et de commerciaux sur + 20 pays.
              </p>
              <button
                onClick={scrollToTop}
                className="rounded bg-[#2e7ab5] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#256a9e]"
              >
                Découvrir la méthode
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOGOS CLIENTS ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-semibold text-[#888]">
            {["ADREC", "Cartesia Education", "Business France", "LEYTON", "Training Académie", "Wall Street English", "Great Place to Work", "ABC", "CCI Bordeaux Gironde", "EdTech France"].map((name, i) => (
              <span key={i} className="rounded border border-gray-200 px-3 py-1.5">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TÉMOIGNAGES ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-14">
          <div className="mb-8 text-center">
            <p className="mb-1 text-[12px] font-semibold text-[#2e7ab5]">Témoignages</p>
            <h2 className="mb-2 text-[22px] font-bold text-[#1a2a3a]">Ils nous ont fait confiance</h2>
            <p className="text-[13px] font-semibold text-[#888]">Google ★★★★★</p>
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2e7ab5] text-[11px] font-bold text-white">
                    {t.name.charAt(0)}
                  </div>
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
              Doublez la performance commerciale de votre organisme de formation dès le prochain trimestre.
            </h2>
            <p className="mx-auto mb-6 max-w-lg text-[12px] leading-[1.7] text-white/80">
              Comme plus de 200 dirigeants — Wall Street English, Cartesia Education, ABC Cours Particuliers, Great Place To Work France, Leyton France, Berlitz France… génèrez plus de RDV qualifiés, plus de clients et plus de croissance — sans augmenter VOTRE budget publicitaire.
            </p>
            <button
              onClick={scrollToTop}
              className="rounded bg-white px-5 py-2.5 text-[13px] font-semibold text-[#2e7ab5] transition hover:bg-gray-100"
            >
              Découvrir la méthode
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-white border-t border-gray-100">
        <div className="mx-auto max-w-[960px] px-6 py-6 text-center text-[12px] text-[#999]">
          <div className="mb-2 flex flex-wrap justify-center gap-4">
            <a href="#" className="transition hover:text-[#555]">Conditions générales de vente</a>
            <span>|</span>
            <a href="#" className="transition hover:text-[#555]">Politique de confidentialité</a>
            <span>|</span>
            <a href="#" className="transition hover:text-[#555]">Mentions légales</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
