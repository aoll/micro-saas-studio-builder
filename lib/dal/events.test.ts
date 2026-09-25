import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { events, productVersions, products, themes } from "@/lib/db/schema";
import { eventTypeSchema } from "@/lib/schemas/event-type";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";

const getSession = vi.fn();
vi.mock("./session", () => ({ getSession: () => getSession() }));

afterEach(() => {
  getSession.mockReset();
});

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  return row!.id;
}

async function anyUserId(): Promise<string> {
  const row = await db.query.users.findFirst();
  return row!.id;
}

// A throwaway product, inserted directly (not through product-editor, whose
// `createProduct` needs `requireAdmin` — a different export of the mocked
// "./session" module), used only to prove the visit dedupe is scoped per
// product. Its config must satisfy `productConfigSchema`: `listProducts()`
// (lib/dal/products.ts) Zod-parses every product row, and a concurrently
// running lib/dal/products.test.ts fails with a ZodError while a row with a
// partial/empty config exists (mirrors the buildConfig() fixture of
// lib/dal/product-editor.test.ts).
//
// Its `cleanup()` must run in a `finally` at every call site (review round,
// product-status.test.ts and thresholds.test.ts's own pattern): if an
// `expect` throws first, an uncleaned call leaks an `events-test-*` product
// into the shared worktree DB.
async function createTempProduct(): Promise<{ id: string; cleanup: () => Promise<void> }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst();
  const id = randomUUID();
  const slug = `events-test-${randomUUID()}`;
  const config: ProductConfig = productConfigSchema.parse({
    slug,
    name: "Events test product",
    status: "test",
    themeId: theme!.id,
    locale: "fr",
    branding: {},
    landing: {
      headline: "Headline",
      subheadline: "Subheadline",
      faq: [],
      seoTitle: "Title",
      seoDescription: "Description",
    },
    inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
    generation: {
      model: "anthropic/claude-haiku-4.5",
      promptTemplate: "Write about {{topic}}",
      outputType: "markdown",
    },
    pricing: {
      freeCreditsOnSignup: 3,
      anonymousFreeGenerations: 1,
      costPerGeneration: 1,
      packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
    },
  });
  await db.insert(products).values({
    id,
    slug,
    themeId: theme!.id,
    currentVersion: 1,
    locale: "fr",
    createdBy: owner!.id,
  });
  await db.insert(productVersions).values({ productId: id, version: 1, config, createdBy: owner!.id });
  return {
    id,
    cleanup: async () => {
      await db.delete(events).where(eq(events.productId, id));
      await db.delete(productVersions).where(eq(productVersions.productId, id));
      await db.delete(products).where(eq(products.id, id));
    },
  };
}

// Real implementation (specs/TRACKING.md bullet 3): track() writes to
// `events`, replacing the V1 stub (docs/11's contract table: "ne fait
// rien").
describe("track", () => {
  it("writes a row for a visit event", async () => {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const anonymousId = randomUUID();

    try {
      const { track } = await import("./events");
      const result = await track({
        type: "visit",
        productId: product!.id,
        userId: null,
        anonymousId,
      });

      expect(result).toBeUndefined();
      const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe("visit");
    } finally {
      await db.delete(events).where(eq(events.anonymousId, anonymousId));
    }
  });

  it.each(eventTypeSchema.options)("inserts a %s event with metadata for an anonymous id", async (type) => {
    const productId = await lettreProId();
    const anonymousId = randomUUID();

    try {
      const { track } = await import("./events");
      await track({ type, productId, userId: null, anonymousId, metadata: { referrer: "seo" } });

      const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe(type);
      expect(rows[0]?.metadata).toEqual({ referrer: "seo" });
      expect(rows[0]?.productId).toBe(productId);
    } finally {
      await db.delete(events).where(eq(events.anonymousId, anonymousId));
    }
  });

  it("links a visit to the signup that follows it, via the shared anonymous id", async () => {
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    // A fresh id, not `anyUserId()`: `events.user_id` has no FK (docs/07),
    // and the signup dedupe below is keyed on (product, user), so a
    // shared user would collide with the signup dedupe tests further down.
    const userId = randomUUID();
    getSession.mockResolvedValue({ user: { id: userId } });

    try {
      const { track } = await import("./events");
      await track({ type: "visit", productId, userId: null, anonymousId });
      await track({ type: "signup", productId, userId, anonymousId });

      const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
      expect(rows).toHaveLength(2);
      const signupRow = rows.find((row) => row.type === "signup");
      expect(signupRow?.userId).toBe(userId);
      expect(signupRow?.anonymousId).toBe(anonymousId);
      const visitRow = rows.find((row) => row.type === "visit");
      expect(visitRow?.anonymousId).toBe(anonymousId);
    } finally {
      await db.delete(events).where(eq(events.anonymousId, anonymousId));
    }
  });

  it("inserts a purchase event carrying only a userId", async () => {
    const productId = await lettreProId();
    const userId = await anyUserId();
    getSession.mockResolvedValue({ user: { id: userId } });

    try {
      const { track } = await import("./events");
      await track({ type: "purchase", productId, userId, anonymousId: null, metadata: { packId: "pack-10" } });

      const rows = await db.select().from(events).where(eq(events.userId, userId));
      const purchaseRow = rows.find((row) => row.type === "purchase" && row.productId === productId);
      expect(purchaseRow).toBeDefined();
      expect(purchaseRow?.anonymousId).toBeNull();
    } finally {
      await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "purchase")));
    }
  });

  it("rejects a userId that does not match the caller's session", async () => {
    const productId = await lettreProId();
    getSession.mockResolvedValue({ user: { id: "someone-else" } });

    const { track } = await import("./events");
    await expect(
      track({ type: "signup", productId, userId: "the-real-user", anonymousId: randomUUID() }),
    ).rejects.toThrow(/does not match the caller's session/);
  });

  it("rejects a userId when there is no session", async () => {
    const productId = await lettreProId();
    getSession.mockResolvedValue(null);

    const { track } = await import("./events");
    await expect(
      track({ type: "signup", productId, userId: "the-real-user", anonymousId: randomUUID() }),
    ).rejects.toThrow(/does not match the caller's session/);
  });

  it("rejects an event with neither a userId nor an anonymousId", async () => {
    const productId = await lettreProId();

    const { track } = await import("./events");
    await expect(track({ type: "purchase", productId, userId: null, anonymousId: null })).rejects.toThrow(
      /needs a userId or an anonymousId/,
    );
  });

  it("rejects a visit event without an anonymousId", async () => {
    const productId = await lettreProId();
    const userId = await anyUserId();
    getSession.mockResolvedValue({ user: { id: userId } });

    const { track } = await import("./events");
    await expect(track({ type: "visit", productId, userId, anonymousId: null })).rejects.toThrow(
      /visit needs an anonymousId/,
    );
  });

  describe("visit dedupe", () => {
    it("writes at most one row per anonymous id, product and UTC day", async () => {
      const productId = await lettreProId();
      const anonymousId = randomUUID();

      try {
        const { track } = await import("./events");
        await track({ type: "visit", productId, userId: null, anonymousId });
        await track({ type: "visit", productId, userId: null, anonymousId });

        const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
        expect(rows).toHaveLength(1);
      } finally {
        await db.delete(events).where(eq(events.anonymousId, anonymousId));
      }
    });

    it("serializes 5 concurrent visits into one row", async () => {
      const productId = await lettreProId();
      const anonymousId = randomUUID();

      try {
        const { track } = await import("./events");
        await Promise.all(
          Array.from({ length: 5 }, () => track({ type: "visit", productId, userId: null, anonymousId })),
        );

        const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
        expect(rows).toHaveLength(1);
      } finally {
        await db.delete(events).where(eq(events.anonymousId, anonymousId));
      }
    });

    it("writes a separate row for the same anonymous id on a different product", async () => {
      const productId = await lettreProId();
      const anonymousId = randomUUID();
      const other = await createTempProduct();

      try {
        const { track } = await import("./events");
        await track({ type: "visit", productId, userId: null, anonymousId });
        await track({ type: "visit", productId: other.id, userId: null, anonymousId });

        const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((row) => row.productId))).toEqual(new Set([productId, other.id]));
      } finally {
        await db.delete(events).where(eq(events.anonymousId, anonymousId));
        await other.cleanup();
      }
    });

    it("writes a new row once the previous visit is more than a day old", async () => {
      const productId = await lettreProId();
      const anonymousId = randomUUID();
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      try {
        await db.insert(events).values({
          productId,
          type: "visit",
          userId: null,
          anonymousId,
          createdAt: twentyFiveHoursAgo,
        });

        const { track } = await import("./events");
        await track({ type: "visit", productId, userId: null, anonymousId });

        const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
        expect(rows).toHaveLength(2);
      } finally {
        await db.delete(events).where(eq(events.anonymousId, anonymousId));
      }
    });

    it("does not dedupe non-visit types", async () => {
      const productId = await lettreProId();
      const anonymousId = randomUUID();

      try {
        const { track } = await import("./events");
        await track({ type: "first_generation", productId, userId: null, anonymousId });
        await track({ type: "first_generation", productId, userId: null, anonymousId });

        const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
        expect(rows).toHaveLength(2);
      } finally {
        await db.delete(events).where(eq(events.anonymousId, anonymousId));
      }
    });
  });

  // TRACKING dedupe follow-up: a returning user's re-login through
  // signup/complete must not write a second `signup` event (the bonus
  // itself was already idempotent; the event wasn't). No unique index
  // backs this (docs/07 lists none for `events`), so it follows the same
  // advisory-lock pattern as the visit dedupe above, keyed on
  // `signup:{productId}:{userId}` — no day boundary: a signup dedupes for
  // the product's whole lifetime, not per calendar day.
  describe("signup dedupe", () => {
    it("writes at most one signup row per product and user", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });
      const anonymousId = randomUUID();

      try {
        const { track } = await import("./events");
        await track({ type: "signup", productId, userId, anonymousId });
        await track({ type: "signup", productId, userId, anonymousId: randomUUID() });

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.productId, productId), eq(events.type, "signup")));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.anonymousId).toBe(anonymousId);
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "signup")));
      }
    });

    it("writes a separate signup row for the same user on a different product", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });
      const other = await createTempProduct();

      try {
        const { track } = await import("./events");
        await track({ type: "signup", productId, userId, anonymousId: null });
        await track({ type: "signup", productId: other.id, userId, anonymousId: null });

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.type, "signup")));
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((row) => row.productId))).toEqual(new Set([productId, other.id]));
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "signup")));
        await other.cleanup();
      }
    });

    it("serializes 5 concurrent signups into one row", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });

      try {
        const { track } = await import("./events");
        await Promise.all(
          Array.from({ length: 5 }, () => track({ type: "signup", productId, userId, anonymousId: null })),
        );

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.productId, productId), eq(events.type, "signup")));
        expect(rows).toHaveLength(1);
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "signup")));
      }
    });
  });

  // TRACKING dedupe follow-up: a replayed purchase (double click, retry)
  // must not write a second `purchase` event. Purchases dedupe by
  // `metadata.purchaseKey`, the same client-generated idempotency key that
  // already protects the ledger write (lib/dal/credits.ts's `purchase()`),
  // scoped to the product — same advisory-lock approach, no unique index.
  describe("purchase dedupe", () => {
    it("writes at most one purchase row per product and purchaseKey", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });
      const purchaseKey = randomUUID();

      try {
        const { track } = await import("./events");
        await track({
          type: "purchase",
          productId,
          userId,
          anonymousId: null,
          metadata: { purchaseKey, packId: "pack-10" },
        });
        await track({
          type: "purchase",
          productId,
          userId,
          anonymousId: null,
          metadata: { purchaseKey, packId: "pack-10" },
        });

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.productId, productId), eq(events.type, "purchase")));
        const matching = rows.filter(
          (row) => (row.metadata as { purchaseKey?: string } | null)?.purchaseKey === purchaseKey,
        );
        expect(matching).toHaveLength(1);
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "purchase")));
      }
    });

    it("writes a separate purchase row for a different purchaseKey", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });

      try {
        const { track } = await import("./events");
        await track({
          type: "purchase",
          productId,
          userId,
          anonymousId: null,
          metadata: { purchaseKey: randomUUID(), packId: "pack-10" },
        });
        await track({
          type: "purchase",
          productId,
          userId,
          anonymousId: null,
          metadata: { purchaseKey: randomUUID(), packId: "pack-10" },
        });

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.productId, productId), eq(events.type, "purchase")));
        expect(rows).toHaveLength(2);
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "purchase")));
      }
    });

    it("writes a separate purchase row for the same purchaseKey on a different product", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });
      const other = await createTempProduct();
      const purchaseKey = randomUUID();

      try {
        const { track } = await import("./events");
        await track({ type: "purchase", productId, userId, anonymousId: null, metadata: { purchaseKey } });
        await track({ type: "purchase", productId: other.id, userId, anonymousId: null, metadata: { purchaseKey } });

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.type, "purchase")));
        const matching = rows.filter(
          (row) => (row.metadata as { purchaseKey?: string } | null)?.purchaseKey === purchaseKey,
        );
        expect(matching).toHaveLength(2);
        expect(new Set(matching.map((row) => row.productId))).toEqual(new Set([productId, other.id]));
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "purchase")));
        await other.cleanup();
      }
    });

    it("serializes 5 concurrent replays of the same purchaseKey into one row", async () => {
      const productId = await lettreProId();
      const userId = randomUUID();
      getSession.mockResolvedValue({ user: { id: userId } });
      const purchaseKey = randomUUID();

      try {
        const { track } = await import("./events");
        await Promise.all(
          Array.from({ length: 5 }, () =>
            track({ type: "purchase", productId, userId, anonymousId: null, metadata: { purchaseKey } }),
          ),
        );

        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.productId, productId), eq(events.type, "purchase")));
        expect(rows).toHaveLength(1);
      } finally {
        await db.delete(events).where(and(eq(events.userId, userId), eq(events.type, "purchase")));
      }
    });
  });
});
