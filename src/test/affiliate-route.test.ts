import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { AffiliateLandingContent } from "@/routes/affiliate.$code";

describe("affiliate public route", () => {
  it("matches affiliate codes at the public landing page path", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/affiliate/aCryptographicCode123456789012");
    expect(matches.at(-1)?.routeId).toBe("/affiliate/$code");
  });

  it("shows creator-set terms and commission without counting a visit as a sale", () => {
    render(
      createElement(AffiliateLandingContent, {
        loading: false,
        error: "",
        result: {
          commissionRate: 12.75,
          product: {
            id: "product-42",
            creatorId: "creator-uid",
            name: "Produit actuel",
            description: "Description publique",
            category: "Formation",
            status: "active",
            affiliateCommissionRate: 12.75,
            pricingAmount: 25,
            currency: "EUR",
          },
        },
      }),
    );

    expect(screen.getByTestId("public-commission-rate")).toHaveTextContent("12.75 %");
    expect(screen.getByRole("heading", { name: "Consignes de promotion" })).toBeInTheDocument();
    expect(screen.getByText(/Signalez clairement votre lien affilié/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Une visite, un affichage ou un clic ne crée ni vente ni commission/i),
    ).toBeInTheDocument();
  });
});
