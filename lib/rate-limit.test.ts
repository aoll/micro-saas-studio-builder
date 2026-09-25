import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// SECURITY plan, decision D4. api/generate/route.ts used to keep its own
// byte-for-byte copy of `clientIp`, proven identical to this one by a parity
// test below; the orchestrator follow-up that made the route import this
// function instead removed that copy, so the fixtures now just pin this
// single implementation's behavior directly.
const fixtures: Array<{ name: string; headers: Record<string, string>; expected: string }> = [
  { name: "a single x-forwarded-for", headers: { "x-forwarded-for": "203.0.113.42" }, expected: "203.0.113.42" },
  {
    name: "the first hop of a multi-value x-forwarded-for",
    headers: { "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" },
    expected: "203.0.113.42",
  },
  {
    name: "a multi-value x-forwarded-for with surrounding whitespace",
    headers: { "x-forwarded-for": "  203.0.113.42  , 70.41.3.18" },
    expected: "203.0.113.42",
  },
  {
    name: "x-real-ip when x-forwarded-for is absent",
    headers: { "x-real-ip": "198.51.100.7" },
    expected: "198.51.100.7",
  },
  {
    name: "x-real-ip when x-forwarded-for is an empty string",
    headers: { "x-forwarded-for": "", "x-real-ip": "198.51.100.7" },
    expected: "198.51.100.7",
  },
  {
    name: "'unknown' when x-forwarded-for is only whitespace and x-real-ip is absent",
    headers: { "x-forwarded-for": "   " },
    expected: "unknown",
  },
  { name: "'unknown' when neither header is present", headers: {}, expected: "unknown" },
];

describe("clientIp", () => {
  it.each(fixtures)("returns $expected for $name", async ({ headers, expected }) => {
    const { clientIp } = await import("./rate-limit");
    expect(clientIp(new Headers(headers))).toBe(expected);
  });
});

// The default GENERATION_RATE_LIMIT_PER_MINUTE (lib/env.ts) is 10: the
// counts below are chosen around that boundary rather than overriding env,
// which keeps these tests independent of any future default change made
// through a real, non-mocked env parse.
const DEFAULT_LIMIT = 10;

// `lib/dal/generations` is mocked per test (vi.doMock + a fresh dynamic
// import), not module-wide: the last describe block below exercises
// isGenerationRateLimited against the real, unmocked DAL and database, and
// a module-wide vi.mock would make that impossible in the same file.
async function importWithMockedCount(countRecentGenerations: (...args: never[]) => unknown) {
  vi.doMock("@/lib/dal/generations", () => ({ countRecentGenerations }));
  vi.resetModules();
  return import("./rate-limit");
}

afterEach(() => {
  vi.doUnmock("@/lib/dal/generations");
  vi.resetModules();
});

describe("isGenerationRateLimited (mocked counts)", () => {
  it(`is limited when byUser reaches the limit (${DEFAULT_LIMIT})`, async () => {
    const { isGenerationRateLimited } = await importWithMockedCount(async () => ({
      byUser: DEFAULT_LIMIT,
      byIp: 0,
    }));
    expect(await isGenerationRateLimited({ userId: "u1", ipHash: "ip1" })).toBe(true);
  });

  it(`is not limited when byUser is one below the limit (${DEFAULT_LIMIT - 1})`, async () => {
    const { isGenerationRateLimited } = await importWithMockedCount(async () => ({
      byUser: DEFAULT_LIMIT - 1,
      byIp: 0,
    }));
    expect(await isGenerationRateLimited({ userId: "u1", ipHash: "ip1" })).toBe(false);
  });

  it(`is limited when byIp alone reaches the limit, even with a low byUser`, async () => {
    const { isGenerationRateLimited } = await importWithMockedCount(async () => ({
      byUser: 0,
      byIp: DEFAULT_LIMIT,
    }));
    expect(await isGenerationRateLimited({ userId: "u1", ipHash: "ip1" })).toBe(true);
  });

  it("ignores byUser for an anonymous caller (userId null), even if it would be over the limit", async () => {
    const { isGenerationRateLimited } = await importWithMockedCount(async () => ({
      byUser: DEFAULT_LIMIT + 5,
      byIp: 0,
    }));
    expect(await isGenerationRateLimited({ userId: null, ipHash: "ip1" })).toBe(false);
  });

  it("is limited for an anonymous caller when byIp reaches the limit", async () => {
    const { isGenerationRateLimited } = await importWithMockedCount(async () => ({
      byUser: 0,
      byIp: DEFAULT_LIMIT,
    }));
    expect(await isGenerationRateLimited({ userId: null, ipHash: "ip1" })).toBe(true);
  });

  it("queries a 60 s window", async () => {
    const countRecentGenerations = vi.fn(async () => ({ byUser: 0, byIp: 0 }));
    const { isGenerationRateLimited } = await importWithMockedCount(countRecentGenerations);
    await isGenerationRateLimited({ userId: "u1", ipHash: "ip1" });
    expect(countRecentGenerations).toHaveBeenCalledWith({ userId: "u1", ipHash: "ip1", windowSeconds: 60 });
  });
});

describe("isGenerationRateLimited (real DAL and database)", () => {
  it(`is limited only once ${DEFAULT_LIMIT} generations exist for the same ip_hash in the window`, async () => {
    const { db } = await import("@/lib/db");
    const { generations, products } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { isGenerationRateLimited } = await import("./rate-limit");

    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const ipHash = `ip-${randomUUID()}`;
    const ids: string[] = [];

    try {
      for (let i = 0; i < DEFAULT_LIMIT - 1; i++) {
        const [row] = await db
          .insert(generations)
          .values({
            productId: product!.id,
            productVersion: 1,
            userId: null,
            anonymousId: randomUUID(),
            ipHash,
            input: {},
            idempotencyKey: randomUUID(),
          })
          .returning({ id: generations.id });
        ids.push(row!.id);
      }

      expect(await isGenerationRateLimited({ userId: null, ipHash })).toBe(false);

      const [last] = await db
        .insert(generations)
        .values({
          productId: product!.id,
          productVersion: 1,
          userId: null,
          anonymousId: randomUUID(),
          ipHash,
          input: {},
          idempotencyKey: randomUUID(),
        })
        .returning({ id: generations.id });
      ids.push(last!.id);

      expect(await isGenerationRateLimited({ userId: null, ipHash })).toBe(true);
    } finally {
      for (const id of ids) await db.delete(generations).where(eq(generations.id, id));
    }
  });
});
