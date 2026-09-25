import { evaluate, type Decision } from "@/lib/decision";
import type { PortfolioMetrics, ProductMetrics } from "@/lib/dal/metrics";
import type { Thresholds } from "@/lib/dal/thresholds";
import { formatEuroCents, formatEuroMicros, formatNumber, formatPercent } from "./format";

// One row per product (BO-02): the raw sort keys `sort.ts` needs, the
// `evaluate()` badge for this product's own thresholds, and display
// strings formatted once on the server (specs/BO-02-portefeuille.md plan,
// design decision 6).
export type PortfolioRow = {
  productId: string;
  slug: string;
  name: string;
  status: ProductMetrics["status"];
  decision: Decision;
  visits: number;
  signupToPurchaseRate: number | null;
  revenueCents: number;
  aiCostMicros: number;
  marginPerGenerationMicros: number | null;
  display: {
    visits: string;
    conversion: string;
    revenue: string;
    aiCost: string;
    margin: string;
  };
};

function toRow(product: ProductMetrics, thresholds: Thresholds | undefined): PortfolioRow {
  const decision = thresholds
    ? evaluate(
        {
          visits: product.visits,
          signupToPurchaseRate: product.signupToPurchaseRate,
          marginPerGenerationMicros: product.marginPerGenerationMicros,
        },
        thresholds,
      )
    : null;
  return {
    productId: product.productId,
    slug: product.slug,
    name: product.name,
    status: product.status,
    decision,
    visits: product.visits,
    signupToPurchaseRate: product.signupToPurchaseRate,
    revenueCents: product.revenueCents,
    aiCostMicros: product.aiCostMicros,
    marginPerGenerationMicros: product.marginPerGenerationMicros,
    display: {
      visits: formatNumber(product.visits),
      conversion: formatPercent(product.signupToPurchaseRate),
      revenue: formatEuroCents(product.revenueCents),
      aiCost: formatEuroMicros(product.aiCostMicros),
      margin: product.marginPerGenerationMicros === null ? "—" : formatEuroMicros(product.marginPerGenerationMicros),
    },
  };
}

// `thresholdsById` is keyed by `productId` (BO-09's per-product override
// keys `decision_thresholds` the same way, docs/07): a product missing
// from the map (should not happen with `getThresholds`'s studio default
// fallback, but keeps this function total) shows no badge rather than
// throwing.
export function toPortfolioRows(metrics: PortfolioMetrics, thresholdsById: Record<string, Thresholds>): PortfolioRow[] {
  return metrics.products.map((product) => toRow(product, thresholdsById[product.productId]));
}
