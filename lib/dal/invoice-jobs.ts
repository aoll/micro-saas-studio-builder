import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoiceJobs } from "@/lib/db/schema";

// Frozen contract (specs/SA-09-facture.md, C0, amended by
// CONTRACT-invoices-queue): every function takes an already-validated
// userId (the caller — a Server Action or the Queues consumer route —
// re-checks the session first, same convention as Debit/Purchase in
// lib/dal/credits.ts), never derives it itself.
//
// claimNextInvoiceJob and MAX_CONCURRENT_INVOICE_JOBS lived here before
// CONTRACT-invoices-queue: a job pool now means a Vercel Queues topic
// invoking app/api/queues/invoices/route.ts directly, so there is no claim
// loop left to serialize — the platform's own consumer-group concurrency
// limit is the pool.

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

// Marks a job `processing`, called by the Queues consumer route at the start
// of a delivery attempt — replaces claimNextInvoiceJob's role now that each
// message already names its own job (no "find the oldest queued one" to do).
// Guarded to `queued`/`processing` so a message redelivered after the job
// already reached a terminal state (`done`, or `failed` and not yet retried
// by the user) is a no-op: the caller must treat a `null` return as "nothing
// to do", never retry the work.
export async function startInvoiceJob(jobId: string): Promise<InvoiceJob | null> {
  const [row] = await db
    .update(invoiceJobs)
    .set({ status: "processing", startedAt: new Date() })
    .where(and(eq(invoiceJobs.id, jobId), inArray(invoiceJobs.status, ["queued", "processing"])))
    .returning();
  return row ?? null;
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
