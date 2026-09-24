import "server-only";
import type { EventType } from "@/lib/schemas/event-type";
import type { ProductStatus } from "@/lib/schemas/product-config";

// Frozen contract (specs/CONTRACT-types.md). † Return shapes proposed from
// the BO-02 (portfolio) and BO-03 (product sheet) bullets of
// docs/02-ecrans.md, since docs/11's contract table only names the two
// functions. Money in cents, AI cost in micros (`cost_micros`, docs/07), a
// conversion rate is `null` when its denominator is 0. All read `events`
// (docs/01-produit.md), cached `metrics:{slug}` with `cacheLife("minutes")`
// (docs/04-nextjs.md).
export type MetricsRange = { days: number };

export type ProductMetrics = {
  productId: string;
  slug: string;
  name: string;
  status: ProductStatus;
  visits: number;
  firstGenerations: number;
  signups: number;
  creditsExhausted: number;
  purchases: number;
  generations: number;
  revenueCents: number;
  aiCostMicros: number;
  signupToPurchaseRate: number | null;
  marginPerGenerationMicros: number | null;
};

export type PortfolioMetrics = {
  totals: { visits: number; revenueCents: number; aiCostMicros: number; marginMicros: number };
  products: ProductMetrics[];
};

export type FunnelStep = { type: Exclude<EventType, "generation">; count: number; rateFromPrevious: number | null };

export type DailyPoint = {
  date: string;
  visits: number;
  signups: number;
  purchases: number;
  revenueCents: number;
  aiCostMicros: number;
};

export type Funnel = { metrics: ProductMetrics; steps: FunnelStep[]; daily: DailyPoint[] };

// Powers the portfolio (BO-02); calls `requireAdmin()` inside.
export const getPortfolioMetrics: (range: MetricsRange) => Promise<PortfolioMetrics> = async () => {
  throw new Error("not implemented");
};

// Powers the product sheet (BO-03); calls `requireAdmin()` inside.
export const getFunnel: (productId: string, range: MetricsRange) => Promise<Funnel> = async () => {
  throw new Error("not implemented");
};
