import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocsMock, getDocMock, runTransactionMock, writtenDocs } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  getDocMock: vi.fn(),
  runTransactionMock: vi.fn(),
  writtenDocs: [] as Array<{ ref: { collectionName: string; id: string }; data: Record<string, unknown> }>,
}));

vi.mock("../mansa/services/firebase", () => ({
  db: { testFirestore: true },
  collection: (_db: unknown, collectionName: string) => ({ collectionName }),
  doc: (_db: unknown, collectionName: string, id: string) => ({ collectionName, id }),
  getDoc: getDocMock,
  getDocs: getDocsMock,
  query: (source: { collectionName: string }) => source,
  where: (...args: unknown[]) => args,
  runTransaction: runTransactionMock,
  serverTimestamp: () => "SERVER_TIMESTAMP",
}));

import {
  createOrGetAffiliateLink,
  getAffiliateEligibleProducts,
} from "../mansa/services/affiliateService";

const productDoc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });
const snapshot = (data: Record<string, unknown> | null) => ({
  id: "product-42",
  exists: () => data !== null,
  data: () => data,
});

beforeEach(() => {
  getDocsMock.mockReset();
  getDocMock.mockReset();
  runTransactionMock.mockReset();
  writtenDocs.length = 0;
});

describe("affiliateService", () => {
  it("lists only active Firebase products with positive rates owned by another UID", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        productDoc("eligible", { creatorId: "creator-uid", name: "Offre valide", status: "active", affiliateCommissionRate: 12.75 }),
        productDoc("own", { creatorId: "affiliate-uid", name: "Mon produit", status: "active", affiliateCommissionRate: 30 }),
        productDoc("zero", { creatorId: "creator-uid", name: "Sans programme", status: "active", affiliateCommissionRate: 0 }),
        productDoc("negative", { creatorId: "creator-uid", name: "Taux invalide", status: "active", affiliateCommissionRate: -1 }),
        productDoc("draft", { creatorId: "creator-uid", name: "Brouillon", status: "draft", affiliateCommissionRate: 20 }),
      ],
    });

    const products = await getAffiliateEligibleProducts("affiliate-uid");
    expect(products.map(({ id, affiliateCommissionRate }) => [id, affiliateCommissionRate])).toEqual([
      ["eligible", 12.75],
    ]);
    expect(getDocsMock).toHaveBeenCalledOnce();
  });

  it("persists a cryptographically random code keyed only by affiliate UID and product ID", async () => {
    const product = {
      id: "product-42",
      creatorId: "creator-uid",
      name: "Produit test",
      description: "",
      category: "Cours",
      status: "active" as const,
      affiliateCommissionRate: 8.5,
      pricingAmount: 25,
      currency: "EUR",
    };
    getDocMock.mockResolvedValue(snapshot({
      creatorId: "creator-uid",
      name: "Produit test",
      status: "active",
      affiliateCommissionRate: 8.5,
      pricingAmount: 25,
      currency: "EUR",
    }));
    runTransactionMock.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => unknown) => {
      const transaction = {
        get: vi.fn(async () => snapshot(null)),
        set: vi.fn((ref, data) => writtenDocs.push({ ref, data })),
      };
      return callback(transaction);
    });

    const link = await createOrGetAffiliateLink("firebase-uid-abc", product);

    expect(link.affiliateUid).toBe("firebase-uid-abc");
    expect(link.productId).toBe("product-42");
    expect(link.commissionRate).toBe(8.5);
    expect(link.code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(writtenDocs.map(({ ref }) => ref.collectionName).sort()).toEqual(["affiliateCodes", "affiliateLinks"]);
    expect(writtenDocs.find(({ ref }) => ref.collectionName === "affiliateCodes")?.ref.id).toBe(link.code);
    const persistedLink = writtenDocs.find(({ ref }) => ref.collectionName === "affiliateLinks")?.data;
    expect(persistedLink).toMatchObject({ affiliateUid: "firebase-uid-abc", productId: "product-42", code: link.code, commissionRate: 8.5 });
    expect(persistedLink).not.toHaveProperty("handle");
    expect(persistedLink).not.toHaveProperty("displayName");
  });

  it("refuses creation if the creator changes the rate after the terms were displayed", async () => {
    getDocMock.mockResolvedValue(snapshot({
      creatorId: "creator-uid",
      name: "Produit test",
      status: "active",
      affiliateCommissionRate: 10,
    }));
    await expect(createOrGetAffiliateLink("affiliate-uid", {
      id: "product-42",
      affiliateCommissionRate: 8,
    })).rejects.toThrow(/modifié le taux/i);
    expect(runTransactionMock).not.toHaveBeenCalled();
  });
});
