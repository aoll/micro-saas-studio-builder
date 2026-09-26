import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { invoiceJobs, products, themes } from "@/lib/db/schema";

// Real Postgres, not mocked (lib/dal/credits.test.ts's pattern): this DAL
// takes an already-validated userId and never checks the session itself
// (invoice-jobs.ts's doc comment — the caller, a Server Action, re-checks
// the session first), so there's nothing to mock here.

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];

async function createUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name: "Invoice test user", email: `${id}@invoice.test`, emailVerified: true });
  createdUserIds.push(id);
  return id;
}

// A private test product, just enough to satisfy invoice_jobs' FK (no
// product_versions row needed: invoice-jobs.ts never reads the product's
// config, only its id).
async function createProduct(): Promise<{ id: string }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const admin = await db.query.users.findFirst({ where: eq(users.role, "admin") });
  const slug = `invoice-test-${randomUUID()}`;
  const [product] = await db
    .insert(products)
    .values({ slug, status: "test", themeId: theme!.id, currentVersion: 1, locale: "fr", createdBy: admin!.id })
    .returning({ id: products.id });
  createdProductIds.push(product!.id);
  return { id: product!.id };
}

async function jobsFor(userId: string, productId: string) {
  return db.query.invoiceJobs.findMany({
    where: and(eq(invoiceJobs.userId, userId), eq(invoiceJobs.productId, productId)),
  });
}

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(invoiceJobs).where(eq(invoiceJobs.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }
  for (const id of createdUserIds) {
    await db.delete(invoiceJobs).where(eq(invoiceJobs.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("enqueueInvoiceMonths", () => {
  it("creates one queued job per requested month", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;

    const { enqueueInvoiceMonths } = await import("./invoice-jobs");
    const result = await enqueueInvoiceMonths({ userId, productId, months: ["2024-01", "2024-02"] });

    expect(result).toHaveLength(2);
    expect(result.map((job) => job.month).sort()).toEqual(["2024-01", "2024-02"]);
    for (const job of result) {
      expect(job).toMatchObject({ userId, productId, status: "queued", blobUrl: null, error: null, startedAt: null });
    }
  });

  it("is idempotent: replaying the same months creates no duplicate row", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;

    const { enqueueInvoiceMonths } = await import("./invoice-jobs");
    const first = await enqueueInvoiceMonths({ userId, productId, months: ["2024-03"] });
    const second = await enqueueInvoiceMonths({ userId, productId, months: ["2024-03"] });

    expect(second).toHaveLength(1);
    expect(second[0]!.id).toBe(first[0]!.id);
    const rows = await jobsFor(userId, productId);
    expect(rows).toHaveLength(1);
  });

  it("returns rows for exactly the requested months, not others already enqueued", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;

    const { enqueueInvoiceMonths } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-04"] });
    const result = await enqueueInvoiceMonths({ userId, productId, months: ["2024-05"] });

    expect(result).toHaveLength(1);
    expect(result[0]!.month).toBe("2024-05");
  });

  it("returns an empty array for an empty months selection", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;

    const { enqueueInvoiceMonths } = await import("./invoice-jobs");
    expect(await enqueueInvoiceMonths({ userId, productId, months: [] })).toEqual([]);
  });

  it("does not create a duplicate when the same month is requested twice in one call", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;

    const { enqueueInvoiceMonths } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-06", "2024-06"] });

    const rows = await jobsFor(userId, productId);
    expect(rows).toHaveLength(1);
  });
});

describe("claimNextInvoiceJob", () => {
  it("returns null when there is no queued job", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;

    const { claimNextInvoiceJob } = await import("./invoice-jobs");
    expect(await claimNextInvoiceJob({ userId, productId })).toBeNull();
  });

  it("claims the oldest queued job, setting status processing and startedAt", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob } = await import("./invoice-jobs");
    const [older] = await enqueueInvoiceMonths({ userId, productId, months: ["2024-07"] });
    // Force a deterministic ordering: back-date the first job so it is
    // unambiguously the oldest queued one.
    await db
      .update(invoiceJobs)
      .set({ createdAt: new Date(Date.now() - 60_000) })
      .where(eq(invoiceJobs.id, older!.id));
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-08"] });

    const claimed = await claimNextInvoiceJob({ userId, productId });
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(older!.id);
    expect(claimed!.status).toBe("processing");
    expect(claimed!.startedAt).not.toBeNull();
  });

  it("returns null (no side effects) once already at MAX_CONCURRENT_INVOICE_JOBS processing jobs", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob, MAX_CONCURRENT_INVOICE_JOBS } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({
      userId,
      productId,
      months: Array.from({ length: MAX_CONCURRENT_INVOICE_JOBS + 1 }, (_unused, index) => `2024-0${index + 1}`),
    });

    for (let i = 0; i < MAX_CONCURRENT_INVOICE_JOBS; i++) {
      const claimed = await claimNextInvoiceJob({ userId, productId });
      expect(claimed).not.toBeNull();
    }

    const extra = await claimNextInvoiceJob({ userId, productId });
    expect(extra).toBeNull();

    const rows = await jobsFor(userId, productId);
    expect(rows.filter((job) => job.status === "queued")).toHaveLength(1);
    expect(rows.filter((job) => job.status === "processing")).toHaveLength(MAX_CONCURRENT_INVOICE_JOBS);
  });

  it("never claims a job for a different (userId, productId) pair", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const otherUserId = await createUser();
    const otherProductId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-09"] });
    await enqueueInvoiceMonths({ userId: otherUserId, productId: otherProductId, months: ["2024-09"] });

    const claimed = await claimNextInvoiceJob({ userId, productId });
    expect(claimed).not.toBeNull();
    expect(claimed).toMatchObject({ userId, productId });

    const otherRows = await jobsFor(otherUserId, otherProductId);
    expect(otherRows).toHaveLength(1);
    expect(otherRows[0]!.status).toBe("queued");
  });

  it("concurrency: parallel claims over more queued jobs than the cap never exceed the cap", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob, MAX_CONCURRENT_INVOICE_JOBS } = await import("./invoice-jobs");
    const monthCount = MAX_CONCURRENT_INVOICE_JOBS + 3;
    await enqueueInvoiceMonths({
      userId,
      productId,
      months: Array.from({ length: monthCount }, (_unused, index) => `2025-${String(index + 1).padStart(2, "0")}`),
    });

    const results = await Promise.all(
      Array.from({ length: monthCount }, () => claimNextInvoiceJob({ userId, productId })),
    );

    const claimedCount = results.filter((result) => result !== null).length;
    expect(claimedCount).toBe(MAX_CONCURRENT_INVOICE_JOBS);

    const rows = await jobsFor(userId, productId);
    expect(rows.filter((job) => job.status === "processing")).toHaveLength(MAX_CONCURRENT_INVOICE_JOBS);
  });
});

describe("completeInvoiceJob", () => {
  it("marks a job done with the blob url and finishedAt set", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob, completeInvoiceJob } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-10"] });
    const claimed = await claimNextInvoiceJob({ userId, productId });

    await completeInvoiceJob(claimed!.id, "https://blob.example/invoice.pdf");

    const row = await db.query.invoiceJobs.findFirst({ where: eq(invoiceJobs.id, claimed!.id) });
    expect(row).toMatchObject({ status: "done", blobUrl: "https://blob.example/invoice.pdf" });
    expect(row!.finishedAt).not.toBeNull();
  });
});

describe("failInvoiceJob", () => {
  it("marks a job failed with the error message and finishedAt set", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob, failInvoiceJob } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-11"] });
    const claimed = await claimNextInvoiceJob({ userId, productId });

    await failInvoiceJob(claimed!.id, "timeout after 15s");

    const row = await db.query.invoiceJobs.findFirst({ where: eq(invoiceJobs.id, claimed!.id) });
    expect(row).toMatchObject({ status: "failed", error: "timeout after 15s" });
    expect(row!.finishedAt).not.toBeNull();
  });
});

describe("retryInvoiceJob", () => {
  it("resets a failed job back to queued, clearing error/startedAt/finishedAt", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, claimNextInvoiceJob, failInvoiceJob, retryInvoiceJob } =
      await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2024-12"] });
    const claimed = await claimNextInvoiceJob({ userId, productId });
    await failInvoiceJob(claimed!.id, "boom");

    await retryInvoiceJob(claimed!.id);

    const row = await db.query.invoiceJobs.findFirst({ where: eq(invoiceJobs.id, claimed!.id) });
    expect(row).toMatchObject({ status: "queued", error: null, startedAt: null, finishedAt: null });
  });

  it("is a no-op on a job that isn't failed", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, retryInvoiceJob } = await import("./invoice-jobs");
    const [job] = await enqueueInvoiceMonths({ userId, productId, months: ["2025-11"] });

    await retryInvoiceJob(job!.id);

    const row = await db.query.invoiceJobs.findFirst({ where: eq(invoiceJobs.id, job!.id) });
    expect(row).toMatchObject({ status: "queued" });
  });
});

describe("listInvoiceJobs", () => {
  it("lists all jobs for a (userId, productId) pair", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { enqueueInvoiceMonths, listInvoiceJobs } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2025-01", "2025-02"] });

    const rows = await listInvoiceJobs({ userId, productId });
    expect(rows.map((job) => job.month).sort()).toEqual(["2025-01", "2025-02"]);
  });

  it("does not list another user's or another product's jobs", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const otherUserId = await createUser();
    const otherProductId = (await createProduct()).id;
    const { enqueueInvoiceMonths, listInvoiceJobs } = await import("./invoice-jobs");
    await enqueueInvoiceMonths({ userId, productId, months: ["2025-03"] });
    await enqueueInvoiceMonths({ userId: otherUserId, productId: otherProductId, months: ["2025-03"] });

    const rows = await listInvoiceJobs({ userId, productId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId, productId });
  });

  it("returns an empty list when there is no job for that pair", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const { listInvoiceJobs } = await import("./invoice-jobs");

    expect(await listInvoiceJobs({ userId, productId })).toEqual([]);
  });
});
