import { describe, expect, it } from "vitest";
import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";
import { computeThresholdGauge } from "./decision-gauge-data";

function metrics(overrides: Partial<DecisionMetrics> = {}): DecisionMetrics {
  return { visits: 0, signupToPurchaseRate: null, marginPerGenerationMicros: null, ...overrides };
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

describe("computeThresholdGauge", () => {
  it("reports the visits gate as unmet below minVisits, with no marker", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 400 }), thresholds());
    expect(gauge.gate).toEqual({ visits: 400, minVisits: 1000, met: false, progress: 0.4 });
    expect(gauge.marker).toBeNull();
  });

  it("caps the gate progress at 1 once visits clear the threshold", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 5000 }), thresholds());
    expect(gauge.gate).toEqual({ visits: 5000, minVisits: 1000, met: true, progress: 1 });
  });

  it("places a below-threshold rate in the kill zone", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 1200, signupToPurchaseRate: 0.009 }), thresholds());
    expect(gauge.marker?.zone).toBe("kill");
    expect(gauge.marker?.position).toBeCloseTo(0.009 / gauge.scaleMax, 5);
  });

  it("places a rate between the two thresholds in the neutral zone", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 1200, signupToPurchaseRate: 0.03 }), thresholds());
    expect(gauge.marker?.zone).toBe("neutral");
  });

  it("places a rate at or above scaleMinConversion in the scale zone", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 1200, signupToPurchaseRate: 0.1 }), thresholds());
    expect(gauge.marker?.zone).toBe("scale");
  });

  it("keeps the marker and both threshold zones within [0, 1] even for a very high rate", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 1200, signupToPurchaseRate: 0.9 }), thresholds());
    expect(gauge.marker?.position).toBeLessThanOrEqual(1);
    expect(gauge.zones.killEnd).toBeGreaterThanOrEqual(0);
    expect(gauge.zones.killEnd).toBeLessThanOrEqual(1);
    expect(gauge.zones.scaleStart).toBeGreaterThanOrEqual(0);
    expect(gauge.zones.scaleStart).toBeLessThanOrEqual(1);
    expect(gauge.zones.scaleStart).toBeGreaterThan(gauge.zones.killEnd);
  });

  it("has no marker when there is no signup yet", () => {
    const gauge = computeThresholdGauge(metrics({ visits: 1200, signupToPurchaseRate: null }), thresholds());
    expect(gauge.marker).toBeNull();
  });
});
