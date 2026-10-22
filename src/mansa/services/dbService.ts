// @ts-nocheck
import {
  db,
  auth,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  deleteField,
} from "./firebase";
import { BusinessProject, LiveEvent, MarketplaceItem } from "../types";
import { safeStorage } from "../utils/storage";
import { getSavedCompanies } from "../utils/companyStorage";
import { filterPersonalTransactions } from "../utils/companyScope";

export interface AccountPaymentMethodConfig {
  dialCode?: string;
  phone?: string;
  accountName?: string;
  bankName?: string;
  bankIbanRib?: string;
  bankAccountHolder?: string;
  identityAuthorized?: boolean;
}

export interface AccountPaymentSettings {
  includeDefaultPaymentMethods: boolean;
  paymentVerificationStatuses: Record<string, "not_configured" | "pending" | "configured">;
  methods: Record<string, AccountPaymentMethodConfig>;
}

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  displayName: string;
  avatarInitials: string;
  photoURL?: string;
  country?: string;
  currency?: string;
  handle?: string;
  bio?: string;
  birthDate?: string;
  showTotalEarned?: boolean;
  showLocation?: boolean;
  showOwnedBusinesses?: boolean;
  showOwnedWhops?: boolean;
  showJoinedWhops?: boolean;
  // Enterprise / Store settings
  storeName?: string;
  storeTagline?: string;
  supportEmail?: string;
  storeCurrency?: string;
  companyBanner?: string;
  companyLogo?: string;
  storeBanner?: string;
  storeLogo?: string;
  payoutMethod?: "wave" | "orange_momo" | "bank_uemoa" | "bank_cemac" | "crypto";
  momoNumber?: string;
  momoName?: string;
  bankName?: string;
  bankIbanRib?: string;
  bankAccountHolder?: string;
  accountPaymentSettings?: AccountPaymentSettings;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreWorkforceMember {
  id: string;
  creatorId: string;
  companyId: string;
  name: string;
  role: string;
  rate: string;
  avatar: string;
  status: "active" | "standby";
  tasksCompleted: number;
  rating: number;
  createdAt: string;
}

export interface FirestorePartnerDeal {
  id: string;
  creatorId: string;
  companyId: string;
  partnerName: string;
  partnerLogo: string;
  partnerHandle: string;
  type: "co_branding" | "cross_promo" | "sponsor" | "tech_integration";
  typeLabel: string;
  description: string;
  contactEmail?: string;
  status: "active" | "pending" | "proposed";
  value: string;
  reach: string;
  startDate: string;
  createdAt: string;
}

export interface FirestoreProduct {
  id: string;
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  name: string;
  tagline?: string;
  description?: string;
  category: string;
  productType?: string;
  pricingAmount: number;
  pricingModel: "subscription" | "one_time" | "annual" | "free_upsell";
  currency: string;
  targetAudience?: string;
  status: "active" | "draft" | "paused";
  features: string[];
  techStack: string[];
  estimatedMonthlyRevenue?: number;
  affiliateCommissionRate: number;
  membersCount: number;
  conversionRate?: string;
  apps: string[];
  storeUrl: string;
  ctaText?: string;
  coverImage?: string;
  bannerUrl?: string;
  companyId?: string;
  companyName?: string;
  createdAt: string;
  updatedAt: string;
}

function mapFirestoreProduct(
  id: string,
  data: FirestoreProduct,
  privateContent: { digitalFiles?: unknown[]; courseModules?: unknown[] } = {},
): BusinessProject {
  return {
    id,
    creatorId: data.creatorId,
    name: data.name,
    tagline: data.tagline || data.description || "",
    category: data.category || "community",
    pricingAmount: data.pricingAmount || 0,
    pricingModel: data.pricingModel || "subscription",
    currency: data.currency || "XOF",
    targetAudience: data.targetAudience || "Membres & Clients",
    status: data.status || "active",
    features: data.features || [],
    techStack: data.techStack || ["Mansa Mobile Money", "Paiement Instantané"],
    estimatedMonthlyRevenue:
      data.estimatedMonthlyRevenue || (data.pricingAmount || 0) * (data.membersCount || 0),
    affiliateCommissionRate: data.affiliateCommissionRate || 30,
    membersCount: data.membersCount || 0,
    conversionRate: data.conversionRate || "0%",
    createdAt: data.createdAt || new Date().toISOString().split("T")[0],
    updatedAt: data.updatedAt || new Date().toISOString().split("T")[0],
    apps: data.apps || [],
    storeUrl: data.storeUrl || `mansa.af/p/${id}`,
    ctaText: data.ctaText,
    coverImage: data.coverImage,
    bannerUrl: data.bannerUrl,
    companyId: data.companyId,
    companyName: data.companyName,
    productType: data.productType,
    digitalFiles: privateContent.digitalFiles || [],
    courseModules: privateContent.courseModules || [],
  } as BusinessProject;
}

export interface FirestoreTransaction {
  id: string;
  creatorId: string;
  buyerName: string;
  buyerEmail: string;
  buyerLocation: string;
  productName: string;
  productId: string;
  amount: string;
  amountNumber: number;
  currency: string;
  paymentMethod: string;
  status: "completed" | "pending" | "failed";
  createdAt: string;
  timestamp?: any;
  customerName?: string;
  customerEmail?: string;
  companyId?: string;
  companyName?: string;
  storeName?: string;
  type?: "sale" | "affiliate" | "other" | "transfer" | "ad_spend";
}

export interface FirestoreCustomer {
  id: string;
  creatorId: string;
  name: string;
  email: string;
  companyId?: string;
  companyName?: string;
  country?: string;
  countryName?: string;
  countryFlag?: string;
  phone?: string;
  productName: string;
  productId?: string;
  amountSpent?: string;
  totalSpent?: number;
  totalSpentFormatted?: string;
  currency?: string;
  status: "active" | "cancelled" | "past_due" | "trial";
  joinedAt?: string;
  joinedDate?: string;
  discordUsername?: string;
}

export interface FirestoreCommunityMessage {
  id: string;
  creatorId: string;
  buyerName: string;
  buyerEmail: string;
  productName: string;
  text: string;
  sender: "buyer" | "creator" | "system";
  createdAt: string;
  time: string;
}

// Helper for local caching
const LOCAL_PRODUCTS_KEY = "mansa_saved_products_cache";
const creatorProductsCacheKey = (creatorId: string) => `${LOCAL_PRODUCTS_KEY}_${creatorId}`;

function getCreatorLocalProducts(creatorId: string): BusinessProject[] {
  if (!creatorId) return [];
  const scoped = getLocalItems<BusinessProject>(creatorProductsCacheKey(creatorId));
  // Import only legacy entries that explicitly identify this creator; never expose
  // anonymous products from the old shared cache to a different account.
  const legacy = getLocalItems<BusinessProject>(LOCAL_PRODUCTS_KEY).filter(
    (product) => product.creatorId === creatorId,
  );
  const merged = [...scoped];
  for (const product of legacy) {
    if (!merged.some((saved) => saved.id === product.id)) merged.push(product);
  }
  return merged;
}

function saveCreatorLocalProducts(creatorId: string, products: BusinessProject[]): void {
  saveLocalItems(creatorProductsCacheKey(creatorId), products);
}
const LOCAL_TRANSACTIONS_KEY = "mansa_saved_transactions_cache";
const LOCAL_CUSTOMERS_KEY = "mansa_saved_customers_cache";
const LOCAL_WORKFORCE_KEY = "mansa_saved_workforce_cache";
const LOCAL_PARTNERS_KEY = "mansa_saved_partners_cache";
const LOCAL_FAVORITES_KEY = "mansa_saved_favorites_cache";
const LOCAL_USER_PROFILE_KEY = "mansa_saved_user_profile_cache_";

function getLocalItems<T>(key: string): T[] {
  try {
    let raw = safeStorage.getItem(key);
    // Backward compatibility fallback for legacy afhub keys
    if (!raw && key.startsWith("mansa_")) {
      const legacyKey = key.replace("mansa_", "afhub_");
      raw = safeStorage.getItem(legacyKey);
      if (raw) {
        safeStorage.setItem(key, raw);
      }
    }
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalItems<T>(key: string, items: T[]) {
  try {
    safeStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error("Local storage save error:", e);
  }
}

export async function loadDiscoverableProducts(): Promise<BusinessProject[]> {
  const toPublicProduct = (
    product: Partial<BusinessProject> & {
      id?: string;
      description?: string;
      companyId?: string;
      companyName?: string;
      productType?: string;
      coverImage?: string;
    },
    id = product.id,
  ): BusinessProject =>
    ({
      id,
      creatorId: product.creatorId,
      name: product.name || "",
      tagline: product.tagline || product.description || "",
      category: product.category || "Produit digital",
      status: product.status,
      pricingAmount: product.pricingAmount || 0,
      pricingModel: product.pricingModel || "one_time",
      currency: product.currency || "XOF",
      companyId: product.companyId,
      companyName: product.companyName,
      productType: product.productType,
      coverImage: product.coverImage,
    }) as BusinessProject;
  const loadLocalPublicProducts = (): BusinessProject[] => {
    if (typeof window === "undefined") return [];
    const products: BusinessProject[] = [];
    const keys = Object.keys(window.localStorage).filter(
      (key) => key === LOCAL_PRODUCTS_KEY || key.startsWith(`${LOCAL_PRODUCTS_KEY}_`),
    );
    for (const key of keys) {
      const items = getLocalItems<BusinessProject>(key);
      products.push(
        ...items
          .filter(
            (product) =>
              product.status === "active" &&
              Boolean(product.companyId) &&
              Boolean(product.creatorId),
          )
          .map((product) => toPublicProduct(product)),
      );
    }
    return products.filter(
      (product, index) => products.findIndex((item) => item.id === product.id) === index,
    );
  };

  if (!db) return loadLocalPublicProducts();
  try {
    const snapshot = await getDocs(
      query(collection(db, "products"), where("status", "==", "active")),
    );
    return snapshot.docs.map((item) => toPublicProduct(item.data(), item.id));
  } catch (error) {
    console.warn("Could not load discoverable products; using public local cache:", error);
    return loadLocalPublicProducts();
  }
}

// ----------------- USER PROFILE & ENTERPRISE SETTINGS -----------------
export function isCreatorPayoutConfigured(profile?: Partial<FirestoreUserProfile> | null): boolean {
  if (!profile) return false;
  if (!profile.payoutMethod) return false;
  if (profile.payoutMethod === "wave" || profile.payoutMethod === "orange_momo") {
    return Boolean(profile.momoNumber && profile.momoNumber.trim().length >= 6);
  }
  if (profile.payoutMethod === "bank_uemoa" || profile.payoutMethod === "bank_cemac") {
    return Boolean(profile.bankIbanRib && profile.bankIbanRib.trim().length >= 6);
  }
  if (profile.payoutMethod === "crypto") {
    return true;
  }
  return false;
}

export async function getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
  if (!uid) return null;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as FirestoreUserProfile;
      safeStorage.setItem(`${LOCAL_USER_PROFILE_KEY}${uid}`, JSON.stringify(data));
      return data;
    }
    const cached = safeStorage.getItem(`${LOCAL_USER_PROFILE_KEY}${uid}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.warn("Firestore getUserProfile fallback to cache:", err);
    const cached = safeStorage.getItem(`${LOCAL_USER_PROFILE_KEY}${uid}`);
    return cached ? JSON.parse(cached) : null;
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<FirestoreUserProfile>,
): Promise<FirestoreUserProfile> {
  if (!uid) throw new Error("User ID is required for profile update");

  const userRef = doc(db, "users", uid);
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    ...data,
    updatedAt: now,
  };

  // Strip undefined values to avoid Firestore errors
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  await setDoc(userRef, payload, { merge: true });

  // Update local cache
  const updatedSnap = await getDoc(userRef);
  const updatedData = updatedSnap.exists()
    ? (updatedSnap.data() as FirestoreUserProfile)
    : ({ uid, ...payload } as FirestoreUserProfile);
  safeStorage.setItem(`${LOCAL_USER_PROFILE_KEY}${uid}`, JSON.stringify(updatedData));

  return updatedData;
}

export async function syncUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}): Promise<FirestoreUserProfile> {
  const initials =
    (user.displayName
      ? user.displayName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : user.email?.slice(0, 2).toUpperCase()) || "MA";

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data() as FirestoreUserProfile;
      const merged: FirestoreUserProfile = {
        ...data,
        uid: user.uid,
        email: user.email || data.email || "",
        displayName: user.displayName || data.displayName || "Créateur Mansa",
        avatarInitials: data.avatarInitials || initials,
        photoURL: user.photoURL || data.photoURL,
        country: data.country || "Côte d'Ivoire",
        currency: data.currency || "XOF",
      };
      safeStorage.setItem(`${LOCAL_USER_PROFILE_KEY}${user.uid}`, JSON.stringify(merged));
      return merged;
    }

    const newProfile: FirestoreUserProfile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "Créateur Mansa",
      avatarInitials: initials,
      photoURL: user.photoURL || undefined,
      country: "Côte d'Ivoire",
      currency: "XOF",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, newProfile);
    safeStorage.setItem(`${LOCAL_USER_PROFILE_KEY}${user.uid}`, JSON.stringify(newProfile));
    return newProfile;
  } catch (err) {
    console.warn("Firestore sync fallback to local:", err);
    return {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "Créateur Mansa",
      avatarInitials: initials,
      photoURL: user.photoURL || undefined,
      country: "Côte d'Ivoire",
      currency: "XOF",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

// ----------------- PRODUCTS (REAL FIRESTORE & CACHE) -----------------
export async function getCreatorProducts(
  creatorId: string,
  companyId?: string,
): Promise<BusinessProject[]> {
  if (companyId === "personal") return [];
  const inScope = (product: BusinessProject) => !companyId || product.companyId === companyId;
  const localList = getCreatorLocalProducts(creatorId).filter(inScope);

  try {
    const q = companyId
      ? query(
          collection(db, "products"),
          where("creatorId", "==", creatorId),
          where("companyId", "==", companyId),
        )
      : query(collection(db, "products"), where("creatorId", "==", creatorId));
    const querySnapshot = await getDocs(q);
    const products = await Promise.all(
      querySnapshot.docs.map(async (docSnap) => {
        const privateSnap = await getDoc(doc(db, "productPrivateContent", docSnap.id));
        return mapFirestoreProduct(
          docSnap.id,
          docSnap.data() as FirestoreProduct,
          privateSnap.exists() ? privateSnap.data() : {},
        );
      }),
    );

    // Merge and deduplicate by id
    const combined = [...products];
    for (const item of localList) {
      if (!combined.some((c) => c.id === item.id)) {
        combined.unshift(item);
      }
    }
    return combined;
  } catch (error) {
    console.warn("Error fetching products, returning local cache:", error);
    return localList;
  }
}

export function subscribeToCreatorProducts(
  creatorId: string,
  callback: (products: BusinessProject[]) => void,
  companyId?: string,
) {
  if (companyId === "personal") {
    callback([]);
    return () => {};
  }
  const inScope = (product: BusinessProject) => !companyId || product.companyId === companyId;
  let active = true;
  let remoteProducts: BusinessProject[] = [];
  const emitMergedProducts = () => {
    if (!active) return;
    const currentLocal = getCreatorLocalProducts(creatorId).filter(inScope);
    const combined = [...remoteProducts];
    for (const item of currentLocal) {
      if (!combined.some((remoteProduct) => remoteProduct.id === item.id)) {
        combined.unshift(item);
      }
    }
    callback(combined);
  };
  const handleLocalProductsUpdated = () => emitMergedProducts();

  // Emit the cache immediately and keep it reactive when Firebase is unavailable
  // or when a local fallback save/delete completes.
  emitMergedProducts();
  if (typeof window !== "undefined") {
    window.addEventListener("mansa_discoverable_products_updated", handleLocalProductsUpdated);
  }

  // In local-preview/fallback mode there is no Firestore listener to attach.
  // Keep the local listener above and return a complete cleanup function.
  if (!db) {
    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "mansa_discoverable_products_updated",
          handleLocalProductsUpdated,
        );
      }
    };
  }

  try {
    const q = companyId
      ? query(
          collection(db, "products"),
          where("creatorId", "==", creatorId),
          where("companyId", "==", companyId),
        )
      : query(collection(db, "products"), where("creatorId", "==", creatorId));
    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        try {
          remoteProducts = await Promise.all(
            querySnapshot.docs.map(async (docSnap) => {
              const privateSnap = await getDoc(doc(db, "productPrivateContent", docSnap.id));
              return mapFirestoreProduct(
                docSnap.id,
                docSnap.data() as FirestoreProduct,
                privateSnap.exists() ? privateSnap.data() : {},
              );
            }),
          );
        } catch (privateContentError) {
          console.warn(
            "Private product content unavailable in this workspace:",
            privateContentError,
          );
          remoteProducts = [];
          emitMergedProducts();
          return;
        }
        emitMergedProducts();
      },
      (err) => {
        console.warn("Products snapshot error, using local items:", err);
        remoteProducts = [];
        emitMergedProducts();
      },
    );
    return () => {
      active = false;
      unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "mansa_discoverable_products_updated",
          handleLocalProductsUpdated,
        );
      }
    };
  } catch (e) {
    console.warn("Failed to attach products snapshot, relying on local cache:", e);
    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "mansa_discoverable_products_updated",
          handleLocalProductsUpdated,
        );
      }
    };
  }
}

export async function saveProductToFirestore(
  creatorId: string,
  creatorEmail: string,
  creatorName: string,
  productData: {
    id?: string;
    name: string;
    description?: string;
    category?: string;
    priceAmount: number;
    pricingType?: "free" | "paid";
    billingCycle?: string;
    currency: string;
    includedApps: string[];
    affiliateRate?: number;
    productUrl?: string;
    ctaText?: string;
    coverImage?: string;
    bannerUrl?: string;
    companyId: string;
    companyName?: string;
    productType?: string;
    digitalFiles?: unknown[];
    courseModules?: unknown[];
    visibility?: "Visible" | "Caché";
  },
): Promise<string> {
  if (!creatorId) throw new Error("Connectez-vous pour créer un produit.");
  if (!productData.companyId?.trim())
    throw new Error("Sélectionnez une entreprise pour ce produit.");
  const effectiveCreatorId = auth?.currentUser?.uid || creatorId;
  if (auth?.currentUser && auth.currentUser.uid !== creatorId) {
    throw new Error("La session Firebase ne correspond pas au compte créateur actif.");
  }
  let companyName = "";
  if (db) {
    let companySnap = await getDoc(doc(db, "companies", productData.companyId));
    if (!companySnap.exists()) {
      const localCompany = getSavedCompanies(effectiveCreatorId).find(
        (company) =>
          company.id === productData.companyId && company.ownerUid === effectiveCreatorId,
      );
      if (localCompany) {
        const now = new Date().toISOString();
        const companyPayload = {
          ...localCompany,
          ownerUid: effectiveCreatorId,
          discoverable: true,
          createdAt: localCompany.createdAt || now,
          updatedAt: now,
        };
        await setDoc(doc(db, "companies", localCompany.id), companyPayload, { merge: true });
        await setDoc(
          doc(db, "discoverableCompanies", localCompany.id),
          {
            companyId: localCompany.id,
            ownerUid: effectiveCreatorId,
            name: localCompany.name,
            description: localCompany.description || "",
            logoInitials: localCompany.logoInitials || "EN",
            colorGradient: localCompany.colorGradient || "from-emerald-600 via-teal-700 to-black",
            companyBanner: localCompany.companyBanner || "",
            companyLogo: localCompany.companyLogo || "",
            discoverable: true,
            createdAt: companyPayload.createdAt,
            updatedAt: now,
          },
          { merge: true },
        );
        companySnap = await getDoc(doc(db, "companies", productData.companyId));
      }
    }
    if (!companySnap.exists() || companySnap.data().ownerUid !== effectiveCreatorId) {
      throw new Error("Cette entreprise ne vous appartient pas ou n'existe plus.");
    }
    companyName = String(companySnap.data().name || "");
  } else {
    const ownedCompany = getSavedCompanies(creatorId).find(
      (company) => company.id === productData.companyId && company.ownerUid === creatorId,
    );
    if (!ownedCompany) throw new Error("Choisissez une entreprise appartenant à votre compte.");
    companyName = ownedCompany.name;
  }
  if (!companyName) throw new Error("L'entreprise sélectionnée n'a pas de nom valide.");

  const productId =
    productData.id && !productData.id.startsWith("proj-temp-")
      ? productData.id
      : "prod-" + Math.random().toString(36).substring(2, 9);
  const existingProductSnap = db ? await getDoc(doc(db, "products", productId)) : null;
  if (existingProductSnap?.exists() && existingProductSnap.data().creatorId !== creatorId) {
    throw new Error("Vous ne pouvez pas modifier un produit qui appartient à un autre compte.");
  }
  const createdAt = existingProductSnap?.exists()
    ? existingProductSnap.data().createdAt || new Date().toISOString()
    : new Date().toISOString();
  const newProject: BusinessProject = {
    id: productId,
    creatorId,
    name: productData.name,
    tagline: productData.description || "Offre digitale exclusive",
    category: (productData.category as any) || "community",
    pricingAmount: productData.priceAmount,
    pricingModel: productData.billingCycle === "one_time" ? "one_time" : "subscription",
    currency: productData.currency || "XOF",
    targetAudience: "Abonnés et Acheteurs",
    status: productData.visibility === "Caché" ? "paused" : "active",
    features: [
      `Applications : ${productData.includedApps.join(", ") || "Accès Privé"}`,
      "Paiement Mobile Money (Wave, Orange, MTN, Moov) & Carte",
      "Délivrance instantanée 24/7",
    ],
    techStack: ["Mansa Engine v2", "Mobile Money Multi-Gateway"],
    estimatedMonthlyRevenue: 0,
    affiliateCommissionRate: productData.affiliateRate || 25,
    membersCount: 0,
    conversionRate: "0%",
    apps: productData.includedApps,
    storeUrl: productData.productUrl || `mansa.af/p/${productId}`,
    ctaText: productData.ctaText,
    coverImage: productData.coverImage,
    bannerUrl: productData.bannerUrl,
    companyId: productData.companyId,
    companyName,
    productType: productData.productType,
    digitalFiles: productData.digitalFiles || [],
    courseModules: productData.courseModules || [],
    createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    const { digitalFiles, courseModules, ...publicProject } = newProject;
    const payload: FirestoreProduct = {
      ...publicProject,
      creatorId,
      ...(!existingProductSnap?.exists() ? { creatorEmail, creatorName } : {}),
      name: productData.name,
      tagline: productData.description || "",
      description: productData.description || "",
      category: productData.category || "community",
      pricingAmount: productData.priceAmount,
      pricingModel: productData.billingCycle === "one_time" ? "one_time" : "subscription",
      currency: productData.currency || "XOF",
      targetAudience: "Abonnés et Acheteurs",
      status: productData.visibility === "Caché" ? "paused" : "active",
      features: newProject.features,
      techStack: newProject.techStack,
      estimatedMonthlyRevenue: 0,
      affiliateCommissionRate: productData.affiliateRate || 25,
      membersCount: 0,
      conversionRate: "0%",
      apps: productData.includedApps,
      storeUrl: productData.productUrl || `mansa.af/p/${productId}`,
      companyId: productData.companyId,
      companyName,
      productType: productData.productType,
      // Migrate any previously public copies out of the product document.
      createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (existingProductSnap?.exists()) {
      payload.digitalFiles = deleteField();
      payload.courseModules = deleteField();
    }
    const batch = writeBatch(db);
    batch.set(doc(db, "products", productId), payload, { merge: true });
    batch.set(
      doc(db, "productPrivateContent", productId),
      {
        creatorId,
        companyId: productData.companyId,
        digitalFiles: digitalFiles || [],
        courseModules: courseModules || [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    // Both records are persisted together so visible products cannot lose their private content.
    await batch.commit();
  }

  const localList = getCreatorLocalProducts(creatorId);
  const existingIdx = localList.findIndex((product) => product.id === productId);
  if (existingIdx >= 0) localList[existingIdx] = newProject;
  else localList.unshift(newProject);
  saveCreatorLocalProducts(creatorId, localList);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("mansa_discoverable_products_updated"));
  }
  return productId;
}

export async function deleteProductFromFirestore(
  productId: string,
  creatorId?: string,
): Promise<void> {
  if (creatorId) {
    saveCreatorLocalProducts(
      creatorId,
      getCreatorLocalProducts(creatorId).filter((product) => product.id !== productId),
    );
  }
  try {
    await deleteDoc(doc(db, "products", productId));
    try {
      await deleteDoc(doc(db, "productPrivateContent", productId));
    } catch (privateDeleteError) {
      console.warn("Private product content cleanup warning:", privateDeleteError);
    }
  } catch (err) {
    console.warn("Firestore delete warning (removed locally):", err);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("mansa_discoverable_products_updated"));
  }
}

// ----------------- TRANSACTIONS (REAL FIRESTORE & CACHE) -----------------
export async function getCreatorTransactions(creatorId: string): Promise<FirestoreTransaction[]> {
  const localList = getLocalItems<FirestoreTransaction>(LOCAL_TRANSACTIONS_KEY).filter(
    (transaction) => transaction.creatorId === creatorId,
  );
  try {
    const q = query(
      collection(db, "transactions"),
      where("creatorId", "==", creatorId),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const snap = await getDocs(q);
    const list: FirestoreTransaction[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));

    const combined = [...list];
    for (const t of localList) {
      if (!combined.some((c) => c.id === t.id)) {
        combined.unshift(t);
      }
    }
    return combined;
  } catch (error) {
    return localList;
  }
}

export function subscribeToCreatorTransactions(
  creatorId: string,
  callback: (transactions: FirestoreTransaction[]) => void,
  companyId?: string | "personal",
) {
  const inScope = (transaction: FirestoreTransaction) =>
    transaction.creatorId === creatorId &&
    (companyId === "personal"
      ? filterPersonalTransactions([transaction]).length > 0
      : !companyId || transaction.companyId === companyId);
  const localList = getLocalItems<FirestoreTransaction>(LOCAL_TRANSACTIONS_KEY).filter(inScope);
  callback(localList);

  try {
    const q =
      companyId === "personal"
        ? query(
            collection(db, "transactions"),
            where("creatorId", "==", creatorId),
            where("type", "in", ["affiliate", "other"]),
            where("companyId", "==", null),
            limit(50),
          )
        : companyId
          ? query(
              collection(db, "transactions"),
              where("creatorId", "==", creatorId),
              where("companyId", "==", companyId),
              limit(50),
            )
          : query(collection(db, "transactions"), where("creatorId", "==", creatorId), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const list: FirestoreTransaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        const currentLocal =
          getLocalItems<FirestoreTransaction>(LOCAL_TRANSACTIONS_KEY).filter(inScope);
        const combined = [...list];
        for (const t of currentLocal) {
          if (!combined.some((c) => c.id === t.id)) {
            combined.unshift(t);
          }
        }
        callback(combined);
      },
      (err) => {
        console.warn("Transactions listener warning, using local cache:", err);
        callback(getLocalItems<FirestoreTransaction>(LOCAL_TRANSACTIONS_KEY).filter(inScope));
      },
    );
  } catch (e) {
    return () => {};
  }
}

export async function createRealTransaction(
  creatorId: string,
  data: {
    buyerName: string;
    buyerEmail: string;
    buyerLocation: string;
    productName: string;
    productId: string;
    amount: string;
    amountNumber: number;
    currency: string;
    paymentMethod: string;
    companyId?: string;
    companyName?: string;
  },
): Promise<string> {
  const txId = "tx-" + Math.random().toString(36).substring(2, 9);
  const txObj: FirestoreTransaction = {
    id: txId,
    creatorId,
    ...data,
    companyId: data.companyId ?? null,
    companyName: data.companyName ?? null,
    status: "completed",
    createdAt: new Date().toISOString(),
  };

  // 1. Update local cache
  const localList = getLocalItems<FirestoreTransaction>(LOCAL_TRANSACTIONS_KEY);
  localList.unshift(txObj);
  saveLocalItems(LOCAL_TRANSACTIONS_KEY, localList);

  // 2. Also register customer locally
  const custId = "cust-" + Math.random().toString(36).substring(2, 9);
  const custObj: FirestoreCustomer = {
    id: custId,
    creatorId,
    name: data.buyerName,
    email: data.buyerEmail,
    companyId: data.companyId,
    companyName: data.companyName,
    country: data.buyerLocation,
    countryName: data.buyerLocation,
    countryFlag: data.buyerLocation?.includes("Sénégal") ? "🇸🇳" : "🇨🇮",
    productName: data.productName,
    productId: data.productId,
    amountSpent: data.amount,
    totalSpent: data.amountNumber,
    totalSpentFormatted: data.amount,
    currency: data.currency,
    status: "active",
    joinedAt: new Date().toISOString().split("T")[0],
    joinedDate: new Date().toLocaleDateString("fr-FR"),
  };
  const custs = getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY);
  custs.unshift(custObj);
  saveLocalItems(LOCAL_CUSTOMERS_KEY, custs);

  // 3. Persist to Firestore
  try {
    await addDoc(collection(db, "transactions"), txObj);
    await addDoc(collection(db, "customers"), custObj);
  } catch (err) {
    console.warn("Firestore transaction save warning (persisted locally):", err);
  }

  return txId;
}

// ----------------- CUSTOMERS (REAL FIRESTORE & CACHE) -----------------
export async function getCreatorCustomers(
  creatorId: string,
  companyId?: string,
): Promise<FirestoreCustomer[]> {
  const inScope = (customer: FirestoreCustomer) =>
    customer.creatorId === creatorId && (!companyId || customer.companyId === companyId);
  const localList = getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY).filter(inScope);
  try {
    const q = companyId
      ? query(
          collection(db, "customers"),
          where("creatorId", "==", creatorId),
          where("companyId", "==", companyId),
          limit(100),
        )
      : query(collection(db, "customers"), where("creatorId", "==", creatorId), limit(100));
    const snap = await getDocs(q);
    const list: FirestoreCustomer[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    const combined = [...list];
    for (const c of localList) {
      if (!combined.some((item) => item.id === c.id)) {
        combined.unshift(c);
      }
    }
    return combined;
  } catch (error) {
    return localList;
  }
}

export function subscribeToCreatorCustomers(
  creatorId: string,
  callback: (customers: FirestoreCustomer[]) => void,
  companyId?: string,
) {
  const inScope = (customer: FirestoreCustomer) =>
    customer.creatorId === creatorId && (!companyId || customer.companyId === companyId);
  const localList = getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY).filter(inScope);
  callback(localList);

  try {
    const q = companyId
      ? query(
          collection(db, "customers"),
          where("creatorId", "==", creatorId),
          where("companyId", "==", companyId),
          limit(100),
        )
      : query(collection(db, "customers"), where("creatorId", "==", creatorId), limit(100));
    return onSnapshot(
      q,
      (snap) => {
        const list: FirestoreCustomer[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        const currentLocal = getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY).filter(inScope);
        const combined = [...list];
        for (const c of currentLocal) {
          if (!combined.some((item) => item.id === c.id)) {
            combined.unshift(c);
          }
        }
        callback(combined);
      },
      (err) => {
        console.warn("Customers listener warning, using local cache:", err);
        callback(getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY).filter(inScope));
      },
    );
  } catch (e) {
    return () => {};
  }
}

export async function createRealCustomer(
  creatorId: string,
  data: {
    name: string;
    email: string;
    productName: string;
    companyId: string;
    companyName?: string;
    productId?: string;
    totalSpent?: number;
    totalSpentFormatted?: string;
    countryFlag?: string;
    countryName?: string;
    status?: "active" | "cancelled" | "trial" | "past_due";
  },
): Promise<string> {
  const custId = "cust-" + Math.random().toString(36).substring(2, 9);
  const custObj: FirestoreCustomer = {
    id: custId,
    creatorId,
    name: data.name,
    email: data.email,
    companyId: data.companyId,
    companyName: data.companyName,
    productName: data.productName,
    productId: data.productId || "",
    totalSpent: data.totalSpent || 0,
    totalSpentFormatted: data.totalSpentFormatted || "0 FCFA",
    countryFlag: data.countryFlag || "🇨🇮",
    countryName: data.countryName || "Côte d'Ivoire",
    country: data.countryName || "Côte d'Ivoire",
    status: data.status || "active",
    joinedAt: new Date().toISOString().split("T")[0],
    joinedDate: new Date().toLocaleDateString("fr-FR"),
  };

  const localList = getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY);
  localList.unshift(custObj);
  saveLocalItems(LOCAL_CUSTOMERS_KEY, localList);

  try {
    await addDoc(collection(db, "customers"), custObj);
  } catch (err) {
    console.warn("Firestore customer save warning (persisted locally):", err);
  }

  return custId;
}

export async function deleteCustomerFromFirestore(customerId: string): Promise<void> {
  const localList = getLocalItems<FirestoreCustomer>(LOCAL_CUSTOMERS_KEY).filter(
    (c) => c.id !== customerId,
  );
  saveLocalItems(LOCAL_CUSTOMERS_KEY, localList);
  try {
    await deleteDoc(doc(db, "customers", customerId));
  } catch (err) {
    console.warn("Firestore delete warning (removed locally):", err);
  }
}

// ----------------- PUBLIC PRODUCTS / MARKETPLACE (REAL FIRESTORE) -----------------
export async function getPublicProducts(): Promise<BusinessProject[]> {
  try {
    const q = query(collection(db, "products"), where("status", "==", "active"), limit(20));
    const querySnapshot = await getDocs(q);
    const products: BusinessProject[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as FirestoreProduct;
      products.push({
        id: docSnap.id,
        name: data.name,
        tagline: data.tagline || data.description || "",
        category: data.category || "community",
        pricingAmount: data.pricingAmount || 0,
        pricingModel: data.pricingModel || "subscription",
        currency: data.currency || "XOF",
        targetAudience: data.targetAudience || "Membres & Clients",
        status: data.status || "active",
        features: data.features || [],
        techStack: data.techStack || ["Mansa Mobile Money"],
        estimatedMonthlyRevenue: data.estimatedMonthlyRevenue || 0,
        affiliateCommissionRate: data.affiliateCommissionRate || 20,
        membersCount: data.membersCount || 0,
        conversionRate: data.conversionRate || "0%",
        createdAt: data.createdAt || new Date().toISOString().split("T")[0],
        updatedAt: data.updatedAt || new Date().toISOString().split("T")[0],
        apps: data.apps || [],
        storeUrl: data.storeUrl || `mansa.af/p/${docSnap.id}`,
        ctaText: data.ctaText,
      });
    });

    return products;
  } catch (error) {
    console.error("Error fetching public products:", error);
    return [];
  }
}

// ----------------- WORKFORCE & TEAM (REAL FIRESTORE & CACHE) -----------------
export async function getCreatorWorkforce(
  creatorId: string,
  companyId: string,
): Promise<FirestoreWorkforceMember[]> {
  if (!creatorId || !companyId) return [];
  const localList = getLocalItems<FirestoreWorkforceMember>(LOCAL_WORKFORCE_KEY).filter(
    (w) => w.creatorId === creatorId && w.companyId === companyId,
  );

  try {
    const q = query(
      collection(db, "workforce"),
      where("creatorId", "==", creatorId),
      where("companyId", "==", companyId),
    );
    const querySnapshot = await getDocs(q);
    const members: FirestoreWorkforceMember[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as FirestoreWorkforceMember;
      members.push({
        ...data,
        id: docSnap.id,
      });
    });

    if (members.length > 0) {
      const otherCompanies = getLocalItems<FirestoreWorkforceMember>(LOCAL_WORKFORCE_KEY).filter(
        (member) => member.creatorId !== creatorId || member.companyId !== companyId,
      );
      saveLocalItems(LOCAL_WORKFORCE_KEY, [...members, ...otherCompanies]);
      return members;
    }
    return localList;
  } catch (err) {
    console.warn("Firestore getCreatorWorkforce fallback to cache:", err);
    return localList;
  }
}

export async function saveWorkforceMemberToFirestore(
  creatorId: string,
  companyId: string,
  memberData: Omit<FirestoreWorkforceMember, "id" | "creatorId" | "companyId" | "createdAt"> & {
    id?: string;
  },
): Promise<string> {
  if (!creatorId || !companyId)
    throw new Error("Sélectionnez une entreprise avant d’ajouter un membre.");
  const memberId =
    memberData.id || `worker-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const memberObj: FirestoreWorkforceMember = {
    id: memberId,
    creatorId,
    companyId,
    name: memberData.name,
    role: memberData.role,
    rate: memberData.rate,
    avatar: memberData.avatar || memberData.name.slice(0, 2).toUpperCase(),
    status: memberData.status || "active",
    tasksCompleted: memberData.tasksCompleted || 0,
    rating: memberData.rating || 5.0,
    createdAt: now,
  };

  // Update local cache
  const localList = getLocalItems<FirestoreWorkforceMember>(LOCAL_WORKFORCE_KEY);
  const existingIdx = localList.findIndex(
    (w) => w.id === memberId && w.creatorId === creatorId && w.companyId === companyId,
  );
  if (existingIdx >= 0) {
    localList[existingIdx] = memberObj;
  } else {
    localList.unshift(memberObj);
  }
  saveLocalItems(LOCAL_WORKFORCE_KEY, localList);

  // Real Firestore write
  try {
    const docRef = doc(db, "workforce", memberId);
    await setDoc(docRef, memberObj);
  } catch (err) {
    console.warn("Firestore saveWorkforceMember warning (persisted locally):", err);
  }

  return memberId;
}

export async function deleteWorkforceMemberFromFirestore(
  memberId: string,
  companyId: string,
): Promise<void> {
  const localList = getLocalItems<FirestoreWorkforceMember>(LOCAL_WORKFORCE_KEY).filter(
    (w) => w.id !== memberId || w.companyId !== companyId,
  );
  saveLocalItems(LOCAL_WORKFORCE_KEY, localList);

  try {
    await deleteDoc(doc(db, "workforce", memberId));
  } catch (err) {
    console.warn("Firestore deleteWorkforceMember warning:", err);
  }
}

// ----------------- PARTNERS & B2B DEALS (REAL FIRESTORE & CACHE) -----------------
export async function getCreatorPartners(
  creatorId: string,
  companyId: string,
): Promise<FirestorePartnerDeal[]> {
  if (!creatorId || !companyId) return [];
  const localList = getLocalItems<FirestorePartnerDeal>(LOCAL_PARTNERS_KEY).filter(
    (d) => d.creatorId === creatorId && d.companyId === companyId,
  );

  try {
    const q = query(
      collection(db, "partners"),
      where("creatorId", "==", creatorId),
      where("companyId", "==", companyId),
    );
    const querySnapshot = await getDocs(q);
    const deals: FirestorePartnerDeal[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as FirestorePartnerDeal;
      deals.push({
        ...data,
        id: docSnap.id,
      });
    });

    if (deals.length > 0) {
      const otherCompanies = getLocalItems<FirestorePartnerDeal>(LOCAL_PARTNERS_KEY).filter(
        (deal) => deal.creatorId !== creatorId || deal.companyId !== companyId,
      );
      saveLocalItems(LOCAL_PARTNERS_KEY, [...deals, ...otherCompanies]);
      return deals;
    }
    return localList;
  } catch (err) {
    console.warn("Firestore getCreatorPartners fallback to cache:", err);
    return localList;
  }
}

export async function savePartnerDealToFirestore(
  creatorId: string,
  companyId: string,
  dealData: Omit<FirestorePartnerDeal, "id" | "creatorId" | "companyId" | "createdAt"> & {
    id?: string;
  },
): Promise<string> {
  if (!creatorId || !companyId)
    throw new Error("Sélectionnez une entreprise avant d’ajouter un partenaire.");
  const dealId = dealData.id || `deal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const dealObj: FirestorePartnerDeal = {
    id: dealId,
    creatorId,
    companyId,
    partnerName: dealData.partnerName,
    partnerLogo:
      dealData.partnerLogo ||
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    partnerHandle:
      dealData.partnerHandle || `@${dealData.partnerName.toLowerCase().replace(/\s+/g, "_")}`,
    type: dealData.type,
    typeLabel: dealData.typeLabel,
    description: dealData.description,
    contactEmail: dealData.contactEmail,
    status: dealData.status || "proposed",
    value: dealData.value || "En négociation",
    reach: dealData.reach || "Portée estimée 10k+",
    startDate: dealData.startDate || "Aujourd'hui",
    createdAt: now,
  };

  // Update local cache
  const localList = getLocalItems<FirestorePartnerDeal>(LOCAL_PARTNERS_KEY);
  const existingIdx = localList.findIndex(
    (d) => d.id === dealId && d.creatorId === creatorId && d.companyId === companyId,
  );
  if (existingIdx >= 0) {
    localList[existingIdx] = dealObj;
  } else {
    localList.unshift(dealObj);
  }
  saveLocalItems(LOCAL_PARTNERS_KEY, localList);

  // Real Firestore write
  try {
    const docRef = doc(db, "partners", dealId);
    await setDoc(docRef, dealObj);
  } catch (err) {
    console.warn("Firestore savePartnerDeal warning (persisted locally):", err);
  }

  return dealId;
}

export async function deletePartnerDealFromFirestore(
  dealId: string,
  companyId: string,
): Promise<void> {
  const localList = getLocalItems<FirestorePartnerDeal>(LOCAL_PARTNERS_KEY).filter(
    (d) => d.id !== dealId || d.companyId !== companyId,
  );
  saveLocalItems(LOCAL_PARTNERS_KEY, localList);

  try {
    await deleteDoc(doc(db, "partners", dealId));
  } catch (err) {
    console.warn("Firestore deletePartnerDeal warning:", err);
  }
}
