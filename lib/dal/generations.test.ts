import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { withTestTransaction } from "@/lib/db/test-transaction";
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

// A dedicated, never-shared user for a test that counts *all* of a user's
// generations (before/after). `db.query.users.findFirst()` (used elsewhere
// in this file for tests that don't count) returns whichever row Postgres
// happens to return first, the same row app/(products)/[app]/api/generate/route.test.ts
// signs in as and writes real generations for: running both files together
// reproduced `expect(after).toBe(before + 1)` failing (an extra concurrent
// row landed on the same shared user between the two reads). A fresh user
// per test removes any other suite from the count.
async function freshUserId(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name: "Generations test user", email: `${id}@example.test`, role: "user" });
  return id;
}

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
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    },
    createdBy: owner!.id,
  });
  return product!.id;
}

// Fixtures and cleanup only, refactored onto withTestTransaction
// (TOOLING-test-transaction): every test below except the two
// `Promise.all` x 5 concurrency tests in "recordAnonymousGeneration" now
// runs inside a transaction that is always rolled back, so the manual
// per-test `db.delete(generations)...` calls and the file-level
// createdProductIds/createdUserIds + afterAll this file used are gone.
// Assertions are unchanged. The two concurrency tests keep their original,
// non-transactional pattern with their own explicit cleanup (tdd-workflow
// skill): postgres.js never releases a savepoint and concurrent savepoints
// on one connection are unsafe, so a test that proves a real lock or a real
// idempotent insert across several connections needs connections of its
// own, not a single shared transaction.
describe("recordGeneration", () => {
  it("inserts a pending row for an anonymous generation (no session)", async () => {
    await withTestTransaction(async () => {
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
    });
  });

  it("is idempotent: a replay with the same key returns the same id, one row", async () => {
    await withTestTransaction(async () => {
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
    });
  });

  it("throws when userId does not match the session", async () => {
    await withTestTransaction(async () => {
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
});

describe("saveGeneration", () => {
  it("marks a generation succeeded with its tokens, cost and model", async () => {
    await withTestTransaction(async () => {
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
    });
  });
});

describe("markGenerationFailed", () => {
  it("marks a generation failed", async () => {
    await withTestTransaction(async () => {
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
    });
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
    await withTestTransaction(async () => {
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
    });
  });
});

describe("countPriorGenerations", () => {
  it("anonymous: 0 with no prior row, 1 after a pending one for the same cookie", async () => {
    await withTestTransaction(async () => {
      getSession.mockResolvedValue(null);
      const { recordGeneration, countPriorGenerations } = await import("./generations");
      const productId = await lettreProId();
      const anonymousId = randomUUID();
      const ipHash = `ip-${randomUUID()}`;

      expect(await countPriorGenerations({ productId, userId: null, anonymousId, ipHash })).toBe(0);

      await recordGeneration({
        productId,
        productVersion: 1,
        userId: null,
        anonymousId,
        ipHash,
        input: {},
        idempotencyKey: randomUUID(),
      });

      expect(await countPriorGenerations({ productId, userId: null, anonymousId, ipHash })).toBe(1);
    });
  });

  it("anonymous: the same IP with a different cookie still counts", async () => {
    await withTestTransaction(async () => {
      getSession.mockResolvedValue(null);
      const { recordGeneration, countPriorGenerations } = await import("./generations");
      const productId = await lettreProId();
      const ipHash = `ip-${randomUUID()}`;

      await recordGeneration({
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
    });
  });

  it("anonymous: a failed generation is not counted", async () => {
    await withTestTransaction(async () => {
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
    });
  });

  it("anonymous: a row from another product is not counted", async () => {
    await withTestTransaction(async () => {
      getSession.mockResolvedValue(null);
      const { recordGeneration, countPriorGenerations } = await import("./generations");
      const productId = await lettreProId();
      const anonymousId = randomUUID();
      const ipHash = `ip-${randomUUID()}`;

      await recordGeneration({
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
    });
  });

  it("by userId: counts the signed-in user's prior generations on this product", async () => {
    await withTestTransaction(async () => {
      const userId = await freshUserId();
      getSession.mockResolvedValue({ user: { id: userId } });
      const { recordGeneration, countPriorGenerations } = await import("./generations");
      const productId = await lettreProId();

      const before = await countPriorGenerations({
        productId,
        userId,
        anonymousId: null,
        ipHash: null,
      });

      await recordGeneration({
        productId,
        productVersion: 1,
        userId,
        anonymousId: null,
        ipHash: "hash",
        input: {},
        idempotencyKey: randomUUID(),
      });

      const after = await countPriorGenerations({ productId, userId, anonymousId: null, ipHash: null });
      expect(after).toBe(before + 1);
    });
  });

  it("throws when the given userId does not match the session", async () => {
    await withTestTransaction(async () => {
      const userId = await freshUserId();
      getSession.mockResolvedValue({ user: { id: userId } });
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

  // QA1-P1-B5: a signed-in caller's count must also see the anonymous
  // generation(s) made by the same visitor (same cookie, before signup),
  // otherwise the route re-fires first_generation at the first signed-in
  // generation (docs/01 › funnel, specs/SA-02-outil.md › Acceptation 6).
  describe("by userId: linking the caller's anonymous generations (QA1-P1-B5)", () => {
    it("also counts an anonymous generation made with the given anonymousId on this product", async () => {
      await withTestTransaction(async () => {
        const userId = await freshUserId();
        const productId = await lettreProId();
        const anonymousId = randomUUID();

        getSession.mockResolvedValue(null);
        const { recordGeneration, countPriorGenerations } = await import("./generations");
        await recordGeneration({
          productId,
          productVersion: 1,
          userId: null,
          anonymousId,
          ipHash: "hash",
          input: {},
          idempotencyKey: randomUUID(),
        });

        getSession.mockResolvedValue({ user: { id: userId } });
        expect(await countPriorGenerations({ productId, userId, anonymousId, ipHash: null })).toBe(1);
      });
    });

    it("does not count an anonymous generation made with a different anonymousId", async () => {
      await withTestTransaction(async () => {
        const userId = await freshUserId();
        const productId = await lettreProId();

        getSession.mockResolvedValue(null);
        const { recordGeneration, countPriorGenerations } = await import("./generations");
        await recordGeneration({
          productId,
          productVersion: 1,
          userId: null,
          anonymousId: randomUUID(),
          ipHash: "hash",
          input: {},
          idempotencyKey: randomUUID(),
        });

        getSession.mockResolvedValue({ user: { id: userId } });
        expect(await countPriorGenerations({ productId, userId, anonymousId: randomUUID(), ipHash: null })).toBe(0);
      });
    });

    it("does not count the same anonymousId's generation on another product", async () => {
      await withTestTransaction(async () => {
        const userId = await freshUserId();
        const productId = await lettreProId();
        const otherId = await otherProductId();
        const anonymousId = randomUUID();

        getSession.mockResolvedValue(null);
        const { recordGeneration, countPriorGenerations } = await import("./generations");
        await recordGeneration({
          productId: otherId,
          productVersion: 1,
          userId: null,
          anonymousId,
          ipHash: "hash",
          input: {},
          idempotencyKey: randomUUID(),
        });

        getSession.mockResolvedValue({ user: { id: userId } });
        expect(await countPriorGenerations({ productId, userId, anonymousId, ipHash: null })).toBe(0);
      });
    });

    it("does not count a failed anonymous generation with the given anonymousId", async () => {
      await withTestTransaction(async () => {
        const userId = await freshUserId();
        const productId = await lettreProId();
        const anonymousId = randomUUID();

        getSession.mockResolvedValue(null);
        const { recordGeneration, markGenerationFailed, countPriorGenerations } = await import("./generations");
        const { id } = await recordGeneration({
          productId,
          productVersion: 1,
          userId: null,
          anonymousId,
          ipHash: "hash",
          input: {},
          idempotencyKey: randomUUID(),
        });
        await markGenerationFailed(id);

        getSession.mockResolvedValue({ user: { id: userId } });
        expect(await countPriorGenerations({ productId, userId, anonymousId, ipHash: null })).toBe(0);
      });
    });

    it("ignores ipHash for a signed-in caller: a shared IP alone does not link another visitor's row", async () => {
      await withTestTransaction(async () => {
        const userId = await freshUserId();
        const productId = await lettreProId();
        const sharedIpHash = `ip-${randomUUID()}`;

        getSession.mockResolvedValue(null);
        const { recordGeneration, countPriorGenerations } = await import("./generations");
        await recordGeneration({
          productId,
          productVersion: 1,
          userId: null,
          anonymousId: randomUUID(),
          ipHash: sharedIpHash,
          input: {},
          idempotencyKey: randomUUID(),
        });

        getSession.mockResolvedValue({ user: { id: userId } });
        expect(
          await countPriorGenerations({ productId, userId, anonymousId: randomUUID(), ipHash: sharedIpHash }),
        ).toBe(0);
      });
    });

    it("with anonymousId null, only counts the user's own rows", async () => {
      await withTestTransaction(async () => {
        const userId = await freshUserId();
        const productId = await lettreProId();

        getSession.mockResolvedValue(null);
        const { recordGeneration, countPriorGenerations } = await import("./generations");
        await recordGeneration({
          productId,
          productVersion: 1,
          userId: null,
          anonymousId: randomUUID(),
          ipHash: "hash",
          input: {},
          idempotencyKey: randomUUID(),
        });

        getSession.mockResolvedValue({ user: { id: userId } });
        expect(await countPriorGenerations({ productId, userId, anonymousId: null, ipHash: null })).toBe(0);
      });
    });
  });
});

describe("recordAnonymousGeneration", () => {
  it("succeeds under the limit and returns the free generations left", async () => {
    await withTestTransaction(async () => {
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
    });
  });

  it("refuses at the limit with 'signup_required', writing nothing", async () => {
    await withTestTransaction(async () => {
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
    });
  });

  // Kept on the original pattern (own connections, explicit cleanup): these
  // two prove a real lock across several concurrent Postgres connections,
  // which a single shared transaction cannot — postgres.js never releases a
  // savepoint and concurrent savepoints on one connection are unsafe.
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
    await withTestTransaction(async () => {
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
    });
  });

  it("a replayed idempotency key returns the existing row instead of inserting again", async () => {
    await withTestTransaction(async () => {
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
    });
  });
});

describe("countRecentGenerations", () => {
  // Inserts a row directly (bypassing recordGeneration) so `createdAt` can
  // be backdated: the window is anchored on the database clock (SECURITY
  // plan), so a fixture 61 s in the past must actually be 61 s in the past
  // in Postgres, not merely inserted "a moment ago" from Node's clock.
  async function insertAt(args: {
    productId: string;
    userId: string | null;
    ipHash: string;
    secondsAgo: number;
    status?: "pending" | "succeeded" | "failed";
  }): Promise<string> {
    const [row] = await db
      .insert(generations)
      .values({
        productId: args.productId,
        productVersion: 1,
        userId: args.userId,
        anonymousId: args.userId ? null : randomUUID(),
        ipHash: args.ipHash,
        input: {},
        status: args.status ?? "succeeded",
        idempotencyKey: randomUUID(),
        createdAt: sql`now() - make_interval(secs => ${args.secondsAgo})`,
      })
      .returning({ id: generations.id });
    return row!.id;
  }

  it("counts rows inside the 60 s window and excludes older ones, by user and by ip", async () => {
    await withTestTransaction(async () => {
      // freshUserId(), not a shared db.query.users.findFirst() row (review
      // round, HIGH): app/(products)/[app]/api/generate/route.test.ts also
      // grabs "a" user this way and, unmocked, writes real generations for it
      // through the real POST handler. Both files run concurrently under
      // Vitest against the same worktree DB; a concurrent write landing for
      // the shared user between this test's inserts and its
      // countRecentGenerations call pushed `byUser` to 3 instead of 2.
      // Reproduced directly: looping the two files together failed `expect(
      // byUser).toBe(2)` with `byUser` off by one in 4 of 5 runs before this
      // fix. A fresh, never-shared user removes any other suite from the
      // count.
      const userId = await freshUserId();
      getSession.mockResolvedValue({ user: { id: userId } });
      const { countRecentGenerations } = await import("./generations");
      const productId = await lettreProId();
      const ipHash = `ip-${randomUUID()}`;
      await insertAt({ productId, userId, ipHash, secondsAgo: 0 });
      await insertAt({ productId, userId, ipHash, secondsAgo: 30 });
      // Outside the window: must not be counted.
      await insertAt({ productId, userId, ipHash, secondsAgo: 61 });

      const { byUser, byIp } = await countRecentGenerations({ userId, ipHash, windowSeconds: 60 });
      expect(byUser).toBe(2);
      expect(byIp).toBe(2);
    });
  });

  it("scopes by ip_hash across products, and a failed row still counts (rate limiting counts attempts)", async () => {
    await withTestTransaction(async () => {
      getSession.mockResolvedValue(null);
      const { countRecentGenerations } = await import("./generations");
      const productId = await lettreProId();
      const otherId = await otherProductId();
      const ipHash = `ip-${randomUUID()}`;
      await insertAt({ productId, userId: null, ipHash, secondsAgo: 0, status: "succeeded" });
      await insertAt({ productId: otherId, userId: null, ipHash, secondsAgo: 0, status: "failed" });

      const { byIp } = await countRecentGenerations({ userId: null, ipHash, windowSeconds: 60 });
      expect(byIp).toBe(2);
    });
  });

  it("byUser is 0 for an anonymous caller (userId null), regardless of byIp", async () => {
    await withTestTransaction(async () => {
      getSession.mockResolvedValue(null);
      const { countRecentGenerations } = await import("./generations");
      const productId = await lettreProId();
      const ipHash = `ip-${randomUUID()}`;
      await insertAt({ productId, userId: null, ipHash, secondsAgo: 0 });

      const { byUser, byIp } = await countRecentGenerations({ userId: null, ipHash, windowSeconds: 60 });
      expect(byUser).toBe(0);
      expect(byIp).toBe(1);
    });
  });

  it("throws when the given userId does not match the session", async () => {
    await withTestTransaction(async () => {
      const randomUser = await db.query.users.findFirst();
      getSession.mockResolvedValue({ user: { id: randomUser!.id } });
      const { countRecentGenerations } = await import("./generations");
      await expect(
        countRecentGenerations({ userId: "someone-else", ipHash: "hash", windowSeconds: 60 }),
      ).rejects.toThrow();
    });
  });
});
