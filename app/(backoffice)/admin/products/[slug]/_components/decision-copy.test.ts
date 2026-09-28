import { describe, expect, it } from "vitest";
import type { ProductMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { toDecisionCopy } from "./decision-copy";

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

// I18N-BACKOFFICE-STRINGS (lot 3): toDecisionCopy() must stay a pure,
// translation-free function so it keeps being unit-testable without a
// next-intl mock (its only caller, DecisionPanel, is an async Server
// Component that turns each structural key below into text with
// getTranslations("backoffice-decision")). These assertions were rewritten
// from hardcoded French strings to the key-based shape for that reason —
// the previous behaviour (which threshold/suggestion is picked for which
// metrics) is unchanged and still fully covered.
describe("toDecisionCopy", () => {
  it("shows the 4 threshold keys and the current values", () => {
    const copy = toDecisionCopy(
      metrics({ visits: 1200, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 }),
      thresholds(),
    );
    expect(copy.thresholds).toEqual([
      { key: "minVisits", value: "1 000" },
      { key: "killMaxConversion", value: "2 %" },
      { key: "scaleMinConversion", value: "5 %" },
      { key: "positiveMarginRequired", value: true },
    ]);
    expect(copy.current).toEqual({ visits: "1 200", conversion: "7 %", margin: "0,50 €" });
  });

  it("carries the raw boolean for positiveMarginRequired, not a localized yes/no", () => {
    const copy = toDecisionCopy(metrics(), thresholds({ scaleRequiresPositiveMargin: false }));
    expect(copy.thresholds).toContainEqual({ key: "positiveMarginRequired", value: false });
  });

  it("shows an em dash for the current margin when it is null", () => {
    const copy = toDecisionCopy(metrics({ marginPerGenerationMicros: null }), thresholds());
    expect(copy.current.margin).toBe("—");
  });

  it("suggests nothing under the minimum-visits volume gate", () => {
    const copy = toDecisionCopy(metrics({ visits: 10 }), thresholds({ minVisits: 1000 }));
    expect(copy.suggestion).toEqual({ kind: "notEnoughVisits", visits: "10", minVisits: "1 000" });
  });

  it("suggests killing when the conversion is below the kill threshold", () => {
    const copy = toDecisionCopy(
      metrics({ visits: 1100, signupToPurchaseRate: 0.01 }),
      thresholds({ minVisits: 1000, killMaxConversion: 0.02 }),
    );
    expect(copy.suggestion).toEqual({ kind: "thresholdReached", decision: "kill" });
  });

  it("suggests scaling when the conversion clears the scale threshold and the margin rule passes", () => {
    const copy = toDecisionCopy(
      metrics({ visits: 1100, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 100 }),
      thresholds({ minVisits: 1000, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true }),
    );
    expect(copy.suggestion).toEqual({ kind: "thresholdReached", decision: "scale" });
  });

  it("does not suggest scaling when the margin rule is required but the margin is not positive", () => {
    const copy = toDecisionCopy(
      metrics({ visits: 1100, signupToPurchaseRate: 0.07, marginPerGenerationMicros: -1 }),
      thresholds({ minVisits: 1000, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true }),
    );
    expect(copy.suggestion).toEqual({ kind: "none" });
  });

  it("suggests scaling on conversion alone when the margin rule is not required", () => {
    const copy = toDecisionCopy(
      metrics({ visits: 1100, signupToPurchaseRate: 0.07, marginPerGenerationMicros: -1 }),
      thresholds({ minVisits: 1000, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: false }),
    );
    expect(copy.suggestion).toEqual({ kind: "thresholdReached", decision: "scale" });
  });

  it("suggests nothing between the two thresholds", () => {
    const copy = toDecisionCopy(
      metrics({ visits: 1100, signupToPurchaseRate: 0.03 }),
      thresholds({ minVisits: 1000, killMaxConversion: 0.02, scaleMinConversion: 0.05 }),
    );
    expect(copy.suggestion).toEqual({ kind: "none" });
  });

  it("suggests nothing for a killed product, regardless of the metrics", () => {
    const copy = toDecisionCopy(
      metrics({ status: "killed", visits: 1100, signupToPurchaseRate: 0.01 }),
      thresholds({ minVisits: 1000, killMaxConversion: 0.02 }),
    );
    expect(copy.suggestion).toBeNull();
  });

  describe("badge", () => {
    it("is the raw evaluate() decision, for the header's DecisionBadge", () => {
      const kill = toDecisionCopy(
        metrics({ visits: 1100, signupToPurchaseRate: 0.01 }),
        thresholds({ minVisits: 1000, killMaxConversion: 0.02 }),
      );
      expect(kill.badge).toBe("kill");
    });

    it("is null for a killed product even when the metrics would otherwise suggest killing", () => {
      const copy = toDecisionCopy(
        metrics({ status: "killed", visits: 1100, signupToPurchaseRate: 0.01 }),
        thresholds({ minVisits: 1000, killMaxConversion: 0.02 }),
      );
      expect(copy.badge).toBeNull();
    });
  });
});
