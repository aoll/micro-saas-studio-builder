import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { creditTransactions, generations, productVersions, products, purchases, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { SEED_OWNER } from "@/scripts/seed";
import {
  ACTIVITY_PAGE_SIZE,
  getPurchaseSummary,
  listProductCreditMovements,
  listProductGenerations,
  listProductPurchases,
  type ActivityGeneration,
  type ActivityMovement,
  type ActivityPage,
  type ActivityPurchase,
  type PurchaseSummary,
} from "./activity";

const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

afterEach(() => {
  requireAdmin.mockReset();
});

function asAdmin(): void {
  requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
}

async function ownerId(): Promise<string> {
  const row = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  return row!.id;
}

async function editorialThemeId(): Promise<string> {
  const row = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  return row!.id;
}

function buildValidConfig(slug: string, themeId: string): ProductConfig {
  return {
    slug,
    name: "Activity test product",
    status: "test",
    themeId,
    locale: "fr",
    branding: {},
    landing: { headline: "H", subheadline: "S", faq: [], seoTitle: "T", seoDescription: "D" },
    inputs: [{ key: "sector", label: "Secteur", type: "text", required: true }],
    generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "About {{sector}}", outputType: "markdown" },
    pricing: {
      freeCreditsOnSignup: 3,
      anonymousFreeGenerations: 1,
      costPerGeneration: 1,
      packs: [
        { id: "pack-10", credits: 10, priceCents: 490 },
        { id: "pack-50", credits: 50, priceCents: 1490 },
      ],
    },
  };
}

/** A throwaway product + its (schema-valid) config, cleaned up by the caller. */
async function createTempProduct(): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `activity-${randomUUID()}`;
  const owner = await ownerId();
  const themeId = await editorialThemeId();
  await db.insert(products).values({
    id,
    slug,
    themeId,
    currentVersion: 1,
    locale: "fr",
    createdBy: owner,
    status: "test",
  });
  await db
    .insert(productVersions)
    .values({ productId: id, version: 1, config: buildValidConfig(slug, themeId), createdBy: owner });
  return { id, slug };
}

/** A throwaway user, cleaned up by the caller. */
async function createTempUser(): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), name: "Activity test user", email: `activity-${randomUUID()}@example.com` })
    .returning({ id: users.id });
  return row!.id;
}

async function cleanupProduct(productId: string, userIds: string[] = []): Promise<void> {
  await db.delete(creditTransactions).where(eq(creditTransactions.productId, productId));
  await db.delete(purchases).where(eq(purchases.productId, productId));
  await db.delete(generations).where(eq(generations.productId, productId));
  await db.delete(productVersions).where(eq(productVersions.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
}

async function insertGeneration(overrides: {
  productId: string;
  userId?: string | null;
  status?: "pending" | "succeeded" | "failed";
  input?: Record<string, unknown>;
  output?: unknown;
  model?: string | null;
  costMicros?: number | null;
  createdAt?: Date;
}): Promise<string> {
  const [row] = await db
    .insert(generations)
    .values({
      productId: overrides.productId,
      productVersion: 1,
      userId: overrides.userId ?? null,
      ipHash: "hash",
      input: overrides.input ?? { sector: "café" },
      output: overrides.output ?? "Résultat",
      model: overrides.model ?? "anthropic/claude-haiku-4.5",
      costMicros: overrides.costMicros ?? 4000,
      status: overrides.status ?? "succeeded",
      idempotencyKey: randomUUID(),
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning({ id: generations.id });
  return row!.id;
}

async function insertPurchase(overrides: {
  productId: string;
  userId: string;
  credits?: number;
  amountCents?: number;
  createdAt?: Date;
}): Promise<{ id: string; credits: number; amountCents: number }> {
  const credits = overrides.credits ?? 10;
  const amountCents = overrides.amountCents ?? 490;
  const [row] = await db
    .insert(purchases)
    .values({
      userId: overrides.userId,
      productId: overrides.productId,
      packId: `pack-${credits}`,
      credits,
      amountCents,
      idempotencyKey: randomUUID(),
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning({ id: purchases.id, credits: purchases.credits, amountCents: purchases.amountCents });
  return row!;
}

async function insertMovement(overrides: {
  productId: string;
  userId: string;
  delta: number;
  reason: "signup_bonus" | "purchase" | "generation" | "refund";
  generationId?: string | null;
  purchaseId?: string | null;
  createdAt?: Date;
}): Promise<string> {
  const [row] = await db
    .insert(creditTransactions)
    .values({
      userId: overrides.userId,
      productId: overrides.productId,
      delta: overrides.delta,
      reason: overrides.reason,
      generationId: overrides.generationId ?? null,
      purchaseId: overrides.purchaseId ?? null,
      idempotencyKey: randomUUID(),
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning({ id: creditTransactions.id });
  return row!.id;
}

describe("signatures", () => {
  it("listProductGenerations has the plan's literal signature", () => {
    expectTypeOf(listProductGenerations).parameter(0).toBeString();
    expectTypeOf(listProductGenerations).parameter(1).toBeNumber();
    expectTypeOf(listProductGenerations).returns.resolves.toEqualTypeOf<ActivityPage<ActivityGeneration>>();
  });

  it("listProductPurchases has the plan's literal signature", () => {
    expectTypeOf(listProductPurchases).parameter(0).toBeString();
    expectTypeOf(listProductPurchases).parameter(1).toBeNumber();
    expectTypeOf(listProductPurchases).returns.resolves.toEqualTypeOf<ActivityPage<ActivityPurchase>>();
  });

  it("listProductCreditMovements has the plan's literal signature", () => {
    expectTypeOf(listProductCreditMovements).parameter(0).toBeString();
    expectTypeOf(listProductCreditMovements).parameter(1).toBeNumber();
    expectTypeOf(listProductCreditMovements).returns.resolves.toEqualTypeOf<ActivityPage<ActivityMovement>>();
  });

  it("getPurchaseSummary has the plan's literal signature", () => {
    expectTypeOf(getPurchaseSummary).parameter(0).toBeString();
    expectTypeOf(getPurchaseSummary).returns.resolves.toEqualTypeOf<PurchaseSummary>();
  });
});

describe("guards", () => {
  it("listProductGenerations requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    await expect(listProductGenerations(randomUUID(), 1)).rejects.toThrow("redirect:/admin/login");
  });

  it("listProductPurchases requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    await expect(listProductPurchases(randomUUID(), 1)).rejects.toThrow("redirect:/admin/login");
  });

  it("listProductCreditMovements requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    await expect(listProductCreditMovements(randomUUID(), 1)).rejects.toThrow("redirect:/admin/login");
  });

  it("getPurchaseSummary requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    await expect(getPurchaseSummary(randomUUID())).rejects.toThrow("redirect:/admin/login");
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "listProductGenerations rejects a non-positive-integer page (%s) with a RangeError, no query",
    async (page) => {
      asAdmin();
      const findMany = vi.spyOn(db.query.generations, "findMany");
      await expect(listProductGenerations(randomUUID(), page)).rejects.toThrow(RangeError);
      expect(findMany).not.toHaveBeenCalled();
      findMany.mockRestore();
    },
  );

  it("listProductGenerations rejects a malformed product id, page checked first, no query", async () => {
    asAdmin();
    const findMany = vi.spyOn(db.query.generations, "findMany");
    await expect(listProductGenerations("not-a-uuid", 1)).rejects.toThrow(/unknown product/);
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockRestore();
  });

  it("listProductGenerations checks page before the product id (both invalid -> RangeError)", async () => {
    asAdmin();
    await expect(listProductGenerations("not-a-uuid", 0)).rejects.toThrow(RangeError);
  });

  it.each([0, -1, 1.5])("listProductPurchases rejects a non-positive-integer page (%s), no query", async (page) => {
    asAdmin();
    const findMany = vi.spyOn(db.query.purchases, "findMany");
    await expect(listProductPurchases(randomUUID(), page)).rejects.toThrow(RangeError);
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockRestore();
  });

  it("listProductPurchases rejects a malformed product id, no query", async () => {
    asAdmin();
    const findMany = vi.spyOn(db.query.purchases, "findMany");
    await expect(listProductPurchases("not-a-uuid", 1)).rejects.toThrow(/unknown product/);
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockRestore();
  });

  it.each([0, -1, 1.5])(
    "listProductCreditMovements rejects a non-positive-integer page (%s), no query",
    async (page) => {
      asAdmin();
      const select = vi.spyOn(db, "select");
      await expect(listProductCreditMovements(randomUUID(), page)).rejects.toThrow(RangeError);
      expect(select).not.toHaveBeenCalled();
      select.mockRestore();
    },
  );

  it("listProductCreditMovements rejects a malformed product id, no query", async () => {
    asAdmin();
    const select = vi.spyOn(db, "select");
    await expect(listProductCreditMovements("not-a-uuid", 1)).rejects.toThrow(/unknown product/);
    expect(select).not.toHaveBeenCalled();
    select.mockRestore();
  });

  it("getPurchaseSummary rejects a malformed product id, no query", async () => {
    asAdmin();
    const select = vi.spyOn(db, "select");
    await expect(getPurchaseSummary("not-a-uuid")).rejects.toThrow(/unknown product/);
    expect(select).not.toHaveBeenCalled();
    select.mockRestore();
  });
});

describe("listProductGenerations", () => {
  it("returns an empty page for a product with no generations", async () => {
    asAdmin();
    const product = await createTempProduct();
    try {
      const result = await listProductGenerations(product.id, 1);
      expect(result).toEqual({ entries: [], page: 1, total: 0, hasMore: false });
    } finally {
      await cleanupProduct(product.id);
    }
  });

  it("orders newest first and paginates 20 per page, with a stable order across equal timestamps", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      const sameInstant = new Date("2026-01-01T00:00:00.000Z");
      const ids: string[] = [];
      for (let index = 0; index < 21; index += 1) {
        const createdAt = index < 2 ? sameInstant : new Date(sameInstant.getTime() + index * 1000);
        ids.push(await insertGeneration({ productId: product.id, userId, createdAt }));
      }

      const firstPage = await listProductGenerations(product.id, 1);
      expect(firstPage.entries).toHaveLength(ACTIVITY_PAGE_SIZE);
      expect(firstPage.total).toBe(21);
      expect(firstPage.hasMore).toBe(true);

      const secondPage = await listProductGenerations(product.id, 2);
      expect(secondPage.entries).toHaveLength(1);
      expect(secondPage.hasMore).toBe(false);

      const allIds = [...firstPage.entries, ...secondPage.entries].map((entry) => entry.id);
      expect(new Set(allIds).size).toBe(21);
      expect(allIds.sort()).toEqual([...ids].sort());
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });

  it("returns every status (pending, succeeded, failed), unlike the user-facing history", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      await insertGeneration({ productId: product.id, userId, status: "succeeded" });
      await insertGeneration({ productId: product.id, userId, status: "pending" });
      await insertGeneration({ productId: product.id, userId, status: "failed" });

      const result = await listProductGenerations(product.id, 1);
      expect(result.total).toBe(3);
      expect(result.entries.map((entry) => entry.status).sort()).toEqual(["failed", "pending", "succeeded"]);
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });

  it("returns input, output, model and cost, never a user id, anonymous id or ip hash", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      await insertGeneration({
        productId: product.id,
        userId,
        input: { sector: "café", tone: "ludique" },
        output: "Brewtiful, Grain Gang",
        model: "anthropic/claude-haiku-4.5",
        costMicros: 4000,
      });

      const result = await listProductGenerations(product.id, 1);
      const entry = result.entries[0]!;
      expect(entry.input).toEqual({ sector: "café", tone: "ludique" });
      expect(entry.output).toBe("Brewtiful, Grain Gang");
      expect(entry.model).toBe("anthropic/claude-haiku-4.5");
      expect(entry.costMicros).toBe(4000);
      expect(Object.keys(entry).sort()).toEqual(
        ["costMicros", "createdAt", "id", "input", "model", "output", "refunded", "status"].sort(),
      );
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });

  it("marks a generation refunded when a refund ledger row references it", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      const failedId = await insertGeneration({ productId: product.id, userId, status: "failed", output: null });
      await insertMovement({ productId: product.id, userId, delta: -1, reason: "generation", generationId: failedId });
      await insertMovement({ productId: product.id, userId, delta: 1, reason: "refund", generationId: failedId });

      const succeededId = await insertGeneration({ productId: product.id, userId, status: "succeeded" });
      await insertMovement({
        productId: product.id,
        userId,
        delta: -1,
        reason: "generation",
        generationId: succeededId,
      });

      const result = await listProductGenerations(product.id, 1);
      const refunded = result.entries.find((entry) => entry.id === failedId)!;
      const notRefunded = result.entries.find((entry) => entry.id === succeededId)!;
      expect(refunded.refunded).toBe(true);
      expect(notRefunded.refunded).toBe(false);
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });
});

describe("listProductPurchases", () => {
  it("returns an empty page for a product with no purchases", async () => {
    asAdmin();
    const product = await createTempProduct();
    try {
      const result = await listProductPurchases(product.id, 1);
      expect(result).toEqual({ entries: [], page: 1, total: 0, hasMore: false });
    } finally {
      await cleanupProduct(product.id);
    }
  });

  it("orders newest first, paginates, and returns every user's purchases without their user id", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userA = await createTempUser();
    const userB = await createTempUser();
    try {
      const older = await insertPurchase({
        productId: product.id,
        userId: userA,
        credits: 10,
        amountCents: 490,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const newer = await insertPurchase({
        productId: product.id,
        userId: userB,
        credits: 50,
        amountCents: 1490,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const result = await listProductPurchases(product.id, 1);
      expect(result.total).toBe(2);
      expect(result.entries.map((entry) => entry.id)).toEqual([newer.id, older.id]);
      expect(result.entries[0]).toEqual({
        id: newer.id,
        createdAt: expect.any(Date),
        credits: 50,
        amountCents: 1490,
        currency: "EUR",
      });
    } finally {
      await cleanupProduct(product.id, [userA, userB]);
    }
  });

  it("paginates 20 per page", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      for (let index = 0; index < 21; index += 1) {
        await insertPurchase({
          productId: product.id,
          userId,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        });
      }
      const firstPage = await listProductPurchases(product.id, 1);
      expect(firstPage.entries).toHaveLength(ACTIVITY_PAGE_SIZE);
      expect(firstPage.hasMore).toBe(true);
      const secondPage = await listProductPurchases(product.id, 2);
      expect(secondPage.entries).toHaveLength(1);
      expect(secondPage.hasMore).toBe(false);
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });
});

describe("listProductCreditMovements", () => {
  it("returns an empty page for a product with no movements", async () => {
    asAdmin();
    const product = await createTempProduct();
    try {
      const result = await listProductCreditMovements(product.id, 1);
      expect(result).toEqual({ entries: [], page: 1, total: 0, hasMore: false });
    } finally {
      await cleanupProduct(product.id);
    }
  });

  it("returns the delta and reason of every user's movements, newest first", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      await insertMovement({
        productId: product.id,
        userId,
        delta: 3,
        reason: "signup_bonus",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await insertMovement({
        productId: product.id,
        userId,
        delta: -1,
        reason: "generation",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const result = await listProductCreditMovements(product.id, 1);
      expect(result.total).toBe(2);
      expect(result.entries.map((entry) => ({ delta: entry.delta, reason: entry.reason }))).toEqual([
        { delta: -1, reason: "generation" },
        { delta: 3, reason: "signup_bonus" },
      ]);
      expect(Object.keys(result.entries[0]!).sort()).toEqual(
        ["createdAt", "delta", "id", "packCredits", "reason"].sort(),
      );
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });

  it("carries the pack's credit count for a purchase movement, null for every other reason", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      const purchase = await insertPurchase({ productId: product.id, userId, credits: 10 });
      await insertMovement({ productId: product.id, userId, delta: 10, reason: "purchase", purchaseId: purchase.id });
      await insertMovement({ productId: product.id, userId, delta: 3, reason: "signup_bonus" });

      const result = await listProductCreditMovements(product.id, 1);
      const purchaseMovement = result.entries.find((entry) => entry.reason === "purchase")!;
      const bonusMovement = result.entries.find((entry) => entry.reason === "signup_bonus")!;
      expect(purchaseMovement.packCredits).toBe(10);
      expect(bonusMovement.packCredits).toBeNull();
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });

  it("paginates 20 per page", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      for (let index = 0; index < 21; index += 1) {
        await insertMovement({
          productId: product.id,
          userId,
          delta: 1,
          reason: "signup_bonus",
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        });
      }
      const firstPage = await listProductCreditMovements(product.id, 1);
      expect(firstPage.entries).toHaveLength(ACTIVITY_PAGE_SIZE);
      expect(firstPage.hasMore).toBe(true);
      const secondPage = await listProductCreditMovements(product.id, 2);
      expect(secondPage.entries).toHaveLength(1);
      expect(secondPage.hasMore).toBe(false);
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });
});

describe("getPurchaseSummary", () => {
  it("returns a zeroed summary for a product with no purchases", async () => {
    asAdmin();
    const product = await createTempProduct();
    try {
      const result = await getPurchaseSummary(product.id);
      expect(result).toEqual({ count: 0, revenueCents: 0, byPack: [] });
    } finally {
      await cleanupProduct(product.id);
    }
  });

  it("counts purchases, sums revenue and groups by pack size, ascending", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      await insertPurchase({ productId: product.id, userId, credits: 50, amountCents: 1490 });
      await insertPurchase({ productId: product.id, userId, credits: 10, amountCents: 490 });
      await insertPurchase({ productId: product.id, userId, credits: 10, amountCents: 490 });

      const result = await getPurchaseSummary(product.id);
      expect(result).toEqual({
        count: 3,
        revenueCents: 490 + 490 + 1490,
        byPack: [
          { credits: 10, count: 2 },
          { credits: 50, count: 1 },
        ],
      });
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });

  it("includes a purchase exactly at the window start, excludes one just before it", async () => {
    asAdmin();
    const product = await createTempProduct();
    const userId = await createTempUser();
    try {
      const now = new Date("2026-02-01T12:00:00.000Z");
      const windowStart = new Date("2026-01-03T00:00:00.000Z"); // 00:00 UTC, 29 days before 2026-02-01
      const justBefore = new Date(windowStart.getTime() - 1);

      await insertPurchase({ productId: product.id, userId, credits: 10, amountCents: 490, createdAt: windowStart });
      await insertPurchase({ productId: product.id, userId, credits: 10, amountCents: 490, createdAt: justBefore });

      const result = await getPurchaseSummary(product.id, now);
      expect(result.count).toBe(1);
      expect(result.revenueCents).toBe(490);
    } finally {
      await cleanupProduct(product.id, [userId]);
    }
  });
});
