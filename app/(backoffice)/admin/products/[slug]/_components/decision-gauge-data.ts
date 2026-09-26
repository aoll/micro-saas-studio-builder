import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";

export type GaugeZone = "kill" | "neutral" | "scale";

export type ThresholdGauge = {
  gate: { visits: number; minVisits: number; met: boolean; progress: number };
  scaleMax: number;
  zones: { killEnd: number; scaleStart: number };
  marker: { position: number; zone: GaugeZone } | null;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Pure geometry for the BO-03 threshold gauge (docs/01-produit.md › Statut Test →
// Learn → Scale → Killed): the same primitives `evaluate()` reads, reshaped into
// positions on a 0..1 axis. Never itself a decision — decision-copy.ts's
// `toDecisionCopy()` (via `evaluate()`) still owns the actual suggestion; this
// only draws where the current numbers sit relative to the two thresholds.
export function computeThresholdGauge(metrics: DecisionMetrics, thresholds: Thresholds): ThresholdGauge {
  const gate = {
    visits: metrics.visits,
    minVisits: thresholds.minVisits,
    met: metrics.visits >= thresholds.minVisits,
    progress: thresholds.minVisits > 0 ? clamp01(metrics.visits / thresholds.minVisits) : 1,
  };

  const rate = metrics.signupToPurchaseRate;
  const scaleMax = Math.max(
    thresholds.scaleMinConversion * 1.5,
    thresholds.killMaxConversion * 1.2,
    (rate ?? 0) * 1.15,
    0.01,
  );

  const zones = {
    killEnd: clamp01(thresholds.killMaxConversion / scaleMax),
    scaleStart: clamp01(thresholds.scaleMinConversion / scaleMax),
  };

  const marker =
    rate === null
      ? null
      : {
          position: clamp01(rate / scaleMax),
          zone: (rate < thresholds.killMaxConversion
            ? "kill"
            : rate >= thresholds.scaleMinConversion
              ? "scale"
              : "neutral") as GaugeZone,
        };

  return { gate, scaleMax, zones, marker };
}
