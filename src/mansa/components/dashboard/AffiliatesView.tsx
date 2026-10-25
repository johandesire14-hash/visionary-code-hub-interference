import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  AffiliateLink,
  AffiliateProduct,
  createOrGetAffiliateLink,
  getAffiliateEligibleProducts,
  getAffiliateLinksForUser,
} from "../../services/affiliateService";
import { CurrencyCode, formatCurrency } from "../../utils/currency";
import { siteUrl } from "@/lib/site";
import { getAffiliateMembership, joinAffiliateProgram, loadDiscoverableProducts } from "../../services/dbService";

interface AffiliatesViewProps {
  lang?: "fr" | "en";
  /** Retained for caller compatibility only. Display names are never used in affiliate links. */
  userRefName?: string;
  userId?: string;
  isPersonalWorkspace?: boolean;
  currency?: CurrencyCode | string;
}

const percentLabel = (rate: number) => `${String(rate)} %`;
const publicAffiliateUrl = (code: string) => siteUrl(`/affiliate/${encodeURIComponent(code)}`);

const formatProductPrice = (amount: number, currency: string) => {
  try {
    return formatCurrency(amount, currency as CurrencyCode);
  } catch {
    return `${amount} ${currency}`;
  }
};

export const AffiliatesView: React.FC<AffiliatesViewProps> = ({ currency = "XOF" }) => {
  const { user } = useAuth();
  const affiliateUid = user?.uid || "";
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdLink, setCreatedLink] = useState<AffiliateLink | null>(null);
  const [copiedUrl, setCopiedUrl] = useState("");
  const activeCurrency = (currency as CurrencyCode) || "XOF";

  const refresh = useCallback(async (showRefresh = false) => {
    if (!affiliateUid) {
      setProducts([]);
      setLinks([]);
      setLoading(false);
      return;
    }
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const [eligibleProducts, ownLinks] = await Promise.all([
        getAffiliateEligibleProducts(affiliateUid),
        getAffiliateLinksForUser(affiliateUid),
      ]);
      setProducts(eligibleProducts);
      setLinks(ownLinks);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Impossible de charger les programmes affiliés.");
      setProducts([]);
      setLinks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [affiliateUid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const productLinks = useMemo(
    () => new Map(links.map((link) => [link.productId, link])),
    [links],
  );

  const beginPromotion = (product: AffiliateProduct) => {
    setSelectedProduct(product);
    setAccepted(false);
    setCreateError("");
    setCreatedLink(null);
  };

  const cancelConditions = () => {
    setSelectedProduct(null);
    setAccepted(false);
    setCreateError("");
  };

  const acceptAndCreateLink = async () => {
    if (!affiliateUid || !selectedProduct || !accepted || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const link = await createOrGetAffiliateLink(affiliateUid, selectedProduct);
      setCreatedLink(link);
      setLinks((existing) => [link, ...existing.filter((item) => item.id !== link.id)]);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Le lien n’a pas pu être créé.");
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl(""), 1800);
    } catch {
      setCopiedUrl("");
    }
  };

  if (selectedProduct) {
    return (
      <main className="min-h-screen pb-16 text-white" aria-label="Conditions du programme d’affiliation">
        <button type="button" onClick={cancelConditions} className="mb-5 inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm text-zinc-300 hover:text-white">
          <ArrowLeft className="size-4" /> Retour aux produits
        </button>
        <section className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#15171d] p-5 sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            {selectedProduct.coverImage ? <img src={selectedProduct.coverImage} alt="" className="size-16 rounded-xl object-cover" /> : <div className="flex size-16 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"><Link2 className="size-7" /></div>}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Conditions avant création du lien</p><h1 className="mt-1 text-xl font-bold">{selectedProduct.name}</h1><p className="mt-1 text-sm text-zinc-400">{selectedProduct.category}</p></div>
          </div>
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4">
            <p className="text-sm text-zinc-300">Taux exact fixé par le créateur pour ce produit</p>
            <p className="mt-1 text-3xl font-bold text-emerald-300" data-testid="accepted-rate">{percentLabel(selectedProduct.affiliateCommissionRate)}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">Ce pourcentage est affiché tel qu’enregistré dans Firebase. Il s’agit du taux annoncé par le créateur, pas d’une commission gagnée ou garantie.</p>
          </div>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
            <h2 className="font-semibold text-white">Règles d’utilisation et d’attribution</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Utilisez le lien généré pour présenter ce produit et ne modifiez pas son code d’attribution.</li>
              <li>Présentez honnêtement le produit, son prix et ses conditions ; n’employez pas de pratiques trompeuses, de spam ou de promesses non autorisées.</li>
              <li>Indiquez clairement à votre audience que vous partagez un lien affilié lorsque la loi ou les règles de la plateforme l’exigent.</li>
              <li>Le code associe le lien à votre compte Firebase et à ce produit. Le pourcentage ci-dessus est celui actuellement fixé par le créateur.</li>
            </ul>
            <div className="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-amber-100">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p className="text-xs leading-relaxed">Limite importante : ce dépôt ne contient pas de backend de paiement confirmé ni de webhook serveur d’attribution. Le lien identifie l’affilié, mais aucune vente ni commission réelle n’est actuellement suivie, créditée ou payée. Une attribution réelle exige un paiement confirmé et un webhook contrôlé côté serveur.</p>
            </div>
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 size-4 accent-emerald-500" />
            <span>J’ai lu et j’accepte les conditions d’utilisation et d’attribution ci-dessus pour promouvoir « {selectedProduct.name} » au taux exact de {percentLabel(selectedProduct.affiliateCommissionRate)}.</span>
          </label>
          {createError && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{createError}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => void acceptAndCreateLink()} disabled={!accepted || creating} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45">{creating ? "Création du lien…" : "J’accepte les conditions et génère mon lien"}</button>
            <button type="button" onClick={cancelConditions} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-zinc-300 hover:bg-white/5">Annuler</button>
          </div>
          {createdLink && (
            <div className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4" role="status">
              <div className="flex items-center gap-2 font-semibold text-emerald-200"><ShieldCheck className="size-5" /> Lien affilié enregistré dans Firestore</div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">Ce lien contient un code aléatoire associé à votre UID Firebase et au produit. Il identifie l’affilié, mais ne confirme ni ne comptabilise de vente ou de commission.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input readOnly value={publicAffiliateUrl(createdLink.code)} aria-label="Votre lien affilié" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-200" />
                <button type="button" onClick={() => void copyUrl(publicAffiliateUrl(createdLink.code))} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{copiedUrl === publicAffiliateUrl(createdLink.code) ? <Check className="size-4" /> : <Copy className="size-4" />}{copiedUrl === publicAffiliateUrl(createdLink.code) ? "Copié" : "Copier"}</button>
                <a href={publicAffiliateUrl(createdLink.code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200"><ExternalLink className="size-4" /> Voir la page publique</a>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div><h1 className="text-xl font-bold tracking-tight">Affiliés</h1><p className="mt-1 text-sm text-zinc-400">Découvrez les produits actifs dont le créateur a activé un taux d’affiliation.</p></div>
        <button type="button" onClick={() => void refresh(true)} disabled={refreshing || loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualiser</button>
      </div>
      {!affiliateUid && <p role="alert" className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Connectez-vous avec un compte Firebase pour consulter et créer des liens affiliés.</p>}
      {loadError && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{loadError}</p>}
      <section className="mt-6" aria-labelledby="affiliate-products-heading">
        <h2 id="affiliate-products-heading" className="mb-3 text-base font-bold">Produits disponibles</h2>
        {loading ? <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">Chargement des produits Firebase…</p> : !loadError && products.length === 0 ? <p className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-zinc-400">Aucun produit actif avec un programme d’affiliation n’est disponible. Les produits dont le taux est nul, absent ou négatif sont exclus. Les produits de votre propre compte Firebase sont également exclus.</p> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {products.map((product) => {
              const existingLink = productLinks.get(product.id);
              return <article key={product.id} className="flex gap-4 rounded-xl border border-white/10 bg-[#15171d] p-4">
                {product.coverImage ? <img src={product.coverImage} alt="" className="size-16 shrink-0 rounded-lg object-cover" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-500"><Link2 className="size-6" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{product.name}</h3><p className="text-xs text-zinc-500">{product.category}</p></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">{percentLabel(product.affiliateCommissionRate)}</span></div>
                  {product.description && <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{product.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-zinc-400">{formatProductPrice(product.pricingAmount, activeCurrency === "XOF" ? product.currency : activeCurrency)}</span><button type="button" onClick={() => beginPromotion(product)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">{existingLink ? "Conditions et lien existant" : "Promouvoir ce produit"}</button></div>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>
      <section className="mt-9" aria-labelledby="affiliate-links-heading">
        <h2 id="affiliate-links-heading" className="mb-1 text-base font-bold">Mes liens affiliés</h2><p className="mb-3 text-xs leading-relaxed text-zinc-400">Liens enregistrés sous votre UID Firebase. Les vues, ventes et commissions ne sont pas suivies par ce dépôt.</p>
        {links.length === 0 ? <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">Aucun lien créé.</p> : <div className="space-y-2">{links.map((link) => {
          const url = publicAffiliateUrl(link.code);
          return <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#15171d] p-4"><div className="min-w-0"><p className="font-semibold">{link.productName}</p><p className="mt-1 font-mono text-xs text-zinc-400">{url}</p><p className="mt-1 text-xs text-emerald-300">Taux accepté : {percentLabel(link.commissionRate)} · aucune commission comptabilisée</p></div><button type="button" onClick={() => void copyUrl(url)} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5">{copiedUrl === url ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copiedUrl === url ? "Copié" : "Copier le lien"}</button></div>;
        })}</div>}
      </section>
      <aside className="mt-7 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-xs leading-relaxed text-amber-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>Le lien pointe vers une page publique et identifie l’affilié. Il ne réalise pas de vente. Le dépôt ne contient pas de backend de paiement confirmé : une commission réelle nécessite un paiement validé et un webhook serveur qui vérifie puis attribue cette vente.</p></aside>
    </main>
  );
};
