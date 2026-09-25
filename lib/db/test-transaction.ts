import "server-only";
import { TransactionRollbackError } from "drizzle-orm";
import { baseDb, testTxStorage, type TestTxScope } from "./index";

// Never drizzle-orm's own `TransactionRollbackError`: `db.transaction()`
// catches instances of that exact class specially — it issues a ROLLBACK
// and *resolves* the promise instead of rejecting it, treating the error as
// "the caller wants to cancel this transaction, quietly" (`tx.rollback()`).
// Sharing that class for our own always-rollback would make a real
// `tx.rollback()` escaping from `fn` indistinguishable from ours: both
// would resolve silently, hiding a bug in the code under test. A private
// sentinel keeps the two apart.
class TestRollback extends Error {}

// Wraps a TransactionRollbackError thrown by `fn` itself so it never
// reaches `baseDb.transaction()` as that exact class — see TestRollback
// above for why an unwrapped one would be swallowed the same way.
class EscapedTransactionRollback extends Error {
  constructor(public readonly original: unknown) {
    super("a TransactionRollbackError escaped from withTestTransaction's fn");
  }
}

/**
 * Runs `fn` inside a Postgres transaction opened on the base db instance,
 * always rolled back once `fn` settles — whether it resolves or rejects —
 * so nothing it writes survives. While `fn` runs, `db` (lib/db/index.ts)
 * routes every call into this same transaction: no DAL signature changes,
 * and a nested `db.transaction()` becomes a savepoint
 * (drizzle-orm/postgres-js).
 *
 * Not reentrant: calling it again from inside `fn` throws. Not for tests
 * that prove real concurrent access from several distinct connections
 * (`Promise.all` over independent `db.transaction()` calls) — postgres.js
 * never releases a savepoint, and concurrent savepoints on one connection
 * are unsafe, so those tests keep opening their own, separate transactions
 * (docs/07-modele-de-donnees.md's ledger concurrency tests, unchanged by
 * this spec).
 */
export async function withTestTransaction(fn: () => Promise<void>): Promise<void> {
  if (testTxStorage.getStore()) {
    throw new Error("withTestTransaction cannot be nested");
  }

  try {
    await baseDb.transaction(async (tx) => {
      const scope: TestTxScope = { tx, open: true };
      try {
        await testTxStorage.run(scope, fn);
      } catch (error) {
        scope.open = false;
        throw error instanceof TransactionRollbackError ? new EscapedTransactionRollback(error) : error;
      }
      scope.open = false;
      throw new TestRollback();
    });
  } catch (error) {
    if (error instanceof TestRollback) return;
    if (error instanceof EscapedTransactionRollback) throw error.original;
    throw error;
  }
}
