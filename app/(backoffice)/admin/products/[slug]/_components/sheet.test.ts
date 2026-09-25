import { describe, expect, it } from "vitest";
import type { DailyPoint, Funnel, FunnelStep, ProductMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { toFunnelRows, toKpis, toProductSheet, toTrendPoints } from "./sheet";

function metrics(overrides: Partial<ProductMetrics> = {}): ProductMetrics {
  return {
    productId: "p1",
    slug: "my-product",
    name: "My Product",
    status: "test",
    visits: 0,
    firstGenerations: 0,
    signups: 0,
    creditsExhausted: 0,
    purchases: 0,
    generations: 0,
    revenueCents: 0,
    aiCostMicros: 0,
    signupToPurchaseRate: null,
    marginPerGenerationMicros: null,
    ...overrides,
  };
}

function thresholds(overrides: Partial<Thresholds> = {}): Thresholds {
  return {
    minVisits: 1000,
    killMaxConversion: 0.02,
    scaleMinConversion: 0.05,
    scaleRequiresPositiveMargin: true,
    ...overrides,
  };
}

function step(type: FunnelStep["type"], count: number, rateFromPrevious: number | null): FunnelStep {
  return { type, count, rateFromPrevious };
}

describe("toKpis", () => {
  it("computes ARPU as revenue / signups", () => {
    const kpis = toKpis(metrics({ revenueCents: 2470, signups: 4 }));
    const arpu = kpis.find((kpi) => kpi.label === "ARPU");
    expect(arpu!.value).toBe("6,18 €");
  });

  it("shows an em dash for ARPU when there are no signups", () => {
    const kpis = toKpis(metrics({ revenueCents: 2470, signups: 0 }));
    const arpu = kpis.find((kpi) => kpi.label === "ARPU");
    expect(arpu!.value).toBe("—");
  });

  it("shows an em dash for margin when it is null", () => {
    const kpis = toKpis(metrics({ marginPerGenerationMicros: null }));
    const margin = kpis.find((kpi) => kpi.label === "Marge / génération");
    expect(margin!.value).toBe("—");
  });

  it("formats revenue and AI cost in euros", () => {
    const kpis = toKpis(metrics({ revenueCents: 2470, aiCostMicros: 12_000_000 }));
    expect(kpis.find((kpi) => kpi.label === "Revenu · 30 j")!.value).toBe("24,70 €");
    expect(kpis.find((kpi) => kpi.label === "Coût IA · 30 j")!.value).toBe("12,00 €");
  });

  it("returns the 4 KPIs in a fixed order", () => {
    const kpis = toKpis(metrics());
    expect(kpis.map((kpi) => kpi.label)).toEqual(["Revenu · 30 j", "ARPU", "Coût IA · 30 j", "Marge / génération"]);
  });
});

describe("toFunnelRows", () => {
  it("labels each of the 5 steps in French", () => {
    const rows = toFunnelRows(
      [
        step("visit", 1200, null),
        step("first_generation", 400, 1 / 3),
        step("signup", 100, 0.25),
        step("credits_exhausted", 40, 0.4),
        step("purchase", 8, 0.2),
      ],
      1200,
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Visites landing",
      "1re génération",
      "Inscription",
      "Crédits épuisés",
      "Achat",
    ]);
  });

  it("formats counts fr-FR and rates as a percentage, step 1's rate an em dash", () => {
    const rows = toFunnelRows([step("visit", 1200, null), step("first_generation", 400, 1 / 3)], 1200);
    expect(rows[0]!.count).toBe("1 200");
    expect(rows[0]!.rate).toBe("—");
    expect(rows[1]!.count).toBe("400");
    expect(rows[1]!.rate).toBe("33,3 %");
  });

  it("computes each bar's width as count / visits * 100, clamped to [0, 100]", () => {
    const rows = toFunnelRows([step("visit", 200, null), step("first_generation", 50, 0.25)], 200);
    expect(rows[0]!.widthPercent).toBe(100);
    expect(rows[1]!.widthPercent).toBe(25);
  });

  it("clamps the width to 100 when visits is 0 (nothing to divide by, no NaN or Infinity)", () => {
    const rows = toFunnelRows([step("visit", 0, null), step("first_generation", 0, null)], 0);
    expect(rows[0]!.widthPercent).toBe(0);
    expect(rows[1]!.widthPercent).toBe(0);
  });
});

describe("toTrendPoints", () => {
  function daily(date: string, overrides: Partial<DailyPoint> = {}): DailyPoint {
    return { date, visits: 0, signups: 0, purchases: 0, revenueCents: 0, aiCostMicros: 0, ...overrides };
  }

  it("slices a dd/MM label from each ISO date and keeps visits and purchases", () => {
    const points = toTrendPoints([daily("2026-09-05", { visits: 12, purchases: 2 })]);
    expect(points).toEqual([{ date: "05/09", visits: 12, purchases: 2 }]);
  });
});

describe("toProductSheet", () => {
  function funnel(overrides: Partial<Funnel> = {}): Funnel {
    return {
      metrics: metrics(),
      steps: [
        step("visit", 0, null),
        step("first_generation", 0, null),
        step("signup", 0, null),
        step("credits_exhausted", 0, null),
        step("purchase", 0, null),
      ],
      daily: [],
      ...overrides,
    };
  }

  it("hasData is false when there are no visits", () => {
    const sheet = toProductSheet(funnel({ metrics: metrics({ visits: 0 }) }), thresholds());
    expect(sheet.hasData).toBe(false);
  });

  it("hasData is true as soon as there is at least one visit", () => {
    const sheet = toProductSheet(funnel({ metrics: metrics({ visits: 1 }) }), thresholds());
    expect(sheet.hasData).toBe(true);
  });

  it("carries the product's identity through", () => {
    const sheet = toProductSheet(
      funnel({ metrics: metrics({ productId: "p42", slug: "bio-insta", name: "BioInsta", status: "learn" }) }),
      thresholds(),
    );
    expect(sheet.productId).toBe("p42");
    expect(sheet.slug).toBe("bio-insta");
    expect(sheet.name).toBe("BioInsta");
    expect(sheet.status).toBe("learn");
  });
});
