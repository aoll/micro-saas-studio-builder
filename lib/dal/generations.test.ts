import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
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

const createdProductIds: string[] = [];

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(productVersions).where(eq(productVersions.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }
});

// A second product, inserted directly (bypassing createProduct/requireAdmin,
// which this file does not mock): used only to check that
// countPriorGenerations scopes by productId.
async function otherProductId(): Promise<string> {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const [product] = await db
    .insert(products)
    .values({
      slug: `generations-other-${randomUUID()}`,
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
      name: "Other",
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
  createdProductIds.push(product!.id);
  return product!.id;
}

describe("recordGeneration", () => {
  it("inserts a pending row for an anonymous generation (no session)", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration } = await import("./generations");
    const idempotencyKey = randomUUID();
    const result = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: { poste: "Développeur" },
      idempotencyKey,
    });
    expect(result.id).toBeTruthy();

    const row = await db.query.generations.findFirst({ where: eq(generations.id, result.id) });
    expect(row?.status).toBe("pending");
    await db.delete(generations).where(eq(generations.id, result.id));
  });

  it("is idempotent: a replay with the same key returns the same id, one row", async () => {
    const randomUser = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: randomUser!.id } });
    const { recordGeneration } = await import("./generations");
    const idempotencyKey = randomUUID();
    const args = {
      productId: await lettreProId(),
      productVersion: 1,
      userId: randomUser!.id,
      anonymousId: null,
      ipHash: "hash",
      input: { poste: "Développeur" },
      idempotencyKey,
    };
    const first = await recordGeneration(args);
    const second = await recordGeneration(args);
    expect(second.id).toBe(first.id);

    const rows = await db.select().from(generations).where(eq(generations.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
    await db.delete(generations).where(eq(generations.id, first.id));
  });

  it("throws when userId does not match the session", async () => {
    const randomUser = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: randomUser!.id } });
    const { recordGeneration } = await import("./generations");
    await expect(
      recordGeneration({
        productId: await lettreProId(),
        productVersion: 1,
        userId: "someone-else",
        anonymousId: null,
        ipHash: "hash",
        input: {},
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow();
  });
});

describe("saveGeneration", () => {
  it("marks a generation succeeded with its tokens, cost and model", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, saveGeneration } = await import("./generations");
    const { id } = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });

    await saveGeneration(id, {
      output: "Lettre générée",
      model: "anthropic/claude-haiku-4.5",
      inputTokens: 200,
      outputTokens: 140,
      cachedInputTokens: 0,
      costMicros: 300,
    });

    const row = await db.query.generations.findFirst({ where: eq(generations.id, id) });
    expect(row?.status).toBe("succeeded");
    expect(row?.model).toBe("anthropic/claude-haiku-4.5");
    expect(row?.inputTokens).toBe(200);
    expect(row?.costMicros).toBe(300);
    await db.delete(generations).where(eq(generations.id, id));
  });
});

describe("markGenerationFailed", () => {
  it("marks a generation failed", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, markGenerationFailed } = await import("./generations");
    const { id } = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });

    await markGenerationFailed(id);
    const row = await db.query.generations.findFirst({ where: eq(generations.id, id) });
    expect(row?.status).toBe("failed");
    await db.delete(generations).where(eq(generations.id, id));
  });
});

describe("hashIp", () => {
  it("is stable for the same IP and produces 64 hex characters", async () => {
    const { hashIp } = await import("./generations");
    const first = hashIp("203.0.113.42");
    const second = hashIp("203.0.113.42");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for a different IP", async () => {
    const { hashIp } = await import("./generations");
    expect(hashIp("203.0.113.42")).not.toBe(hashIp("203.0.113.43"));
  });

  it("never contains the plain IP", async () => {
    const { hashIp } = await import("./generations");
    expect(hashIp("203.0.113.42")).not.toContain("203.0.113.42");
  });
});

describe("findGenerationByKey", () => {
  it("returns null for an unknown key", async () => {
    const { findGenerationByKey } = await import("./generations");
    expect(await findGenerationByKey(randomUUID())).toBeNull();
  });

  it("returns the id and status of an existing row", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, findGenerationByKey } = await import("./generations");
    const idempotencyKey = randomUUID();
    const { id } = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey,
    });

    expect(await findGenerationByKey(idempotencyKey)).toEqual({ id, status: "pending" });
    await db.delete(generations).where(eq(generations.id, id));
  });
});

describe("countPriorGenerations", () => {
  it("anonymous: 0 with no prior row, 1 after a pending one for the same cookie", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, countPriorGenerations } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;

    expect(await countPriorGenerations({ productId, userId: null, anonymousId, ipHash })).toBe(0);

    const { id } = await recordGeneration({
      productId,
      productVersion: 1,
      userId: null,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
    });

    expect(await countPriorGenerations({ productId, userId: null, anonymousId, ipHash })).toBe(1);
    await db.delete(generations).where(eq(generations.id, id));
  });

  it("anonymous: the same IP with a different cookie still counts", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, countPriorGenerations } = await import("./generations");
    const productId = await lettreProId();
    const ipHash = `ip-${randomUUID()}`;

    const { id } = await recordGeneration({
      productId,
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
    });

    const otherCookie = randomUUID();
    expect(await countPriorGenerations({ productId, userId: null, anonymousId: otherCookie, ipHash })).toBe(1);
    await db.delete(generations).where(eq(generations.id, id));
  });

  it("anonymous: a failed generation is not counted", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, markGenerationFailed, countPriorGenerations } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;

    const { id } = await recordGeneration({
      productId,
      productVersion: 1,
      userId: null,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
    });
    await markGenerationFailed(id);

    expect(await countPriorGenerations({ productId, userId: null, anonymousId, ipHash })).toBe(0);
    await db.delete(generations).where(eq(generations.id, id));
  });

  it("anonymous: a row from another product is not counted", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, countPriorGenerations } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;

    const { id } = await recordGeneration({
      productId,
      productVersion: 1,
      userId: null,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
    });

    const otherId = await otherProductId();
    expect(await countPriorGenerations({ productId: otherId, userId: null, anonymousId, ipHash })).toBe(0);
    await db.delete(generations).where(eq(generations.id, id));
  });

  it("by userId: counts the signed-in user's prior generations on this product", async () => {
    const randomUser = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: randomUser!.id } });
    const { recordGeneration, countPriorGenerations } = await import("./generations");
    const productId = await lettreProId();

    const before = await countPriorGenerations({
      productId,
      userId: randomUser!.id,
      anonymousId: null,
      ipHash: null,
    });

    const { id } = await recordGeneration({
      productId,
      productVersion: 1,
      userId: randomUser!.id,
      anonymousId: null,
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });

    const after = await countPriorGenerations({ productId, userId: randomUser!.id, anonymousId: null, ipHash: null });
    expect(after).toBe(before + 1);
    await db.delete(generations).where(eq(generations.id, id));
  });

  it("throws when the given userId does not match the session", async () => {
    const randomUser = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: randomUser!.id } });
    const { countPriorGenerations } = await import("./generations");
    await expect(
      countPriorGenerations({
        productId: await lettreProId(),
        userId: "someone-else",
        anonymousId: null,
        ipHash: null,
      }),
    ).rejects.toThrow();
  });
});

describe("recordAnonymousGeneration", () => {
  it("succeeds under the limit and returns the free generations left", async () => {
    const { recordAnonymousGeneration } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;

    const result = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
      limit: 1,
    });

    expect(result).toMatchObject({ ok: true, freeGenerationsLeft: 0, isFirst: true });
    if (result.ok) await db.delete(generations).where(eq(generations.id, result.id));
  });

  it("refuses at the limit with 'signup_required', writing nothing", async () => {
    const { recordAnonymousGeneration, findGenerationByKey } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;

    const first = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
      limit: 1,
    });
    expect(first.ok).toBe(true);

    const secondKey = randomUUID();
    const second = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: secondKey,
      limit: 1,
    });
    expect(second).toEqual({ ok: false, reason: "signup_required" });
    expect(await findGenerationByKey(secondKey)).toBeNull();

    if (first.ok) await db.delete(generations).where(eq(generations.id, first.id));
  });

  it("5 concurrent calls with the same cookie produce exactly `limit` rows", async () => {
    const { recordAnonymousGeneration } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;
    const limit = 2;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        recordAnonymousGeneration({
          productId,
          productVersion: 1,
          anonymousId,
          ipHash,
          input: {},
          idempotencyKey: randomUUID(),
          limit,
        }),
      ),
    );

    const succeeded = results.filter((result) => result.ok);
    const refused = results.filter((result) => !result.ok);
    expect(succeeded).toHaveLength(limit);
    expect(refused).toHaveLength(5 - limit);
    refused.forEach((result) => expect(result).toEqual({ ok: false, reason: "signup_required" }));

    const rows = await db.query.generations.findMany({ where: eq(generations.anonymousId, anonymousId) });
    expect(rows).toHaveLength(limit);
    await db.delete(generations).where(eq(generations.anonymousId, anonymousId));
  });

  it("5 concurrent calls with the same IP but different cookies produce exactly `limit` rows", async () => {
    const { recordAnonymousGeneration } = await import("./generations");
    const productId = await lettreProId();
    const ipHash = `ip-${randomUUID()}`;
    const limit = 2;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        recordAnonymousGeneration({
          productId,
          productVersion: 1,
          anonymousId: randomUUID(),
          ipHash,
          input: {},
          idempotencyKey: randomUUID(),
          limit,
        }),
      ),
    );

    const succeeded = results.filter((result) => result.ok);
    expect(succeeded).toHaveLength(limit);

    const rows = await db.query.generations.findMany({ where: eq(generations.ipHash, ipHash) });
    expect(rows).toHaveLength(limit);
    await db.delete(generations).where(eq(generations.ipHash, ipHash));
  });

  it("a failed generation does not count against the limit", async () => {
    const { recordAnonymousGeneration, markGenerationFailed } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;

    const first = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
      limit: 1,
    });
    if (first.ok) await markGenerationFailed(first.id);

    const second = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey: randomUUID(),
      limit: 1,
    });
    expect(second).toMatchObject({ ok: true, isFirst: true });

    await db.delete(generations).where(eq(generations.anonymousId, anonymousId));
  });

  it("a replayed idempotency key returns the existing row instead of inserting again", async () => {
    const { recordAnonymousGeneration } = await import("./generations");
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const ipHash = `ip-${randomUUID()}`;
    const idempotencyKey = randomUUID();

    const first = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey,
      limit: 1,
    });
    const second = await recordAnonymousGeneration({
      productId,
      productVersion: 1,
      anonymousId,
      ipHash,
      input: {},
      idempotencyKey,
      limit: 1,
    });

    expect(first.ok && second.ok && first.id === second.id).toBe(true);
    const rows = await db.select().from(generations).where(eq(generations.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
    await db.delete(generations).where(eq(generations.idempotencyKey, idempotencyKey));
  });
});
