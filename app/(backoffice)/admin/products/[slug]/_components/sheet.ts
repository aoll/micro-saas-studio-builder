import type { DailyPoint, Funnel, FunnelStep, ProductMetrics } from "@/lib/dal/metrics";
import type { ProductStatus } from "@/lib/schemas/product-config";
import type { Thresholds } from "@/lib/dal/thresholds";
import {
  formatEuroCents,
  formatEuroMicros,
  formatNumber,
  formatPercent,
} from "@/app/(backoffice)/admin/_components/portfolio/format";
import { toDecisionCopy, type DecisionCopy } from "./decision-copy";

const EM_DASH = "—";

// BO-03's 4 KPI cards (docs/02-ecrans.md, plan design decision 3 — no "Visites" card, no deltas:
// orchestrator decision 4). ARPU isn't stored on ProductMetrics (unlike the portfolio's gross
// margin rate, docs/01-produit.md › ARPU = revenu / inscrits): `null` (shown "—") at 0 signups.
export function toKpis(metrics: ProductMetrics): { label: string; value: string }[] {
  const arpu = metrics.signups > 0 ? metrics.revenueCents / metrics.signups : null;
  return [
    { label: "Revenu · 30 j", value: formatEuroCents(metrics.revenueCents) },
    { label: "ARPU", value: arpu === null ? EM_DASH : formatEuroCents(arpu) },
    { label: "Coût IA · 30 j", value: formatEuroMicros(metrics.aiCostMicros) },
    {
      label: "Marge / génération",
      value: metrics.marginPerGenerationMicros === null ? EM_DASH : formatEuroMicros(metrics.marginPerGenerationMicros),
    },
  ];
}

const STEP_LABELS: Record<FunnelStep["type"], string> = {
  visit: "Visites landing",
  first_generation: "1re génération",
  signup: "Inscription",
  credits_exhausted: "Crédits épuisés",
  purchase: "Achat",
};

export type FunnelRow = { type: FunnelStep["type"]; label: string; count: string; rate: string; widthPercent: number };

// docs/02-ecrans.md › Funnel: "5 étapes avec volumes et taux de passage" — a bar per step, width
// proportional to `visits` (the first step, always 100 unless visits is 0), clamped to [0, 100]
// so a data inconsistency can never overflow the bar.
export function toFunnelRows(steps: FunnelStep[], visits: number): FunnelRow[] {
  return steps.map((step) => ({
    type: step.type,
    label: STEP_LABELS[step.type],
    count: formatNumber(step.count),
    rate: formatPercent(step.rateFromPrevious),
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
};

// The product sheet's (BO-03) full view model, computed once on the server from `getFunnel` and
// `getThresholds`'s real data (design decisions 3-4). `hasData` gates the "no data" state
// (docs/02-ecrans.md › BO-03 état "Produit sans données"): true as soon as there is at least one
// visit, false only for a brand-new, never-visited product.
export function toProductSheet(funnel: Funnel, thresholds: Thresholds): ProductSheetViewModel {
  const { metrics } = funnel;
  return {
    productId: metrics.productId,
    slug: metrics.slug,
    name: metrics.name,
    status: metrics.status,
    hasData: metrics.visits > 0,
    kpis: toKpis(metrics),
    funnelRows: toFunnelRows(funnel.steps, metrics.visits),
    trend: toTrendPoints(funnel.daily),
    decision: toDecisionCopy(metrics, thresholds),
  };
}
