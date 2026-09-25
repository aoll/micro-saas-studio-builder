import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { balances, creditTransactions, productVersions, products, purchases, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

// SA-07 (specs/SA-07-compte.md), orchestrator round-2 decision: additive,
// user-scoped reads for the account page's ledger movements and purchases.
// No frozen contract in lib/dal/credits.ts is touched; assertOwnUser's
// session check is mirrored here (CLAUDE.md: every DAL module checks the
// session) rather than imported, since it isn't exported from credits.ts.

const getSession = vi.fn();
vi.mock("./session", () => ({ getSession: () => getSession() }));

afterEach(() => {
  getSession.mockReset();
});

function asUser(userId: string) {
  getSession.mockResolvedValue({ user: { id: userId, role: "user" } });
}

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];

async function createUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name: "Account test user", email: `${id}@account.test`, emailVerified: true });
  createdUserIds.push(id);
  return id;
}

async function createProduct(): Promise<{ id: string }> {
  const lettrePro = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const version = await db.query.productVersions.findFirst({
    where: and(eq(productVersions.productId, lettrePro!.id), eq(productVersions.version, lettrePro!.currentVersion)),
  });
  const admin = await db.query.users.findFirst({ where: eq(users.role, "admin") });
  const slug = `account-test-${randomUUID()}`;
  const config: ProductConfig = { ...(version!.config as ProductConfig), slug, themeId: editorial!.id };

  const [product] = await db
    .insert(products)
    .values({ slug, status: "test", themeId: editorial!.id, currentVersion: 1, locale: "fr", createdBy: admin!.id })
    .returning({ id: products.id });
  await db.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: admin!.id });
  createdProductIds.push(product!.id);
  return { id: product!.id };
}

// Test setup only, mirrors credits.test.ts's giveCredits: writes a ledger
// row and updates `balances` directly, bypassing the DAL. The row is
// ensured first with a plain insert-do-nothing, then updated by a plain
// UPDATE (not an upsert): Postgres evaluates an INSERT ... ON CONFLICT DO
// UPDATE's speculative insert values against every CHECK constraint before
// resolving the conflict, so upserting a negative delta directly would
// spuriously fail `balances_balance_nonnegative` even when the existing row
// already covers it.
async function giveCredits(
  userId: string,
  productId: string,
  delta: number,
  reason: "signup_bonus" | "generation" | "refund" = "signup_bonus",
  // Explicit, not `setTimeout` + `defaultNow()`: `now()` is frozen for the
  // whole duration of a Postgres transaction (TOOLING-test-transaction), so
  // two movements written a few milliseconds apart in real wall-clock time
  // get the exact same `created_at` once this helper runs inside
  // withTestTransaction. Ordering tests pass distinct Dates instead.
  createdAt?: Date,
) {
  await db.transaction(async (tx) => {
    await tx.insert(creditTransactions).values({
      userId,
      productId,
      delta,
      reason,
      idempotencyKey: randomUUID(),
      ...(createdAt ? { createdAt } : {}),
    });
    await tx
      .insert(balances)
      .values({ userId, productId, balance: 0 })
      .onConflictDoNothing({ target: [balances.userId, balances.productId] });
    await tx
      .update(balances)
      .set({ balance: sql`${balances.balance} + ${delta}`, updatedAt: new Date() })
      .where(and(eq(balances.userId, userId), eq(balances.productId, productId)));
  });
}

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(creditTransactions).where(eq(creditTransactions.productId, id));
    await db.delete(purchases).where(eq(purchases.productId, id));
    await db.delete(balances).where(eq(balances.productId, id));
    await db.delete(productVersions).where(eq(productVersions.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }
  for (const id of createdUserIds) {
    await db.delete(creditTransactions).where(eq(creditTransactions.userId, id));
    await db.delete(purchases).where(eq(purchases.userId, id));
    await db.delete(balances).where(eq(balances.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("ACCOUNT_LIST_LIMIT", () => {
  it("is 50", async () => {
    const { ACCOUNT_LIST_LIMIT } = await import("./account");
    expect(ACCOUNT_LIST_LIMIT).toBe(50);
  });
});

describe("listCreditMovements", () => {
  it("pins the CreditMovement shape", async () => {
    const { listCreditMovements } = await import("./account");
    expectTypeOf(listCreditMovements).parameter(0).toBeString();
    expectTypeOf(listCreditMovements).parameter(1).toBeString();
    expectTypeOf(listCreditMovements).returns.resolves.toEqualTypeOf<
      { id: string; createdAt: Date; delta: number; reason: "signup_bonus" | "purchase" | "generation" | "refund" }[]
    >();
  });

  it("returns the caller's movements newest first, with only id/createdAt/delta/reason", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 3, "signup_bonus", new Date("2026-01-01T00:00:00.000Z"));
    await giveCredits(userId, productId, -1, "generation", new Date("2026-01-01T00:00:05.000Z"));
    asUser(userId);

    const { listCreditMovements } = await import("./account");
    const rows = await listCreditMovements(userId, productId);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ delta: -1, reason: "generation" });
    expect(rows[1]).toMatchObject({ delta: 3, reason: "signup_bonus" });
    expect(Object.keys(rows[0]!).sort()).toEqual(["createdAt", "delta", "id", "reason"]);
  });

  it("excludes another user's and another product's movements", async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    const productId = (await createProduct()).id;
    const otherProductId = (await createProduct()).id;
    await giveCredits(userId, productId, 3, "signup_bonus");
    await giveCredits(otherUserId, productId, 5, "signup_bonus");
    await giveCredits(userId, otherProductId, 7, "signup_bonus");
    asUser(userId);

    const { listCreditMovements } = await import("./account");
    const rows = await listCreditMovements(userId, productId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ delta: 3 });
  });

  it("caps at ACCOUNT_LIST_LIMIT", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    for (let i = 0; i < 55; i++) {
      await db.insert(creditTransactions).values({
        userId,
        productId,
        delta: i % 2 === 0 ? 1 : -1,
        reason: i % 2 === 0 ? "purchase" : "generation",
        idempotencyKey: randomUUID(),
      });
    }
    asUser(userId);

    const { listCreditMovements, ACCOUNT_LIST_LIMIT } = await import("./account");
    const rows = await listCreditMovements(userId, productId);
    expect(rows).toHaveLength(ACCOUNT_LIST_LIMIT);
  });

  it("rejects a mismatched session and never queries", async () => {
    const userId = await createUser();
    const otherId = await createUser();
    const productId = (await createProduct()).id;
    asUser(otherId);

    const { listCreditMovements } = await import("./account");
    await expect(listCreditMovements(userId, productId)).rejects.toThrow();
  });

  it("rejects with no session", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    getSession.mockResolvedValue(null);

    const { listCreditMovements } = await import("./account");
    await expect(listCreditMovements(userId, productId)).rejects.toThrow();
  });
});

describe("listPurchases", () => {
  it("pins the AccountPurchase shape", async () => {
    const { listPurchases } = await import("./account");
    expectTypeOf(listPurchases).returns.resolves.toEqualTypeOf<
      { id: string; createdAt: Date; credits: number; amountCents: number; currency: string }[]
    >();
  });

  it("returns the caller's purchases newest first via the real purchase(), with only the documented fields", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    asUser(userId);
    const { purchase } = await import("./credits");
    // purchase()'s signature is frozen (no createdAt override): call it
    // twice, then backdate the older one directly. Two `now()` calls inside
    // the same transaction return the same instant (now() is frozen for a
    // whole Postgres transaction, TOOLING-test-transaction), so the
    // `setTimeout` this test used to rely on no longer produces distinct
    // timestamps once it runs inside withTestTransaction.
    const olderKey = randomUUID();
    await purchase({ userId, productId, packId: "pack-10", idempotencyKey: olderKey });
    await db
      .update(purchases)
      .set({ createdAt: new Date("2026-01-01T00:00:00.000Z") })
      .where(eq(purchases.idempotencyKey, olderKey));
    await purchase({ userId, productId, packId: "pack-50", idempotencyKey: randomUUID() });

    const { listPurchases } = await import("./account");
    const rows = await listPurchases(userId, productId);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ credits: 50, amountCents: 1490, currency: "EUR" });
    expect(rows[1]).toMatchObject({ credits: 10, amountCents: 490, currency: "EUR" });
    expect(Object.keys(rows[0]!).sort()).toEqual(["amountCents", "createdAt", "credits", "currency", "id"]);
  });

  it("excludes another user's purchases", async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    const productId = (await createProduct()).id;
    asUser(otherUserId);
    const { purchase } = await import("./credits");
    await purchase({ userId: otherUserId, productId, packId: "pack-10", idempotencyKey: randomUUID() });

    asUser(userId);
    const { listPurchases } = await import("./account");
    const rows = await listPurchases(userId, productId);
    expect(rows).toHaveLength(0);
  });

  it("rejects a mismatched session and never queries", async () => {
    const userId = await createUser();
    const otherId = await createUser();
    const productId = (await createProduct()).id;
    asUser(otherId);

    const { listPurchases } = await import("./account");
    await expect(listPurchases(userId, productId)).rejects.toThrow();
  });

  it("rejects with no session", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    getSession.mockResolvedValue(null);

    const { listPurchases } = await import("./account");
    await expect(listPurchases(userId, productId)).rejects.toThrow();
  });
});
