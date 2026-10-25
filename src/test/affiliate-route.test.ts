import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

describe("affiliate public route", () => {
  it("matches affiliate codes at the public landing page path", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/affiliate/aCryptographicCode123");
    expect(matches.at(-1)?.routeId).toBe("/affiliate/$code");
  });
});
