"use server";

import { send } from "@vercel/queue";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { listPurchases } from "@/lib/dal/account";
import { enqueueInvoiceMonths, listInvoiceJobs, retryInvoiceJob, type InvoiceJob } from "@/lib/dal/invoice-jobs";
import { getProduct } from "@/lib/dal/products";
import { getSession } from "@/lib/dal/session";
import { slugSchema } from "@/lib/schemas/product-config";
import type { InvoiceQueueMessage } from "@/app/api/queues/invoices/route";
import { invoiceableMonths } from "./_components/invoiceable-months";

// SA-09 (specs/SA-09-facture.md) + CONTRACT-invoices-queue: the invoices
// page's Server Actions, following checkout/_actions.ts's shape — session
// first, Zod-parse input, re-derive everything server-side, never trust the
// client, unstable_rethrow before mapping to a typed failure. `months` isn't
// in lib/schemas/** (frozen, out of this spec's Périmètre): validated with a
// local schema instead, same rule ("shared Zod schema"), just not the shared
// module.
//
// The pool itself (claim, render, upload, complete/fail) no longer lives
// here: app/api/queues/invoices/route.ts is now the Vercel Queues consumer
// that does that work, once per message, at the platform's own concurrency
// limit. These actions only ever enqueue — enqueueInvoiceMonths() for the DB
// row, `send()` for the message that gets it actually processed.

const monthStringSchema = z.string().regex(/^\d{4}-\d{2}$/);
const monthsInputSchema = z.array(monthStringSchema).min(1);

export type GenerateInvoicesResult =
  { ok: true; jobs: InvoiceJob[] } | { ok: false; error: "unauthenticated" | "invalid_request" | "failed" };

export type RetryInvoiceResult =
  { ok: true } | { ok: false; error: "unauthenticated" | "invalid_request" | "not_found" | "failed" };

export type InvoiceJobsResult =
  { ok: true; jobs: InvoiceJob[] } | { ok: false; error: "unauthenticated" | "invalid_request" };

// Publishes one Vercel Queues message per job — the actual work (render,
// upload, complete/fail) happens in app/api/queues/invoices/route.ts,
// invoked by Vercel itself. A `send()` that throws for one job (network
// hiccup, auth) is logged and skipped rather than aborting the others: the
// job stays `queued` in the DB and the user can select it again, same as
// any other job that never got picked up.
//
// No `idempotencyKey` here: this function is also how a manual retry
// re-publishes the SAME job.id after a genuine failure, and Queues'
// deduplication window (up to 24h) would silently drop that second message
// if it reused the job id as the key — retry would look like it worked but
// nothing would ever be redelivered. Message-level dedup isn't needed
// anyway: enqueueInvoiceMonths' unique idempotency key and
// startInvoiceJob's status guard already make double-processing impossible
// at the DB layer, and this code never retries a `send()` call itself.
async function enqueueForProcessing(jobs: InvoiceJob[], context: { productName: string; buyerEmail: string }) {
  await Promise.all(
    jobs.map(async (job) => {
      const message: InvoiceQueueMessage = {
        jobId: job.id,
        userId: job.userId,
        productId: job.productId,
        month: job.month,
        productName: context.productName,
        buyerEmail: context.buyerEmail,
      };
      try {
        await send("invoices", message);
      } catch (error) {
        console.error("[invoices] send() failed", job.id, error);
      }
    }),
  );
}

export async function generateInvoices(slug: string, months: string[]): Promise<GenerateInvoicesResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const parsedSlug = slugSchema.safeParse(slug);
  const parsedMonths = monthsInputSchema.safeParse(months);
  if (!parsedSlug.success || !parsedMonths.success) return { ok: false, error: "invalid_request" };

  const product = await getProduct(parsedSlug.data);
  if (!product) return { ok: false, error: "invalid_request" };

  const userId = session.user.id;

  try {
    // Never trust the client's month list (CLAUDE.md, spec's explicit
    // bullet "un job ne peut jamais être créé pour un mois sans achat"):
    // re-derive the real invoiceable months from this user's own purchases
    // and filter the request down to that set before touching the DAL.
    const purchases = await listPurchases(userId, product.id);
    const eligibleMonths = new Set(invoiceableMonths(purchases, new Date()));
    const validMonths = parsedMonths.data.filter((month) => eligibleMonths.has(month));

    const jobs = await enqueueInvoiceMonths({ userId, productId: product.id, months: validMonths });

    // Fire-and-forget (docs/04-nextjs.md, checkout/_actions.ts's own
    // tracking call): the client starts polling getInvoiceJobs right after
    // this action returns, it never awaits the queue itself.
    after(() => enqueueForProcessing(jobs, { productName: product.name, buyerEmail: session.user.email }));

    return { ok: true, jobs };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[invoices] generateInvoices failed", error);
    return { ok: false, error: "failed" };
  }
}

export async function retryInvoice(slug: string, jobId: string): Promise<RetryInvoiceResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const parsedSlug = slugSchema.safeParse(slug);
  const parsedJobId = z.uuid().safeParse(jobId);
  if (!parsedSlug.success || !parsedJobId.success) return { ok: false, error: "invalid_request" };

  const product = await getProduct(parsedSlug.data);
  if (!product) return { ok: false, error: "invalid_request" };

  const userId = session.user.id;

  try {
    // lib/dal/invoice-jobs.ts's own doc comment: retryInvoiceJob does not
    // check ownership itself, the caller must — listInvoiceJobs is already
    // scoped to (userId, productId), so a jobId absent from it either
    // belongs to someone else or to another product.
    const jobs = await listInvoiceJobs({ userId, productId: product.id });
    const job = jobs.find((candidate) => candidate.id === parsedJobId.data);
    if (!job) return { ok: false, error: "not_found" };

    await retryInvoiceJob(job.id);

    // Re-queued in the DB, but Vercel Queues has no memory of it — publish a
    // fresh message the same way generateInvoices does (spec: "redébloque un
    // slot pour lui").
    after(() => enqueueForProcessing([job], { productName: product.name, buyerEmail: session.user.email }));

    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[invoices] retryInvoice failed", error);
    return { ok: false, error: "failed" };
  }
}

export async function getInvoiceJobs(slug: string): Promise<InvoiceJobsResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const parsedSlug = slugSchema.safeParse(slug);
  if (!parsedSlug.success) return { ok: false, error: "invalid_request" };

  const product = await getProduct(parsedSlug.data);
  if (!product) return { ok: false, error: "invalid_request" };

  const jobs = await listInvoiceJobs({ userId: session.user.id, productId: product.id });
  return { ok: true, jobs };
}
