import { put } from "@vercel/blob";
import { handleCallback, type MessageMetadata } from "@vercel/queue";
import { listPurchases } from "@/lib/dal/account";
import { completeInvoiceJob, failInvoiceJob, startInvoiceJob } from "@/lib/dal/invoice-jobs";
import { env } from "@/lib/env";
import { renderInvoicePdf } from "@/lib/invoice/render";
import { monthKey } from "@/app/(products)/[app]/account/invoices/_components/invoiceable-months";

// CONTRACT-invoices-queue: the push consumer Vercel invokes for the
// `invoices` topic (registered in vercel.json's `experimentalTriggers`).
// Reprises processInvoiceJob's old body from _actions.ts's after()-driven
// pool almost verbatim — the difference is who invokes this and how often:
// Vercel Queues, once per message, at up to the consumer group's own
// concurrency limit, with automatic redelivery on a thrown error instead of
// a hand-rolled claim loop.
export type InvoiceQueueMessage = {
  jobId: string;
  userId: string;
  productId: string;
  month: string; // "YYYY-MM"
  productName: string;
  buyerEmail: string;
};

const RENDER_TIMEOUT_MS = 15_000;

// A message redelivered more times than this is a poison message (a bug, or
// a month that can never succeed): give up and record a definitive failure
// instead of retrying forever. The spec's "acquitté après un nombre borné de
// tentatives" bullet — checked here rather than in the `retry` callback so
// the DB write can simply be awaited like any other step of the handler.
const MAX_INVOICE_JOB_DELIVERIES = 5;

// Exported separately from POST so the test file can call it directly with
// a fake (message, metadata) pair: handleCallback()'s return type is a Web
// Request handler (`(requestOrEvent) => Promise<Response>`), not this
// function's own signature, so it can't be invoked that way in a test.
export async function handleInvoiceMessage(message: InvoiceQueueMessage, metadata: MessageMetadata): Promise<void> {
  const { jobId, userId, productId, month, productName, buyerEmail } = message;

  if (metadata.deliveryCount > MAX_INVOICE_JOB_DELIVERIES) {
    console.error("[invoices] giving up after too many deliveries", jobId, metadata.deliveryCount);
    await failInvoiceJob(jobId, "Échec après plusieurs tentatives");
    return;
  }

  // A redelivery of a message whose job already reached done (or failed,
  // pending a manual retry) has nothing left to do — never reprocess it.
  const job = await startInvoiceJob(jobId);
  if (!job) return;

  try {
    const monthPurchases = (await listPurchases(userId, productId)).filter(
      (purchase) => monthKey(purchase.createdAt) === month,
    );

    const buffer = await Promise.race([
      renderInvoicePdf({ productName, buyerEmail, month, purchases: monthPurchases }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("Délai dépassé (15 s)")), RENDER_TIMEOUT_MS);
      }),
    ]);

    // Pathname keyed by messageId (not random) so a redelivery of the same
    // message overwrites the same blob instead of leaving orphaned copies
    // behind — the spec's idempotency bullet for the upload step.
    const blob = await put(`invoices/${userId}/${productId}/${metadata.messageId}.pdf`, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    await completeInvoiceJob(jobId, blob.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[invoices] job failed", jobId, error);

    // The 15s render timeout is a definitive failure (same UX as before the
    // migration: "Échec" + a manual "Réessayer" button), never redelivered
    // automatically. Any other error (a transient Blob or render hiccup)
    // rethrows so Vercel Queues retries it with its own backoff — the actual
    // benefit this migration was for.
    if (message === "Délai dépassé (15 s)") {
      await failInvoiceJob(jobId, message);
      return;
    }
    throw error;
  }
}

export const POST = handleCallback<InvoiceQueueMessage>(handleInvoiceMessage);
