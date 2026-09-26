"use server";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { listPurchases } from "@/lib/dal/account";
import {
  claimNextInvoiceJob,
  completeInvoiceJob,
  enqueueInvoiceMonths,
  failInvoiceJob,
  listInvoiceJobs,
  MAX_CONCURRENT_INVOICE_JOBS,
  retryInvoiceJob,
  type InvoiceJob,
} from "@/lib/dal/invoice-jobs";
import { renderInvoicePdf } from "@/lib/invoice/render";
import { getProduct } from "@/lib/dal/products";
import { getSession } from "@/lib/dal/session";
import { env } from "@/lib/env";
import { slugSchema } from "@/lib/schemas/product-config";
import { invoiceableMonths, monthKey } from "./_components/invoiceable-months";

// SA-09 (specs/SA-09-facture.md): the invoices page's Server Actions,
// following checkout/_actions.ts's shape — session first, Zod-parse input,
// re-derive everything server-side, never trust the client, unstable_rethrow
// before mapping to a typed failure. `months` isn't in lib/schemas/**
// (frozen, out of this spec's Périmètre): validated with a local schema
// instead, same rule ("shared Zod schema"), just not the shared module.
const RENDER_TIMEOUT_MS = 15_000;

const monthStringSchema = z.string().regex(/^\d{4}-\d{2}$/);
const monthsInputSchema = z.array(monthStringSchema).min(1);

export type GenerateInvoicesResult =
  { ok: true; jobs: InvoiceJob[] } | { ok: false; error: "unauthenticated" | "invalid_request" | "failed" };

export type RetryInvoiceResult =
  { ok: true } | { ok: false; error: "unauthenticated" | "invalid_request" | "not_found" | "failed" };

export type InvoiceJobsResult =
  { ok: true; jobs: InvoiceJob[] } | { ok: false; error: "unauthenticated" | "invalid_request" };

type PoolContext = { userId: string; productId: string; productName: string; buyerEmail: string };

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
    // this action returns, it never awaits the pool itself.
    after(() =>
      runInvoicePool({ userId, productId: product.id, productName: product.name, buyerEmail: session.user.email }),
    );

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

    // A slot may now be claimable again (spec: "redébloque un slot pour
    // lui"): kick the pool the same way generateInvoices does.
    after(() =>
      runInvoicePool({ userId, productId: product.id, productName: product.name, buyerEmail: session.user.email }),
    );

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

// Spawns exactly MAX_CONCURRENT_INVOICE_JOBS concurrent worker loops
// (lib/dal/invoice-jobs.ts: "one source of truth so the two never drift
// apart" — claimNextInvoiceJob enforces the same constant on its side).
async function runInvoicePool(context: PoolContext): Promise<void> {
  await Promise.all(Array.from({ length: MAX_CONCURRENT_INVOICE_JOBS }, () => runInvoiceWorker(context)));
}

async function runInvoiceWorker(context: PoolContext): Promise<void> {
  for (;;) {
    const job = await claimNextInvoiceJob({ userId: context.userId, productId: context.productId });
    if (!job) return;
    await processInvoiceJob(job, context);
  }
}

async function processInvoiceJob(job: InvoiceJob, context: Pick<PoolContext, "productName" | "buyerEmail">) {
  try {
    const monthPurchases = (await listPurchases(job.userId, job.productId)).filter(
      (purchase) => monthKey(purchase.createdAt) === job.month,
    );

    const buffer = await Promise.race([
      renderInvoicePdf({
        productName: context.productName,
        buyerEmail: context.buyerEmail,
        month: job.month,
        purchases: monthPurchases,
      }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("Délai dépassé (15 s)")), RENDER_TIMEOUT_MS);
      }),
    ]);

    // Vercel Blob upload convention (app/(backoffice)/admin/products/_actions.ts's
    // uploadLogo): random pathname and filename, never a client-supplied one.
    const blob = await put(`invoices/${job.userId}/${job.productId}/${randomUUID()}.pdf`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/pdf",
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    await completeInvoiceJob(job.id, blob.url);
  } catch (error) {
    unstable_rethrow(error);
    // A timeout or render/upload failure never bubbles up: it only ever
    // fails this one job, the other workers of the pool keep running
    // (spec: "sans bloquer ni faire échouer les autres jobs du pool").
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[invoices] job failed", job.id, error);
    await failInvoiceJob(job.id, message);
  }
}
