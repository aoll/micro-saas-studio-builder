import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountPurchase } from "@/lib/dal/account";
import type { InvoiceJob } from "@/lib/dal/invoice-jobs";

// SA-09 (specs/SA-09-facture.md) + CONTRACT-invoices-queue: generateInvoices
// / retryInvoice / getInvoiceJobs Server Actions. The actual pool (claim,
// render, upload, complete/fail) lives in app/api/queues/invoices/route.ts
// now, invoked by Vercel Queues — these actions only enqueue the DB row and
// publish a message, both mocked at the module boundary here, same trick as
// checkout/_actions.test.ts for after().
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const listPurchases = vi.fn();
vi.mock("@/lib/dal/account", () => ({ listPurchases: (...args: unknown[]) => listPurchases(...args) }));

const enqueueInvoiceMonths = vi.fn();
const retryInvoiceJob = vi.fn();
const listInvoiceJobs = vi.fn();
vi.mock("@/lib/dal/invoice-jobs", () => ({
  enqueueInvoiceMonths: (...args: unknown[]) => enqueueInvoiceMonths(...args),
  retryInvoiceJob: (...args: unknown[]) => retryInvoiceJob(...args),
  listInvoiceJobs: (...args: unknown[]) => listInvoiceJobs(...args),
}));

const send = vi.fn();
vi.mock("@vercel/queue", () => ({ send: (...args: unknown[]) => send(...args) }));

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
  retryInvoiceJob.mockReset();
  listInvoiceJobs.mockReset();
  send.mockReset();
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

    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["2026-06", "2026-07"]);

    expect(result).toEqual({ ok: true, jobs });
    expect(enqueueInvoiceMonths).toHaveBeenCalledWith({
      userId: "user-1",
      productId: "product-1",
      months: ["2026-06", "2026-07"],
    });
  });

  it("publishes one Vercel Queues message per job via after(), without blocking the response", async () => {
    currentUser("user-1", "lea@exemple.fr");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    const jobs = [job({ id: "job-1", month: "2026-06" })];
    enqueueInvoiceMonths.mockResolvedValue(jobs);

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);

    // Registered with after(), never awaited inline (docs/04-nextjs.md:
    // never adding latency to the response).
    expect(send).not.toHaveBeenCalled();
    await flushAfterCallbacks();
    expect(send).toHaveBeenCalledWith("invoices", {
      jobId: "job-1",
      userId: "user-1",
      productId: "product-1",
      month: "2026-06",
      productName: "BioInsta",
      buyerEmail: "lea@exemple.fr",
    });
  });

  it("publishes one message per job when several months are enqueued at once", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([
      purchase({ createdAt: new Date("2026-06-10T00:00:00Z") }),
      purchase({ id: "purchase-2", createdAt: new Date("2026-07-10T00:00:00Z") }),
    ]);
    const jobs = [job({ id: "job-1", month: "2026-06" }), job({ id: "job-2", month: "2026-07" })];
    enqueueInvoiceMonths.mockResolvedValue(jobs);

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06", "2026-07"]);
    await flushAfterCallbacks();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("never sets an idempotencyKey on send() — reusing job.id would silently drop a later manual retry", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job({ id: "job-1", month: "2026-06" })]);

    const { generateInvoices } = await import("./_actions");
    await generateInvoices("bio-insta", ["2026-06"]);
    await flushAfterCallbacks();

    expect(send).toHaveBeenCalledWith("invoices", expect.any(Object));
    expect(send.mock.calls[0]).toHaveLength(2);
  });

  it("logs and continues when send() throws for one job, without touching the DB job status", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockResolvedValue([job({ id: "job-1" })]);
    send.mockRejectedValue(new Error("network down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["2026-06"]);
    await flushAfterCallbacks();

    expect(result.ok).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns failed and never publishes when enqueueInvoiceMonths throws", async () => {
    currentUser();
    getProduct.mockResolvedValue(product);
    listPurchases.mockResolvedValue([purchase({ createdAt: new Date("2026-06-10T00:00:00Z") })]);
    enqueueInvoiceMonths.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { generateInvoices } = await import("./_actions");
    const result = await generateInvoices("bio-insta", ["2026-06"]);

    expect(result).toEqual({ ok: false, error: "failed" });
    await flushAfterCallbacks();
    expect(send).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
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

  it("retries an owned failed job and publishes a fresh message for it", async () => {
    currentUser("user-1", "lea@exemple.fr");
    getProduct.mockResolvedValue(product);
    const jobId = randomUUID();
    listInvoiceJobs.mockResolvedValue([job({ id: jobId, month: "2026-06", status: "failed" })]);
    retryInvoiceJob.mockResolvedValue(undefined);

    const { retryInvoice } = await import("./_actions");
    const result = await retryInvoice("bio-insta", jobId);

    expect(result).toEqual({ ok: true });
    expect(retryInvoiceJob).toHaveBeenCalledWith(jobId);
    expect(send).not.toHaveBeenCalled();
    await flushAfterCallbacks();
    expect(send).toHaveBeenCalledWith("invoices", {
      jobId,
      userId: "user-1",
      productId: "product-1",
      month: "2026-06",
      productName: "BioInsta",
      buyerEmail: "lea@exemple.fr",
    });
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
