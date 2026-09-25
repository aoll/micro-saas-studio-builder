import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { events, generations, productVersions, products, purchases, themes } from "@/lib/db/schema";
import { users } from "@/lib/db/auth-schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { toProductMetrics, type PortfolioRow } from "./metrics";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));
// Task 8 also calls the real `getThresholds` (./thresholds), which is `"use cache"`: this
// mock lets it run outside a `cacheComponents` request (docs/09 test pattern).
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

afterEach(() => {
  requireAdmin.mockReset();
});

async function anyUserId(): Promise<string> {
  const row = await db.query.users.findFirst();
  return row!.id;
}

/**
 * Inserts `count` throwaway, distinct `users` rows and returns their ids — for `signup`,
 * `credits_exhausted` and `purchase` events, which (QA1-P1-Q5, D1) are always identified by
 * `user_id` in production (`track()` requires a session for all three), never `anonymous_id`.
 * Caller cleans them up (`db.delete(users).where(inArray(users.id, ids))`).
 */
async function distinctUserIds(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => randomUUID());
  if (ids.length === 0) return ids;
  await db.insert(users).values(ids.map((id) => ({ id, name: `Test user ${id}`, email: `${id}@example.test` })));
  return ids;
}

async function editorialThemeId(): Promise<string> {
  const row = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  return row!.id;
}

// A full, schema-valid config (mirrors lib/dal/product-editor.test.ts's
// buildConfig()): getPortfolioMetrics's SQL only ever reads `name` and
// `pricing.costPerGeneration` from it, but a schema-invalid config would
// break any test file whose `listProducts()` runs concurrently against
// this shared DB (it Zod-parses every product's config) — reproduced with
// products.test.ts and events.test.ts. Only `name` and `costPerGeneration`
// vary per test.
function buildValidConfig(
  slug: string,
  themeId: string,
  overrides: { name?: string; costPerGeneration?: number } = {},
): ProductConfig {
  return {
    slug,
    name: overrides.name ?? "Metrics test product",
    status: "test",
    themeId,
    locale: "fr",
    branding: {},
    landing: {
      headline: "Headline",
      subheadline: "Subheadline",
      faq: [],
      seoTitle: "Title",
      seoDescription: "Description",
    },
    inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
    generation: {
      model: "anthropic/claude-haiku-4.5",
      promptTemplate: "Write about {{topic}}",
      outputType: "markdown",
    },
    pricing: {
      freeCreditsOnSignup: 3,
      anonymousFreeGenerations: 1,
      costPerGeneration: overrides.costPerGeneration ?? 1,
      packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
    },
  };
}

/** A throwaway product + its (schema-valid) config, cleaned up by the caller. */
async function createTempProduct(
  overrides: { name?: string; costPerGeneration?: number } = {},
  opts: { status?: "test" | "learn" | "scale" | "killed" } = {},
): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `metrics-${randomUUID()}`;
  const owner = await anyUserId();
  const themeId = await editorialThemeId();
  await db.insert(products).values({
    id,
    slug,
    themeId,
    currentVersion: 1,
    locale: "fr",
    createdBy: owner,
    status: opts.status ?? "test",
  });
  await db
    .insert(productVersions)
    .values({ productId: id, version: 1, config: buildValidConfig(slug, themeId, overrides), createdBy: owner });
  return { id, slug };
}

async function cleanupProduct(id: string): Promise<void> {
  await db.delete(purchases).where(eq(purchases.productId, id));
  await db.delete(generations).where(eq(generations.productId, id));
  await db.delete(events).where(eq(events.productId, id));
  await db.delete(productVersions).where(eq(productVersions.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

// Pure mapping (no DB, no session mock): restores the coverage commit
// 62927a3 dropped when it removed the "empty config" DB test (specs/
// BO-02-portefeuille.md review round). That commit's claim that the
// coalesce-to-slug and null-costPerGeneration branches "stay covered
// indirectly" was wrong — neither was exercised by any other test.
function baseRow(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    product_id: "p1",
    slug: "my-slug",
    name: "My Product",
    status: "test",
    visits: 100,
    first_generations: 10,
    signups: 10,
    credits_exhausted: 2,
    purchases: 1,
    generations: 5,
    revenue_cents: 1000,
    ai_cost_micros: 2000,
    buyers: 2,
    credits_sold: 20,
    cost_per_generation: 1,
    ...overrides,
  };
}

describe("toProductMetrics (pure row mapping)", () => {
  it("falls back to slug when the config has no name", () => {
    const metrics = toProductMetrics(baseRow({ name: null, slug: "my-slug" }));
    expect(metrics.name).toBe("my-slug");
  });

  it("keeps the config's name when it is present", () => {
    const metrics = toProductMetrics(baseRow({ name: "Real Name", slug: "my-slug" }));
    expect(metrics.name).toBe("Real Name");
  });

  it("returns a null margin when the config has no costPerGeneration, even with credits sold and generations", () => {
    const metrics = toProductMetrics(baseRow({ cost_per_generation: null, credits_sold: 20, generations: 5 }));
    expect(metrics.marginPerGenerationMicros).toBeNull();
  });

  it("returns a null margin when no credits were sold", () => {
    const metrics = toProductMetrics(baseRow({ credits_sold: 0 }));
    expect(metrics.marginPerGenerationMicros).toBeNull();
  });

  it("returns a null margin when there is no succeeded generation", () => {
    const metrics = toProductMetrics(baseRow({ generations: 0 }));
    expect(metrics.marginPerGenerationMicros).toBeNull();
  });

  it("computes a margin when credits sold, generations and costPerGeneration are all present", () => {
    const metrics = toProductMetrics(
      baseRow({ revenue_cents: 2470, credits_sold: 70, cost_per_generation: 1, ai_cost_micros: 12000, generations: 3 }),
    );
    expect(metrics.marginPerGenerationMicros).toBe(Math.round((2470 * 10_000) / 70) - 4000);
  });

  it("returns a null conversion rate when there are no signups", () => {
    const metrics = toProductMetrics(baseRow({ signups: 0, buyers: 0 }));
    expect(metrics.signupToPurchaseRate).toBeNull();
  });

  it("converts string bigint results (revenue_cents, ai_cost_micros) to numbers", () => {
    const metrics = toProductMetrics(baseRow({ revenue_cents: "1000", ai_cost_micros: "2000" }));
    expect(metrics.revenueCents).toBe(1000);
    expect(metrics.aiCostMicros).toBe(2000);
  });
});

describe("getPortfolioMetrics", () => {
  it("requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { getPortfolioMetrics } = await import("./metrics");
    await expect(getPortfolioMetrics({ days: 30 })).rejects.toThrow("redirect:/admin/login");
  });

  // Task 5 — SQL counts, from `events` and `generations`, real DB
  describe("SQL aggregation", () => {
    it("counts events and succeeded generations, and reads name/slug/status for an active product", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id, slug } = await createTempProduct({ name: "Metrics P", costPerGeneration: 1 }, { status: "learn" });

      // QA1-P1-Q5 (D1): signup, credits_exhausted and purchase are always identified by a real,
      // distinct user_id in production — an anonymousId-only fixture here would now read back as
      // 0 for all three once the query counts `distinct user_id`.
      const signupUserIds = await distinctUserIds(4);
      const exhaustedUserIds = await distinctUserIds(2);
      const purchaseUserIds = await distinctUserIds(1);
      await db.insert(events).values([
        ...Array.from({ length: 12 }, () => ({ productId: id, type: "visit" as const, anonymousId: randomUUID() })),
        ...Array.from({ length: 5 }, () => ({
          productId: id,
          type: "first_generation" as const,
          anonymousId: randomUUID(),
        })),
        ...signupUserIds.map((userId) => ({ productId: id, type: "signup" as const, userId, anonymousId: null })),
        ...exhaustedUserIds.map((userId) => ({
          productId: id,
          type: "credits_exhausted" as const,
          userId,
          anonymousId: null,
        })),
        ...purchaseUserIds.map((userId) => ({ productId: id, type: "purchase" as const, userId, anonymousId: null })),
      ]);
      await db.insert(generations).values(
        Array.from({ length: 3 }, () => ({
          productId: id,
          productVersion: 1,
          ipHash: "h",
          input: {},
          status: "succeeded" as const,
          idempotencyKey: randomUUID(),
        })),
      );

      const { getPortfolioMetrics } = await import("./metrics");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id);
      expect(product).toBeDefined();
      expect(product!.slug).toBe(slug);
      expect(product!.name).toBe("Metrics P");
      expect(product!.status).toBe("learn");
      expect(product!.visits).toBe(12);
      expect(product!.firstGenerations).toBe(5);
      expect(product!.signups).toBe(4);
      expect(product!.creditsExhausted).toBe(2);
      expect(product!.purchases).toBe(1);
      expect(product!.generations).toBe(3);

      await cleanupProduct(id);
      await db.delete(users).where(inArray(users.id, [...signupUserIds, ...exhaustedUserIds, ...purchaseUserIds]));
    });

    it("returns zero counts and null rates for an idle product (no events, purchases or generations)", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Idle", costPerGeneration: 2 });

      const { getPortfolioMetrics } = await import("./metrics");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id);
      expect(product).toBeDefined();
      expect(product!.visits).toBe(0);
      expect(product!.firstGenerations).toBe(0);
      expect(product!.signups).toBe(0);
      expect(product!.creditsExhausted).toBe(0);
      expect(product!.purchases).toBe(0);
      expect(product!.generations).toBe(0);
      expect(product!.revenueCents).toBe(0);
      expect(product!.aiCostMicros).toBe(0);
      expect(product!.signupToPurchaseRate).toBeNull();
      expect(product!.marginPerGenerationMicros).toBeNull();

      await cleanupProduct(id);
    });
  });

  // Task 6 — revenue, AI cost, conversion, margin, totals, real DB
  describe("revenue, cost, conversion and margin", () => {
    it("computes revenue, buyer conversion, AI cost and margin per generation from purchases and generations", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Margin P", costPerGeneration: 1 });

      // QA1-P1-Q5 (D1): signup is always identified by a real, distinct user_id in production.
      // 4 distinct signups, 2 distinct buyers (one buys twice) → conversion 2/4 = 0.5
      const signupUserIds = await distinctUserIds(4);
      await db
        .insert(events)
        .values(signupUserIds.map((userId) => ({ productId: id, type: "signup" as const, userId, anonymousId: null })));

      const buyerA = randomUUID();
      const buyerB = randomUUID();
      await db.insert(users).values([
        { id: buyerA, name: "Buyer A", email: `${buyerA}@example.test` },
        { id: buyerB, name: "Buyer B", email: `${buyerB}@example.test` },
      ]);
      await db.insert(purchases).values([
        {
          userId: buyerA,
          productId: id,
          packId: "pack-10",
          credits: 10,
          amountCents: 490,
          idempotencyKey: randomUUID(),
        },
        {
          userId: buyerA,
          productId: id,
          packId: "pack-10",
          credits: 10,
          amountCents: 490,
          idempotencyKey: randomUUID(),
        },
        {
          userId: buyerB,
          productId: id,
          packId: "pack-50",
          credits: 50,
          amountCents: 1490,
          idempotencyKey: randomUUID(),
        },
      ]);

      // 3 succeeded generations at 4000 µ$, 1 failed with a null cost, 1 pending: only the 3
      // succeeded ones count as `generations`, but AI cost sums every status (nulls as 0).
      await db.insert(generations).values([
        ...Array.from({ length: 3 }, () => ({
          productId: id,
          productVersion: 1,
          ipHash: "h",
          input: {},
          status: "succeeded" as const,
          costMicros: 4000,
          idempotencyKey: randomUUID(),
        })),
        {
          productId: id,
          productVersion: 1,
          ipHash: "h",
          input: {},
          status: "failed" as const,
          costMicros: null,
          idempotencyKey: randomUUID(),
        },
        {
          productId: id,
          productVersion: 1,
          ipHash: "h",
          input: {},
          status: "pending" as const,
          idempotencyKey: randomUUID(),
        },
      ]);

      const { getPortfolioMetrics } = await import("./metrics");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id)!;
      expect(product.revenueCents).toBe(2470);
      expect(product.generations).toBe(3);
      expect(product.aiCostMicros).toBe(12000);
      expect(product.signupToPurchaseRate).toBeCloseTo(0.5);
      // pricePerCreditMicros = 2470 * 10_000 / 70 credits sold; margin = pricePerCredit *
      // costPerGeneration(1) − avg AI cost per succeeded generation (12000 / 3 = 4000).
      const expectedMargin = Math.round((2470 * 10_000) / 70) - 4000;
      expect(product.marginPerGenerationMicros).toBe(expectedMargin);

      // Totals = sum over every product currently in the DB (concurrent test files may add
      // their own rows): recomputed from the same response, not hardcoded.
      expect(metrics.totals.visits).toBe(metrics.products.reduce((sum, row) => sum + row.visits, 0));
      expect(metrics.totals.revenueCents).toBe(metrics.products.reduce((sum, row) => sum + row.revenueCents, 0));
      expect(metrics.totals.aiCostMicros).toBe(metrics.products.reduce((sum, row) => sum + row.aiCostMicros, 0));
      expect(metrics.totals.marginMicros).toBe(
        metrics.products.reduce((sum, row) => sum + row.revenueCents * 10_000 - row.aiCostMicros, 0),
      );

      await cleanupProduct(id);
      await db.delete(users).where(eq(users.id, buyerA));
      await db.delete(users).where(eq(users.id, buyerB));
      await db.delete(users).where(inArray(users.id, signupUserIds));
    });

    it("returns null margin when no credits were sold, even with succeeded generations", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "No sales", costPerGeneration: 1 });
      await db.insert(generations).values({
        productId: id,
        productVersion: 1,
        ipHash: "h",
        input: {},
        status: "succeeded" as const,
        costMicros: 4000,
        idempotencyKey: randomUUID(),
      });

      const { getPortfolioMetrics } = await import("./metrics");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id)!;
      expect(product.marginPerGenerationMicros).toBeNull();

      await cleanupProduct(id);
    });
  });

  // Task 7 — range
  describe("range", () => {
    it("only counts rows within the last `days` UTC calendar days", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Range P" });
      const now = new Date();
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const justInside = new Date(startOfToday.getTime() + 60_000);
      const justOutside = new Date(startOfToday.getTime() - 60_000);

      await db.insert(events).values([
        { productId: id, type: "visit", anonymousId: randomUUID(), createdAt: justInside },
        { productId: id, type: "visit", anonymousId: randomUUID(), createdAt: justOutside },
      ]);

      const { getPortfolioMetrics } = await import("./metrics");
      const metrics = await getPortfolioMetrics({ days: 1 });
      const product = metrics.products.find((row) => row.productId === id)!;
      expect(product.visits).toBe(1);

      await cleanupProduct(id);
    });

    it.each([0, 1.5, 400])("rejects an invalid range of %s days with a RangeError", async (days) => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { getPortfolioMetrics } = await import("./metrics");
      await expect(getPortfolioMetrics({ days })).rejects.toThrow(RangeError);
    });

    it("checks the admin session before validating the range", async () => {
      requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
      const { getPortfolioMetrics } = await import("./metrics");
      await expect(getPortfolioMetrics({ days: 0 })).rejects.toThrow("redirect:/admin/login");
    });
  });

  // Task 8 — the dossier's seed story: a product that scales, one to kill, one with no badge
  describe("the dossier's kill / scale story (fresh products, real thresholds)", () => {
    it("scales a product with visits, conversion and margin above the default thresholds", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "LettrePro-like", costPerGeneration: 1 }, { status: "scale" });
      const { buyerIds } = await seedFunnelStory(id, {
        visits: 1200,
        signups: 100,
        buyers: 7,
        succeededGenerations: 20,
      });

      const { getPortfolioMetrics } = await import("./metrics");
      const { getThresholds } = await import("./thresholds");
      const { evaluate } = await import("../decision");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id)!;
      const thresholds = await getThresholds(id);
      expect(
        evaluate(
          {
            visits: product.visits,
            signupToPurchaseRate: product.signupToPurchaseRate,
            marginPerGenerationMicros: product.marginPerGenerationMicros,
          },
          thresholds,
        ),
      ).toBe("scale");

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });

    it("suggests killing a product with visits but very low conversion", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "NomDeMarque-like", costPerGeneration: 1 }, { status: "test" });
      const { buyerIds } = await seedFunnelStory(id, {
        visits: 1100,
        signups: 100,
        buyers: 1,
        succeededGenerations: 5,
      });

      const { getPortfolioMetrics } = await import("./metrics");
      const { getThresholds } = await import("./thresholds");
      const { evaluate } = await import("../decision");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id)!;
      const thresholds = await getThresholds(id);
      expect(
        evaluate(
          {
            visits: product.visits,
            signupToPurchaseRate: product.signupToPurchaseRate,
            marginPerGenerationMicros: product.marginPerGenerationMicros,
          },
          thresholds,
        ),
      ).toBe("kill");

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });

    it("suggests no badge for a product between the two thresholds", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "DescriPro-like", costPerGeneration: 1 }, { status: "learn" });
      const { buyerIds } = await seedFunnelStory(id, {
        visits: 1050,
        signups: 100,
        buyers: 3,
        succeededGenerations: 10,
      });

      const { getPortfolioMetrics } = await import("./metrics");
      const { getThresholds } = await import("./thresholds");
      const { evaluate } = await import("../decision");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id)!;
      const thresholds = await getThresholds(id);
      expect(
        evaluate(
          {
            visits: product.visits,
            signupToPurchaseRate: product.signupToPurchaseRate,
            marginPerGenerationMicros: product.marginPerGenerationMicros,
          },
          thresholds,
        ),
      ).toBeNull();

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });

    it("suggests no badge under the 1000-visit volume gate", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Tiny", costPerGeneration: 1 });
      const { buyerIds } = await seedFunnelStory(id, { visits: 10, signups: 2, buyers: 0, succeededGenerations: 0 });

      const { getPortfolioMetrics } = await import("./metrics");
      const { getThresholds } = await import("./thresholds");
      const { evaluate } = await import("../decision");
      const metrics = await getPortfolioMetrics({ days: 30 });
      const product = metrics.products.find((row) => row.productId === id)!;
      const thresholds = await getThresholds(id);
      expect(
        evaluate(
          {
            visits: product.visits,
            signupToPurchaseRate: product.signupToPurchaseRate,
            marginPerGenerationMicros: product.marginPerGenerationMicros,
          },
          thresholds,
        ),
      ).toBeNull();

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });
  });
});

// BO-03 (specs/BO-03-fiche.md): getFunnel moves from the V1 fixture stub to real SQL reusing
// getPortfolioMetrics's aggregation, filtered to one product, plus its own day-bucketed query.
// The 2 tests that asserted the fixture's shape (a hardcoded productId echo, an always-nonzero
// rateFromPrevious, a `days` cap with no real day-bucketing) are replaced below by tests against
// real, freshly-seeded data — this commit's explained removal (plan Task 0). The admin-session
// test is untouched.
describe("getFunnel", () => {
  it("requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { getFunnel } = await import("./metrics");
    await expect(getFunnel("p1", { days: 30 })).rejects.toThrow("redirect:/admin/login");
  });

  // Task 1 — guards
  describe("guards", () => {
    it("checks the admin session before validating the range", async () => {
      requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
      const { getFunnel } = await import("./metrics");
      await expect(getFunnel("p1", { days: 0 })).rejects.toThrow("redirect:/admin/login");
    });

    it.each([0, 1.5, 400])("rejects an invalid range of %s days with a RangeError", async (days) => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
      const { getFunnel } = await import("./metrics");
      await expect(getFunnel(product!.id, { days })).rejects.toThrow(RangeError);
    });

    it("throws on a well-formed but unknown productId", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const unknownId = randomUUID();
      const { getFunnel } = await import("./metrics");
      await expect(getFunnel(unknownId, { days: 30 })).rejects.toThrow(`getFunnel: unknown product ${unknownId}`);
    });

    it("throws on a non-uuid productId", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { getFunnel } = await import("./metrics");
      await expect(getFunnel("not-a-uuid", { days: 30 })).rejects.toThrow("getFunnel: unknown product not-a-uuid");
    });
  });

  // Task 2 — metrics equals the portfolio row for the same product
  describe("metrics", () => {
    it("equals the row getPortfolioMetrics returns for the same product", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Funnel Metrics P", costPerGeneration: 1 });
      const { buyerIds } = await seedFunnelStory(id, { visits: 12, signups: 4, buyers: 2, succeededGenerations: 3 });

      const { getFunnel, getPortfolioMetrics } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const portfolio = await getPortfolioMetrics({ days: 30 });
      const portfolioRow = portfolio.products.find((row) => row.productId === id);

      expect(funnel.metrics).toEqual(portfolioRow);

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });
  });

  // QA1-P1-Q5 (specs/qa/QA1-P1-Q5-funnel-personnes.md): a funnel step counts distinct persons,
  // not events — a retried 402 or a repeated purchase from the same person must not inflate a
  // step's count or push its rate above 100%.
  describe("counts distinct persons, not events (QA1-P1-Q5)", () => {
    it("counts two credits_exhausted events from the same person as 1, not 2", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Retried 402 P" });
      const buyerId = await anyUserId();
      await db.insert(events).values([
        { productId: id, type: "signup" as const, userId: buyerId, anonymousId: null },
        { productId: id, type: "credits_exhausted" as const, userId: buyerId, anonymousId: null },
        { productId: id, type: "credits_exhausted" as const, userId: buyerId, anonymousId: null },
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const step = funnel.steps.find((row) => row.type === "credits_exhausted")!;
      expect(step.count).toBe(1);
      expect(step.rateFromPrevious).toBe(1);

      await cleanupProduct(id);
    });

    it("counts two purchases from the same buyer as 1, not 2", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Double purchase P" });
      const buyerId = await anyUserId();
      await db.insert(events).values([
        { productId: id, type: "signup" as const, userId: buyerId, anonymousId: null },
        {
          productId: id,
          type: "purchase" as const,
          userId: buyerId,
          anonymousId: null,
          metadata: { purchaseKey: randomUUID() },
        },
        {
          productId: id,
          type: "purchase" as const,
          userId: buyerId,
          anonymousId: null,
          metadata: { purchaseKey: randomUUID() },
        },
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const step = funnel.steps.find((row) => row.type === "purchase")!;
      expect(step.count).toBe(1);

      await cleanupProduct(id);
    });

    it("counts two first_generation events from the same anonymous visitor as 1", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Dup first-gen anon P" });
      const anonymousId = randomUUID();
      await db.insert(events).values([
        { productId: id, type: "first_generation" as const, anonymousId, userId: null },
        { productId: id, type: "first_generation" as const, anonymousId, userId: null },
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const step = funnel.steps.find((row) => row.type === "first_generation")!;
      expect(step.count).toBe(1);

      await cleanupProduct(id);
    });

    it("counts two first_generation events from the same signed-in user as 1", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Dup first-gen user P" });
      const userId = await anyUserId();
      await db.insert(events).values([
        { productId: id, type: "first_generation" as const, userId, anonymousId: null },
        { productId: id, type: "first_generation" as const, userId, anonymousId: null },
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const step = funnel.steps.find((row) => row.type === "first_generation")!;
      expect(step.count).toBe(1);

      await cleanupProduct(id);
    });

    it("a rate never exceeds 100% when a later step has more distinct persons than the previous one (range boundary)", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Boundary skip P" });
      const signedUpBuyer = await anyUserId();
      // 1 signup inside the range; 3 different people reach credits_exhausted inside the range
      // without a signup event of their own in range (e.g. they signed up before the window, or
      // the row didn't survive dedupe) — the true count (3) is a fact, but the rate from a
      // previous count of 1 must be clamped to 100%, not 300%.
      const buyer2 = randomUUID();
      const buyer3 = randomUUID();
      await db.insert(users).values([
        { id: buyer2, name: "Buyer 2", email: `${buyer2}@example.test` },
        { id: buyer3, name: "Buyer 3", email: `${buyer3}@example.test` },
      ]);
      await db.insert(events).values([
        { productId: id, type: "signup" as const, userId: signedUpBuyer, anonymousId: null },
        { productId: id, type: "credits_exhausted" as const, userId: signedUpBuyer, anonymousId: null },
        { productId: id, type: "credits_exhausted" as const, userId: buyer2, anonymousId: null },
        { productId: id, type: "credits_exhausted" as const, userId: buyer3, anonymousId: null },
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const step = funnel.steps.find((row) => row.type === "credits_exhausted")!;
      expect(step.count).toBe(3);
      expect(step.rateFromPrevious).toBe(1);

      await cleanupProduct(id);
      await db.delete(users).where(inArray(users.id, [buyer2, buyer3]));
    });

    it("leaves revenueCents, aiCostMicros and marginPerGenerationMicros unchanged by a duplicated purchase event", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "KPIs unchanged P", costPerGeneration: 1 });
      const { buyerIds } = await seedFunnelStory(id, { visits: 0, signups: 0, buyers: 1, succeededGenerations: 1 });
      const [buyerId] = buyerIds;

      // A second `purchase` event for the very same person the QA1-P1-Q5 fix now dedupes at the
      // funnel-step level — revenueCents and aiCostMicros are read from `purchases` and
      // `generations` (never from the `events` subquery this spec touches), so they must be
      // identical whether this duplicate event exists or not.
      await db.insert(events).values([
        { productId: id, type: "purchase" as const, userId: buyerId, anonymousId: null },
        { productId: id, type: "purchase" as const, userId: buyerId, anonymousId: null },
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      expect(funnel.metrics.revenueCents).toBe(490);
      expect(funnel.metrics.aiCostMicros).toBe(4000);
      expect(funnel.metrics.marginPerGenerationMicros).toBe(Math.round((490 * 10_000) / 10) - 4000);
      const purchaseStep = funnel.steps.find((row) => row.type === "purchase")!;
      expect(purchaseStep.count).toBe(1);

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });
  });

  // Task 3 — steps
  describe("steps", () => {
    it("builds counts and pass rates from 12/5/4/2/1 funnel-step events, step 1's rate null", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Steps P" });
      // QA1-P1-Q5 (D1): signup, credits_exhausted and purchase are always identified by a real,
      // distinct user_id in production — an anonymousId-only fixture here would now read back as
      // 0 for all three.
      const signupUserIds = await distinctUserIds(4);
      const exhaustedUserIds = await distinctUserIds(2);
      const purchaseUserIds = await distinctUserIds(1);
      await db.insert(events).values([
        ...Array.from({ length: 12 }, () => ({ productId: id, type: "visit" as const, anonymousId: randomUUID() })),
        ...Array.from({ length: 5 }, () => ({
          productId: id,
          type: "first_generation" as const,
          anonymousId: randomUUID(),
        })),
        ...signupUserIds.map((userId) => ({ productId: id, type: "signup" as const, userId, anonymousId: null })),
        ...exhaustedUserIds.map((userId) => ({
          productId: id,
          type: "credits_exhausted" as const,
          userId,
          anonymousId: null,
        })),
        ...purchaseUserIds.map((userId) => ({ productId: id, type: "purchase" as const, userId, anonymousId: null })),
      ]);

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      expect(funnel.steps).toEqual([
        { type: "visit", count: 12, rateFromPrevious: null },
        { type: "first_generation", count: 5, rateFromPrevious: 5 / 12 },
        { type: "signup", count: 4, rateFromPrevious: 4 / 5 },
        { type: "credits_exhausted", count: 2, rateFromPrevious: 2 / 4 },
        { type: "purchase", count: 1, rateFromPrevious: 1 / 2 },
      ]);

      await cleanupProduct(id);
      await db.delete(users).where(inArray(users.id, [...signupUserIds, ...exhaustedUserIds, ...purchaseUserIds]));
    });

    it("returns zero counts and null rates for an idle product", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Idle steps P" });

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      expect(funnel.steps).toEqual([
        { type: "visit", count: 0, rateFromPrevious: null },
        { type: "first_generation", count: 0, rateFromPrevious: null },
        { type: "signup", count: 0, rateFromPrevious: null },
        { type: "credits_exhausted", count: 0, rateFromPrevious: null },
        { type: "purchase", count: 0, rateFromPrevious: null },
      ]);

      await cleanupProduct(id);
    });

    it("leaves the signup step's rate null when there are 0 first generations", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "No first-gen P" });
      const signupUserIds = await distinctUserIds(3);
      await db
        .insert(events)
        .values(signupUserIds.map((userId) => ({ productId: id, type: "signup" as const, userId, anonymousId: null })));

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const signupStep = funnel.steps.find((step) => step.type === "signup");
      expect(signupStep!.count).toBe(3);
      expect(signupStep!.rateFromPrevious).toBeNull();

      await cleanupProduct(id);
      await db.delete(users).where(inArray(users.id, signupUserIds));
    });
  });

  // Task 4 — daily
  describe("daily", () => {
    it("returns 30 zero-filled points, ascending, ending today (UTC), for an idle product", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Idle daily P" });

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      expect(funnel.daily).toHaveLength(30);
      const dates = funnel.daily.map((point) => point.date);
      expect(dates).toEqual([...dates].sort());
      const today = new Date().toISOString().slice(0, 10);
      expect(dates[dates.length - 1]).toBe(today);
      for (const point of funnel.daily) {
        expect(point.visits).toBe(0);
        expect(point.signups).toBe(0);
        expect(point.purchases).toBe(0);
        expect(point.revenueCents).toBe(0);
        expect(point.aiCostMicros).toBe(0);
      }

      await cleanupProduct(id);
    });

    it("buckets an event just after midnight UTC into today, and one just before into yesterday", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Boundary daily P" });
      const now = new Date();
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const justInside = new Date(startOfToday.getTime() + 60_000);
      const justBeforeMidnight = new Date(startOfToday.getTime() - 60_000);

      await db.insert(events).values([
        { productId: id, type: "visit", anonymousId: randomUUID(), createdAt: justInside },
        { productId: id, type: "visit", anonymousId: randomUUID(), createdAt: justBeforeMidnight },
      ]);

      // Both events fall within the 30-day range: `since` is truncated to a whole UTC day, so a
      // "just before midnight" timestamp still passes the `created_at >= since` filter — it is
      // the bucketing itself, not the range, that this test exercises.
      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const today = startOfToday.toISOString().slice(0, 10);
      const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const todayPoint = funnel.daily.find((point) => point.date === today);
      const yesterdayPoint = funnel.daily.find((point) => point.date === yesterday);
      expect(todayPoint!.visits).toBe(1);
      expect(yesterdayPoint!.visits).toBe(1);

      await cleanupProduct(id);
    });

    it("sums to the same totals as `metrics`, over the same range", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Daily sums P", costPerGeneration: 1 });
      const { buyerIds } = await seedFunnelStory(id, { visits: 9, signups: 3, buyers: 2, succeededGenerations: 4 });

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      const dailyVisits = funnel.daily.reduce((sum, point) => sum + point.visits, 0);
      const dailySignups = funnel.daily.reduce((sum, point) => sum + point.signups, 0);
      const dailyPurchases = funnel.daily.reduce((sum, point) => sum + point.purchases, 0);
      const dailyRevenue = funnel.daily.reduce((sum, point) => sum + point.revenueCents, 0);
      const dailyAiCost = funnel.daily.reduce((sum, point) => sum + point.aiCostMicros, 0);
      expect(dailyVisits).toBe(funnel.metrics.visits);
      expect(dailySignups).toBe(funnel.metrics.signups);
      expect(dailyPurchases).toBe(funnel.metrics.purchases);
      expect(dailyRevenue).toBe(funnel.metrics.revenueCents);
      expect(dailyAiCost).toBe(funnel.metrics.aiCostMicros);

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });

    it("excludes another product's events, purchases and generations", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id: idA } = await createTempProduct({ name: "Daily A" });
      const { id: idB } = await createTempProduct({ name: "Daily B" });
      await db.insert(events).values({ productId: idB, type: "visit", anonymousId: randomUUID() });

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(idA, { days: 30 });
      const totalVisits = funnel.daily.reduce((sum, point) => sum + point.visits, 0);
      expect(totalVisits).toBe(0);

      await cleanupProduct(idA);
      await cleanupProduct(idB);
    });

    it("caps daily points to the requested range", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Range daily P" });

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 7 });
      expect(funnel.daily).toHaveLength(7);

      await cleanupProduct(id);
    });
  });

  // Task 5 — killed product: still returns its data (BO-03 bullet 4, "produit killed")
  describe("killed product", () => {
    it("returns status killed and its historical data, not an error", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Killed P", costPerGeneration: 1 }, { status: "killed" });
      const { buyerIds } = await seedFunnelStory(id, { visits: 5, signups: 2, buyers: 1, succeededGenerations: 1 });

      const { getFunnel } = await import("./metrics");
      const funnel = await getFunnel(id, { days: 30 });
      expect(funnel.metrics.status).toBe("killed");
      expect(funnel.metrics.visits).toBe(5);
      expect(funnel.steps[0]).toEqual({ type: "visit", count: 5, rateFromPrevious: null });

      await cleanupProduct(id);
      if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
    });
  });
});

/**
 * Inserts a small "funnel story" for one product: `visits` visit events, `signups` signup
 * events (each a real, distinct `users` row — QA1-P1-Q5: `getFunnel`'s signup count is
 * `count(distinct user_id)`, and production's `track()` never writes a `signup` event without a
 * `userId`, so an `anonymousId`-only fixture would silently read back as 0 signups), `buyers`
 * distinct users each buying one 10-credit pack at 490 cents, and `succeededGenerations`
 * succeeded generations at 4000 µ$ each. Returns the ids of every user it created (signups and
 * buyers), for the caller to clean up alongside the product.
 */
async function seedFunnelStory(
  productId: string,
  story: { visits: number; signups: number; buyers: number; succeededGenerations: number },
): Promise<{ buyerIds: string[] }> {
  const anon = () => randomUUID();
  if (story.visits > 0) {
    await db
      .insert(events)
      .values(Array.from({ length: story.visits }, () => ({ productId, type: "visit" as const, anonymousId: anon() })));
  }
  const buyerIds: string[] = [];
  if (story.signups > 0) {
    for (let index = 0; index < story.signups; index += 1) {
      const signedUpId = randomUUID();
      buyerIds.push(signedUpId);
      await db.insert(users).values({ id: signedUpId, name: `Signup ${index}`, email: `${signedUpId}@example.test` });
      await db.insert(events).values({ productId, type: "signup" as const, userId: signedUpId, anonymousId: null });
    }
  }
  for (let index = 0; index < story.buyers; index += 1) {
    const buyerId = randomUUID();
    buyerIds.push(buyerId);
    await db.insert(users).values({ id: buyerId, name: `Buyer ${index}`, email: `${buyerId}@example.test` });
    await db.insert(purchases).values({
      userId: buyerId,
      productId,
      packId: "pack-10",
      credits: 10,
      amountCents: 490,
      idempotencyKey: randomUUID(),
    });
  }
  if (story.succeededGenerations > 0) {
    await db.insert(generations).values(
      Array.from({ length: story.succeededGenerations }, () => ({
        productId,
        productVersion: 1,
        ipHash: "h",
        input: {},
        status: "succeeded" as const,
        costMicros: 4000,
        idempotencyKey: randomUUID(),
      })),
    );
  }
  return { buyerIds };
}
