"use client";

import Image from "next/image";
import { Play } from "lucide-react";

const subtitleText =
  "Comme plus de 200 dirigeants \u2014 Wall Street English, Cartesia Education, ABC Cours Particuliers, Great Place To Work France, Leyton France, Berlitz France\u2026 Transformez vos leads en RDV, plus de clients et plus de croissance, sans augmenter VOTRE budget publicitaire.";

export default function VSLPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo-lca.png"
            alt="La Closing Académie"
            width={80}
            height={80}
            className="rounded-md"
          />
        </div>

        {/* Title */}
        <h1 className="mb-4 text-center text-2xl font-bold text-[#1a6b9c] md:text-3xl lg:text-4xl">
          Doublez la performance commerciale de votre organisme de formation
          dès le prochain trimestre.
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mb-10 max-w-2xl text-center text-base leading-relaxed text-[#1a2a3a]/70 md:text-lg">
          {subtitleText}
        </p>

        {/* Video placeholder */}
        <div className="relative mb-10 w-full overflow-hidden rounded-xl bg-gray-200">
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

        {/* CTA */}
        <div className="flex justify-center">
          <a
            href="/booking"
            className="inline-block rounded-lg bg-[#FF6B35] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#e55a28]"
          >
            Réserver un appel stratégique
          </a>
        </div>
      </div>
    </div>
  );
}
