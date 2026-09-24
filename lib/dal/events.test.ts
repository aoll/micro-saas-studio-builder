import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events, products } from "@/lib/db/schema";
import { eventTypeSchema } from "@/lib/schemas/event-type";

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
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
});
