import { lazy, Suspense, useEffect, useState } from "react";
import type { CreatedProductData } from "./components/ProductCreationStudio";
import {
  CurrencyCode,
  SUPPORTED_CURRENCIES,
  detectUserLocationAndCurrency,
  getStoredCurrency,
  setStoredCurrency,
} from "./utils/currency";
import { useAuth } from "./context/AuthContext";
import { saveProductToFirestore } from "./services/dbService";
import { purgeLegacyDemoData } from "./utils/storage";
import { getSavedCompanies } from "./utils/companyStorage";
import { AfhubLogo } from "./components/AfhubLogo";

const UserDashboard = lazy(() =>
  import("./components/UserDashboard").then((module) => ({ default: module.UserDashboard })),
);
const ProductCreationStudio = lazy(() =>
  import("./components/ProductCreationStudio").then((module) => ({
    default: module.ProductCreationStudio,
  })),
);

export default function App({ openStudioOnMount = false }: { openStudioOnMount?: boolean }) {
  const { user: authUser, profile, logout } = useAuth();
  const [lang] = useState<"fr" | "en">("fr");
  const initialAppCurrency = getStoredCurrency();
  const [userLocationInfo, setUserLocationInfo] = useState({
    country: "France",
    currency: initialAppCurrency,
    currencySymbol: SUPPORTED_CURRENCIES[initialAppCurrency]?.symbol || "$",
  });
  const [isStudioOpen, setIsStudioOpen] = useState(openStudioOnMount);

  useEffect(() => {
    purgeLegacyDemoData();
    const loc = detectUserLocationAndCurrency();
    const stored = getStoredCurrency();
    const activeCurr = stored || loc.currency;
    setUserLocationInfo({
      country: loc.countryName,
      currency: activeCurr,
      currencySymbol: SUPPORTED_CURRENCIES[activeCurr]?.symbol || "$",
    });
    const handleStorageCurrency = (e: Event) => {
      const detail = (e as CustomEvent<{ currency?: CurrencyCode }>).detail;
      const newCurr = detail?.currency || getStoredCurrency();
      if (newCurr && SUPPORTED_CURRENCIES[newCurr]) {
        setUserLocationInfo((prev) => ({
          ...prev,
          currency: newCurr,
          currencySymbol: SUPPORTED_CURRENCIES[newCurr]?.symbol || "$",
        }));
      }
    };
    window.addEventListener("mansa_currency_changed", handleStorageCurrency);
    return () => window.removeEventListener("mansa_currency_changed", handleStorageCurrency);
  }, []);

  const currentUser =
    authUser && profile
      ? {
          uid: profile.uid,
          name: profile.displayName || authUser.displayName || "Créateur Mansa",
          email: profile.email || authUser.email || "",
          avatarInitials: profile.avatarInitials || "MA",
        }
      : null;

  const handleOpenStudio = () => {
    setIsStudioOpen(true);
  };

  const handleGlobalCurrencyChange = (newCurrency: CurrencyCode) => {
    setStoredCurrency(newCurrency);
    setUserLocationInfo((prev) => ({
      ...prev,
      currency: newCurrency,
      currencySymbol: SUPPORTED_CURRENCIES[newCurrency]?.symbol || "$",
    }));
  };

  const handleSaveProductFromStudio = async (product: CreatedProductData) => {
    const creatorId = profile?.uid || authUser?.uid || "user-temp";
    const creatorEmail = profile?.email || authUser?.email || "createur@mansa.af";
    const creatorName = profile?.displayName || authUser?.displayName || "Créateur Mansa";
    await saveProductToFirestore(creatorId, creatorEmail, creatorName, {
      id: product.id,
      name: product.name,
      description: product.description,
      category: "community",
      priceAmount: product.priceAmount,
      pricingType: product.pricingType,
      billingCycle: product.billingCycle,
      currency: product.currency || userLocationInfo.currency || "USD",
      includedApps: product.includedApps || ["Chat VIP", "Mansa Checkout"],
      affiliateRate: product.affiliateRate ?? 25,
      visibility: product.visibility,
      productType: product.productType,
      productUrl: product.productUrl,
      ...(product.imageUrl ? { coverImage: product.imageUrl } : {}),
      ...(product.bannerUrl ? { bannerUrl: product.bannerUrl } : {}),
      companyId: product.companyId || "",
      companyName: product.companyName || "",
    });
    setIsStudioOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!currentUser) return null;

  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Chargement du tableau de bord"
          className="mansa-viewport relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0f1012] px-6 text-[#eeeeee]"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00D26A]/[0.06] blur-3xl" />
          <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/[0.08] bg-[#121316]/90 px-8 py-10 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-7 rounded-2xl border border-white/[0.08] bg-[#0c0d0e] p-3 shadow-lg shadow-black/20">
              <AfhubLogo size="lg" />
            </div>
            <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#00D26A]">
              <span className="size-1.5 rounded-full bg-[#00D26A] animate-pulse" />
              <span>afhub</span>
              <span className="size-1.5 rounded-full bg-[#00D26A] animate-pulse [animation-delay:180ms]" />
            </div>
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-white">
              Préparation de votre espace
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Nous synchronisons vos données et vos applications.
            </p>
            <div className="mt-7 h-1 w-44 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-1/2 rounded-full bg-[#00D26A] animate-[loader-slide_1.4s_ease-in-out_infinite]" />
            </div>
            <span className="mt-3 text-[10px] font-medium text-zinc-600">Chargement…</span>
          </div>
        </div>
      }
    >
      <>
        <UserDashboard
          user={currentUser}
          onLogout={handleLogout}
          onOpenProductStudio={() => handleOpenStudio()}
          lang={lang}
        />
        {isStudioOpen && (
          <ProductCreationStudio
            isOpen={isStudioOpen}
            activeCurrency={userLocationInfo.currency}
            onCurrencyChange={handleGlobalCurrencyChange}
            lang={lang}
            onClose={() => setIsStudioOpen(false)}
            onSaveProduct={handleSaveProductFromStudio}
            companies={getSavedCompanies(currentUser.uid)}
            {...(getSavedCompanies(currentUser.uid)[0]?.id
              ? { initialCompanyId: getSavedCompanies(currentUser.uid)[0]!.id }
              : {})}
          />
        )}
      </>
    </Suspense>
  );
}
