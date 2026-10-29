import React from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import storefront from "@/assets/afhub-storefront.webp";

interface HeroSectionProps {
  onOpenStudio: (category?: string) => void;
  lang: "fr" | "en";
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenStudio }) => (
  <section className="afhub-home-hero relative flex min-h-[82svh] flex-col items-center justify-center overflow-hidden px-5 pb-14 pt-24 text-center text-white sm:px-10 sm:pt-28">
    <div className="afhub-grid-overlay absolute inset-0 opacity-25" aria-hidden="true" />
    <div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col items-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
        <Sparkles className="size-3.5" />
        Pour les créateurs africains
      </div>
      <h1 className="max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.065em] sm:text-7xl md:text-[6.2rem]">
        Transformez votre audience en revenus récurrents.
      </h1>
      <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
        Vendez vos canaux VIP Telegram et Discord, vos formations et vos produits numériques.
        Encaissez simplement avec le Mobile Money.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="default"
          size="lg"
          onClick={() => onOpenStudio()}
          className="h-12 rounded-full px-7"
        >
          Créer ma boutique
        </Button>
        <a
          href="#solutions"
          className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Découvrir afhub
          <ArrowDown className="size-4" />
        </a>
      </div>
      <img
        src={storefront}
        alt="Une boutique afhub, un portefeuille et un mégaphone"
        width={1536}
        height={1024}
        fetchPriority="high"
        className="mt-8 w-full max-w-[620px] object-contain mix-blend-screen sm:mt-2"
      />
    </div>
  </section>
);
