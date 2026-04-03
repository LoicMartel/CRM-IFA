"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import {
  TrendingDown,
  Target,
  Calendar,
  ShoppingCart,
  Users,
  GraduationCap,
  CheckCircle,
  Quote,
} from "lucide-react";

const subtitleText =
  "Comme plus de 200 dirigeants \u2014 Wall Street English, Cartesia Education, ABC Cours Particuliers, Great Place To Work France, Leyton France, Berlitz France\u2026 Transformez vos leads en RDV, plus de clients et plus de croissance, sans augmenter VOTRE budget publicitaire.";

const painPoints = [
  {
    icon: TrendingDown,
    text: "Un chiffre d\u2019affaires insuffisant et des cycles de vente trop longs",
  },
  {
    icon: Target,
    text: "Des taux de conversion et de closing trop faibles",
  },
  {
    icon: Calendar,
    text: "Un nombre de RDV hebdomadaires insuffisant",
  },
  {
    icon: ShoppingCart,
    text: "Des paniers moyens trop bas et un ROAS insuffisant",
  },
  {
    icon: Users,
    text: "Des commerciaux démotivés ou un turnover élevé",
  },
  {
    icon: GraduationCap,
    text: "Des difficultés à former et coacher vos équipes",
  },
];

const goals = [
  "Accélérer la croissance et les ventes",
  "Augmenter les marges et la rentabilité",
  "Stabiliser la trésorerie",
  "Développer le chiffre d\u2019affaires",
  "Renforcer vos équipes commerciales",
  "Libérer du temps personnel",
  "Augmenter la valorisation de l\u2019entreprise",
];

const testimonials = [
  {
    name: "Christophe D.",
    company: "Cartesia Education",
    quote:
      "Analyse pointue et solutions ad-hoc avec un impact conséquent et significatif.",
  },
  {
    name: "Sophie M.",
    company: "Wall Street English",
    quote: "One of the great Wall Street English success stories.",
  },
  {
    name: "Laurent P.",
    company: "Leyton France",
    quote:
      "Nouvelle approche commerciale, axée sur le client et la performance.",
  },
  {
    name: "Marie T.",
    company: "ABC Cours Particuliers",
    quote:
      "Technique de Rafi pour closer\u2026 extrêmement efficace.",
  },
  {
    name: "Thomas R.",
    company: "Great Place To Work",
    quote:
      "Bootcamp au top\u2026 contenu riche, recommandations précises.",
  },
  {
    name: "Isabelle F.",
    company: "Business France",
    quote:
      "Un accompagnement sur mesure qui a transformé nos résultats commerciaux.",
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
      if (!res.ok) throw new Error("Une erreur est survenue.");
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
    <div className="min-h-screen scroll-smooth">
      {/* ===== SECTION 1: HERO ===== */}
      <section
        id="hero"
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* Left column */}
            <div className="flex flex-col gap-6">
              <Image
                src="/logo-lca.png"
                alt="La Closing Académie"
                width={100}
                height={100}
                className="rounded-md border-2 border-white"
              />
              <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl lg:text-[36px]">
                Doublez la performance commerciale de votre organisme de
                formation dès le prochain trimestre.
              </h1>
              <p className="text-base leading-relaxed text-white/80 md:text-lg">
                {subtitleText}
              </p>
            </div>

            {/* Right column: Form card */}
            <div className="rounded-xl bg-white p-6 shadow-lg md:p-8">
              <h2 className="mb-6 text-xl font-bold text-[#1a2a3a]">
                Accédez gratuitement à la méthode
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a2a3a]">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    placeholder="ex: John"
                    value={form.firstName}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#1a2a3a] outline-none transition focus:ring-2 focus:ring-[#1a6b9c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a2a3a]">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    placeholder="ex: Doe"
                    value={form.lastName}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#1a2a3a] outline-none transition focus:ring-2 focus:ring-[#1a6b9c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a2a3a]">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="ex: johndoe@gmail.com"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#1a2a3a] outline-none transition focus:ring-2 focus:ring-[#1a6b9c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a2a3a]">
                    Numéro de téléphone{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="+33..."
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#1a2a3a] outline-none transition focus:ring-2 focus:ring-[#1a6b9c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a2a3a]">
                    URL de la société{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    name="website"
                    required
                    placeholder="ex: www.url-de-la-societe.com"
                    value={form.website}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#1a2a3a] outline-none transition focus:ring-2 focus:ring-[#1a6b9c]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-lg bg-[#1a6b9c] px-6 py-3 font-semibold text-white transition hover:bg-[#15577d] disabled:opacity-60"
                >
                  {loading ? "Envoi en cours\u2026" : "Découvrir la méthode"}
                </button>
                {error && (
                  <p className="text-center text-sm text-red-500">{error}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 2: Pour qui ===== */}
      <section className="bg-[#EFF5F9]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <span className="mb-3 inline-block rounded-full bg-[#FF6B35]/10 px-4 py-1 text-sm font-semibold text-[#FF6B35]">
            Pour qui est cette méthode ?
          </span>
          <h2 className="mb-4 text-2xl font-bold text-[#1a2a3a] md:text-3xl">
            Cette méthode s&apos;adresse...
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-[#1a2a3a]/80 md:text-lg">
            Aux dirigeants et fondateurs d&apos;organismes de formation qui
            cherchent à booster la performance de leurs équipes
            commerciales.
          </p>
        </div>
      </section>

      {/* ===== SECTION 3: Challenges ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <span className="mb-3 inline-block rounded-full bg-[#FF6B35]/10 px-4 py-1 text-sm font-semibold text-[#FF6B35]">
            Vos challenges quotidiens
          </span>
          <h2 className="mb-8 text-2xl font-bold text-[#1a2a3a] md:text-3xl">
            Vos équipes ou votre activité souffrent de...
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {painPoints.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl bg-white p-6 shadow-lg transition hover:shadow-xl"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <Icon size={24} />
                  </div>
                  <p className="text-sm font-medium text-[#1a2a3a] md:text-base">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: Objectifs ===== */}
      <section className="bg-[#EFF5F9]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <span className="mb-3 inline-block rounded-full bg-[#FF6B35]/10 px-4 py-1 text-sm font-semibold text-[#FF6B35]">
            Vos objectifs finaux
          </span>
          <h2 className="mb-8 text-2xl font-bold text-[#1a2a3a] md:text-3xl">
            Avec la bonne stratégie commerciale, vous pouvez :
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-xl bg-white p-6 shadow-lg transition hover:shadow-xl"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-500">
                  <CheckCircle size={22} />
                </div>
                <p className="text-sm font-medium text-[#1a2a3a] md:text-base">
                  {goal}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 5: Qui sommes-nous ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-4 text-2xl font-bold text-[#1a2a3a] md:text-3xl">
            Qui sommes-nous ?
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-[#1a2a3a]/80 md:text-lg">
            La Closing Académie® — Fruit de plus de 25 ans
            d&apos;accompagnement d&apos;entrepreneurs, dirigeants, managers et
            commerciaux sur + 20 pays.
          </p>
        </div>
      </section>

      {/* ===== SECTION 6: Testimonials ===== */}
      <section className="bg-[#EFF5F9]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <span className="mb-3 inline-block rounded-full bg-[#FF6B35]/10 px-4 py-1 text-sm font-semibold text-[#FF6B35]">
            Témoignages
          </span>
          <h2 className="mb-8 text-2xl font-bold text-[#1a2a3a] md:text-3xl">
            Ils nous ont fait confiance
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="rounded-xl bg-white p-6 shadow-lg transition hover:shadow-xl"
              >
                <div className="mb-3 text-[#1a6b9c]/30">
                  <Quote size={28} />
                </div>
                <p className="mb-4 text-sm italic leading-relaxed text-[#1a2a3a]/70 md:text-base">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="text-sm font-bold text-[#1a2a3a]">{t.name}</p>
                <p className="text-xs text-[#1a2a3a]/50">{t.company}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 7: Final CTA ===== */}
      <section
        style={{
          background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
            Prêt à transformer votre performance commerciale ?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            {subtitleText}
          </p>
          <button
            onClick={scrollToTop}
            className="inline-block rounded-lg bg-[#FF6B35] px-8 py-4 font-semibold text-white transition hover:bg-[#e55a28]"
          >
            Découvrir la méthode
          </button>
        </div>
      </section>

      {/* ===== SECTION 8: Footer ===== */}
      <footer className="bg-[#0a3d5f]">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-white/60">
          <div className="mb-3 flex flex-wrap justify-center gap-4">
            <a href="#" className="transition hover:text-white">
              Conditions générales de vente
            </a>
            <span>|</span>
            <a href="#" className="transition hover:text-white">
              Politique de confidentialité
            </a>
            <span>|</span>
            <a href="#" className="transition hover:text-white">
              Mentions légales
            </a>
          </div>
          <p>&copy; 2025 La Closing Académie®. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
