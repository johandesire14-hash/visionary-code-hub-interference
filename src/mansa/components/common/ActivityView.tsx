import React, { useMemo } from "react";
import { Building2, Package } from "lucide-react";
import { EnterpriseSubscription } from "../../types";
import { getArchivedSubscriptions } from "../../utils/subscriptionsStorage";

interface ActivityViewProps {
  userKey: string;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ userKey }) => {
  const active = useMemo(() => {
    if (typeof window === "undefined") return [] as EnterpriseSubscription[];
    try {
      const parsed = JSON.parse(localStorage.getItem(`mansa_enterprise_subscriptions_${userKey}`) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [userKey]);
  const archived = getArchivedSubscriptions(userKey);
  const companies = [...active, ...archived].filter(
    (item, index, list) => list.findIndex((candidate) => candidate.id === item.id || candidate.companyId === item.companyId) === index,
  );
  const products = companies.flatMap((item) => {
    const purchased = item.purchasedOfferIds || item.unlockedProductIds || [];
    return purchased.map((productId) => ({ productId, companyName: item.companyName, productName: item.productName }));
  });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Building2 className="size-4 text-emerald-400" /> Entreprises rejointes</h3>
        {companies.length === 0 ? <p className="text-xs text-zinc-500">Aucune entreprise dans votre activité.</p> : (
          <div className="space-y-2">{companies.map((company) => <div key={company.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs"><span className="font-semibold text-zinc-200">{company.companyName}</span><span className="text-zinc-500">{active.some((item) => item.id === company.id) ? "Rejointe" : "Quittée"}</span></div>)}</div>
        )}
      </section>
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Package className="size-4 text-emerald-400" /> Produits achetés</h3>
        {products.length === 0 ? <p className="text-xs text-zinc-500">Aucun produit acheté dans votre activité.</p> : (
          <div className="space-y-2">{products.map((product, index) => <div key={`${product.productId}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-semibold text-zinc-200">{product.productName || product.productId}</p><p className="mt-1 text-[11px] text-zinc-500">{product.companyName}</p></div>)}</div>
        )}
      </section>
    </div>
  );
};
