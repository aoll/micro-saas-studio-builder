import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
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

const FUNNEL_STEP_TYPES = ["visit", "first_generation", "signup", "credits_exhausted", "purchase"] as const;

// The 5 funnel steps (BO-03) and their pass rate from the previous step, from one product's
// ProductMetrics: `null` for the first step (no previous step) and whenever the previous step's
// count is 0 (nothing to divide by).
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

type DailyRow = {
  date: string;
  visits: number;
  signups: number;
  purchases: number;
  revenue_cents: number | string;
  ai_cost_micros: number | string;
};

function toDailyPoint(row: DailyRow): DailyPoint {
  return {
    date: row.date,
    visits: row.visits,
    signups: row.signups,
    purchases: row.purchases,
    revenueCents: Number(row.revenue_cents),
    aiCostMicros: Number(row.ai_cost_micros),
  };
}

// One point per UTC calendar day of the range, `since` (00:00 UTC) to today included, zero-filled
// where nothing happened (docs/01: "courbes sur 30 jours"). Own query, filtered to one product:
// `events` for visits/signups/purchases, `purchases` for revenue, `generations` for AI cost (every
// status, like selectProductRows). Bucketed by `(created_at at time zone 'UTC')::date` so the
// day boundary is UTC midnight regardless of the server's local time zone.
async function selectDailyPoints(productId: string, since: string, days: number): Promise<DailyPoint[]> {
  const result = await db.execute<DailyRow>(sql`
    select
      to_char(gs.day, 'YYYY-MM-DD') as date,
      coalesce(ev.visits, 0)::int as visits,
      coalesce(ev.signups, 0)::int as signups,
      coalesce(ev.purchases, 0)::int as purchases,
      coalesce(pu.revenue_cents, 0)::bigint as revenue_cents,
      coalesce(gen.ai_cost_micros, 0)::bigint as ai_cost_micros
    from generate_series(${since}::date, ${since}::date + (${days - 1} || ' days')::interval, interval '1 day') as gs(day)
    left join (
      select
        (created_at at time zone 'UTC')::date as day,
        count(*) filter (where type = 'visit') as visits,
        count(*) filter (where type = 'signup') as signups,
        count(*) filter (where type = 'purchase') as purchases
      from events
      where product_id = ${productId} and created_at >= ${since}
      group by 1
    ) ev on ev.day = gs.day
    left join (
      select (created_at at time zone 'UTC')::date as day, sum(amount_cents) as revenue_cents
      from purchases
      where product_id = ${productId} and created_at >= ${since}
      group by 1
    ) pu on pu.day = gs.day
    left join (
      select (created_at at time zone 'UTC')::date as day, coalesce(sum(cost_micros), 0) as ai_cost_micros
      from generations
      where product_id = ${productId} and created_at >= ${since}
      group by 1
    ) gen on gen.day = gs.day
    order by gs.day asc
  `);
  return [...result].map(toDailyPoint);
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

export type PortfolioRow = {
  product_id: string;
  slug: string;
  name: string | null;
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

// The pure row → ProductMetrics mapping (exported for lib/dal/metrics.test.ts to exercise
// directly with a fabricated row, instead of inserting a schema-invalid product_versions row
// into the shared test DB — specs/BO-02-portefeuille.md review round). Two defensive
// fallbacks, both driven by data SQL alone cannot guarantee (a product's config could, in
// theory, be missing `name` or `pricing.costPerGeneration`):
// - `name`: `null` (config has no `name`) falls back to `slug`.
// - `marginPerGenerationMicros`: a price per credit (in micros, from the pack revenue
//   actually collected in range) times the product's `costPerGeneration`, minus the average
//   AI cost of a succeeded generation (specs/BO-02-portefeuille.md plan, design decision 2).
//   `null` when there is nothing to divide by: no credits sold, no succeeded generation, or no
//   `costPerGeneration` in the product's config.
export function toProductMetrics(row: PortfolioRow): ProductMetrics {
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
    name: row.name ?? row.slug,
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

// The portfolio's aggregation SQL (BO-02), extracted so getFunnel (BO-03) can reuse it filtered
// to one product instead of duplicating the 3 subqueries: `products` joined to its current
// `product_versions` row (for `name` and `pricing.costPerGeneration`), left-joined to `events`
// (the 5 funnel-step counts), `purchases` (revenue, credits sold, distinct buyers) and
// `generations` (succeeded count, AI cost over every status), grouped by `product_id` so no
// product fans out into duplicate rows. With no `productId`, every product is returned, `killed`
// included; with one, at most one row (empty when the id doesn't exist).
async function selectProductRows(since: string, productId?: string): Promise<PortfolioRow[]> {
  const result = await db.execute<PortfolioRow>(sql`
    select
      p.id as product_id,
      p.slug as slug,
      pv.config ->> 'name' as name,
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
        count(distinct anonymous_id) filter (where type = 'visit') as visits,
        count(distinct coalesce(user_id, anonymous_id)) filter (where type = 'first_generation') as first_generations,
        count(distinct user_id) filter (where type = 'signup') as signups,
        count(distinct user_id) filter (where type = 'credits_exhausted') as credits_exhausted,
        count(distinct user_id) filter (where type = 'purchase') as purchases
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
    ${productId ? sql`where p.id = ${productId}` : sql``}
  `);
  return [...result];
}

// Powers the portfolio (BO-02); calls `requireAdmin()` inside, before
// validating the range (specs/BO-02-portefeuille.md plan, design decision 2).
export const getPortfolioMetrics: (range: MetricsRange) => Promise<PortfolioMetrics> = async (range) => {
  await requireAdmin();
  const days = validateRangeDays(range);
  // `postgres` (the driver) refuses a bare `Date` as a bind parameter; an
  // ISO string round-trips through `timestamptz` correctly.
  const since = computeSince(days).toISOString();

  const productMetrics = (await selectProductRows(since)).map(toProductMetrics);
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

// Powers the product sheet (BO-03); calls `requireAdmin()` inside, before validating the range
// (mirrors getPortfolioMetrics). A malformed or unknown productId throws before any SQL runs
// (`z.uuid()`, cheaper and clearer than a Postgres "invalid input syntax for type uuid" error):
// there is no "empty funnel" to render for a product that doesn't exist, unlike an idle product,
// whose row exists with zero counts.
export const getFunnel: (productId: string, range: MetricsRange) => Promise<Funnel> = async (productId, range) => {
  await requireAdmin();
  const days = validateRangeDays(range);
  if (!z.uuid().safeParse(productId).success) {
    throw new Error(`getFunnel: unknown product ${productId}`);
  }
  const since = computeSince(days).toISOString();

  const [row] = await selectProductRows(since, productId);
  if (!row) throw new Error(`getFunnel: unknown product ${productId}`);
  const metrics = toProductMetrics(row);
  const daily = await selectDailyPoints(productId, since, days);
  return { metrics, steps: buildSteps(metrics), daily };
};
