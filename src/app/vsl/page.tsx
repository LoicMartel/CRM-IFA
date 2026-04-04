"use client";

import Image from "next/image";

const subtitleText =
  "Comme plus de 200 dirigeants \u2014 Wall Street English, Cartesia Education, ABC Cours Particuliers, Great Place To Work France, Leyton France, Berlitz France\u2026 Transformez vos leads en RDV, plus de clients et plus de croissance, sans augmenter VOTRE budget publicitaire.";

export default function VSLPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Blue section: logo + title + subtitle */}
      <div style={{ background: "#2e7ab5" }} className="pb-36">
        <div className="mx-auto max-w-4xl px-4 pt-4">
          {/* Logo */}
          <div className="mb-3 flex justify-center">
            <Image
              src="/lca-white-logo.png"
              alt="La Closing Académie"
              width={120}
              height={90}
              className="w-[120px] h-auto"
            />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-center text-xl font-bold text-white md:text-2xl lg:text-3xl">
            Doublez la performance commerciale de votre organisme de formation
            dès le prochain trimestre.
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mb-4 max-w-2xl text-center text-xs leading-relaxed text-white/80 md:text-sm">
            {subtitleText}
          </p>
        </div>
      </div>

      {/* White section */}
      <div className="bg-white flex-1">
        <div className="mx-auto max-w-4xl px-4">
          {/* Video - overlaps blue/white transition */}
          <div className="-mt-32 relative mb-10 w-full overflow-hidden rounded-xl shadow-xl">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src="https://www.youtube.com/embed/q3Dpr2ydjkU?rel=0&modestbranding=1"
                title="VSL - La Closing Académie"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full rounded-xl"
              />
            </div>
          </div>

          {/* Booking section */}
          <div className="py-10 text-center">
            <h2 className="mb-4 text-xl font-bold text-[#1a2a3a] md:text-2xl">
              Réservez votre bilan commercial offert
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-[#4a6274]">
              Découvrez comment optimiser votre équipe commerciale. Réservez votre
              session offerte dès maintenant et repartez avec une feuille de route
              sur-mesure pour votre organisme de formation.
            </p>

            {/* Embedded booking - compact card */}
            <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
              <iframe
                src="/booking-pauline-commercial"
                className="w-full border-0"
                style={{ height: "700px" }}
                title="Réserver un appel découverte"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
