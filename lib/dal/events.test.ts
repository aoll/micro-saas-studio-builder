import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events, products } from "@/lib/db/schema";

// V1 stub (docs/11 › Les contrats gelés en V1: "track(event) … ne fait
// rien"). Replaced by TRACKING's real insert.
describe("track", () => {
  it("resolves without writing a row", async () => {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const before = await db.select().from(events).where(eq(events.productId, product!.id));

    const { track } = await import("./events");
    const result = await track({
      type: "visit",
      productId: product!.id,
      userId: null,
      anonymousId: randomUUID(),
    });

    expect(result).toBeUndefined();
    const after = await db.select().from(events).where(eq(events.productId, product!.id));
    expect(after).toHaveLength(before.length);
  });
});
