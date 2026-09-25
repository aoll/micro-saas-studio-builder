import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { magicLinkOutbox } from "@/lib/db/auth-schema";

describe("getLatestMagicLink", () => {
  it("returns the newer of two outbox rows for the same email", async () => {
    const email = `visitor-${randomUUID()}@example.test`;
    const [older] = await db
      .insert(magicLinkOutbox)
      .values({ email, url: "https://msb.local/older" })
      .returning({ id: magicLinkOutbox.id });
    // Distinct `created_at`: defaultNow() would otherwise collide within
    // the same millisecond on a fast local database.
    await db
      .update(magicLinkOutbox)
      .set({ createdAt: new Date(Date.now() - 1000) })
      .where(eq(magicLinkOutbox.id, older!.id));

    const [newer] = await db
      .insert(magicLinkOutbox)
      .values({ email, url: "https://msb.local/newer" })
      .returning({ id: magicLinkOutbox.id });

    const { getLatestMagicLink } = await import("./magic-link");
    const result = await getLatestMagicLink(email);
    expect(result?.url).toBe("https://msb.local/newer");
    expect(result?.createdAt).toBeInstanceOf(Date);

    await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.id, older!.id));
    await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.id, newer!.id));
  });

  it("matches the email case-insensitively", async () => {
    const email = `visitor-${randomUUID()}@example.test`;
    const [row] = await db
      .insert(magicLinkOutbox)
      .values({ email, url: "https://msb.local/mixed-case" })
      .returning({ id: magicLinkOutbox.id });

    const { getLatestMagicLink } = await import("./magic-link");
    const result = await getLatestMagicLink(email.toUpperCase());
    expect(result?.url).toBe("https://msb.local/mixed-case");

    await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.id, row!.id));
  });

  it("resolves to null for an email with no outbox row", async () => {
    const { getLatestMagicLink } = await import("./magic-link");
    expect(await getLatestMagicLink(`missing-${randomUUID()}@example.test`)).toBeNull();
  });
});
