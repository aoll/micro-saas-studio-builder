import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { PgDatabase, PgTransaction } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_POOL_MAX, baseDb, db, poolMaxFor, TEST_POOL_MAX, testTxStorage } from "./index";

describe("poolMaxFor", () => {
  it("is 5 under test, documented as the widest concurrency inside one Vitest file", () => {
    expect(TEST_POOL_MAX).toBe(5);
    expect(poolMaxFor("test")).toBe(5);
  });

  it("is 10 for development and production", () => {
    expect(APP_POOL_MAX).toBe(10);
    expect(poolMaxFor("development")).toBe(10);
    expect(poolMaxFor("production")).toBe(10);
  });
});

describe("the test pool", () => {
  it("caps its postgres.js client at TEST_POOL_MAX under Vitest (NODE_ENV=test)", () => {
    expect(baseDb.$client.options.max).toBe(TEST_POOL_MAX);
  });
});

// `db` routes every access through `currentTarget()`, which reads the
// AsyncLocalStorage scope `withTestTransaction` opens. These tests manage
// that scope by hand (never through `withTestTransaction` itself, tested
// separately in test-transaction.test.ts) to pin the routing mechanism in
// isolation.
describe("db routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads through the base instance with no open scope", async () => {
    expect(testTxStorage.getStore()).toBeUndefined();
    const [row] = await db.execute(sql`select 1 as one`);
    expect(row).toEqual({ one: 1 });
  });

  it("routes to the transaction while a scope is open, and back to the base instance once it closes", async () => {
    let insideTxId: number | undefined;
    await baseDb
      .transaction(async (tx) => {
        const scope = { tx, open: true };
        await testTxStorage.run(scope, async () => {
          const [row] = await db.execute(sql`select txid_current() as txid`);
          insideTxId = Number((row as { txid: number }).txid);
          const [txRow] = await tx.execute(sql`select txid_current() as txid`);
          expect(insideTxId).toBe(Number((txRow as { txid: number }).txid));
        });
        scope.open = false;
        tx.rollback();
      })
      .catch(() => {
        // drizzle resolves tx.rollback() as a normal, silent rollback; nothing
        // to assert on the rejection itself, only that the row above never
        // reached `baseDb`.
      });

    expect(insideTxId).toBeTypeOf("number");
    expect(testTxStorage.getStore()).toBeUndefined();
  });

  it("throws when `db` is used after its scope has closed (a floating promise)", async () => {
    let capturedScope: { tx: unknown; open: boolean } | undefined;
    await baseDb
      .transaction(async (tx) => {
        capturedScope = { tx, open: true };
        capturedScope.open = false; // simulate the scope having already closed
        await testTxStorage.run(capturedScope as never, async () => {
          await expect(db.execute(sql`select 1`)).rejects.toThrow(/withTestTransaction ended/);
        });
        tx.rollback();
      })
      .catch(() => {});
  });

  it("lets vi.spyOn(db, ...) patch and restore the currently routed target, outside a scope", async () => {
    const spy = vi.spyOn(db, "execute");
    await db.execute(sql`select 1`);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("lets vi.spyOn(db, ...) patch and restore the currently routed target, inside a scope", async () => {
    await baseDb
      .transaction(async (tx) => {
        const scope = { tx, open: true };
        await testTxStorage.run(scope, async () => {
          const spy = vi.spyOn(db, "execute");
          await db.execute(sql`select 1`);
          expect(spy).toHaveBeenCalledTimes(1);
        });
        scope.open = false;
        tx.rollback();
      })
      .catch(() => {});
  });

  // Review finding (DB, LOW): without a `getPrototypeOf` trap, the Proxy's
  // own prototype was that of its literal `{}` target, so `db instanceof
  // PgDatabase` and drizzle's `is(db, …)` both returned false through the
  // routing proxy, and any method resolved via the prototype chain (rather
  // than an own property) would miss a `vi.spyOn` patch placed on the real
  // class's prototype.
  it("db is an instance of the drizzle class matching whatever is currently routed to", async () => {
    expect(db).toBeInstanceOf(PgDatabase);
    expect(db).not.toBeInstanceOf(PgTransaction);

    await baseDb
      .transaction(async (tx) => {
        const scope = { tx, open: true };
        await testTxStorage.run(scope, async () => {
          expect(db).toBeInstanceOf(PgTransaction);
        });
        scope.open = false;
        tx.rollback();
      })
      .catch(() => {});
  });
});

// Exercises the routing outside of Vitest's own NODE_ENV=test to pin "outside
// withTestTransaction, `db` behaves exactly as before" from a second angle:
// in development or production, `db` is the base instance itself, not a
// proxy — never `NODE_ENV=production` (default.NODE_ENV), just enough to
// prove the identity holds once test-only routing is off.
describe("db identity outside test", () => {
  it("db === baseDb when NODE_ENV is not test", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    try {
      const fresh = await import("./index");
      expect(fresh.db).toBe(fresh.baseDb);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

// `testTxStorage` and `baseDb` must survive `vi.resetModules()`: a DAL
// module re-imported inside a scope (the common `await import("./foo")`
// pattern used across lib/dal/*.test.ts) still needs to reach the same
// storage and the same base instance as `lib/db/index.ts`'s first import.
describe("survives vi.resetModules()", () => {
  it("keeps the same testTxStorage and baseDb across a reset", async () => {
    vi.resetModules();
    const reimported = await import("./index");
    expect(reimported.testTxStorage).toBeInstanceOf(AsyncLocalStorage);
    expect(reimported.testTxStorage).toBe(testTxStorage);
    expect(reimported.baseDb).toBe(baseDb);
  });
});
