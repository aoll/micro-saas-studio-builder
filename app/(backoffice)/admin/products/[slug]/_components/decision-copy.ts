import { evaluate, type Decision } from "@/lib/decision";
import type { ProductMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { formatEuroMicros, formatNumber, formatPercent } from "@/app/(backoffice)/admin/_components/portfolio/format";

const EM_DASH = "—";

export type DecisionSuggestion = { headline: string; detail: string } | null;

export type DecisionCopy = {
  thresholds: { label: string; value: string }[];
  current: { visits: string; conversion: string; margin: string };
  suggestion: DecisionSuggestion;
  badge: Decision;
};

// docs/01-produit.md › Statut Test → Learn → Scale → Killed, docs/07 › decision_thresholds
// (plan design decision 4): the 4 studio thresholds, this product's current values, the same
// `evaluate()` decision the portfolio badge uses (`badge`, so the sheet's header and the
// portfolio table never disagree) and its French `suggestion` text. A killed product never
// suggests anything: the decision has already been made.
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
  const badge = toBadge(metrics, thresholds);

  return { thresholds: thresholdLines, current, suggestion: toSuggestion(metrics, thresholds, badge), badge };
}

function toBadge(metrics: ProductMetrics, thresholds: Thresholds): Decision {
  if (metrics.status === "killed") return null;
  return evaluate(
    {
      visits: metrics.visits,
      signupToPurchaseRate: metrics.signupToPurchaseRate,
      marginPerGenerationMicros: metrics.marginPerGenerationMicros,
    },
    thresholds,
  );
}

function toSuggestion(metrics: ProductMetrics, thresholds: Thresholds, badge: Decision): DecisionSuggestion {
  if (metrics.status === "killed") return null;
  if (metrics.visits < thresholds.minVisits) {
    return {
      headline: "Pas assez de visites pour décider",
      detail: `${formatNumber(metrics.visits)} / ${formatNumber(thresholds.minVisits)}`,
    };
  }
  if (badge === "kill") return { headline: "Seuil de décision atteint", detail: "Statut suggéré : Killed (à couper)" };
  if (badge === "scale") return { headline: "Seuil de décision atteint", detail: "Statut suggéré : Scale (à scaler)" };
  return { headline: "Pas de suggestion", detail: "on continue d'observer" };
}
