import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { generations, productVersions, products, themes } from "@/lib/db/schema";
import { SEED_OWNER } from "@/scripts/seed";

const getSession = vi.fn();
vi.mock("./session", () => ({ getSession: () => getSession() }));

afterEach(() => {
  getSession.mockReset();
});

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  return row!.id;
}

// Fresh user per test (seeded users carry other suites' generation rows):
// created directly, bypassing signup/Better Auth, which this file does not
// exercise.
async function createUser(): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), name: "History test user", email: `history-${randomUUID()}@example.com` })
    .returning({ id: users.id });
  return row!.id;
}

// Fresh product per isolation test, so its rows never mix with other
// suites' generations on lettre-pro.
async function createProduct(): Promise<string> {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const [product] = await db
    .insert(products)
    .values({
      slug: `history-${randomUUID()}`,
      status: "test",
      themeId: editorial!.id,
      currentVersion: 1,
      locale: "fr",
      createdBy: owner!.id,
    })
    .returning({ id: products.id });
  await db.insert(productVersions).values({
    productId: product!.id,
    version: 1,
    config: {
      slug: product!.id,
      name: "History test product",
      status: "test",
      themeId: editorial!.id,
      locale: "fr",
      branding: {},
      landing: { headline: "H", subheadline: "S", faq: [], seoTitle: "T", seoDescription: "D" },
      inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
      generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "About {{topic}}", outputType: "markdown" },
      pricing: { freeCreditsOnSignup: 3, anonymousFreeGenerations: 1, costPerGeneration: 1, packs: [] },
    },
    createdBy: owner!.id,
  });
  return product!.id;
}

async function insertGeneration(overrides: {
  productId: string;
  userId?: string | null;
  anonymousId?: string | null;
  status?: "pending" | "succeeded" | "failed";
  input?: Record<string, unknown>;
  output?: unknown;
  createdAt?: Date;
}): Promise<string> {
  const [row] = await db
    .insert(generations)
    .values({
      productId: overrides.productId,
      productVersion: 1,
      userId: overrides.userId ?? null,
      anonymousId: overrides.anonymousId ?? null,
      ipHash: "hash",
      input: overrides.input ?? {},
      output: overrides.output ?? "output",
      status: overrides.status ?? "succeeded",
      idempotencyKey: randomUUID(),
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning({ id: generations.id });
  return row!.id;
}

describe("listGenerations", () => {
  it("has the spec's literal signature", async () => {
    const { listGenerations } = await import("./history");
    expectTypeOf(listGenerations).parameter(0).toBeString();
    expectTypeOf(listGenerations).parameter(1).toBeString();
    expectTypeOf(listGenerations).parameter(2).toBeNumber();
    expectTypeOf(listGenerations).returns.resolves.toEqualTypeOf<import("./history").HistoryPage>();
  });

  it("returns an empty page for a user with no generations", async () => {
    const userId = await createUser();
    getSession.mockResolvedValue({ user: { id: userId } });
    const { listGenerations } = await import("./history");

    const result = await listGenerations(userId, await lettreProId(), 1);
    expect(result).toEqual({ entries: [], page: 1, total: 0, hasMore: false });
  });

  it("orders newest first and paginates 20 per page, with a stable order across equal timestamps", async () => {
    const userId = await createUser();
    const productId = await createProduct();
    getSession.mockResolvedValue({ user: { id: userId } });

    const sameInstant = new Date("2026-01-01T00:00:00.000Z");
    const ids: string[] = [];
    for (let index = 0; index < 21; index += 1) {
      // Two rows share the same timestamp to exercise the tie-break
      // (`created_at DESC, id DESC`): no duplicate, no gap across pages.
      const createdAt = index < 2 ? sameInstant : new Date(sameInstant.getTime() + index * 1000);
      ids.push(await insertGeneration({ productId, userId, input: { topic: `t${index}` }, createdAt }));
    }

    const { listGenerations } = await import("./history");
    const firstPage = await listGenerations(userId, productId, 1);
    expect(firstPage.entries).toHaveLength(20);
    expect(firstPage.total).toBe(21);
    expect(firstPage.hasMore).toBe(true);

    const secondPage = await listGenerations(userId, productId, 2);
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);

    const allIds = [...firstPage.entries, ...secondPage.entries].map((entry) => entry.id);
    expect(new Set(allIds).size).toBe(21);
    expect(allIds.sort()).toEqual([...ids].sort());
  });

  it("excludes pending and failed generations from entries and total", async () => {
    const userId = await createUser();
    const productId = await createProduct();
    getSession.mockResolvedValue({ user: { id: userId } });

    await insertGeneration({ productId, userId, status: "succeeded" });
    await insertGeneration({ productId, userId, status: "pending" });
    await insertGeneration({ productId, userId, status: "failed" });

    const { listGenerations } = await import("./history");
    const result = await listGenerations(userId, productId, 1);
    expect(result.total).toBe(1);
    expect(result.entries).toHaveLength(1);
  });

  it("a user never sees another user's generations on the same product", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const productId = await createProduct();
    await insertGeneration({ productId, userId: userB });

    getSession.mockResolvedValue({ user: { id: userA } });
    const { listGenerations } = await import("./history");
    const result = await listGenerations(userA, productId, 1);
    expect(result).toEqual({ entries: [], page: 1, total: 0, hasMore: false });
  });

  it("throws when userOrAnonId does not match the session user", async () => {
    const userA = await createUser();
    getSession.mockResolvedValue({ user: { id: userA } });
    const { listGenerations } = await import("./history");
    await expect(listGenerations("someone-else", await lettreProId(), 1)).rejects.toThrow();
  });

  it("anonymous: filters by anonymous_id and excludes rows that have a user_id, even with the same value", async () => {
    const productId = await createProduct();
    const anonymousId = randomUUID();
    await insertGeneration({ productId, anonymousId });
    // A user-owned row that happens to carry the same anonymous_id (e.g. the
    // user's own signup cookie): must not leak into the anonymous view.
    const userB = await createUser();
    await insertGeneration({ productId, userId: userB, anonymousId });

    getSession.mockResolvedValue(null);
    const { listGenerations } = await import("./history");
    const result = await listGenerations(anonymousId, productId, 1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.output).toBeTruthy();
  });

  it("anonymous: an unknown anonymous id returns an empty page", async () => {
    getSession.mockResolvedValue(null);
    const { listGenerations } = await import("./history");
    const result = await listGenerations(randomUUID(), await lettreProId(), 1);
    expect(result).toEqual({ entries: [], page: 1, total: 0, hasMore: false });
  });

  it("normalizes a structured jsonb output to a pretty-printed JSON string", async () => {
    const userId = await createUser();
    const productId = await createProduct();
    getSession.mockResolvedValue({ user: { id: userId } });
    await insertGeneration({ productId, userId, output: { names: ["Alpha", "Beta"] } });

    const { listGenerations } = await import("./history");
    const result = await listGenerations(userId, productId, 1);
    expect(result.entries[0]!.output).toBe(JSON.stringify({ names: ["Alpha", "Beta"] }, null, 2));
  });

  it("keeps a string markdown output as-is", async () => {
    const userId = await createUser();
    const productId = await createProduct();
    getSession.mockResolvedValue({ user: { id: userId } });
    await insertGeneration({ productId, userId, output: "Bonjour, voici votre lettre." });

    const { listGenerations } = await import("./history");
    const result = await listGenerations(userId, productId, 1);
    expect(result.entries[0]!.output).toBe("Bonjour, voici votre lettre.");
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects a non-positive-integer page (%s) with a RangeError, no query",
    async (page) => {
      getSession.mockResolvedValue(null);
      const findMany = vi.spyOn(db.query.generations, "findMany");
      const { listGenerations } = await import("./history");
      await expect(listGenerations(randomUUID(), await lettreProId(), page)).rejects.toThrow(RangeError);
      expect(findMany).not.toHaveBeenCalled();
      findMany.mockRestore();
    },
  );
});
