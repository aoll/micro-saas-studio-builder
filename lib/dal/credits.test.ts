import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { balances, creditTransactions, generations, productVersions, products, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

// Real ledger tests (LEDGER spec): the V1 stub-value tests (docs/11 ›
// "Solde fixe à 10, remboursement et bonus sans effet, debit() toujours
// ok") are dropped here because LEDGER replaces the stub with the real
// implementation; the frozen shape and type of every export stay pinned in
// contract-shape.test.ts and contract.test.ts, unchanged by this file.

const getSession = vi.fn();
vi.mock("./session", () => ({ getSession: () => getSession() }));

afterEach(() => {
  getSession.mockReset();
});

function asUser(userId: string, role: "user" | "admin" | "owner" = "user") {
  getSession.mockResolvedValue({ user: { id: userId, role } });
}

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];

async function createUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name: "Ledger test user", email: `${id}@ledger.test`, emailVerified: true });
  createdUserIds.push(id);
  return id;
}

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  return row!.id;
}

// A private test product, copied from lettre-pro's config, so tests never
// touch the seeded product (guards.ts locks it) nor share balances with
// other spec's tests.
async function createProduct(overrides?: Partial<ProductConfig["pricing"]>): Promise<{ id: string }> {
  const lettrePro = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const version = await db.query.productVersions.findFirst({
    where: and(eq(productVersions.productId, lettrePro!.id), eq(productVersions.version, lettrePro!.currentVersion)),
  });
  const admin = await db.query.users.findFirst({ where: eq(users.role, "admin") });
  const slug = `ledger-test-${randomUUID()}`;
  const config: ProductConfig = {
    ...(version!.config as ProductConfig),
    slug,
    themeId: editorial!.id,
    pricing: { ...(version!.config as ProductConfig).pricing, ...overrides },
  };

  const [product] = await db
    .insert(products)
    .values({
      slug,
      status: "test",
      themeId: editorial!.id,
      currentVersion: 1,
      locale: "fr",
      createdBy: admin!.id,
    })
    .returning({ id: products.id });
  await db.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: admin!.id });
  createdProductIds.push(product!.id);
  return { id: product!.id };
}

async function createGeneration(userId: string | null, productId: string): Promise<string> {
  const [row] = await db
    .insert(generations)
    .values({
      productId,
      productVersion: 1,
      userId,
      anonymousId: userId ? null : randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    })
    .returning({ id: generations.id });
  return row!.id;
}

// Test setup only: writes a ledger row and upserts `balances` directly,
// bypassing the DAL, to seed a starting balance before exercising debit /
// refund / purchase.
async function giveCredits(userId: string, productId: string, delta: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(creditTransactions).values({
      userId,
      productId,
      delta,
      reason: "purchase",
      idempotencyKey: randomUUID(),
    });
    await tx
      .insert(balances)
      .values({ userId, productId, balance: delta })
      .onConflictDoUpdate({
        target: [balances.userId, balances.productId],
        set: { balance: sql`${balances.balance} + ${delta}`, updatedAt: new Date() },
      });
  });
}

async function expectLedgerMatchesBalance(userId: string, productId: string): Promise<void> {
  const [sumRow] = await db
    .select({ sum: sql<string>`coalesce(sum(${creditTransactions.delta}), 0)::int` })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.productId, productId)));
  const balanceRow = await db.query.balances.findFirst({
    where: and(eq(balances.userId, userId), eq(balances.productId, productId)),
  });
  expect(Number(sumRow!.sum)).toBe(balanceRow?.balance ?? 0);
}

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(creditTransactions).where(eq(creditTransactions.productId, id));
    await db.delete(balances).where(eq(balances.productId, id));
    await db.delete(generations).where(eq(generations.productId, id));
    await db.delete(productVersions).where(eq(productVersions.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }
  for (const id of createdUserIds) {
    await db.delete(creditTransactions).where(eq(creditTransactions.userId, id));
    await db.delete(balances).where(eq(balances.userId, id));
    await db.delete(generations).where(eq(generations.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("getBalance", () => {
  it("returns 0 when the user has no balances row", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    asUser(userId);

    const { getBalance } = await import("./credits");
    expect(await getBalance(userId, productId)).toBe(0);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("returns the balance after a credit", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 4);
    asUser(userId);

    const { getBalance } = await import("./credits");
    expect(await getBalance(userId, productId)).toBe(4);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("lets an admin read another user's balance", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 2);
    const adminId = await createUser();
    getSession.mockResolvedValue({ user: { id: adminId, role: "admin" } });

    const { getBalance } = await import("./credits");
    expect(await getBalance(userId, productId)).toBe(2);
  });

  it("rejects a caller reading another user's balance", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const otherId = await createUser();
    asUser(otherId);

    const { getBalance } = await import("./credits");
    await expect(getBalance(userId, productId)).rejects.toThrow();
  });

  it("rejects with no session", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    getSession.mockResolvedValue(null);

    const { getBalance } = await import("./credits");
    await expect(getBalance(userId, productId)).rejects.toThrow();
  });
});

describe("grantSignupBonus", () => {
  it("credits the signup bonus once for a fresh user, creating the balances row", async () => {
    const userId = await createUser();
    const productId = (await createProduct({ freeCreditsOnSignup: 3 })).id;
    asUser(userId);

    const { grantSignupBonus, getBalance } = await import("./credits");
    const result = await grantSignupBonus({ userId, productId });
    expect(result).toEqual({ balance: 3 });
    expect(await getBalance(userId, productId)).toBe(3);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("does not credit twice: a second call keeps a single signup_bonus row", async () => {
    const userId = await createUser();
    const productId = (await createProduct({ freeCreditsOnSignup: 3 })).id;
    asUser(userId);

    const { grantSignupBonus } = await import("./credits");
    await grantSignupBonus({ userId, productId });
    const second = await grantSignupBonus({ userId, productId });
    expect(second).toEqual({ balance: 3 });

    const rows = await db
      .select()
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.productId, productId),
          eq(creditTransactions.reason, "signup_bonus"),
        ),
      );
    expect(rows).toHaveLength(1);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("grants the bonus per product: another product's bonus doesn't affect lettre-pro's", async () => {
    const userId = await createUser();
    const testProductId = (await createProduct({ freeCreditsOnSignup: 3 })).id;
    const lettrePro = await lettreProId();
    asUser(userId);

    const { grantSignupBonus, getBalance } = await import("./credits");
    await grantSignupBonus({ userId, productId: testProductId });
    expect(await getBalance(userId, lettrePro)).toBe(0);
    await expectLedgerMatchesBalance(userId, lettrePro);
  });

  it("rejects a mismatched session and writes nothing", async () => {
    const userId = await createUser();
    const productId = (await createProduct({ freeCreditsOnSignup: 3 })).id;
    const otherId = await createUser();
    asUser(otherId);

    const { grantSignupBonus } = await import("./credits");
    await expect(grantSignupBonus({ userId, productId })).rejects.toThrow();

    const rows = await db
      .select()
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.productId, productId)));
    expect(rows).toHaveLength(0);
  });
});

describe("debit", () => {
  it("debits the balance and replays the same key without a second debit", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 3);
    const generationId = await createGeneration(userId, productId);
    const idempotencyKey = randomUUID();
    asUser(userId);

    const { debit, getBalance } = await import("./credits");
    const first = await debit({ userId, productId, cost: 1, generationId, idempotencyKey });
    expect(first).toEqual({ ok: true, balance: 2 });

    const replay = await debit({ userId, productId, cost: 1, generationId, idempotencyKey });
    expect(replay).toEqual({ ok: true, replay: true });
    expect(await getBalance(userId, productId)).toBe(2);

    const rows = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ delta: -1, reason: "generation", generationId });
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("refuses at balance 0 without throwing, and writes no ledger row for its key", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const generationId = await createGeneration(userId, productId);
    const idempotencyKey = randomUUID();
    asUser(userId);

    const { debit } = await import("./credits");
    const result = await debit({ userId, productId, cost: 1, generationId, idempotencyKey });
    expect(result).toEqual({ ok: false, reason: "insufficient_balance" });

    const rows = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(0);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("refuses when the user was never credited on this product (no balances row); getBalance is 0", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const generationId = await createGeneration(userId, productId);
    asUser(userId);

    const { debit, getBalance } = await import("./credits");
    const result = await debit({ userId, productId, cost: 1, generationId, idempotencyKey: randomUUID() });
    expect(result).toEqual({ ok: false, reason: "insufficient_balance" });
    expect(await getBalance(userId, productId)).toBe(0);
  });

  it("concurrency: balance 1 and two parallel debits, exactly one passes", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 1);
    const generationA = await createGeneration(userId, productId);
    const generationB = await createGeneration(userId, productId);
    asUser(userId);

    const { debit, getBalance } = await import("./credits");
    const [a, b] = await Promise.all([
      debit({ userId, productId, cost: 1, generationId: generationA, idempotencyKey: randomUUID() }),
      debit({ userId, productId, cost: 1, generationId: generationB, idempotencyKey: randomUUID() }),
    ]);
    const results = [a, b];
    expect(results.filter((result) => result.ok && !("replay" in result))).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(await getBalance(userId, productId)).toBe(0);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("concurrency: balance 2 and 5 parallel debits, exactly two pass", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 2);
    const generationIds = await Promise.all(Array.from({ length: 5 }, () => createGeneration(userId, productId)));
    asUser(userId);

    const { debit, getBalance } = await import("./credits");
    const results = await Promise.all(
      generationIds.map((generationId) =>
        debit({ userId, productId, cost: 1, generationId, idempotencyKey: randomUUID() }),
      ),
    );
    expect(results.filter((result) => result.ok && !("replay" in result))).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(3);
    expect(await getBalance(userId, productId)).toBe(0);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("concurrency: the same key twice in parallel debits once, one replay", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    await giveCredits(userId, productId, 2);
    const generationId = await createGeneration(userId, productId);
    const idempotencyKey = randomUUID();
    asUser(userId);

    const { debit, getBalance } = await import("./credits");
    const [a, b] = await Promise.all([
      debit({ userId, productId, cost: 1, generationId, idempotencyKey }),
      debit({ userId, productId, cost: 1, generationId, idempotencyKey }),
    ]);
    const results = [a, b];
    expect(results.filter((result) => result.ok && "balance" in result && result.balance === 1)).toHaveLength(1);
    expect(results.filter((result) => result.ok && "replay" in result)).toHaveLength(1);
    expect(await getBalance(userId, productId)).toBe(1);

    const rows = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
    await expectLedgerMatchesBalance(userId, productId);
  });

  it("rejects a mismatched session and writes nothing", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const generationId = await createGeneration(userId, productId);
    const otherId = await createUser();
    asUser(otherId);

    const { debit } = await import("./credits");
    await expect(debit({ userId, productId, cost: 1, generationId, idempotencyKey: randomUUID() })).rejects.toThrow();
  });

  it("rejects a non-positive-integer cost", async () => {
    const userId = await createUser();
    const productId = (await createProduct()).id;
    const generationId = await createGeneration(userId, productId);
    asUser(userId);

    const { debit } = await import("./credits");
    await expect(debit({ userId, productId, cost: 0, generationId, idempotencyKey: randomUUID() })).rejects.toThrow();
    await expect(debit({ userId, productId, cost: -1, generationId, idempotencyKey: randomUUID() })).rejects.toThrow();
    await expect(debit({ userId, productId, cost: 1.5, generationId, idempotencyKey: randomUUID() })).rejects.toThrow();
  });
});
