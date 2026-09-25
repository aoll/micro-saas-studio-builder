import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { balances, creditTransactions, events, productVersions, products, purchases, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

// SA-05 integration (real ledger and events, shared worktree DB): the
// purchase action's own logic (auth, validation, guard, pack lookup) is
// covered by _actions.test.ts's mocks; this file exercises it against the
// real DAL (LEDGER, TRACKING), like credits.test.ts's "purchase" describe
// block, but through the Server Action's public surface.
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

// next/server's after() and next/cache's refresh() both need a real
// request context (route.test.ts's same trick): after() just collects
// tasks so this test can await them, refresh() is a no-op spy. next/cache's
// other exports (cacheLife/cacheTag) are needed by getProduct's 'use cache'.
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
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), refresh: vi.fn() }));

afterEach(() => {
  afterCallbacks.length = 0;
  getSession.mockReset();
});

async function flushAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.splice(0).map((callback) => callback()));
}

function asUser(userId: string) {
  getSession.mockResolvedValue({ user: { id: userId, role: "user" } });
}

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];

async function createUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name: "Checkout test user", email: `${id}@checkout.test`, emailVerified: true });
  createdUserIds.push(id);
  return id;
}

// A private test product, copied from lettre-pro's config (credits.test.ts's
// same helper), so this file never touches the seeded product's balances.
async function createProduct(): Promise<{ id: string; slug: string }> {
  const lettrePro = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const version = await db.query.productVersions.findFirst({
    where: and(eq(productVersions.productId, lettrePro!.id), eq(productVersions.version, lettrePro!.currentVersion)),
  });
  const admin = await db.query.users.findFirst({ where: eq(users.role, "admin") });
  const slug = `checkout-test-${randomUUID()}`;
  const config: ProductConfig = { ...(version!.config as ProductConfig), slug, themeId: editorial!.id };

  const [product] = await db
    .insert(products)
    .values({ slug, status: "test", themeId: editorial!.id, currentVersion: 1, locale: "fr", createdBy: admin!.id })
    .returning({ id: products.id });
  await db.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: admin!.id });
  createdProductIds.push(product!.id);
  return { id: product!.id, slug };
}

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(events).where(eq(events.productId, id));
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

describe("purchase (real ledger and events)", () => {
  it("credits the ledger once on a sequential replay of the same idempotency key", async () => {
    const userId = await createUser();
    const { id: productId, slug } = await createProduct();
    asUser(userId);
    const key = randomUUID();

    const { purchase } = await import("./_actions");
    const first = await purchase(slug, "pack-10", key);
    const second = await purchase(slug, "pack-10", key);

    expect(first).toEqual({ ok: true, balance: 10 });
    expect(second).toEqual({ ok: true, balance: 10 });

    const purchaseRows = await db.select().from(purchases).where(eq(purchases.productId, productId));
    expect(purchaseRows).toHaveLength(1);
  });

  it("credits the ledger once when the same idempotency key is replayed concurrently", async () => {
    const userId = await createUser();
    const { id: productId, slug } = await createProduct();
    asUser(userId);
    const key = randomUUID();

    const { purchase } = await import("./_actions");
    const [first, second] = await Promise.all([purchase(slug, "pack-10", key), purchase(slug, "pack-10", key)]);

    expect(first).toEqual({ ok: true, balance: 10 });
    expect(second).toEqual({ ok: true, balance: 10 });

    const purchaseRows = await db.select().from(purchases).where(eq(purchases.productId, productId));
    expect(purchaseRows).toHaveLength(1);
  });

  it("keeps the balance equal to the sum of the ledger after a purchase", async () => {
    const userId = await createUser();
    const { id: productId, slug } = await createProduct();
    asUser(userId);

    const { purchase } = await import("./_actions");
    await purchase(slug, "pack-50", randomUUID());

    const [sumRow] = await db.query.creditTransactions
      .findMany({ where: and(eq(creditTransactions.userId, userId), eq(creditTransactions.productId, productId)) })
      .then((rows) => [rows.reduce((sum, row) => sum + row.delta, 0)]);
    const balanceRow = await db.query.balances.findFirst({
      where: and(eq(balances.userId, userId), eq(balances.productId, productId)),
    });
    expect(balanceRow?.balance).toBe(sumRow);
    expect(balanceRow?.balance).toBe(50);
  });

  it("writes no row at all for an unknown pack", async () => {
    const userId = await createUser();
    const { slug } = await createProduct();
    asUser(userId);

    const { purchase } = await import("./_actions");
    const result = await purchase(slug, "does-not-exist", randomUUID());

    expect(result).toEqual({ ok: false, error: "unknown_pack" });
    const purchaseRows = await db.select().from(purchases).where(eq(purchases.userId, userId));
    expect(purchaseRows).toHaveLength(0);
    const balanceRow = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
    expect(balanceRow).toBeUndefined();
  });

  it("writes one purchase event carrying the pack in its metadata", async () => {
    const userId = await createUser();
    const { id: productId, slug } = await createProduct();
    asUser(userId);
    const key = randomUUID();

    const { purchase } = await import("./_actions");
    await purchase(slug, "pack-10", key);
    await flushAfterCallbacks();

    const eventRows = await db.query.events.findMany({
      where: and(eq(events.productId, productId), eq(events.type, "purchase")),
    });
    expect(eventRows).toHaveLength(1);
    expect(eventRows[0]?.metadata).toMatchObject({
      packId: "pack-10",
      credits: 10,
      amountCents: 490,
      purchaseKey: key,
    });
    expect(eventRows[0]?.userId).toBe(userId);
  });
});
