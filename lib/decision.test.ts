import { describe, expect, it } from "vitest";
import { evaluate, type Decision, type DecisionMetrics } from "./decision";
import type { Thresholds } from "./dal/thresholds";

// Pure function (specs/BO-02-portefeuille.md bullet 3): no database import
// here on purpose, testable without a session or a Postgres connection.

const DEFAULT_THRESHOLDS: Thresholds = {
  minVisits: 1000,
  killMaxConversion: 0.02,
  scaleMinConversion: 0.05,
  scaleRequiresPositiveMargin: true,
};

function metrics(overrides: Partial<DecisionMetrics> = {}): DecisionMetrics {
  return { visits: 1000, signupToPurchaseRate: 0.03, marginPerGenerationMicros: 1, ...overrides };
}

describe("evaluate", () => {
  // Task 1 — volume gate
  it("returns null under min_visits even with a killing conversion rate", () => {
    const result: Decision = evaluate(metrics({ visits: 999, signupToPurchaseRate: 0 }), DEFAULT_THRESHOLDS);
    expect(result).toBeNull();
  });

  it("returns null under min_visits even with a scaling conversion rate", () => {
    const result = evaluate(
      metrics({ visits: 999, signupToPurchaseRate: 0.5, marginPerGenerationMicros: 1 }),
      DEFAULT_THRESHOLDS,
    );
    expect(result).toBeNull();
  });

  it("evaluates at exactly min_visits", () => {
    const result = evaluate(metrics({ visits: 1000, signupToPurchaseRate: 0 }), DEFAULT_THRESHOLDS);
    expect(result).toBe("kill");
  });

  // Task 2 — kill
  it("suggests kill below kill_max_conversion", () => {
    expect(evaluate(metrics({ signupToPurchaseRate: 0.019 }), DEFAULT_THRESHOLDS)).toBe("kill");
  });

  it("does not suggest kill at exactly kill_max_conversion", () => {
    expect(evaluate(metrics({ signupToPurchaseRate: 0.02 }), DEFAULT_THRESHOLDS)).toBeNull();
  });

  it("suggests kill at a 0 conversion rate", () => {
    expect(evaluate(metrics({ signupToPurchaseRate: 0 }), DEFAULT_THRESHOLDS)).toBe("kill");
  });

  it("respects a custom kill_max_conversion", () => {
    const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, killMaxConversion: 0.1 };
    expect(evaluate(metrics({ signupToPurchaseRate: 0.05 }), thresholds)).toBe("kill");
  });

  // Task 3 — scale
  it("suggests scale at scale_min_conversion with a positive margin", () => {
    expect(evaluate(metrics({ signupToPurchaseRate: 0.05, marginPerGenerationMicros: 1 }), DEFAULT_THRESHOLDS)).toBe(
      "scale",
    );
  });

  it("does not suggest scale with a zero margin when a positive margin is required", () => {
    expect(
      evaluate(metrics({ signupToPurchaseRate: 0.07, marginPerGenerationMicros: 0 }), DEFAULT_THRESHOLDS),
    ).toBeNull();
  });

  it("does not suggest scale with a negative margin when a positive margin is required", () => {
    expect(
      evaluate(metrics({ signupToPurchaseRate: 0.07, marginPerGenerationMicros: -5 }), DEFAULT_THRESHOLDS),
    ).toBeNull();
  });

  it("does not suggest scale with a null margin when a positive margin is required", () => {
    expect(
      evaluate(metrics({ signupToPurchaseRate: 0.07, marginPerGenerationMicros: null }), DEFAULT_THRESHOLDS),
    ).toBeNull();
  });

  it("suggests scale with a negative margin when a positive margin is not required", () => {
    const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, scaleRequiresPositiveMargin: false };
    expect(evaluate(metrics({ signupToPurchaseRate: 0.07, marginPerGenerationMicros: -5 }), thresholds)).toBe("scale");
  });

  // Task 4 — otherwise null
  it("returns null between the two thresholds", () => {
    expect(evaluate(metrics({ signupToPurchaseRate: 0.03 }), DEFAULT_THRESHOLDS)).toBeNull();
  });

  it("returns null with a null conversion rate, even above min_visits", () => {
    expect(evaluate(metrics({ visits: 5000, signupToPurchaseRate: null }), DEFAULT_THRESHOLDS)).toBeNull();
  });
});
