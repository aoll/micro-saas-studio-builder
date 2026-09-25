import { describe, expect, it } from "vitest";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import type { ThresholdSettings } from "@/lib/dal/thresholds";
import { toSettingsView } from "./settings-view";

function metrics(overrides: Partial<PortfolioMetrics["products"][number]> = {}): PortfolioMetrics {
  return {
    totals: { visits: 0, revenueCents: 0, aiCostMicros: 0, marginMicros: 0 },
    products: [
      {
        productId: "p1",
        slug: "produit-un",
        name: "Produit Un",
        status: "test",
        visits: 2000,
        firstGenerations: 0,
        signups: 0,
        creditsExhausted: 0,
        purchases: 0,
        generations: 0,
        revenueCents: 0,
        aiCostMicros: 0,
        signupToPurchaseRate: 0.01,
        marginPerGenerationMicros: 500,
        ...overrides,
      },
    ],
  };
}

const SETTINGS: ThresholdSettings = {
  defaults: {
    values: { minVisits: 1000, killMaxConversion: 0.02, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
    isSeed: true,
  },
  products: [{ productId: "p1", isSeed: false, override: null }],
};

describe("toSettingsView", () => {
  it("carries the studio defaults through unchanged", () => {
    const view = toSettingsView(metrics(), SETTINGS);
    expect(view.defaults).toEqual(SETTINGS.defaults);
  });

  it("joins each threshold row with its product's name, status and metrics", () => {
    const view = toSettingsView(metrics(), SETTINGS);
    expect(view.products).toEqual([
      {
        productId: "p1",
        name: "Produit Un",
        status: "test",
        isSeed: false,
        visits: 2000,
        signupToPurchaseRate: 0.01,
        marginPerGenerationMicros: 500,
        override: null,
      },
    ]);
  });

  it("falls back to the product id when no metrics row matches", () => {
    const settingsWithExtraProduct: ThresholdSettings = {
      ...SETTINGS,
      products: [...SETTINGS.products, { productId: "missing", isSeed: false, override: null }],
    };
    const view = toSettingsView(metrics(), settingsWithExtraProduct);
    const missing = view.products.find((product) => product.productId === "missing");
    expect(missing).toMatchObject({
      name: "missing",
      visits: 0,
      signupToPurchaseRate: null,
      marginPerGenerationMicros: null,
    });
  });
});
