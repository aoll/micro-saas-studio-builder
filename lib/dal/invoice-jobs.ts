import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoiceJobs } from "@/lib/db/schema";

// Frozen contract (specs/SA-09-facture.md, C0): signatures only, filled in
// by the spec's TDD loop. Every function takes an already-validated userId
// (the caller — a Server Action — re-checks the session first, same
// convention as Debit/Purchase in lib/dal/credits.ts), never derives it
// itself.

// Shared by claimNextInvoiceJob (enforces it) and the caller that drives the
// pool (must run this many concurrent worker loops for jobs to actually
// process in parallel, not just be allowed to) — one source of truth so the
// two never drift apart.
export const MAX_CONCURRENT_INVOICE_JOBS = 2;

export type InvoiceJobStatus = (typeof invoiceJobs.status.enumValues)[number];

export type InvoiceJob = {
  id: string;
  userId: string;
  productId: string;
  month: string; // "YYYY-MM"
  status: InvoiceJobStatus;
  blobUrl: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

// Derived deterministically from (userId, productId, month) — same idiom as
// credits.ts's `debit:`/`purchase:`/`signup_bonus:` namespaced keys — so
// replaying the same month selection is naturally idempotent via
// `onConflictDoNothing` on the unique column, never a pre-check-then-insert
// race.
function idempotencyKeyFor(userId: string, productId: string, month: string): string {
  return `invoice:${userId}:${productId}:${month}`;
}

// Idempotent: re-selecting a month already enqueued (or already done/failed)
// never creates a second row. `months` must already be closed months with at
// least one purchase — the caller (Server Action) filters the offer, this
// function does not re-validate it against `purchases`.
export async function enqueueInvoiceMonths({
  userId,
  productId,
  months,
}: {
  userId: string;
  productId: string;
  months: string[];
}): Promise<InvoiceJob[]> {
  if (months.length === 0) return [];

  await db
    .insert(invoiceJobs)
    .values(
      months.map((month) => ({
        userId,
        productId,
        month,
        idempotencyKey: idempotencyKeyFor(userId, productId, month),
      })),
    )
    .onConflictDoNothing({ target: invoiceJobs.idempotencyKey });

  const uniqueMonths = [...new Set(months)];
  return db.query.invoiceJobs.findMany({
    where: and(
      eq(invoiceJobs.userId, userId),
      eq(invoiceJobs.productId, productId),
      inArray(invoiceJobs.month, uniqueMonths),
    ),
    orderBy: [asc(invoiceJobs.month)],
  });
}

// Atomically: counts this (userId, productId)'s `processing` jobs; if under
// MAX_CONCURRENT_INVOICE_JOBS, flips the oldest `queued` one to `processing`
// and returns it (sets startedAt); otherwise returns null without side
// effects — including when there is simply no `queued` job left. Never
// claims a job for a different (userId, productId) than asked.
//
// Concurrency: a naive "select count, then update if under the cap" races
// under read-committed — two concurrent callers can both read a count under
// the cap before either commits, over-claiming past it. A Postgres advisory
// transaction lock scoped to this (userId, productId) pair (same idiom as
// lib/dal/generations.ts's recordAnonymousGeneration and lib/dal/events.ts's
// insertDeduped) serializes every claim for that pair, so the count-then-
// claim below is effectively atomic across concurrent worker loops.
export async function claimNextInvoiceJob({
  userId,
  productId,
}: {
  userId: string;
  productId: string;
}): Promise<InvoiceJob | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`invoice-pool:${userId}:${productId}`}, 0))`);

    const [processingRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(invoiceJobs)
      .where(
        and(eq(invoiceJobs.userId, userId), eq(invoiceJobs.productId, productId), eq(invoiceJobs.status, "processing")),
      );
    if ((processingRow?.count ?? 0) >= MAX_CONCURRENT_INVOICE_JOBS) return null;

    const next = await tx.query.invoiceJobs.findFirst({
      where: and(
        eq(invoiceJobs.userId, userId),
        eq(invoiceJobs.productId, productId),
        eq(invoiceJobs.status, "queued"),
      ),
      orderBy: [asc(invoiceJobs.createdAt)],
    });
    if (!next) return null;

    const [claimed] = await tx
      .update(invoiceJobs)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(invoiceJobs.id, next.id))
      .returning();
    return claimed ?? null;
  });
}

export async function completeInvoiceJob(jobId: string, blobUrl: string): Promise<void> {
  await db
    .update(invoiceJobs)
    .set({ status: "done", blobUrl, finishedAt: new Date() })
    .where(eq(invoiceJobs.id, jobId));
}

export async function failInvoiceJob(jobId: string, message: string): Promise<void> {
  await db
    .update(invoiceJobs)
    .set({ status: "failed", error: message, finishedAt: new Date() })
    .where(eq(invoiceJobs.id, jobId));
}

// A `failed` job can be retried: caller checks the job belongs to
// (userId, productId) before calling this (same ownership rule as every
// other function here). The `WHERE status = 'failed'` guard (same defensive
// style as debit()'s balance check in lib/dal/credits.ts) makes calling this
// on a non-failed job a no-op instead of resetting a job mid-flight.
export async function retryInvoiceJob(jobId: string): Promise<void> {
  await db
    .update(invoiceJobs)
    .set({ status: "queued", error: null, startedAt: null, finishedAt: null })
    .where(and(eq(invoiceJobs.id, jobId), eq(invoiceJobs.status, "failed")));
}

export async function listInvoiceJobs({
  userId,
  productId,
}: {
  userId: string;
  productId: string;
}): Promise<InvoiceJob[]> {
  return db.query.invoiceJobs.findMany({
    where: and(eq(invoiceJobs.userId, userId), eq(invoiceJobs.productId, productId)),
    orderBy: [asc(invoiceJobs.month)],
  });
}
