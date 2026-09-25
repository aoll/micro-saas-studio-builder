import { describe, expect, it } from "vitest";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { toPortfolioRows } from "./rows";

const DEFAULT_THRESHOLDS: Thresholds = {
  minVisits: 1000,
  killMaxConversion: 0.02,
  scaleMinConversion: 0.05,
  scaleRequiresPositiveMargin: true,
};

function metrics(...products: PortfolioMetrics["products"]): PortfolioMetrics {
  return {
    totals: {
      visits: products.reduce((sum, p) => sum + p.visits, 0),
      revenueCents: products.reduce((sum, p) => sum + p.revenueCents, 0),
      aiCostMicros: products.reduce((sum, p) => sum + p.aiCostMicros, 0),
      marginMicros: products.reduce((sum, p) => sum + p.revenueCents * 10_000 - p.aiCostMicros, 0),
    },
    products,
  };
}

function product(overrides: Partial<PortfolioMetrics["products"][number]> = {}): PortfolioMetrics["products"][number] {
  return {
    productId: "p1",
    slug: "p1",
    name: "P1",
    status: "test",
    visits: 1200,
    firstGenerations: 0,
    signups: 100,
    creditsExhausted: 0,
    purchases: 0,
    generations: 20,
    revenueCents: 2470,
    aiCostMicros: 80000,
    signupToPurchaseRate: 0.07,
    marginPerGenerationMicros: 1000,
    ...overrides,
  };
}

describe("toPortfolioRows", () => {
  it("carries the decision suggested by evaluate() for the product's own thresholds", () => {
    const rows = toPortfolioRows(metrics(product({ productId: "p1" })), { p1: DEFAULT_THRESHOLDS });
    expect(rows[0]!.decision).toBe("scale");
  });

  it("falls back to no decision when the product's thresholds are missing", () => {
    const rows = toPortfolioRows(metrics(product({ productId: "p1" })), {});
    expect(rows[0]!.decision).toBeNull();
  });

  it("formats display strings for the table columns", () => {
    const rows = toPortfolioRows(metrics(product({ productId: "p1" })), { p1: DEFAULT_THRESHOLDS });
    const row = rows[0]!;
    expect(row.display.visits).toContain("1");
    expect(row.display.conversion).toContain("%");
    expect(row.display.revenue).toContain("€");
    expect(row.display.aiCost).toContain("€");
    expect(row.display.margin).toContain("%");
  });

  it("shows the 30-day margin, (revenue − AI cost) / revenue, not the per-generation margin", () => {
    // 24,70 € of revenue, 0,08 $ of AI cost (1:1): (24.70 − 0.08) / 24.70 ≈ 99,7 %.
    const rows = toPortfolioRows(metrics(product({ productId: "p1" })), { p1: DEFAULT_THRESHOLDS });
    expect(rows[0]!.marginRate).toBeCloseTo((24_700_000 - 80_000) / 24_700_000);
    expect(rows[0]!.display.margin).toBe("99,7\u00a0%");
  });

  it("shows an em dash for a null conversion or a margin without revenue", () => {
    const rows = toPortfolioRows(metrics(product({ productId: "p1", signupToPurchaseRate: null, revenueCents: 0 })), {
      p1: DEFAULT_THRESHOLDS,
    });
    const row = rows[0]!;
    expect(row.display.conversion).toBe("—");
    expect(row.display.margin).toBe("—");
  });

  it("maps one row per product, in the same order as the metrics response", () => {
    const rows = toPortfolioRows(
      metrics(product({ productId: "p1", slug: "a" }), product({ productId: "p2", slug: "b" })),
      { p1: DEFAULT_THRESHOLDS, p2: DEFAULT_THRESHOLDS },
    );
    expect(rows.map((row) => row.slug)).toEqual(["a", "b"]);
  });
});
