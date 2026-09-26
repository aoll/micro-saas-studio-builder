import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountPurchase } from "@/lib/dal/account";
import type { InvoiceJob } from "@/lib/dal/invoice-jobs";

// SA-09 (specs/SA-09-facture.md): generateInvoices / retryInvoice /
// getInvoiceJobs server actions, plus the internal (non-exported)
// runInvoicePool/processJob they kick off via next/server's after() — same
// mocking boundary and after()-flushing trick as
// checkout/_actions.test.ts, since the real DAL/render bodies
// (lib/dal/invoice-jobs.ts, lib/invoice/render.tsx) are still
// `throw new Error("not implemented")` stubs in this worktree (owned by a
// parallel track, see specs/SA-09-facture.md's Contrat).
// _actions.ts imports "@/lib/env" for BLOB_READ_WRITE_TOKEN; mocked here
// (lib/security.test.ts's own convention) so this unit test never needs a
// real Better Auth / Blob / AI Gateway configuration.
vi.mock("@/lib/env", () => ({ env: { BLOB_READ_WRITE_TOKEN: "test-token" } }));

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const listPurchases = vi.fn();
vi.mock("@/lib/dal/account", () => ({ listPurchases: (...args: unknown[]) => listPurchases(...args) }));

const enqueueInvoiceMonths = vi.fn();
const claimNextInvoiceJob = vi.fn();
const completeInvoiceJob = vi.fn();
const failInvoiceJob = vi.fn();
const retryInvoiceJob = vi.fn();
const listInvoiceJobs = vi.fn();
vi.mock("@/lib/dal/invoice-jobs", () => ({
  MAX_CONCURRENT_INVOICE_JOBS: 2,
  enqueueInvoiceMonths: (...args: unknown[]) => enqueueInvoiceMonths(...args),
  claimNextInvoiceJob: (...args: unknown[]) => claimNextInvoiceJob(...args),
  completeInvoiceJob: (...args: unknown[]) => completeInvoiceJob(...args),
  failInvoiceJob: (...args: unknown[]) => failInvoiceJob(...args),
  retryInvoiceJob: (...args: unknown[]) => retryInvoiceJob(...args),
  listInvoiceJobs: (...args: unknown[]) => listInvoiceJobs(...args),
}));

const renderInvoicePdf = vi.fn();
vi.mock("@/lib/invoice/render", () => ({ renderInvoicePdf: (...args: unknown[]) => renderInvoicePdf(...args) }));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: unknown[]) => put(...args) }));

// next/server's after() just collects tasks (checkout/_actions.test.ts's
// same trick): this unit test never sets up a real request context.
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (task: unknown) => {
      afterCallbacks.push(typeof task === "function" ? (task as () => unknown) : () => task);
    },
  };
});

async function flushAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.splice(0).map((callback) => callback()));
}

afterEach(() => {
  afterCallbacks.length = 0;
  getSession.mockReset();
  getProduct.mockReset();
  listPurchases.mockReset();
  enqueueInvoiceMonths.mockReset();
  claimNextInvoiceJob.mockReset();
  completeInvoiceJob.mockReset();
  failInvoiceJob.mockReset();
  retryInvoiceJob.mockReset();
  listInvoiceJobs.mockReset();
  renderInvoicePdf.mockReset();
  put.mockReset();
  vi.useRealTimers();
});

function currentUser(userId = "user-1", email = "lea@exemple.fr") {
  getSession.mockResolvedValue({ user: { id: userId, email } });
}

const product = {
  id: "product-1",
  version: 1,
  isSeed: true,
  slug: "bio-insta",
  name: "BioInsta",
  status: "test" as const,
  themeId: "theme-1",
  locale: "fr" as const,
  branding: {},
  landing: { headline: "h", subheadline: "s", faq: [], seoTitle: "t", seoDescription: "d" },
  inputs: [{ key: "topic", label: "Topic", type: "text" as const, required: true }],
  generation: { model: "anthropic/claude-haiku", promptTemplate: "hello", outputType: "markdown" as const },
  pricing: {
    freeCreditsOnSignup: 3,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
  },
};

function purchase(overrides: Partial<AccountPurchase> = {}): AccountPurchase {
  return {
    id: "purchase-1",
    createdAt: new Date("2026-06-15T00:00:00Z"),
    credits: 10,
    amountCents: 490,
    currency: "EUR",
    ...overrides,
  };
}

function job(overrides: Partial<InvoiceJob> = {}): InvoiceJob {
  return {
    id: "job-1",
    userId: "user-1",
    productId: "product-1",
    month: "2026-06",
    status: "queued",
    blobUrl: null,
    error: null,
    createdAt: new Date("2026-09-26T00:00:00Z"),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe("generateInvoices", () => {
  it("returns unauthenticated when there is no session, without touching anything else", async () => {
    getSession.mockResolvedValue(null);
    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["2026-06"]);
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(getProduct).not.toHaveBeenCalled();
    expect(enqueueInvoiceMonths).not.toHaveBeenCalled();
  });

  it("returns invalid_request for a malformed slug", async () => {
    currentUser();
    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("Not A Slug!", ["2026-06"]);
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(enqueueInvoiceMonths).not.toHaveBeenCalled();
  });

  it("returns invalid_request for an empty months array", async () => {
    currentUser();
    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", []);
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(enqueueInvoiceMonths).not.toHaveBeenCalled();
  });

  it("returns invalid_request for a malformed month string", async () => {
    currentUser();
    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["June 2026"]);
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(enqueueInvoiceMonths).not.toHaveBeenCalled();
  });

  it("returns invalid_request for an unknown product", async () => {
    currentUser();
    getProduct.mockResolvedValue(null);
    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("unknown-slug", ["2026-06"]);
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(enqueueInvoiceMonths).not.toHaveBeenCalled();
  });

  it("never creates a job for a month without a purchase, even if the client requests it", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job({ month: "2026-06" })]);
    claimNextInvoiceJob.mockResolvedValue(null);

    const { generateInvoices } = await import("./_actions");
    // "2026-07" has no purchase behind it (server-side truth), only "2026-06"
    // does — the client's request for "2026-07" must never reach the DAL.
    const result = await generateInvoices("bio-insta", ["2026-06", "2026-07"]);

    expect(result.ok).toBe(true);
    expect(enqueueInvoiceMonths).toHaveBeenCalledWith({
      userId: "user-1",
      productId: "product-1",
      months: ["2026-06"],
    });
  });

  it("enqueues every requested month that does have a purchase and returns the resulting jobs", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([
      purchase({ createdAt: new Date("2026-06-10T00:00:00Z") }),
      purchase({ id: "purchase-2", createdAt: new Date("2026-07-10T00:00:00Z") }),
    ]);
    const jobs = [job({ id: "job-1", month: "2026-06" }), job({ id: "job-2", month: "2026-07" })];
    enqueueInvoiceMonths.mockResolvedValue(jobs);
    claimNextInvoiceJob.mockResolvedValue(null);

    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["2026-06", "2026-07"]);

    expect(result).toEqual({ ok: true, jobs });
    expect(enqueueInvoiceMonths).toHaveBeenCalledWith({
      userId: "user-1",
      productId: "product-1",
      months: ["2026-06", "2026-07"],
    });
  });

  it("kicks the invoice pool via after() without blocking the response", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job()]);
    claimNextInvoiceJob.mockResolvedValue(null);

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);

    // The pool hasn't run yet: only registered with after(), never awaited
    // inline (docs/04-nextjs.md: never adding latency to the response).
    expect(claimNextInvoiceJob).not.toHaveBeenCalled();
    await flushAfterCallbacks();
    expect(claimNextInvoiceJob).toHaveBeenCalled();
  });

  it("returns failed and never kicks the pool when enqueueInvoiceMonths throws", async () => {
    currentUser();
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["2026-06"]);

    expect(result).toEqual({ ok: false, error: "failed" });
    await flushAfterCallbacks();
    expect(claimNextInvoiceJob).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("generateInvoices — pool concurrency (after() the response)", () => {
  it("spawns MAX_CONCURRENT_INVOICE_JOBS worker loops, each claiming at least once", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job()]);
    claimNextInvoiceJob.mockResolvedValue(null);

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);
    await flushAfterCallbacks();

    // MAX_CONCURRENT_INVOICE_JOBS (mocked to 2): an empty queue still means
    // each of the 2 worker loops calls claimNextInvoiceJob exactly once
    // before returning.
    expect(claimNextInvoiceJob).toHaveBeenCalledTimes(2);
    expect(claimNextInvoiceJob).toHaveBeenCalledWith({ userId: "user-1", productId: "product-1" });
  });

  it("processes a claimed job end to end: renders, uploads to Blob, and completes the job", async () => {
    currentUser("user-1", "lea@exemple.fr");
    getProduct.mockResolvedValue(product);
    const monthPurchases = [purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })];
    listPurchases.mockResolvedValue(monthPurchases);
    enqueueInvoiceMonths.mockResolvedValue([job()]);

    let claimed = false;
    claimNextInvoiceJob.mockImplementation(async () => {
      if (claimed) return null;
      claimed = true;
      return job({ id: "job-1", month: "2026-06" });
    });
    const buffer = Buffer.from("pdf-bytes");
    renderInvoicePdf.mockResolvedValue(buffer);
    put.mockResolvedValue({ url: "https://blob.example/invoices/job-1.pdf" });

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);
    await flushAfterCallbacks();

    expect(renderInvoicePdf).toHaveBeenCalledWith({
      productName: "BioInsta",
      buyerEmail: "lea@exemple.fr",
      month: "2026-06",
      purchases: monthPurchases,
    });
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^invoices\/user-1\/product-1\/[0-9a-f-]{36}\.pdf$/),
      buffer,
      {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
        token: expect.any(String),
      },
    );
    expect(completeInvoiceJob).toHaveBeenCalledWith("job-1", "https://blob.example/invoices/job-1.pdf");
    expect(failInvoiceJob).not.toHaveBeenCalled();
  });

  it("filters purchases down to the job's own month before rendering", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    const junePurchase = purchase({ id: "june", createdAt: new Date("2026-06-05T00:00:00Z") });
    const julyPurchase = purchase({ id: "july", createdAt: new Date("2026-07-05T00:00:00Z") });
    listPurchases.mockResolvedValue([junePurchase, julyPurchase]);
    enqueueInvoiceMonths.mockResolvedValue([job({ month: "2026-06" })]);

    let claimed = false;
    claimNextInvoiceJob.mockImplementation(async () => {
      if (claimed) return null;
      claimed = true;
      return job({ id: "job-1", month: "2026-06" });
    });
    renderInvoicePdf.mockResolvedValue(Buffer.from("pdf"));
    put.mockResolvedValue({ url: "https://blob.example/x.pdf" });

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);
    await flushAfterCallbacks();

    expect(renderInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ purchases: [junePurchase] }));
  });

  it("fails the job with the caught error's message when renderInvoicePdf rejects", async () => {
    currentUser();
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job()]);

    let claimed = false;
    claimNextInvoiceJob.mockImplementation(async () => {
      if (claimed) return null;
      claimed = true;
      return job({ id: "job-1", month: "2026-06" });
    });
    renderInvoicePdf.mockRejectedValue(new Error("moteur PDF indisponible"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);
    await flushAfterCallbacks();

    expect(failInvoiceJob).toHaveBeenCalledWith("job-1", "moteur PDF indisponible");
    expect(completeInvoiceJob).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("fails the job with a clear French timeout message after 15 seconds, without blocking other jobs", async () => {
    vi.useFakeTimers();
    currentUser();
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job()]);

    let claimed = false;
    claimNextInvoiceJob.mockImplementation(async () => {
      if (claimed) return null;
      claimed = true;
      return job({ id: "job-1", month: "2026-06" });
    });
    // Never settles on its own: only the 15s race timer decides the outcome.
    renderInvoicePdf.mockReturnValue(new Promise(() => {}));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);
    // Started but not awaited yet: the pending 15s setTimeout only fires once
    // the fake clock below advances past it.
    const flushed = flushAfterCallbacks();
    await vi.advanceTimersByTimeAsync(15_000);
    await flushed;

    expect(failInvoiceJob).toHaveBeenCalledWith("job-1", expect.stringContaining("15"));
    expect(completeInvoiceJob).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("retryInvoice", () => {
  it("returns unauthenticated when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const { retryInvoice } = await import("./_actions");
    const result = await retryInvoice("bio-insta", "job-1");
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(retryInvoiceJob).not.toHaveBeenCalled();
  });

  it("returns invalid_request for a malformed slug", async () => {
    currentUser();
    const { retryInvoice } = await import("./_actions");
    const result = await retryInvoice("Not A Slug!", randomUUID());
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(retryInvoiceJob).not.toHaveBeenCalled();
  });

  it("returns invalid_request for an unknown product", async () => {
    currentUser();
    getProduct.mockResolvedValue(null);
    const { retryInvoice } = await import("./_actions");
    const result = await retryInvoice("unknown-slug", randomUUID());
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(retryInvoiceJob).not.toHaveBeenCalled();
  });

  it("rejects a job that does not belong to this user's product, without calling retryInvoiceJob (the DAL trusts the caller's ownership check)", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listInvoiceJobs.mockResolvedValue([job({ id: "some-other-job" })]);

    const { retryInvoice } = await import("./_actions");
    const otherJobId = randomUUID();
    const result = await retryInvoice("bio-insta", otherJobId);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(retryInvoiceJob).not.toHaveBeenCalled();
  });

  it("retries an owned failed job and kicks the pool again", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    const jobId = randomUUID();
    listInvoiceJobs.mockResolvedValue([job({ id: jobId, status: "failed" })]);
    retryInvoiceJob.mockResolvedValue(undefined);
    claimNextInvoiceJob.mockResolvedValue(null);

    const { retryInvoice } = await import("./_actions");
    const result = await retryInvoice("bio-insta", jobId);

    expect(result).toEqual({ ok: true });
    expect(retryInvoiceJob).toHaveBeenCalledWith(jobId);
    expect(claimNextInvoiceJob).not.toHaveBeenCalled();
    await flushAfterCallbacks();
    expect(claimNextInvoiceJob).toHaveBeenCalled();
  });
});

describe("getInvoiceJobs", () => {
  it("returns unauthenticated when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const { getInvoiceJobs } = await import("./_actions");
    const result = await getInvoiceJobs("bio-insta");
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(listInvoiceJobs).not.toHaveBeenCalled();
  });

  it("returns invalid_request for an unknown product", async () => {
    currentUser();
    getProduct.mockResolvedValue(null);
    const { getInvoiceJobs } = await import("./_actions");
    const result = await getInvoiceJobs("unknown-slug");
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(listInvoiceJobs).not.toHaveBeenCalled();
  });

  it("returns this user's own jobs for the product", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    const jobs = [job()];
    listInvoiceJobs.mockResolvedValue(jobs);

    const { getInvoiceJobs } = await import("./_actions");
    const result = await getInvoiceJobs("bio-insta");

    expect(result).toEqual({ ok: true, jobs });
    expect(listInvoiceJobs).toHaveBeenCalledWith({ userId: "user-1", productId: "product-1" });
  });
});
