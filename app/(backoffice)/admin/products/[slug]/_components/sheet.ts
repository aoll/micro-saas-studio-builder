import type { DailyPoint, Funnel, FunnelStep, ProductMetrics } from "@/lib/dal/metrics";
import type { ProductConfig, ProductStatus } from "@/lib/schemas/product-config";
import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";
import {
  formatEuroCents,
  formatEuroMicros,
  formatNumber,
  formatPercent,
} from "@/app/(backoffice)/admin/_components/portfolio/format";
import { toDecisionCopy, type DecisionCopy } from "./decision-copy";

const EM_DASH = "—";

// I18N-BACKOFFICE-STRINGS: a minimal structural type rather than next-intl's own (heavier,
// server/client-specific) translator type — any real translator satisfies it, and a test double
// can implement it directly without casting (product-tabs.tsx's comment on the same trade-off).
export type Translate = (key: string, values?: Record<string, string | number>) => string;

// BO-03's 4 KPI cards (docs/02-ecrans.md, plan design decision 3 — no "Visites" card, no deltas:
// orchestrator decision 4). ARPU isn't stored on ProductMetrics (unlike the portfolio's gross
// margin rate, docs/01-produit.md › ARPU = revenu / inscrits): `null` (shown "—") at 0 signups.
export function toKpis(
  metrics: ProductMetrics,
  t: Translate,
  locale: ProductConfig["locale"] = "fr",
): { label: string; value: string }[] {
  const arpu = metrics.signups > 0 ? metrics.revenueCents / metrics.signups : null;
  return [
    { label: t("kpis.revenue"), value: formatEuroCents(metrics.revenueCents, locale) },
    { label: t("kpis.arpu"), value: arpu === null ? EM_DASH : formatEuroCents(arpu, locale) },
    { label: t("kpis.aiCost"), value: formatEuroMicros(metrics.aiCostMicros, 2, locale) },
    {
      label: t("kpis.marginPerGeneration"),
      value:
        metrics.marginPerGenerationMicros === null
          ? EM_DASH
          : formatEuroMicros(metrics.marginPerGenerationMicros, 2, locale),
    },
  ];
}

const STEP_KEYS: Record<FunnelStep["type"], string> = {
  visit: "funnel.steps.visit",
  first_generation: "funnel.steps.first_generation",
  signup: "funnel.steps.signup",
  credits_exhausted: "funnel.steps.credits_exhausted",
  purchase: "funnel.steps.purchase",
};

export type FunnelRow = { type: FunnelStep["type"]; label: string; count: string; rate: string; widthPercent: number };

// docs/02-ecrans.md › Funnel: "5 étapes avec volumes et taux de passage" — a bar per step, width
// proportional to `visits` (the first step, always 100 unless visits is 0), clamped to [0, 100]
// so a data inconsistency can never overflow the bar. The rate itself is clamped to [0, 1]
// (QA1-P1-Q5), independently of lib/dal/metrics.ts's own clamp: no step's pass rate is ever
// displayed above 100%, whatever `rateFromPrevious` carries.
export function toFunnelRows(
  steps: FunnelStep[],
  visits: number,
  t: Translate,
  locale: ProductConfig["locale"] = "fr",
): FunnelRow[] {
  return steps.map((step) => ({
    type: step.type,
    label: t(STEP_KEYS[step.type]),
    count: formatNumber(step.count, locale),
    rate: formatPercent(step.rateFromPrevious === null ? null : Math.min(1, step.rateFromPrevious), locale),
    widthPercent: visits > 0 ? Math.min(100, Math.max(0, (step.count / visits) * 100)) : 0,
  }));
}

export type TrendPoint = { date: string; visits: number; purchases: number };

// docs/01-produit.md › "courbes sur 30 jours": a dd/MM label (the ISO date's day and month,
// already ordered by the DAL) and the two series the trend chart plots.
export function toTrendPoints(daily: DailyPoint[]): TrendPoint[] {
  return daily.map((point) => ({
    date: `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`,
    visits: point.visits,
    purchases: point.purchases,
  }));
}

export type ProductSheetViewModel = {
  productId: string;
  slug: string;
  name: string;
  status: ProductStatus;
  hasData: boolean;
  kpis: { label: string; value: string }[];
  funnelRows: FunnelRow[];
  trend: TrendPoint[];
  decision: DecisionCopy;
  decisionMetrics: DecisionMetrics;
  thresholds: Thresholds;
};

// The product sheet's (BO-03) full view model, computed once on the server from `getFunnel` and
// `getThresholds`'s real data (design decisions 3-4). `hasData` gates the "no data" state
// (docs/02-ecrans.md › BO-03 état "Produit sans données"): true as soon as there is at least one
// visit, false only for a brand-new, never-visited product.
export function toProductSheet(
  funnel: Funnel,
  thresholds: Thresholds,
  t: Translate,
  locale: ProductConfig["locale"] = "fr",
): ProductSheetViewModel {
  const { metrics } = funnel;
  return {
    productId: metrics.productId,
    slug: metrics.slug,
    name: metrics.name,
    status: metrics.status,
    hasData: metrics.visits > 0,
    kpis: toKpis(metrics, t, locale),
    funnelRows: toFunnelRows(funnel.steps, metrics.visits, t, locale),
    trend: toTrendPoints(funnel.daily),
    decision: toDecisionCopy(metrics, thresholds),
    decisionMetrics: {
      visits: metrics.visits,
      signupToPurchaseRate: metrics.signupToPurchaseRate,
      marginPerGenerationMicros: metrics.marginPerGenerationMicros,
    },
    thresholds,
  };
}
