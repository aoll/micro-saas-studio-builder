import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events, products } from "@/lib/db/schema";

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
});
