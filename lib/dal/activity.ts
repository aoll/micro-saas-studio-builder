import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { creditTransactions, generations, purchases } from "@/lib/db/schema";
import { requireAdmin } from "./session";

// BO-04 (specs/BO-04-activite.md), new code, not a frozen contract (plan §
// "lib/dal/activity.ts is new code"): powers the read-only "Activité" tab of
// a product's sheet — the latest generations, the purchases (with a 30-day
// summary) and the credit-ledger movements of every user on that product.
// Admin-only, never `'use cache'`d (docs/04-nextjs.md: admin data streams
// under <Suspense>).

export const ACTIVITY_PAGE_SIZE = 20;
export const PURCHASE_SUMMARY_DAYS = 30;

export type ActivityPage<T> = { entries: T[]; page: number; total: number; hasMore: boolean };

export type ActivityGeneration = {
  id: string;
  createdAt: Date;
  input: Record<string, string>;
  output: unknown;
  model: string | null;
  costMicros: number | null;
  status: "pending" | "succeeded" | "failed";
  refunded: boolean;
};

export type ActivityPurchase = {
  id: string;
  createdAt: Date;
  credits: number;
  amountCents: number;
  currency: string;
};

export type ActivityMovement = {
  id: string;
  createdAt: Date;
  delta: number;
  reason: "signup_bonus" | "purchase" | "generation" | "refund";
  packCredits: number | null;
};

export type PurchaseSummary = {
  count: number;
  revenueCents: number;
  byPack: { credits: number; count: number }[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Guard order (plan § "Rules for every function"): requireAdmin() first, then
// `page` (when the function takes one), then the product id's format. No SQL
// runs before these checks pass.
function assertValidPage(page: number, fnName: string): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`${fnName}: page must be a positive integer, got ${page}`);
  }
}

function assertValidProductId(productId: string, fnName: string): void {
  if (!z.uuid().safeParse(productId).success) {
    throw new Error(`${fnName}: unknown product`);
  }
}

function normalizeInput(input: unknown): Record<string, string> {
  return (input ?? {}) as Record<string, string>;
}

// The refund flag (plan): true when a `refund` ledger row references the
// generation. Looked up in one batched query for the whole page instead of
// one query per row.
async function refundedGenerationIds(generationIds: string[]): Promise<Set<string>> {
  if (generationIds.length === 0) return new Set();
  const rows = await db
    .select({ generationId: creditTransactions.generationId })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.reason, "refund"), inArray(creditTransactions.generationId, generationIds)));
  return new Set(rows.flatMap((row) => (row.generationId ? [row.generationId] : [])));
}

// Newest first (created_at desc, id desc), paginated `ACTIVITY_PAGE_SIZE` at
// a time, every status included (docs/02-ecrans.md › BO-04: "Dernières
// générations"). Never returns a user id, an anonymous id or an ip hash
// (plan § "Returned fields").
export async function listProductGenerations(
  productId: string,
  page: number,
): Promise<ActivityPage<ActivityGeneration>> {
  await requireAdmin();
  assertValidPage(page, "listProductGenerations");
  assertValidProductId(productId, "listProductGenerations");

  const where = eq(generations.productId, productId);
  const [rows, totalRows] = await Promise.all([
    db.query.generations.findMany({
      where,
      orderBy: [desc(generations.createdAt), desc(generations.id)],
      limit: ACTIVITY_PAGE_SIZE,
      offset: (page - 1) * ACTIVITY_PAGE_SIZE,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(generations)
      .where(where),
  ]);
  const total = totalRows[0]?.count ?? 0;
  const refunded = await refundedGenerationIds(rows.map((row) => row.id));

  return {
    entries: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      input: normalizeInput(row.input),
      output: row.output,
      model: row.model,
      costMicros: row.costMicros,
      status: row.status,
      refunded: refunded.has(row.id),
    })),
    page,
    total,
    hasMore: page * ACTIVITY_PAGE_SIZE < total,
  };
}

// Newest first, paginated, every purchase of every user on the product
// (docs/02-ecrans.md › BO-04: "achats"). Never returns a user id, a pack id
// or an idempotency key.
export async function listProductPurchases(productId: string, page: number): Promise<ActivityPage<ActivityPurchase>> {
  await requireAdmin();
  assertValidPage(page, "listProductPurchases");
  assertValidProductId(productId, "listProductPurchases");

  const where = eq(purchases.productId, productId);
  const [rows, totalRows] = await Promise.all([
    db.query.purchases.findMany({
      where,
      orderBy: [desc(purchases.createdAt), desc(purchases.id)],
      limit: ACTIVITY_PAGE_SIZE,
      offset: (page - 1) * ACTIVITY_PAGE_SIZE,
      columns: { id: true, createdAt: true, credits: true, amountCents: true, currency: true },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(purchases)
      .where(where),
  ]);
  const total = totalRows[0]?.count ?? 0;

  return { entries: rows, page, total, hasMore: page * ACTIVITY_PAGE_SIZE < total };
}

// Newest first, paginated, every credit movement of every user on the
// product (docs/02-ecrans.md › BO-04: "mouvements de crédits").
// `packCredits` is the pack's credit count for a `purchase` movement (left
// join to `purchases` on `purchase_id`), `null` for every other reason.
// Never returns a user id or an idempotency key.
export async function listProductCreditMovements(
  productId: string,
  page: number,
): Promise<ActivityPage<ActivityMovement>> {
  await requireAdmin();
  assertValidPage(page, "listProductCreditMovements");
  assertValidProductId(productId, "listProductCreditMovements");

  const where = eq(creditTransactions.productId, productId);
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: creditTransactions.id,
        createdAt: creditTransactions.createdAt,
        delta: creditTransactions.delta,
        reason: creditTransactions.reason,
        packCredits: purchases.credits,
      })
      .from(creditTransactions)
      .leftJoin(purchases, eq(creditTransactions.purchaseId, purchases.id))
      .where(where)
      .orderBy(desc(creditTransactions.createdAt), desc(creditTransactions.id))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(creditTransactions)
      .where(where),
  ]);
  const total = totalRows[0]?.count ?? 0;

  return {
    entries: rows.map((row) => ({ ...row, packCredits: row.packCredits ?? null })),
    page,
    total,
    hasMore: page * ACTIVITY_PAGE_SIZE < total,
  };
}

// 00:00 UTC, `PURCHASE_SUMMARY_DAYS - 1` days ago through now (same window
// as BO-02/BO-03's 30-day range, docs/04-nextjs.md).
function summaryWindowStart(now: Date): Date {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(startOfToday - (PURCHASE_SUMMARY_DAYS - 1) * MS_PER_DAY);
}

// The mockup's "Achats · 30 j" card: a purchase count, its revenue, and a
// breakdown by pack size (plan § "Purchases show the mockup's 30-day
// summary"). `now` is a parameter (plan design decision 8: created after
// requireAdmin(), a request-time API), defaulting to `new Date()` so a real
// caller never has to pass it.
export async function getPurchaseSummary(productId: string, now: Date = new Date()): Promise<PurchaseSummary> {
  await requireAdmin();
  assertValidProductId(productId, "getPurchaseSummary");
  const since = summaryWindowStart(now);

  const rows = await db
    .select({ credits: purchases.credits, amountCents: purchases.amountCents })
    .from(purchases)
    .where(and(eq(purchases.productId, productId), gte(purchases.createdAt, since)));

  const byPackCounts = new Map<number, number>();
  let revenueCents = 0;
  for (const row of rows) {
    revenueCents += row.amountCents;
    byPackCounts.set(row.credits, (byPackCounts.get(row.credits) ?? 0) + 1);
  }
  const byPack = [...byPackCounts.entries()]
    .sort(([creditsA], [creditsB]) => creditsA - creditsB)
    .map(([credits, count]) => ({ credits, count }));

  return { count: rows.length, revenueCents, byPack };
}
