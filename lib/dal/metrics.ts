import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import type { EventType } from "@/lib/schemas/event-type";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { requireAdmin } from "./session";

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

// V1 stub numbers (docs/11 › Les contrats gelés en V1: "chiffres fixes
// plausibles"): a funnel that tells LettrePro's "it works" story (scale
// status, positive margin), replaced by TRACKING's real aggregation over
// `events`. Internally consistent: each step is smaller than the last, the
// margin is positive, and the totals below simply sum this one product
// (there is only one seeded product with metrics in V1).
const FIXTURE = {
  visits: 4200,
  firstGenerations: 1260,
  signups: 520,
  creditsExhausted: 180,
  purchases: 36,
  generations: 2900,
  revenueCents: 29640,
  costMicrosPerGeneration: 4000,
};

const FUNNEL_STEP_TYPES = ["visit", "first_generation", "signup", "credits_exhausted", "purchase"] as const;

async function buildProductMetrics(productId: string): Promise<ProductMetrics> {
  const aiCostMicros = FIXTURE.generations * FIXTURE.costMicrosPerGeneration;
  const revenueMicros = FIXTURE.revenueCents * 10_000;
  return {
    productId,
    slug: "lettre-pro",
    name: "LettrePro",
    status: "scale",
    visits: FIXTURE.visits,
    firstGenerations: FIXTURE.firstGenerations,
    signups: FIXTURE.signups,
    creditsExhausted: FIXTURE.creditsExhausted,
    purchases: FIXTURE.purchases,
    generations: FIXTURE.generations,
    revenueCents: FIXTURE.revenueCents,
    aiCostMicros,
    // FIXTURE.signups and FIXTURE.generations are hardcoded positive
    // constants (never 0): no `null` branch to guard here, unlike
    // buildSteps' rateFromPrevious below, whose denominator does vary.
    signupToPurchaseRate: FIXTURE.purchases / FIXTURE.signups,
    marginPerGenerationMicros: Math.round(revenueMicros / FIXTURE.generations) - FIXTURE.costMicrosPerGeneration,
  };
}

function buildSteps(metrics: ProductMetrics): FunnelStep[] {
  const counts: Record<(typeof FUNNEL_STEP_TYPES)[number], number> = {
    visit: metrics.visits,
    first_generation: metrics.firstGenerations,
    signup: metrics.signups,
    credits_exhausted: metrics.creditsExhausted,
    purchase: metrics.purchases,
  };
  return FUNNEL_STEP_TYPES.map((type, index) => {
    const previousType = FUNNEL_STEP_TYPES[index - 1];
    const previousCount = previousType ? counts[previousType] : null;
    return {
      type,
      count: counts[type],
      rateFromPrevious: previousCount && previousCount > 0 ? counts[type] / previousCount : null,
    };
  });
}

// One private builder (docs/11), shared by getFunnel's `daily` and the
// (bonus) 30-day chart: an even split of the fixed totals over the
// requested range, capped to 30 points (docs/01: "courbes sur 30 jours").
function buildDaily(range: MetricsRange, metrics: ProductMetrics): DailyPoint[] {
  const days = Math.max(1, Math.min(range.days, 30));
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    return {
      date: date.toISOString().slice(0, 10),
      visits: Math.round(metrics.visits / days),
      signups: Math.round(metrics.signups / days),
      purchases: Math.round(metrics.purchases / days),
      revenueCents: Math.round(metrics.revenueCents / days),
      aiCostMicros: Math.round(metrics.aiCostMicros / days),
    };
  });
}

// Powers the portfolio (BO-02); calls `requireAdmin()` inside.
export const getPortfolioMetrics: (range: MetricsRange) => Promise<PortfolioMetrics> = async () => {
  await requireAdmin();
  const lettrePro = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  const productMetrics = lettrePro ? [await buildProductMetrics(lettrePro.id)] : [];
  return {
    totals: {
      visits: productMetrics.reduce((sum, product) => sum + product.visits, 0),
      revenueCents: productMetrics.reduce((sum, product) => sum + product.revenueCents, 0),
      aiCostMicros: productMetrics.reduce((sum, product) => sum + product.aiCostMicros, 0),
      marginMicros: productMetrics.reduce(
        (sum, product) => sum + product.revenueCents * 10_000 - product.aiCostMicros,
        0,
      ),
    },
    products: productMetrics,
  };
};

// Powers the product sheet (BO-03); calls `requireAdmin()` inside.
export const getFunnel: (productId: string, range: MetricsRange) => Promise<Funnel> = async (productId, range) => {
  await requireAdmin();
  const metrics = await buildProductMetrics(productId);
  return { metrics, steps: buildSteps(metrics), daily: buildDaily(range, metrics) };
};
