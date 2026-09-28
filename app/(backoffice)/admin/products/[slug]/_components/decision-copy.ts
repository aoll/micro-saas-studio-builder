import { evaluate, type Decision } from "@/lib/decision";
import type { ProductMetrics } from "@/lib/dal/metrics";
import type { ProductConfig } from "@/lib/schemas/product-config";
import type { Thresholds } from "@/lib/dal/thresholds";
import { formatEuroMicros, formatNumber, formatPercent } from "@/app/(backoffice)/admin/_components/portfolio/format";

const EM_DASH = "—";

export type ThresholdLine =
  | { key: "minVisits" | "killMaxConversion" | "scaleMinConversion"; value: string }
  | { key: "positiveMarginRequired"; value: boolean };

export type DecisionSuggestion =
  | { kind: "notEnoughVisits"; visits: string; minVisits: string }
  | { kind: "thresholdReached"; decision: "kill" | "scale" }
  | { kind: "none" }
  | null;

export type DecisionCopy = {
  thresholds: ThresholdLine[];
  current: { visits: string; conversion: string; margin: string };
  suggestion: DecisionSuggestion;
  badge: Decision;
};

// docs/01-produit.md › Statut Test → Learn → Scale → Killed, docs/07 › decision_thresholds
// (plan design decision 4): the 4 studio thresholds, this product's current values, the same
// `evaluate()` decision the portfolio badge uses (`badge`, so the sheet's header and the
// portfolio table never disagree) and its suggestion shape. Pure and translation-free on purpose
// (I18N-BACKOFFICE-STRINGS, lot 3): it returns structural keys, not localized text, so it stays
// unit-testable without a next-intl mock; DecisionPanel — its only caller, an async Server
// Component — turns each key into text with getTranslations("backoffice-decision"). A killed
// product never suggests anything: the decision has already been made.
export function toDecisionCopy(
  metrics: ProductMetrics,
  thresholds: Thresholds,
  locale: ProductConfig["locale"] = "fr",
): DecisionCopy {
  const thresholdLines: ThresholdLine[] = [
    { key: "minVisits", value: formatNumber(thresholds.minVisits, locale) },
    { key: "killMaxConversion", value: formatPercent(thresholds.killMaxConversion, locale) },
    { key: "scaleMinConversion", value: formatPercent(thresholds.scaleMinConversion, locale) },
    { key: "positiveMarginRequired", value: thresholds.scaleRequiresPositiveMargin },
  ];
  const current = {
    visits: formatNumber(metrics.visits, locale),
    conversion: formatPercent(metrics.signupToPurchaseRate, locale),
    margin:
      metrics.marginPerGenerationMicros === null
        ? EM_DASH
        : formatEuroMicros(metrics.marginPerGenerationMicros, 2, locale),
  };
  const badge = toBadge(metrics, thresholds);

  return {
    thresholds: thresholdLines,
    current,
    suggestion: toSuggestion(metrics, thresholds, badge, locale),
    badge,
  };
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

function toSuggestion(
  metrics: ProductMetrics,
  thresholds: Thresholds,
  badge: Decision,
  locale: ProductConfig["locale"],
): DecisionSuggestion {
  if (metrics.status === "killed") return null;
  if (metrics.visits < thresholds.minVisits) {
    return {
      kind: "notEnoughVisits",
      visits: formatNumber(metrics.visits, locale),
      minVisits: formatNumber(thresholds.minVisits, locale),
    };
  }
  if (badge === "kill") return { kind: "thresholdReached", decision: "kill" };
  if (badge === "scale") return { kind: "thresholdReached", decision: "scale" };
  return { kind: "none" };
}
