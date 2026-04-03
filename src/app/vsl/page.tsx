"use client";

import Image from "next/image";
import { Play } from "lucide-react";

const subtitleText =
  "Comme plus de 200 dirigeants \u2014 Wall Street English, Cartesia Education, ABC Cours Particuliers, Great Place To Work France, Leyton France, Berlitz France\u2026 Transformez vos leads en RDV, plus de clients et plus de croissance, sans augmenter VOTRE budget publicitaire.";

export default function VSLPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Blue section: logo + title + subtitle + top half of video */}
      <div style={{ background: "#2e7ab5" }} className="pb-40">
        <div className="mx-auto max-w-4xl px-4 pt-12">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/lca-white-logo.png"
              alt="La Closing Académie"
              width={100}
              height={75}
              className="w-[100px] h-auto"
            />
          </div>

          {/* Title */}
          <h1 className="mb-4 text-center text-2xl font-bold text-white md:text-3xl lg:text-4xl">
            Doublez la performance commerciale de votre organisme de formation
            dès le prochain trimestre.
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mb-10 max-w-2xl text-center text-base leading-relaxed text-white/80 md:text-lg">
            {subtitleText}
          </p>
        </div>
      </div>

      {/* White section: video overlaps into here + CTA */}
      <div className="bg-white flex-1">
        <div className="mx-auto max-w-4xl px-4">
          {/* Video placeholder - pulled up to overlap the blue section */}
          <div className="-mt-32 relative mb-10 w-full overflow-hidden rounded-xl bg-gray-200 shadow-xl">
            <div className="relative" style={{ paddingBottom: "56.25%" }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a6b9c] text-white shadow-lg transition hover:bg-[#15577d]">
                  <Play size={32} className="ml-1" />
                </div>
                <span className="text-sm font-medium text-[#1a2a3a]/60">
                  Vidéo de présentation
                </span>
              </div>
            </div>
          </div>

          {/* CTA section */}
          <div className="py-10 text-center">
            <h2 className="mb-4 text-xl font-bold text-[#1a2a3a] md:text-2xl">
              Réservez votre bilan commercial offert
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-[#4a6274]">
              Découvrez comment optimiser votre équipe commerciale. Réservez votre
              session offerte dès maintenant et repartez avec une feuille de route
              sur-mesure pour votre organisme de formation.
            </p>
            <a
              href="/booking"
              className="inline-block rounded-lg bg-[#FF6B35] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#e55a28]"
            >
              Réserver un appel stratégique
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
