import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { events, products } from "@/lib/db/schema";
import { eventTypeSchema } from "@/lib/schemas/event-type";

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

// Real implementation (specs/TRACKING.md bullet 3): track() writes to
// `events`, replacing the V1 stub (docs/11's contract table: "ne fait
// rien").
describe("track", () => {
  it("writes a row for a visit event", async () => {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const anonymousId = randomUUID();

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

    await db.delete(events).where(eq(events.anonymousId, anonymousId));
  });

  it.each(eventTypeSchema.options)("inserts a %s event with metadata for an anonymous id", async (type) => {
    const productId = await lettreProId();
    const anonymousId = randomUUID();

    const { track } = await import("./events");
    await track({ type, productId, userId: null, anonymousId, metadata: { referrer: "seo" } });

    const rows = await db.select().from(events).where(eq(events.anonymousId, anonymousId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe(type);
    expect(rows[0]?.metadata).toEqual({ referrer: "seo" });
    expect(rows[0]?.productId).toBe(productId);

    await db.delete(events).where(eq(events.anonymousId, anonymousId));
  });

  it("links a visit to the signup that follows it, via the shared anonymous id", async () => {
    const productId = await lettreProId();
    const anonymousId = randomUUID();
    const userId = await anyUserId();
    getSession.mockResolvedValue({ user: { id: userId } });

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

    await db.delete(events).where(eq(events.anonymousId, anonymousId));
  });

  it("inserts a purchase event carrying only a userId", async () => {
    const productId = await lettreProId();
    const userId = await anyUserId();
    getSession.mockResolvedValue({ user: { id: userId } });

    const { track } = await import("./events");
    await track({ type: "purchase", productId, userId, anonymousId: null, metadata: { packId: "pack-10" } });

    const rows = await db.select().from(events).where(eq(events.userId, userId));
    const purchaseRow = rows.find((row) => row.type === "purchase" && row.productId === productId);
    expect(purchaseRow).toBeDefined();
    expect(purchaseRow?.anonymousId).toBeNull();

    await db.delete(events).where(eq(events.id, purchaseRow!.id));
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
});
