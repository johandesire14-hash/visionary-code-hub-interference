// @ts-nocheck
import { Company } from "../types";
import { db, doc, setDoc, deleteDoc, collection, getDocs, query, where } from "../services/firebase";

const COMPANIES_STORAGE_PREFIX = "mansa_companies_";
const LEGACY_COMPANIES_STORAGE_PREFIX = "afhub_companies_";

export function getSavedCompanies(userKey: string = "default"): Company[] {
  try {
    let raw = localStorage.getItem(`${COMPANIES_STORAGE_PREFIX}${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((company) => ({ ...company, ownerUid: company.ownerUid || userKey }))
      : [];
  } catch (err) {
    console.error("Error reading companies from storage:", err);
    return [];
  }
}

const publicCompanyPayload = (company: Company) => ({
  companyId: company.id,
  ownerUid: company.ownerUid,
  name: company.name,
  description: company.description || "",
  logoInitials: company.logoInitials || "EN",
  colorGradient: company.colorGradient || "from-emerald-600 via-teal-700 to-black",
  companyBanner: company.companyBanner || "",
  companyLogo: company.companyLogo || "",
  discoverable: true,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt || company.createdAt,
});

async function syncCompanyToFirestore(company: Company): Promise<void> {
  if (!db) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("mansa_discoverable_companies_updated"));
    return;
  }
  await setDoc(doc(db, "companies", company.id), company);
  await setDoc(doc(db, "discoverableCompanies", company.id), publicCompanyPayload(company));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mansa_discoverable_companies_updated"));
}

export async function loadCreatorCompanies(userUid: string): Promise<Company[]> {
  const local = getSavedCompanies(userUid);
  if (!db || !userUid) return local;
  try {
    const snapshot = await getDocs(query(collection(db, "companies"), where("ownerUid", "==", userUid)));
    const remote = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Company);
    const localOnly = local.filter((item) => !remote.some((remoteItem) => remoteItem.id === item.id));
    for (const company of localOnly) {
      await syncCompanyToFirestore({ ...company, ownerUid: userUid, discoverable: true });
    }
    const merged = [...remote, ...localOnly.map((company) => ({ ...company, ownerUid: userUid, discoverable: true }))];
    localStorage.setItem(`${COMPANIES_STORAGE_PREFIX}${userUid}`, JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.warn("Could not load owned companies from Firestore; using this account's cache:", error);
    return local;
  }
}

export async function loadDiscoverableCompanies(): Promise<Company[]> {
  const toPublicListing = (company: Partial<Company> & { companyId?: string }): Company => ({
    id: company.id || company.companyId,
    ownerUid: "",
    name: company.name || "",
    description: company.description || "",
    logoInitials: company.logoInitials || "EN",
    colorGradient: company.colorGradient || "from-emerald-600 via-teal-700 to-black",
    companyBanner: company.companyBanner || "",
    companyLogo: company.companyLogo || "",
    discoverable: true,
  } as Company);
  const readLocalDirectory = (): Company[] => {
    if (typeof window === "undefined") return [];
    const companies: Company[] = [];
    for (const key of Object.keys(localStorage).filter((item) => item.startsWith(COMPANIES_STORAGE_PREFIX))) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) {
          companies.push(
            ...parsed
              .filter((company) => company?.id && company.discoverable !== false)
              .map(toPublicListing),
          );
        }
      } catch {}
    }
    return companies;
  };
  if (!db) return readLocalDirectory();
  try {
    const snapshot = await getDocs(query(collection(db, "discoverableCompanies"), where("discoverable", "==", true)));
    return snapshot.docs.map((item) => toPublicListing({ ...item.data(), id: item.id }));
  } catch (error) {
    console.warn("Could not load discoverable companies:", error);
    return readLocalDirectory();
  }
}

export function saveCompany(
  userKey: string = "default",
  newCompany: Omit<Company, "id" | "createdAt"> & { id?: string },
): { companies: Company[]; created: Company; persisted: Promise<void> } {
  const current = getSavedCompanies(userKey);
  const initials =
    newCompany.logoInitials ||
    (newCompany.name
      ? newCompany.name
          .trim()
          .split(/\s+/)
          .map((w) => w[0]?.toUpperCase() || "")
          .slice(0, 2)
          .join("") || "EN"
      : "EN");

  const gradients = [
    "from-emerald-600 via-teal-700 to-black",
    "from-blue-600 via-indigo-800 to-black",
    "from-purple-600 via-pink-800 to-black",
    "from-amber-600 via-orange-800 to-black",
    "from-rose-600 via-red-800 to-black",
    "from-cyan-600 via-blue-800 to-black",
  ];
  const chosenGradient = newCompany.colorGradient || gradients[current.length % gradients.length];

  const fullCompany: Company = {
    id: newCompany.id || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ownerUid: userKey,
    name: newCompany.name.trim(),
    description: newCompany.description.trim(),
    acceptedPayments:
      newCompany.acceptedPayments && newCompany.acceptedPayments.length > 0
        ? newCompany.acceptedPayments
        : ["wave", "orange_money", "mtn_momo", "card"],
    primaryCurrency: newCompany.primaryCurrency || "XOF",
    logoInitials: initials,
    colorGradient: chosenGradient,
    supportEmail: newCompany.supportEmail || "",
    supportAutoReplyEnabled: newCompany.supportAutoReplyEnabled ?? true,
    supportAutoReplyMessage:
      newCompany.supportAutoReplyMessage ||
      "Bonjour ! Merci d'avoir contacté notre équipe. Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.",
    companyBanner:
      newCompany.companyBanner ||
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1800&q=85",
    companyLogo:
      newCompany.companyLogo ||
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80",
    socialLinks: newCompany.socialLinks || {},
    discoverable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [fullCompany, ...current.filter((c) => c.id !== fullCompany.id)];
  try {
    localStorage.setItem(`${COMPANIES_STORAGE_PREFIX}${userKey}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("mansa_companies_updated", { detail: updated }));
  } catch (err) {
    console.error("Error saving company to storage:", err);
  }

  const persisted = syncCompanyToFirestore(fullCompany);

  return { companies: updated, created: fullCompany, persisted };
}

export function updateCompany(userKey: string = "default", updatedCompany: Company): Company[] {
  const current = getSavedCompanies(userKey);
  const updated = current.map((c) =>
    c.id === updatedCompany.id ? { ...updatedCompany, updatedAt: new Date().toISOString() } : c,
  );
  try {
    localStorage.setItem(`${COMPANIES_STORAGE_PREFIX}${userKey}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("mansa_companies_updated", { detail: updated }));
  } catch (err) {
    console.error("Error updating company in storage:", err);
  }

  void syncCompanyToFirestore({ ...updatedCompany, ownerUid: updatedCompany.ownerUid || userKey, updatedAt: new Date().toISOString() })
    .catch((err) => console.warn("Company Firestore update failed:", err));

  return updated;
}

export function updateCompanyAutoReply(
  userKey: string = "default",
  companyId: string,
  config: {
    enabled: boolean;
    message: string;
  },
): { companies: Company[]; updatedCompany: Company | null } {
  const current = getSavedCompanies(userKey);
  let updatedCompany: Company | null = null;
  const updated = current.map((c) => {
    if (c.id === companyId) {
      updatedCompany = {
        ...c,
        supportAutoReplyEnabled: config.enabled,
        supportAutoReplyMessage: config.message,
        updatedAt: new Date().toISOString(),
      };
      return updatedCompany;
    }
    return c;
  });

  try {
    localStorage.setItem(`${COMPANIES_STORAGE_PREFIX}${userKey}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("mansa_companies_updated", { detail: updated }));
    window.dispatchEvent(
      new CustomEvent("mansa_autoreply_updated", {
        detail: { companyId, enabled: config.enabled, message: config.message },
      }),
    );
  } catch (err) {
    console.error("Error updating company auto-reply in storage:", err);
  }

  if (updatedCompany) {
    try {
      setDoc(doc(db, "companies", companyId), { ...updatedCompany, ownerUid: updatedCompany.ownerUid || userKey }, { merge: true }).catch((err) =>
        console.warn("Notice: Firestore company auto-reply update:", err),
      );
    } catch (e) {}
  }

  return { companies: updated, updatedCompany };
}

export function updateCompanyBranding(
  userKey: string = "default",
  companyId: string,
  branding: {
    companyBanner?: string;
    companyLogo?: string;
    name?: string;
    description?: string;
    socialLinks?: Record<string, string>;
  },
): { companies: Company[]; updatedCompany: Company | null } {
  const current = getSavedCompanies(userKey);
  let updatedItem: Company | null = null;
  const updated = current.map((c) => {
    if (c.id === companyId) {
      updatedItem = {
        ...c,
        ...branding,
        updatedAt: new Date().toISOString(),
      };
      return updatedItem;
    }
    return c;
  });

  try {
    localStorage.setItem(`${COMPANIES_STORAGE_PREFIX}${userKey}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("mansa_companies_updated", { detail: updated }));
    window.dispatchEvent(
      new CustomEvent("mansa_company_branding_changed", { detail: { companyId, branding } }),
    );
  } catch (err) {
    console.error("Error updating company branding:", err);
  }

  if (updatedItem) {
    void syncCompanyToFirestore(updatedItem).catch((err) =>
      console.warn("Company branding Firestore update failed:", err),
    );
  }
  return { companies: updated, updatedCompany: updatedItem };
}

export function deleteCompany(userKey: string = "default", companyId: string): Company[] {
  const current = getSavedCompanies(userKey);
  const updated = current.filter((c) => c.id !== companyId);
  try {
    localStorage.setItem(`${COMPANIES_STORAGE_PREFIX}${userKey}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("mansa_companies_updated", { detail: updated }));
  } catch (err) {
    console.error("Error deleting company from storage:", err);
  }

  // Suppression synchronisée dans Firestore
  try {
    if (db) {
      void (async () => {
        await deleteDoc(doc(db, "discoverableCompanies", companyId));
        await deleteDoc(doc(db, "companies", companyId));
        if (typeof window !== "undefined") window.dispatchEvent(new Event("mansa_discoverable_companies_updated"));
      })().catch((err) => console.warn("Company Firestore delete failed:", err));
    }
  } catch (e) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("mansa_discoverable_companies_updated"));
  }

  return updated;
}
