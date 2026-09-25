import type { Thresholds } from "./dal/thresholds";

// Frozen contract (specs/BO-02-portefeuille.md, plan decision 5): a pure
// function, independent of the product's current status, so BO-02 and
// BO-03 both suggest the same badge from the same metrics and thresholds.
export type Decision = "kill" | "scale" | null;

export type DecisionMetrics = {
  visits: number;
  signupToPurchaseRate: number | null;
  marginPerGenerationMicros: number | null;
};

// docs/01-produit.md › Statut Test → Learn → Scale → Killed, docs/07 ›
// decision_thresholds: below min_visits, no suggestion at all (not enough
// volume to trust the rate); a null rate (no signup yet) never suggests a
// badge either, kill included (plan decision 4, literal rule).
export function evaluate(metrics: DecisionMetrics, thresholds: Thresholds): Decision {
  if (metrics.visits < thresholds.minVisits) return null;
  const { signupToPurchaseRate: rate, marginPerGenerationMicros: margin } = metrics;
  if (rate === null) return null;
  if (rate < thresholds.killMaxConversion) return "kill";
  const marginOk = !thresholds.scaleRequiresPositiveMargin || (margin !== null && margin > 0);
  if (rate >= thresholds.scaleMinConversion && marginOk) return "scale";
  return null;
}
