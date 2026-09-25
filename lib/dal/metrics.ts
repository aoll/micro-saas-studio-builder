import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { EventType } from "@/lib/schemas/event-type";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { requireAdmin } from "./session";

// Frozen contract (specs/CONTRACT-types.md). † Return shapes proposed from
// the BO-02 (portfolio) and BO-03 (product sheet) bullets of
// docs/02-ecrans.md, since docs/11's contract table only names the two
// functions. Money in cents, AI cost in micros (`cost_micros`, docs/07), a
// conversion rate is `null` when its denominator is 0. All read `events`
// (docs/01-produit.md). `getPortfolioMetrics` calls `requireAdmin()`
// (reads `headers()`) and is never cached, unlike docs/04's
// `metrics:{slug}` sketch (specs/BO-02-portefeuille.md plan, design
// decision 1): admin data streams under `<Suspense>` instead, like every
// other session-gated read in this file.
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

const MIN_RANGE_DAYS = 1;
const MAX_RANGE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// `{ days: 1 }` means "today only", `{ days: 30 }` the last 30 UTC calendar
// days, today included: `since` is 00:00 UTC of the day `days - 1` days ago
// (specs/BO-02-portefeuille.md plan, design decision 3).
function computeSince(days: number, now: Date = new Date()): Date {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(startOfToday - (days - 1) * MS_PER_DAY);
}

function validateRangeDays(range: MetricsRange): number {
  const { days } = range;
  if (!Number.isInteger(days) || days < MIN_RANGE_DAYS || days > MAX_RANGE_DAYS) {
    throw new RangeError(
      `MetricsRange.days must be an integer between ${MIN_RANGE_DAYS} and ${MAX_RANGE_DAYS}, got ${days}`,
    );
  }
  return days;
}

type PortfolioRow = {
  product_id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  visits: number;
  first_generations: number;
  signups: number;
  credits_exhausted: number;
  purchases: number;
  generations: number;
  revenue_cents: number | string;
  ai_cost_micros: number | string;
  buyers: number;
  credits_sold: number;
  cost_per_generation: number | null;
};

// A price per credit (in micros, from the pack revenue actually collected
// in range) times the product's `costPerGeneration`, minus the average AI
// cost of a succeeded generation: the margin the studio pockets on one
// generation today, given the packs it currently sells (specs/
// BO-02-portefeuille.md plan, design decision 2). `null` when there is
// nothing to divide by: no credits sold, no succeeded generation, or no
// `costPerGeneration` in the product's config.
function toProductMetrics(row: PortfolioRow): ProductMetrics {
  const revenueCents = Number(row.revenue_cents);
  const aiCostMicros = Number(row.ai_cost_micros);
  const signupToPurchaseRate = row.signups > 0 ? row.buyers / row.signups : null;
  const marginPerGenerationMicros =
    row.credits_sold > 0 && row.generations > 0 && row.cost_per_generation !== null
      ? Math.round(((revenueCents * 10_000) / row.credits_sold) * row.cost_per_generation) -
        Math.round(aiCostMicros / row.generations)
      : null;
  return {
    productId: row.product_id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    visits: row.visits,
    firstGenerations: row.first_generations,
    signups: row.signups,
    creditsExhausted: row.credits_exhausted,
    purchases: row.purchases,
    generations: row.generations,
    revenueCents,
    aiCostMicros,
    signupToPurchaseRate,
    marginPerGenerationMicros,
  };
}

// Powers the portfolio (BO-02); calls `requireAdmin()` inside, before
// validating the range. One own SQL statement rather than `listProducts()`
// (specs/BO-02-portefeuille.md plan, design decision 2): `products` joined
// to its current `product_versions` row (for `name` and
// `pricing.costPerGeneration`), left-joined to three subqueries grouped by
// `product_id` — `events` (the 5 funnel-step counts), `purchases`
// (revenue, credits sold, distinct buyers) and `generations` (succeeded
// count, AI cost over every status) — so no product fans out into
// duplicate rows. Every product is returned, `killed` included, with
// zeros and `null` rates when idle.
export const getPortfolioMetrics: (range: MetricsRange) => Promise<PortfolioMetrics> = async (range) => {
  await requireAdmin();
  const days = validateRangeDays(range);
  // `postgres` (the driver) refuses a bare `Date` as a bind parameter; an
  // ISO string round-trips through `timestamptz` correctly.
  const since = computeSince(days).toISOString();

  const result = await db.execute(sql`
    select
      p.id as product_id,
      p.slug as slug,
      coalesce(pv.config ->> 'name', p.slug) as name,
      p.status as status,
      coalesce(ev.visits, 0)::int as visits,
      coalesce(ev.first_generations, 0)::int as first_generations,
      coalesce(ev.signups, 0)::int as signups,
      coalesce(ev.credits_exhausted, 0)::int as credits_exhausted,
      coalesce(ev.purchases, 0)::int as purchases,
      coalesce(gen.generations, 0)::int as generations,
      coalesce(pu.revenue_cents, 0)::bigint as revenue_cents,
      coalesce(gen.ai_cost_micros, 0)::bigint as ai_cost_micros,
      coalesce(pu.buyers, 0)::int as buyers,
      coalesce(pu.credits_sold, 0)::int as credits_sold,
      (pv.config -> 'pricing' ->> 'costPerGeneration')::int as cost_per_generation
    from products p
    inner join product_versions pv
      on pv.product_id = p.id and pv.version = p.current_version
    left join (
      select
        product_id,
        count(*) filter (where type = 'visit') as visits,
        count(*) filter (where type = 'first_generation') as first_generations,
        count(*) filter (where type = 'signup') as signups,
        count(*) filter (where type = 'credits_exhausted') as credits_exhausted,
        count(*) filter (where type = 'purchase') as purchases
      from events
      where created_at >= ${since}
      group by product_id
    ) ev on ev.product_id = p.id
    left join (
      select
        product_id,
        sum(amount_cents) as revenue_cents,
        sum(credits) as credits_sold,
        count(distinct user_id) as buyers
      from purchases
      where created_at >= ${since}
      group by product_id
    ) pu on pu.product_id = p.id
    left join (
      select
        product_id,
        count(*) filter (where status = 'succeeded') as generations,
        coalesce(sum(cost_micros), 0) as ai_cost_micros
      from generations
      where created_at >= ${since}
      group by product_id
    ) gen on gen.product_id = p.id
  `);
  const rows = [...result] as unknown as PortfolioRow[];

  const productMetrics = rows.map(toProductMetrics);
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
