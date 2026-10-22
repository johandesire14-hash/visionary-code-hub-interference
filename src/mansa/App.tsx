// @ts-nocheck
import React, { lazy, Suspense, useState, useEffect } from "react";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { BuildNextCarousel } from "./components/BuildNextCarousel";
import { MarketplaceSection } from "./components/MarketplaceSection";
import { FaqSection } from "./components/FaqSection";
import { Footer } from "./components/Footer";
import { LoginPage } from "./components/LoginPage";
import { UiArcShowcase } from "./components/UiArcShowcase";
import type { CreatedProductData } from "./components/ProductCreationStudio";
import {
  CurrencyCode,
  SUPPORTED_CURRENCIES,
  detectUserLocationAndCurrency,
  getStoredCurrency,
  setStoredCurrency,
  formatCurrency,
  convertBetweenCurrencies,
} from "./utils/currency";
import { useAuth } from "./context/AuthContext";
import { saveProductToFirestore } from "./services/dbService";
import { purgeLegacyDemoData } from "./utils/storage";
import { getSavedCompanies } from "./utils/companyStorage";
const UserDashboard = lazy(() =>
  import("./components/UserDashboard").then((module) => ({ default: module.UserDashboard })),
);
const ProductCreationStudio = lazy(() =>
  import("./components/ProductCreationStudio").then((module) => ({
    default: module.ProductCreationStudio,
  })),
);

export default function App() {
  const { user: authUser, profile, logout, loading: authLoading } = useAuth();
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [currentView, setCurrentView] = useState<"landing" | "login" | "dashboard">("landing");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // User detected location and currency
  const initialAppCurrency = getStoredCurrency();
  const [userLocationInfo, setUserLocationInfo] = useState<{
    country: string;
    currency: CurrencyCode;
    currencySymbol: string;
  }>({
    country: "France",
    currency: initialAppCurrency,
    currencySymbol: SUPPORTED_CURRENCIES[initialAppCurrency]?.symbol || "$",
  });

  // State for Product Creation Studio modal
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioInitialCategory, setStudioInitialCategory] = useState<string | undefined>(undefined);

  // Global currency sync & location detection on mount
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

    const handleStorageCurrency = (e: any) => {
      const newCurr = (e.detail?.currency as CurrencyCode) || getStoredCurrency();
      if (newCurr && SUPPORTED_CURRENCIES[newCurr]) {
        setUserLocationInfo((prev) => ({
          ...prev,
          currency: newCurr,
          currencySymbol: SUPPORTED_CURRENCIES[newCurr]?.symbol || "$",
        }));
      }
    };

    window.addEventListener("mansa_currency_changed", handleStorageCurrency);
    return () => {
      window.removeEventListener("mansa_currency_changed", handleStorageCurrency);
    };
  }, []);

  const handleGlobalCurrencyChange = (newCurrency: CurrencyCode) => {
    setStoredCurrency(newCurrency);
    setUserLocationInfo((prev) => ({
      ...prev,
      currency: newCurrency,
      currencySymbol: SUPPORTED_CURRENCIES[newCurrency]?.symbol || "$",
    }));
  };

  // Sync current user with Firebase profile
  const currentUser =
    authUser && profile
      ? {
          uid: profile.uid,
          name: profile.displayName || authUser.displayName || "Créateur Mansa",
          email: profile.email || authUser.email || "",
          avatarInitials: profile.avatarInitials || "MA",
        }
      : null;

  const handleOpenStudio = (category?: string) => {
    // La landing reste publique, mais le studio et les actions métier nécessitent un compte.
    if (!currentUser) {
      setAuthMode("signup");
      setCurrentView("login");
      return;
    }

    setStudioInitialCategory(category);
    setIsStudioOpen(true);
  };

  const handleSaveProductFromStudio = async (product: CreatedProductData) => {
    const creatorId = profile?.uid || authUser?.uid || "user-temp";
    const creatorEmail = profile?.email || authUser?.email || "createur@mansa.af";
    const creatorName = profile?.displayName || authUser?.displayName || "Créateur Mansa";

    // Save directly to Firestore database with correct synchronized currency
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
      affiliateRate: product.affiliateRate || 25,
      productUrl: product.productUrl,
      coverImage: product.imageUrl,
      bannerUrl: product.bannerUrl,
      companyId: product.companyId,
      companyName: product.companyName,
    });

    setIsStudioOpen(false);

    // Auto navigate to dashboard if on landing
    if (currentView !== "dashboard") {
      setCurrentView("dashboard");
    }
  };

  const handleLoginSuccess = () => {
    setCurrentView("dashboard");
  };

  const handleLogout = async () => {
    await logout();
    setCurrentView("landing");
  };

  // Loading state while Firebase auth checks:
  // The landing page is completely public and renders immediately without blocking on auth network checks.
  // We only show the full loading screen if the user is explicitly navigating to their private dashboard.
  if (authLoading && currentView === "dashboard") {
    return (
      <div className="min-h-screen w-full bg-[#2A2929] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-2xl bg-[#12141a] border border-white/10 flex items-center justify-center shadow-sm">
          <div className="size-5 rounded-full border-2 border-[#3DDC84] border-t-transparent animate-spin" />
        </div>
        <p className="text-xs font-mono text-[#B6B5B0]">Mansa · Initialisation sécurisée...</p>
      </div>
    );
  }

  // L’authentification est ouverte depuis la landing, jamais imposée à l’arrivée.
  if (currentView === "login" && !currentUser) {
    return (
      <LoginPage
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={() => setCurrentView("landing")}
        lang={lang}
      />
    );
  }

  // Le dashboard et ses fonctionnalités restent réservés aux utilisateurs connectés.
  if (currentView === "dashboard" && currentUser) {
    return (
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Chargement du tableau de bord"
            className="min-h-screen w-full bg-[#2A2929] flex items-center justify-center"
          >
            <div className="size-5 rounded-full border-2 border-[#3DDC84] border-t-transparent animate-spin" />
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

          {/* Global Product Creation Studio Modal accessible from Dashboard */}
          {isStudioOpen && (
            <ProductCreationStudio
              isOpen={isStudioOpen}
              activeCurrency={userLocationInfo.currency}
              onCurrencyChange={handleGlobalCurrencyChange}
              lang={lang}
              onClose={() => setIsStudioOpen(false)}
              onSaveProduct={handleSaveProductFromStudio}
              companies={getSavedCompanies(currentUser.uid)}
              initialCompanyId={getSavedCompanies(currentUser.uid)[0]?.id}
            />
          )}
        </>
      </Suspense>
    );
  }

  // Landing structurée : les sections restent visibles, mais le catalogue n’affiche
  // aucun produit tant qu’aucune offre réelle n’est disponible.
  return (
    <div
      id="home"
      className="afhub-home min-h-screen bg-store-background text-store-foreground flex flex-col font-sans"
    >
      <Header
        onOpenMarketplace={() =>
          document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" })
        }
        onOpenDocs={() => window.open("/documentation", "_blank")}
        onOpenLogin={() => {
          setAuthMode("login");
          setCurrentView("login");
        }}
      />
      <main className="flex-1 flex flex-col w-full" aria-label="Accueil afhub">
        <HeroSection onOpenStudio={() => handleOpenStudio()} lang={lang} />
        <UiArcShowcase onOpenStudio={() => handleOpenStudio()} />
        <BuildNextCarousel
          onSelectCategory={(category) => handleOpenStudio(category.categoryKey)}
          onOpenStudio={() => handleOpenStudio()}
          lang={lang}
        />
        <MarketplaceSection
          onSelectProduct={() => undefined}
          onOpenStudio={() => handleOpenStudio()}
          lang={lang}
        />
        <FaqSection onOpenStudio={() => handleOpenStudio()} lang={lang} />
        <Footer onOpenStudio={() => handleOpenStudio()} lang={lang} />
      </main>
    </div>
  );
}
