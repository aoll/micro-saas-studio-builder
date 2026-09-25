import { evaluate } from "@/lib/decision";
import type { ProductMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { formatEuroMicros, formatNumber, formatPercent } from "@/app/(backoffice)/admin/_components/portfolio/format";

const EM_DASH = "—";

export type DecisionSuggestion = { headline: string; detail: string } | null;

export type DecisionCopy = {
  thresholds: { label: string; value: string }[];
  current: { visits: string; conversion: string; margin: string };
  suggestion: DecisionSuggestion;
};

// docs/01-produit.md › Statut Test → Learn → Scale → Killed, docs/07 › decision_thresholds
// (plan design decision 4): the 4 studio thresholds, this product's current values, and a
// French suggestion built on the same `evaluate()` the portfolio badge uses — so the sheet and
// the table never disagree. A killed product never suggests anything: the decision has already
// been made.
export function toDecisionCopy(metrics: ProductMetrics, thresholds: Thresholds): DecisionCopy {
  const thresholdLines = [
    { label: "Visites minimales", value: formatNumber(thresholds.minVisits) },
    { label: "Conversion « à couper » sous", value: formatPercent(thresholds.killMaxConversion) },
    { label: "Conversion « à scaler » à partir de", value: formatPercent(thresholds.scaleMinConversion) },
    { label: "Marge positive exigée", value: thresholds.scaleRequiresPositiveMargin ? "Oui" : "Non" },
  ];
  const current = {
    visits: formatNumber(metrics.visits),
    conversion: formatPercent(metrics.signupToPurchaseRate),
    margin: metrics.marginPerGenerationMicros === null ? EM_DASH : formatEuroMicros(metrics.marginPerGenerationMicros),
  };

  return { thresholds: thresholdLines, current, suggestion: toSuggestion(metrics, thresholds) };
}

function toSuggestion(metrics: ProductMetrics, thresholds: Thresholds): DecisionSuggestion {
  if (metrics.status === "killed") return null;
  if (metrics.visits < thresholds.minVisits) {
    return {
      headline: "Pas assez de visites pour décider",
      detail: `${formatNumber(metrics.visits)} / ${formatNumber(thresholds.minVisits)}`,
    };
  }
  const decision = evaluate(
    {
      visits: metrics.visits,
      signupToPurchaseRate: metrics.signupToPurchaseRate,
      marginPerGenerationMicros: metrics.marginPerGenerationMicros,
    },
    thresholds,
  );
  if (decision === "kill")
    return { headline: "Seuil de décision atteint", detail: "Statut suggéré : Killed (à couper)" };
  if (decision === "scale")
    return { headline: "Seuil de décision atteint", detail: "Statut suggéré : Scale (à scaler)" };
  return { headline: "Pas de suggestion", detail: "on continue d'observer" };
}
