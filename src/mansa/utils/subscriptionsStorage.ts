// @ts-nocheck
import { EnterpriseSubscription } from "../types";
import { registerLocalCompanyMember, unregisterLocalCompanyMember } from "./localCommunityStore";
import {
  getMemberAuthorizedTelegramChannels,
  getMemberAuthorizedDiscordChannels,
  getMemberAuthorizedEbooks,
  getMemberAuthorizedCourses,
  getMemberAuthorizedOffers,
} from "./rightsAccessEngine";

const SUBSCRIPTIONS_STORAGE_KEY_PREFIX = "mansa_enterprise_subscriptions_";

export function deduplicateSubscriptions(subs: EnterpriseSubscription[]): EnterpriseSubscription[] {
  if (!Array.isArray(subs)) return [];
  const seen = new Set<string>();
  const result: EnterpriseSubscription[] = [];
  for (const sub of subs) {
    if (!sub) continue;
    const key = sub.id || sub.companyId;
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(sub);
    }
  }
  return result;
}

export function getSavedSubscriptions(userKey: string): EnterpriseSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY_PREFIX + userKey);
    const wasSeeded = localStorage.getItem(`mansa_subscriptions_seeded_${userKey}`);

    let leftIds: string[] = [];
    try {
      const leftRaw = localStorage.getItem(`mansa_left_enterprises_${userKey}`);
      if (leftRaw) leftIds = JSON.parse(leftRaw);
    } catch {}

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any left enterprises
      const filtered = parsed.filter(
        (sub) => !leftIds.includes(sub.id) && !leftIds.includes(sub.companyId),
      );
      const deduped = deduplicateSubscriptions(filtered);
      if (deduped.length !== parsed.length) {
        localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY_PREFIX + userKey, JSON.stringify(deduped));
      }
      return deduped;
    }
    return [];
  } catch (err) {
    console.error("Error loading subscriptions from localStorage:", err);
    return [];
  }
}

export function saveSubscription(
  userKey: string,
  newSub: EnterpriseSubscription,
): EnterpriseSubscription[] {
  const current = getSavedSubscriptions(userKey);
  const existsIndex = current.findIndex(
    (s) => s.id === newSub.id || s.companyId === newSub.companyId,
  );
  let updated: EnterpriseSubscription[];

  if (existsIndex >= 0) {
    const prev = current[existsIndex];
    const compId = newSub.companyId || prev.companyId;

    const mergedUnlockedProducts = Array.from(
      new Set([
        ...(prev.unlockedProductIds || []),
        ...(newSub.unlockedProductIds || []),
        ...(newSub.purchasedOfferIds || []),
      ]),
    );

    // Calcul STRICT des ressources autorisées basé UNIQUEMENT sur les offres achetées
    const authorizedTelegram = getMemberAuthorizedTelegramChannels(compId, mergedUnlockedProducts);
    const authorizedDiscord = getMemberAuthorizedDiscordChannels(compId, mergedUnlockedProducts);
    const authorizedEbooks = getMemberAuthorizedEbooks(compId, mergedUnlockedProducts);
    const authorizedCourses = getMemberAuthorizedCourses(compId, mergedUnlockedProducts);

    // Dérivation stricte des fonctionnalités actives
    const authorizedOffers = getMemberAuthorizedOffers(compId, mergedUnlockedProducts);
    const derivedAppsSet = new Set<string>(["dashboard", "support"]);
    authorizedOffers.forEach((o) => {
      if (Array.isArray(o.includedApps)) {
        o.includedApps.forEach((a) => derivedAppsSet.add(a));
      }
    });

    const isPaid =
      mergedUnlockedProducts.length > 0 || Boolean(prev.hasPaidOffer || newSub.hasPaidOffer);

    const merged: EnterpriseSubscription = {
      ...prev,
      ...newSub,
      id: prev.id,
      companyId: compId,
      productName: newSub.hasPaidOffer
        ? prev.hasPaidOffer && prev.productName !== newSub.productName
          ? `${prev.productName} + ${newSub.productName}`
          : newSub.productName
        : prev.productName,
      priceDisplay: newSub.hasPaidOffer ? newSub.priceDisplay : prev.priceDisplay,
      hasPaidOffer: isPaid,
      includedApps: Array.from(derivedAppsSet),
      unlockedProductIds: mergedUnlockedProducts,
      purchasedOfferIds: mergedUnlockedProducts,
      telegramChannels: authorizedTelegram,
      discordChannels: authorizedDiscord,
      ebooks: authorizedEbooks,
      courses: authorizedCourses,
      discordInvite: authorizedDiscord[0]?.inviteLink || newSub.discordInvite || prev.discordInvite,
    };

    updated = [...current];
    updated[existsIndex] = merged;
  } else {
    const compId = newSub.companyId;
    const initialUnlocked = Array.from(
      new Set([...(newSub.unlockedProductIds || []), ...(newSub.purchasedOfferIds || [])]),
    );
    const authorizedTelegram = getMemberAuthorizedTelegramChannels(compId, initialUnlocked);
    const authorizedDiscord = getMemberAuthorizedDiscordChannels(compId, initialUnlocked);
    const authorizedEbooks = getMemberAuthorizedEbooks(compId, initialUnlocked);
    const authorizedCourses = getMemberAuthorizedCourses(compId, initialUnlocked);

    const authorizedOffers = getMemberAuthorizedOffers(compId, initialUnlocked);
    const derivedAppsSet = new Set<string>(["dashboard", "support"]);
    authorizedOffers.forEach((o) => {
      if (Array.isArray(o.includedApps)) {
        o.includedApps.forEach((a) => derivedAppsSet.add(a));
      }
    });

    const populatedSub: EnterpriseSubscription = {
      ...newSub,
      unlockedProductIds: initialUnlocked,
      purchasedOfferIds: initialUnlocked,
      includedApps: Array.from(derivedAppsSet),
      telegramChannels: authorizedTelegram,
      discordChannels: authorizedDiscord,
      ebooks: authorizedEbooks,
      courses: authorizedCourses,
      hasPaidOffer: initialUnlocked.length > 0 || Boolean(newSub.hasPaidOffer),
    };

    updated = [populatedSub, ...current];
  }

  // If user is saving/rejoining, remove from left list
  try {
    const leftKey = `mansa_left_enterprises_${userKey}`;
    const leftRaw = localStorage.getItem(leftKey);
    if (leftRaw) {
      const leftIds: string[] = JSON.parse(leftRaw);
      const filtered = leftIds.filter((id) => id !== newSub.id && id !== newSub.companyId);
      localStorage.setItem(leftKey, JSON.stringify(filtered));
    }
  } catch {}

  if (typeof window !== "undefined") {
    localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY_PREFIX + userKey, JSON.stringify(updated));
    if (newSub.companyId && newSub.hasJoined !== false && !newSub.isCommunityPreview) {
      const email = userKey.includes("@") ? userKey.trim().toLowerCase() : "";
      registerLocalCompanyMember(newSub.companyId, {
        memberId: userKey,
        email,
        name: email ? email.split("@")[0] : "Membre",
      });
    }
    window.dispatchEvent(new CustomEvent("mansa_subscription_updated", { detail: newSub }));
  }
  return updated;
}

export function removeSubscription(userKey: string, targetId: string): EnterpriseSubscription[] {
  const current = getSavedSubscriptions(userKey);
  const removed = current.find((sub) => sub.id === targetId || sub.companyId === targetId);

  // Track in left enterprises list
  try {
    const leftKey = `mansa_left_enterprises_${userKey}`;
    const leftRaw = localStorage.getItem(leftKey);
    const leftIds: string[] = leftRaw ? JSON.parse(leftRaw) : [];
    if (!leftIds.includes(targetId)) {
      leftIds.push(targetId);
      localStorage.setItem(leftKey, JSON.stringify(leftIds));
    }
  } catch {}

  const updated = current.filter((sub) => sub.id !== targetId && sub.companyId !== targetId);

  if (typeof window !== "undefined") {
    localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY_PREFIX + userKey, JSON.stringify(updated));
    if (removed?.companyId) unregisterLocalCompanyMember(removed.companyId, userKey);
    window.dispatchEvent(
      new CustomEvent("mansa_subscription_updated", { detail: { removedId: targetId } }),
    );
  }
  return updated;
}

export function cancelActiveSubscription(
  userKey: string,
  targetId: string,
): EnterpriseSubscription[] {
  const current = getSavedSubscriptions(userKey);
  const updated = current.map((sub) => {
    if (sub.id === targetId || sub.companyId === targetId) {
      return {
        ...sub,
        hasPaidOffer: false,
        status: "canceled" as const,
        productName: "Adhésion Simple (Gratuit)",
        priceDisplay: "0 FCFA",
        includedApps: ["dashboard", "support"],
        unlockedProductIds: [],
        purchasedOfferIds: [],
        telegramChannels: [],
        discordChannels: [],
        ebooks: [],
        courses: [],
        customResources: [],
      };
    }
    return sub;
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY_PREFIX + userKey, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("mansa_subscription_updated", { detail: { cancelledId: targetId } }),
    );
  }
  return updated;
}

export function updateSubscriptionBranding(
  userKey: string,
  targetId: string,
  branding: {
    companyBanner?: string;
    companyLogo?: string;
    companyName?: string;
    socialLinks?: Record<string, string>;
  },
): EnterpriseSubscription[] {
  const current = getSavedSubscriptions(userKey);
  const updated = current.map((sub) => {
    if (sub.id === targetId || sub.companyId === targetId) {
      return {
        ...sub,
        companyName: branding.companyName !== undefined ? branding.companyName : sub.companyName,
        companyLogo: branding.companyLogo !== undefined ? branding.companyLogo : sub.companyLogo,
        companyBanner:
          branding.companyBanner !== undefined ? branding.companyBanner : sub.companyBanner,
        socialLinks: branding.socialLinks || sub.socialLinks,
      };
    }
    return sub;
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY_PREFIX + userKey, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("mansa_subscription_updated", {
        detail: { companyId: targetId, ...branding },
      }),
    );
  }
  return updated;
}
