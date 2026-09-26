import "server-only";
import { invoiceJobs } from "@/lib/db/schema";

// Frozen contract (specs/SA-09-facture.md, C0): signatures only, filled in
// by the spec's TDD loop. Every function takes an already-validated userId
// (the caller — a Server Action — re-checks the session first, same
// convention as Debit/Purchase in lib/dal/credits.ts), never derives it
// itself.

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

// Idempotent: re-selecting a month already enqueued (or already done/failed)
// never creates a second row. `months` must already be closed months with at
// least one purchase — the caller (Server Action) filters the offer, this
// function does not re-validate it against `purchases`.
export async function enqueueInvoiceMonths(_params: {
  userId: string;
  productId: string;
  months: string[];
}): Promise<InvoiceJob[]> {
  throw new Error("not implemented");
}

// Atomically: counts this (userId, productId)'s `processing` jobs; if under
// MAX_CONCURRENT_INVOICE_JOBS, flips the oldest `queued` one to `processing`
// and returns it (sets startedAt); otherwise returns null without side
// effects — including when there is simply no `queued` job left. Never
// claims a job for a different (userId, productId) than asked.
export async function claimNextInvoiceJob(_params: { userId: string; productId: string }): Promise<InvoiceJob | null> {
  throw new Error("not implemented");
}

export async function completeInvoiceJob(_jobId: string, _blobUrl: string): Promise<void> {
  throw new Error("not implemented");
}

export async function failInvoiceJob(_jobId: string, _message: string): Promise<void> {
  throw new Error("not implemented");
}

// A `failed` job can be retried: caller checks the job belongs to
// (userId, productId) before calling this (same ownership rule as every
// other function here).
export async function retryInvoiceJob(_jobId: string): Promise<void> {
  throw new Error("not implemented");
}

export async function listInvoiceJobs(_params: { userId: string; productId: string }): Promise<InvoiceJob[]> {
  throw new Error("not implemented");
}
