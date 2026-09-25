import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { TransactionRollbackError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { baseDb, db } from "./index";
import { magicLinkOutbox } from "./auth-schema";
import { themes } from "./schema";
import { withTestTransaction } from "./test-transaction";

const colorTokens = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  primary: "oklch(0.7 0.1 250)",
  primaryForeground: "#ffffff",
  secondary: "#f4f4f5",
  secondaryForeground: "#0a0a0a",
  muted: "#f4f4f5",
  mutedForeground: "#71717a",
  accent: "#f4f4f5",
  accentForeground: "#0a0a0a",
  destructive: "#ef4444",
  border: "#e4e4e7",
  input: "#e4e4e7",
  ring: "#a1a1aa",
};
const validTokens = { light: colorTokens, dark: colorTokens, fontKey: "serif-editorial", radius: "0.5rem" };

function themeRow(slug: string) {
  return { slug, name: "withTestTransaction fixture", tokens: validTokens, landingVariant: "centered" as const };
}

async function themeExistsInBase(slug: string): Promise<boolean> {
  const row = await baseDb.query.themes.findFirst({ where: eq(themes.slug, slug) });
  return row !== undefined;
}

describe("withTestTransaction", () => {
  it("rolls back everything fn wrote once it resolves, whether it succeeds...", async () => {
    const slug = `wtt-success-${randomUUID()}`;
    await withTestTransaction(async () => {
      await db.insert(themes).values(themeRow(slug));
      const seenInsideScope = await db.query.themes.findFirst({ where: eq(themes.slug, slug) });
      expect(seenInsideScope).toBeTruthy();
    });

    expect(await themeExistsInBase(slug)).toBe(false);
  });

  it("...or fails: the original error still rejects the caller", async () => {
    const slug = `wtt-failure-${randomUUID()}`;
    await expect(
      withTestTransaction(async () => {
        await db.insert(themes).values(themeRow(slug));
        throw new Error("boom from fn");
      }),
    ).rejects.toThrow("boom from fn");

    expect(await themeExistsInBase(slug)).toBe(false);
  });

  it("does not swallow a TransactionRollbackError thrown by fn (e.g. a stray tx.rollback())", async () => {
    const slug = `wtt-escaped-rollback-${randomUUID()}`;
    await expect(
      withTestTransaction(async () => {
        await db.insert(themes).values(themeRow(slug));
        // Simulate application code reaching into the transaction: `db`
        // here is the very transaction withTestTransaction opened.
        (db as unknown as { rollback: () => never }).rollback();
      }),
    ).rejects.toThrow(TransactionRollbackError);

    expect(await themeExistsInBase(slug)).toBe(false);
  });

  it("routes every call through the same transaction, invisible to baseDb until (never) committed", async () => {
    const slug = `wtt-same-tx-${randomUUID()}`;
    let txIdFromFirstCall: number | undefined;

    await withTestTransaction(async () => {
      const [first] = await db.execute(sql`select txid_current() as txid`);
      txIdFromFirstCall = Number((first as { txid: number }).txid);

      await db.insert(themes).values(themeRow(slug));

      const [second] = await db.execute(sql`select txid_current() as txid`);
      expect(Number((second as { txid: number }).txid)).toBe(txIdFromFirstCall);

      // Same slug, queried straight from the base pool on its own
      // connection: the uncommitted insert above must not be visible there.
      expect(await themeExistsInBase(slug)).toBe(false);
    });

    expect(txIdFromFirstCall).toBeTypeOf("number");
    expect(await themeExistsInBase(slug)).toBe(false);
  });

  it("turns a nested db.transaction() into a savepoint: an inner failure only undoes the inner insert", async () => {
    const outerSlug = `wtt-savepoint-outer-${randomUUID()}`;
    const innerSlug = `wtt-savepoint-inner-fail-${randomUUID()}`;

    await withTestTransaction(async () => {
      await db.insert(themes).values(themeRow(outerSlug));

      await expect(
        db.transaction(async (tx) => {
          await tx.insert(themes).values(themeRow(innerSlug));
          throw new Error("inner boom");
        }),
      ).rejects.toThrow("inner boom");

      expect(await db.query.themes.findFirst({ where: eq(themes.slug, outerSlug) })).toBeTruthy();
      expect(await db.query.themes.findFirst({ where: eq(themes.slug, innerSlug) })).toBeUndefined();
    });

    expect(await themeExistsInBase(outerSlug)).toBe(false);
    expect(await themeExistsInBase(innerSlug)).toBe(false);
  });

  it("turns a nested db.transaction() into a savepoint: an inner success keeps the inner insert (until the outer rollback)", async () => {
    const innerSlug = `wtt-savepoint-inner-ok-${randomUUID()}`;

    await withTestTransaction(async () => {
      await db.transaction(async (tx) => {
        await tx.insert(themes).values(themeRow(innerSlug));
      });

      expect(await db.query.themes.findFirst({ where: eq(themes.slug, innerSlug) })).toBeTruthy();
    });

    expect(await themeExistsInBase(innerSlug)).toBe(false);
  });

  it("throws when called from inside another withTestTransaction (not reentrant)", async () => {
    await withTestTransaction(async () => {
      await expect(withTestTransaction(async () => {})).rejects.toThrow(/cannot be nested/);
    });
  });

  it("a DAL module re-imported after vi.resetModules() still writes into the transaction", async () => {
    const slug = `wtt-reimport-${randomUUID()}`;
    await withTestTransaction(async () => {
      vi.resetModules();
      const reimported = await import("./index");
      await reimported.db.insert(themes).values(themeRow(slug));
      expect(await db.query.themes.findFirst({ where: eq(themes.slug, slug) })).toBeTruthy();
    });

    expect(await themeExistsInBase(slug)).toBe(false);
  });

  it("keeps two concurrent scopes isolated from each other", async () => {
    const slugA = `wtt-concurrent-a-${randomUUID()}`;
    const slugB = `wtt-concurrent-b-${randomUUID()}`;

    await Promise.all([
      withTestTransaction(async () => {
        await db.insert(themes).values(themeRow(slugA));
        // The other scope's row must never be visible here: a shared
        // AsyncLocalStorage store would leak `tx` across the two calls.
        expect(await db.query.themes.findFirst({ where: eq(themes.slug, slugB) })).toBeUndefined();
      }),
      withTestTransaction(async () => {
        await db.insert(themes).values(themeRow(slugB));
        expect(await db.query.themes.findFirst({ where: eq(themes.slug, slugA) })).toBeUndefined();
      }),
    ]);

    expect(await themeExistsInBase(slugA)).toBe(false);
    expect(await themeExistsInBase(slugB)).toBe(false);
  });

  // Optional (TOOLING-test-transaction plan, task 9): `lib/auth.ts` wires
  // Better Auth's own storage with `drizzleAdapter(db)` — the exact same
  // `db` this module routes. No mock, no change to lib/auth.ts: signing in
  // with a magic link both writes Better Auth's own verification token
  // (through the adapter) and this app's outbox row (lib/auth.ts's
  // sendMagicLink, a plain `db.insert`); both must vanish once the scope
  // rolls back.
  it("routes Better Auth's own writes (drizzleAdapter(db)) into the transaction", async () => {
    const email = `wtt-magic-link-${randomUUID()}@example.test`;

    await withTestTransaction(async () => {
      await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
      const rows = await db.select().from(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
      expect(rows).toHaveLength(1);
    });

    const rowsAfter = await baseDb.select().from(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
    expect(rowsAfter).toHaveLength(0);
  });
});
