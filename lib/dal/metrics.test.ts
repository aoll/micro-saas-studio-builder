import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { events, generations, productVersions, products, purchases, themes } from "@/lib/db/schema";
import { users } from "@/lib/db/auth-schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

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

async function editorialThemeId(): Promise<string> {
  const row = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  return row!.id;
}

/** A throwaway product + its (draft) config, cleaned up by the caller. */
async function createTempProduct(
  config: Record<string, unknown>,
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
    .values({ productId: id, version: 1, config: config as unknown as ProductConfig, createdBy: owner });
  return { id, slug };
}

async function cleanupProduct(id: string): Promise<void> {
  await db.delete(purchases).where(eq(purchases.productId, id));
  await db.delete(generations).where(eq(generations.productId, id));
  await db.delete(events).where(eq(events.productId, id));
  await db.delete(productVersions).where(eq(productVersions.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

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
      const { id, slug } = await createTempProduct(
        { name: "Metrics P", pricing: { costPerGeneration: 1 } },
        { status: "learn" },
      );

      await db.insert(events).values([
        ...Array.from({ length: 12 }, () => ({ productId: id, type: "visit" as const, anonymousId: randomUUID() })),
        ...Array.from({ length: 5 }, () => ({
          productId: id,
          type: "first_generation" as const,
          anonymousId: randomUUID(),
        })),
        ...Array.from({ length: 4 }, () => ({ productId: id, type: "signup" as const, anonymousId: randomUUID() })),
        ...Array.from({ length: 2 }, () => ({
          productId: id,
          type: "credits_exhausted" as const,
          anonymousId: randomUUID(),
        })),
        { productId: id, type: "purchase" as const, anonymousId: randomUUID() },
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
    });

    it("returns zero counts and null rates for an idle product (no events, purchases or generations)", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "Idle", pricing: { costPerGeneration: 2 } });

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
      const { id } = await createTempProduct({ name: "Margin P", pricing: { costPerGeneration: 1 } });

      // 4 signups, 2 distinct buyers (one buys twice) → conversion 2/4 = 0.5
      await db
        .insert(events)
        .values(
          Array.from({ length: 4 }, () => ({ productId: id, type: "signup" as const, anonymousId: randomUUID() })),
        );

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
    });

    it("returns null margin when no credits were sold, even with succeeded generations", async () => {
      requireAdmin.mockResolvedValue({ user: { role: "admin" } });
      const { id } = await createTempProduct({ name: "No sales", pricing: { costPerGeneration: 1 } });
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
      const { id } = await createTempProduct(
        { name: "LettrePro-like", pricing: { costPerGeneration: 1 } },
        { status: "scale" },
      );
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
      const { id } = await createTempProduct(
        { name: "NomDeMarque-like", pricing: { costPerGeneration: 1 } },
        { status: "test" },
      );
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
      const { id } = await createTempProduct(
        { name: "DescriPro-like", pricing: { costPerGeneration: 1 } },
        { status: "learn" },
      );
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
      const { id } = await createTempProduct({ name: "Tiny", pricing: { costPerGeneration: 1 } });
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

/**
 * Inserts a small "funnel story" for one product: `visits` visit events, `signups` signup
 * events, `buyers` distinct users each buying one 10-credit pack at 490 cents, and
 * `succeededGenerations` succeeded generations at 4000 µ$ each. Returns the ids of the users
 * it created, for the caller to clean up alongside the product.
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
  if (story.signups > 0) {
    await db
      .insert(events)
      .values(
        Array.from({ length: story.signups }, () => ({ productId, type: "signup" as const, anonymousId: anon() })),
      );
  }
  const buyerIds: string[] = [];
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
