import { describe, expect, it } from "vitest";
import type { Thresholds } from "@/lib/dal/thresholds";
import { mergeThresholds, previewChanges, type PreviewProduct } from "./preview";

const DEFAULTS: Thresholds = {
  minVisits: 1000,
  killMaxConversion: 0.02,
  scaleMinConversion: 0.05,
  scaleRequiresPositiveMargin: true,
};

describe("mergeThresholds", () => {
  it("returns the base thresholds when there is no override", () => {
    expect(mergeThresholds(DEFAULTS, null)).toEqual(DEFAULTS);
  });

  it("merges a partial override field by field", () => {
    expect(
      mergeThresholds(DEFAULTS, {
        minVisits: null,
        killMaxConversion: 0.01,
        scaleMinConversion: null,
        scaleRequiresPositiveMargin: null,
      }),
    ).toEqual({ ...DEFAULTS, killMaxConversion: 0.01 });
  });
});

function product(overrides: Partial<PreviewProduct> = {}): PreviewProduct {
  return {
    productId: "p1",
    name: "Produit",
    visits: 2000,
    signupToPurchaseRate: 0.01,
    marginPerGenerationMicros: 1000,
    override: null,
    ...overrides,
  };
}

describe("previewChanges", () => {
  it("flags a product whose badge would change under the new defaults", () => {
    // 0.01 < the seeded kill 0.02 -> "kill" already; a looser candidate kill
    // (0.005) would clear that badge.
    const changes = previewChanges(
      [product()],
      DEFAULTS,
      { kind: "default" },
      { minVisits: 1000, killMaxConversion: 0.005, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
    );
    expect(changes).toEqual([{ productId: "p1", name: "Produit", before: "kill", after: null }]);
  });

  it("returns no change when the badge stays the same", () => {
    const changes = previewChanges(
      [product()],
      DEFAULTS,
      { kind: "default" },
      { minVisits: 1000, killMaxConversion: 0.02, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
    );
    expect(changes).toEqual([]);
  });

  it("a default-scope preview skips a product with its own override on the changed field", () => {
    const overridden = product({
      productId: "p2",
      override: {
        minVisits: null,
        killMaxConversion: 0.001,
        scaleMinConversion: null,
        scaleRequiresPositiveMargin: null,
      },
    });
    const changes = previewChanges(
      [overridden],
      DEFAULTS,
      { kind: "default" },
      { minVisits: 1000, killMaxConversion: 0.005, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
    );
    expect(changes).toEqual([]);
  });

  it("a product-scope preview only evaluates that one product", () => {
    const target = product({ productId: "p1" });
    const other = product({ productId: "p2" });
    const changes = previewChanges(
      [target, other],
      DEFAULTS,
      { kind: "product", productId: "p1" },
      { minVisits: 1000, killMaxConversion: 0.005, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
    );
    expect(changes).toEqual([{ productId: "p1", name: "Produit", before: "kill", after: null }]);
  });
});
