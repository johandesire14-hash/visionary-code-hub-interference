import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "./firebase";
import { db } from "./firebase";

export interface AffiliateProduct {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  category: string;
  status: "active";
  affiliateCommissionRate: number;
  pricingAmount: number;
  currency: string;
  coverImage?: string;
  storeUrl?: string;
}

export interface AffiliateLink {
  id: string;
  affiliateUid: string;
  productId: string;
  productName: string;
  commissionRate: number;
  code: string;
  acceptedAt?: unknown;
  createdAt?: unknown;
}

export interface PublicAffiliateProduct {
  product: AffiliateProduct;
  commissionRate: number;
}

const requireFirestore = () => {
  if (!db) {
    throw new Error("Firebase Firestore n’est pas configuré. Aucun lien affilié n’a été créé.");
  }
  return db;
};

const firestoreError = (error: unknown, operation: string): Error => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("permission-denied") || code.includes("unauthenticated")) {
    return new Error(
      `Firestore a refusé ${operation} (règles d’accès ou authentification). Aucun lien n’a été créé. Vérifiez les règles Firestore pour les produits, affiliateLinks et affiliateCodes.`,
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(`Échec de ${operation}.`);
};

const mapProduct = (id: string, data: Record<string, unknown>): AffiliateProduct | null => {
  const rate = Number(data["affiliateCommissionRate"]);
  const creatorId = typeof data["creatorId"] === "string" ? data["creatorId"] : "";
  const name = typeof data["name"] === "string" ? data["name"].trim() : "";
  if (
    data["status"] !== "active" ||
    !creatorId ||
    !name ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return null;
  }
  return {
    id,
    creatorId,
    name,
    description:
      typeof data["description"] === "string"
        ? data["description"]
        : typeof data["tagline"] === "string"
          ? data["tagline"]
          : "",
    category: typeof data["category"] === "string" ? data["category"] : "Produit",
    status: "active",
    affiliateCommissionRate: rate,
    pricingAmount: Number.isFinite(Number(data["pricingAmount"])) ? Number(data["pricingAmount"]) : 0,
    currency: typeof data["currency"] === "string" ? data["currency"] : "XOF",
    ...(typeof data["coverImage"] === "string" ? { coverImage: data["coverImage"] } : {}),
    ...(typeof data["storeUrl"] === "string" ? { storeUrl: data["storeUrl"] } : {}),
  };
};

export async function getAffiliateEligibleProducts(affiliateUid: string): Promise<AffiliateProduct[]> {
  if (!affiliateUid) return [];
  const firestore = requireFirestore();
  try {
    const productsSnapshot = await getDocs(
      query(collection(firestore, "products"), where("status", "==", "active")),
    );
    return productsSnapshot.docs
      .map((snapshot) => mapProduct(snapshot.id, snapshot.data()))
      .filter(
        (product): product is AffiliateProduct =>
          product !== null && product.creatorId !== affiliateUid,
      );
  } catch (error) {
    throw firestoreError(error, "la lecture des produits affiliables");
  }
}

function createRandomAffiliateCode(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Un générateur cryptographique sécurisé est nécessaire pour créer un lien.");
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function affiliateProductDocumentId(affiliateUid: string, productId: string): string {
  const encodedUid = encodeURIComponent(affiliateUid);
  const encodedProductId = encodeURIComponent(productId);
  return `${encodedUid.length}_${encodedUid}${encodedProductId}`;
}

export async function createOrGetAffiliateLink(
  affiliateUid: string,
  product: Pick<AffiliateProduct, "id" | "affiliateCommissionRate">,
): Promise<AffiliateLink> {
  if (!affiliateUid) throw new Error("Une session utilisateur est requise.");
  const firestore = requireFirestore();
  try {
    const productSnapshot = await getDoc(doc(firestore, "products", product.id));
    if (!productSnapshot.exists()) throw new Error("Ce produit n’existe plus dans Firebase.");
    const currentProduct = mapProduct(productSnapshot.id, productSnapshot.data());
    if (!currentProduct || currentProduct.creatorId === affiliateUid) {
      throw new Error("Ce produit n’est plus éligible au programme d’affiliation.");
    }
    if (currentProduct.affiliateCommissionRate !== product.affiliateCommissionRate) {
      throw new Error(
        "Le créateur a modifié le taux depuis l’affichage des conditions. Rechargez les produits et acceptez le taux actuel.",
      );
    }

    const linkId = affiliateProductDocumentId(affiliateUid, currentProduct.id);
    const linkRef = doc(firestore, "affiliateLinks", linkId);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createRandomAffiliateCode();
      const codeRef = doc(firestore, "affiliateCodes", code);
      const result = await runTransaction(firestore, async (transaction) => {
        const [linkSnapshot, codeSnapshot] = await Promise.all([
          transaction.get(linkRef),
          transaction.get(codeRef),
        ]);
        if (linkSnapshot.exists()) {
          const saved = linkSnapshot.data();
          if (saved["affiliateUid"] !== affiliateUid || saved["productId"] !== currentProduct.id) {
            throw new Error("Le lien affilié existant ne correspond pas à ce compte et produit.");
          }
          if (Number(saved["commissionRate"]) !== currentProduct.affiliateCommissionRate) {
            throw new Error(
              "Le taux de commission a changé depuis votre précédente acceptation. Un nouvel accord est requis par le créateur.",
            );
          }
          return {
            id: linkId,
            affiliateUid,
            productId: currentProduct.id,
            productName: currentProduct.name,
            commissionRate: Number(saved["commissionRate"]),
            code: String(saved["code"]),
            acceptedAt: saved["acceptedAt"],
            createdAt: saved["createdAt"],
          } satisfies AffiliateLink;
        }
        if (codeSnapshot.exists()) return null;
        transaction.set(codeRef, { linkId, createdAt: serverTimestamp() });
        transaction.set(linkRef, {
          affiliateUid,
          productId: currentProduct.id,
          productName: currentProduct.name,
          creatorUid: currentProduct.creatorId,
          commissionRate: currentProduct.affiliateCommissionRate,
          code,
          acceptedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        return {
          id: linkId,
          affiliateUid,
          productId: currentProduct.id,
          productName: currentProduct.name,
          commissionRate: currentProduct.affiliateCommissionRate,
          code,
        } satisfies AffiliateLink;
      });
      if (result) return result;
    }
    throw new Error("Impossible de réserver un code unique après plusieurs tentatives.");
  } catch (error) {
    throw firestoreError(error, "la création du lien affilié");
  }
}

export async function getAffiliateLinksForUser(affiliateUid: string): Promise<AffiliateLink[]> {
  if (!affiliateUid) return [];
  const firestore = requireFirestore();
  try {
    const linksSnapshot = await getDocs(
      query(collection(firestore, "affiliateLinks"), where("affiliateUid", "==", affiliateUid)),
    );
    return linksSnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        affiliateUid: String(data["affiliateUid"]),
        productId: String(data["productId"]),
        productName: String(data["productName"] || "Produit"),
        commissionRate: Number(data["commissionRate"]),
        code: String(data["code"]),
        acceptedAt: data["acceptedAt"],
        createdAt: data["createdAt"],
      };
    });
  } catch (error) {
    throw firestoreError(error, "la lecture de vos liens affiliés");
  }
}

export async function resolvePublicAffiliateCode(code: string): Promise<PublicAffiliateProduct | null> {
  if (!code || code.length > 100) return null;
  const firestore = requireFirestore();
  try {
    const codeSnapshot = await getDoc(doc(firestore, "affiliateCodes", code));
    if (!codeSnapshot.exists()) return null;
    const linkId = codeSnapshot.data()["linkId"];
    if (typeof linkId !== "string" || !linkId) return null;
    const linkSnapshot = await getDoc(doc(firestore, "affiliateLinks", linkId));
    if (!linkSnapshot.exists()) return null;
    const link = linkSnapshot.data();
    if (link["code"] !== code || typeof link["productId"] !== "string") return null;
    const productSnapshot = await getDoc(doc(firestore, "products", link["productId"]));
    if (!productSnapshot.exists()) return null;
    const product = mapProduct(productSnapshot.id, productSnapshot.data());
    if (!product || product.creatorId !== link["creatorUid"]) return null;
    return { product, commissionRate: Number(link["commissionRate"]) };
  } catch (error) {
    throw firestoreError(error, "la résolution du lien affilié public");
  }
}
