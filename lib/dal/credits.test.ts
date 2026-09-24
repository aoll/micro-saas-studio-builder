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
