import { useState } from "react";
import { Check, Heart } from "lucide-react";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { BillingPrice, BillingToggle } from "@/components/arc/billing-toggle/billing-toggle";
import { Button } from "@/components/arc/button/button";
import { IconMorph } from "@/components/arc/icon-morph/icon-morph";

interface UiArcShowcaseProps {
  onOpenStudio: () => void;
}

const PLANS = {
  monthly: { amount: 19, period: "par mois", was: undefined },
  yearly: { amount: 15, period: "par mois, facturé annuellement", was: 19 },
} as const;

export function UiArcShowcase({ onOpenStudio }: UiArcShowcaseProps) {
  const [billing, setBilling] = useState<keyof typeof PLANS>("monthly");
  const [liked, setLiked] = useState(false);
  const plan = PLANS[billing];

  return (
    <section
      id="tarifs"
      className="w-full border-t border-white/[0.06] bg-[#111216] py-16 text-white sm:py-20"
    >
      <div className="mx-auto grid max-w-[1100px] gap-10 px-6 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Une expérience plus fluide
          </p>
          <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Lancez votre boutique sans friction.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
            Un espace simple pour vendre vos produits numériques, avec des interactions claires à
            chaque étape. Choisissez votre formule et commencez à construire.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={onOpenStudio}>
              Créer ma boutique
            </Button>
            <button
              type="button"
              aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-pressed={liked}
              onClick={() => setLiked((value) => !value)}
              className="inline-flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <IconMorph name="heart" state={liked} size={21} />
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#181a20] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-300">Plan Créateur</p>
              <p className="mt-1 text-xs text-zinc-500">Tout ce qu’il faut pour démarrer.</p>
            </div>
            <BillingToggle
              value={billing}
              onValueChange={(value) => setBilling(value as keyof typeof PLANS)}
              options={[
                { value: "monthly", label: "Mensuel" },
                { value: "yearly", label: "Annuel", badge: "-21%" },
              ]}
              label="Période de facturation"
              size="md"
            />
          </div>

          <div className="mt-8 flex items-end gap-3">
            <BillingPrice
              amount={plan.amount}
              {...(plan.was === undefined ? {} : { was: plan.was })}
              currency="€"
              period={plan.period}
            />
          </div>

          <ul className="mt-7 grid gap-3 border-t border-white/[0.08] pt-6 text-sm text-zinc-300 sm:grid-cols-2">
            {[
              "Paiements sécurisés",
              "Accès instantané",
              "Analytics intégrés",
              "Support prioritaire",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <ActionButton
            className="mt-7 w-full"
            label="Commencer maintenant"
            pendingLabel="Préparation..."
            successLabel="C’est parti"
            onAction={async () => {
              await new Promise((resolve) => window.setTimeout(resolve, 450));
              onOpenStudio();
            }}
          />
        </div>
      </div>
    </section>
  );
}
