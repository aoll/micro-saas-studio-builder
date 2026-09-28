import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import type { DailyPoint, Funnel, FunnelStep, ProductMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { toFunnelRows, toKpis, toProductSheet, toTrendPoints } from "./sheet";

// I18N-BACKOFFICE-STRINGS: toKpis/toFunnelRows/toProductSheet now take a translator (like
// formatRelative etc. in activity-format.ts take `now`, this stays a pure function of its
// arguments) — a real next-intl translator built from the committed messages, so a wrong key or
// a missing message would fail these tests, not a hand-rolled fake.
const tFr = createTranslator({
  locale: "fr",
  messages: { "backoffice-product-sheet": frSheet },
  namespace: "backoffice-product-sheet",
});
const tEn = createTranslator({
  locale: "en",
  messages: { "backoffice-product-sheet": enSheet },
  namespace: "backoffice-product-sheet",
});

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
    const kpis = toKpis(metrics({ revenueCents: 2470, signups: 4 }), tFr);
    const arpu = kpis.find((kpi) => kpi.label === "ARPU");
    expect(arpu!.value).toBe("6,18 €");
  });

  it("shows an em dash for ARPU when there are no signups", () => {
    const kpis = toKpis(metrics({ revenueCents: 2470, signups: 0 }), tFr);
    const arpu = kpis.find((kpi) => kpi.label === "ARPU");
    expect(arpu!.value).toBe("—");
  });

  it("shows an em dash for margin when it is null", () => {
    const kpis = toKpis(metrics({ marginPerGenerationMicros: null }), tFr);
    const margin = kpis.find((kpi) => kpi.label === "Marge / génération");
    expect(margin!.value).toBe("—");
  });

  it("formats revenue and AI cost in euros", () => {
    const kpis = toKpis(metrics({ revenueCents: 2470, aiCostMicros: 12_000_000 }), tFr);
    expect(kpis.find((kpi) => kpi.label === "Revenu · 30 j")!.value).toBe("24,70 €");
    expect(kpis.find((kpi) => kpi.label === "Coût IA · 30 j")!.value).toBe("12,00 €");
  });

  it("returns the 4 KPIs in a fixed order, in French", () => {
    const kpis = toKpis(metrics(), tFr);
    expect(kpis.map((kpi) => kpi.label)).toEqual(["Revenu · 30 j", "ARPU", "Coût IA · 30 j", "Marge / génération"]);
  });

  it("returns the 4 KPI labels in English when given the English translator", () => {
    const kpis = toKpis(metrics(), tEn);
    expect(kpis.map((kpi) => kpi.label)).toEqual(["Revenue · 30d", "ARPU", "AI cost · 30d", "Margin / generation"]);
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
      tFr,
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Visites landing",
      "1re génération",
      "Inscription",
      "Crédits épuisés",
      "Achat",
    ]);
  });

  it("labels each of the 5 steps in English when given the English translator", () => {
    const rows = toFunnelRows(
      [
        step("visit", 1200, null),
        step("first_generation", 400, 1 / 3),
        step("signup", 100, 0.25),
        step("credits_exhausted", 40, 0.4),
        step("purchase", 8, 0.2),
      ],
      1200,
      tEn,
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Landing visits",
      "1st generation",
      "Signup",
      "Credits exhausted",
      "Purchase",
    ]);
  });

  it("formats counts fr-FR and rates as a percentage, step 1's rate an em dash", () => {
    const rows = toFunnelRows([step("visit", 1200, null), step("first_generation", 400, 1 / 3)], 1200, tFr);
    expect(rows[0]!.count).toBe("1 200");
    expect(rows[0]!.rate).toBe("—");
    expect(rows[1]!.count).toBe("400");
    expect(rows[1]!.rate).toBe("33,3 %");
  });

  it("computes each bar's width as count / visits * 100, clamped to [0, 100]", () => {
    const rows = toFunnelRows([step("visit", 200, null), step("first_generation", 50, 0.25)], 200, tFr);
    expect(rows[0]!.widthPercent).toBe(100);
    expect(rows[1]!.widthPercent).toBe(25);
  });

  it("clamps the width to 100 when visits is 0 (nothing to divide by, no NaN or Infinity)", () => {
    const rows = toFunnelRows([step("visit", 0, null), step("first_generation", 0, null)], 0, tFr);
    expect(rows[0]!.widthPercent).toBe(0);
    expect(rows[1]!.widthPercent).toBe(0);
  });

  // QA1-P1-Q5: a second, independent clamp at the display boundary, so this acceptance bullet
  // ("aucun taux n'est affiché au-dessus de 100 %") holds even if a future regression at the DAL
  // layer (lib/dal/metrics.ts's own clamp) ever let a rate above 1 through.
  it("never displays a rate above 100%, even if a step's rateFromPrevious is above 1", () => {
    const rows = toFunnelRows([step("visit", 2, null), step("first_generation", 3, 1.5)], 2, tFr);
    expect(rows[1]!.rate).toBe("100 %");
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
    const sheet = toProductSheet(funnel({ metrics: metrics({ visits: 0 }) }), thresholds(), tFr);
    expect(sheet.hasData).toBe(false);
  });

  it("hasData is true as soon as there is at least one visit", () => {
    const sheet = toProductSheet(funnel({ metrics: metrics({ visits: 1 }) }), thresholds(), tFr);
    expect(sheet.hasData).toBe(true);
  });

  it("carries the product's identity through", () => {
    const sheet = toProductSheet(
      funnel({ metrics: metrics({ productId: "p42", slug: "bio-insta", name: "BioInsta", status: "learn" }) }),
      thresholds(),
      tFr,
    );
    expect(sheet.productId).toBe("p42");
    expect(sheet.slug).toBe("bio-insta");
    expect(sheet.name).toBe("BioInsta");
    expect(sheet.status).toBe("learn");
  });
});
