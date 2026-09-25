// specs/DEMO-mode.md: wipes every visitor-created row (products, their
// versions and threshold overrides) and every usage row (generations,
// purchases, the credit ledger, balances, events, and the end-user
// accounts they belong to), then replays the seeded catalogue and its 30
// days of usage (scripts/seed.ts's applySeed). Like scripts/seed.ts, this
// script builds its own Postgres client from `DATABASE_URL` alone: no
// `import "server-only"`, no `lib/env.ts` (which requires all 8
// variables) — app/(backoffice)/admin/ops/_actions.ts imports this file
// directly (an accepted exception, docs/09 flags a raw `lib/db` import
// outside `lib/dal/`, but a Server Action calling a script that owns its
// own connection is not that).
//
// Usage: pnpm tsx scripts/reset-demo.ts (called by the /admin/ops button)
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Namespace import: see the comment in drizzle.config.ts.
import * as nextEnvNs from "@next/env";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;
import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import {
  balances,
  creditTransactions,
  decisionThresholds,
  events,
  generations,
  productVersions,
  products,
  purchases,
} from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { applySeed, createSeedDb, type SeedTx } from "./seed";

loadEnvConfig(process.cwd());

// A Postgres advisory lock, held for the whole transaction
// (`pg_advisory_xact_lock`, auto-released at commit or rollback): a reset
// and a concurrent seed (or two concurrent resets — the button posts once,
// but a retried request must not race itself) always serialize instead of
// interleaving their deletes and inserts.
const RESET_LOCK_KEY = sql`hashtext('reset-demo')`;

// Deletes every visitor-created product (its versions and threshold
// override) and every usage row (docs/07's usage block: generations,
// purchases, the ledger, balances, events) along with the end-user
// accounts they belong to (role `user`; admin and owner keep their role
// and survive). Usage carries no `is_seed` column of its own, so a full
// wipe followed by applySeed's fresh, deterministic replay is the only
// way to guarantee the reset story matches the seed exactly — a partial
// wipe would leave stray visitor activity mixed into a locked product's
// metrics. Exported so scripts/reset-demo.test.ts can assert on it
// directly, one statement at a time, on the isolated database it creates.
export async function applyReset(tx: SeedTx, now: Date): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${RESET_LOCK_KEY})`);

  // Usage first (children before the users they reference).
  await tx.delete(creditTransactions);
  await tx.delete(purchases);
  await tx.delete(generations);
  await tx.delete(balances);
  await tx.delete(events);
  await tx.delete(users).where(eq(users.role, "user"));

  // Visitor-created products (children before the product itself).
  const visitorProducts = await tx.select({ id: products.id }).from(products).where(eq(products.isSeed, false));
  const visitorProductIds = visitorProducts.map((row) => row.id);
  if (visitorProductIds.length > 0) {
    await tx.delete(decisionThresholds).where(inArray(decisionThresholds.productId, visitorProductIds));
    await tx.delete(productVersions).where(inArray(productVersions.productId, visitorProductIds));
    await tx.delete(products).where(inArray(products.id, visitorProductIds));
  }

  // Replays the seeded catalogue (idempotent upserts: themes, the 3 locked
  // products, the default thresholds, admin/owner) and fresh usage.
  await applySeed(tx, now);
}

export async function resetDemo(opts: { sql?: postgres.Sql; now?: Date } = {}): Promise<void> {
  const ownsSql = !opts.sql;
  const sqlClient = opts.sql ?? postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 5, onnotice: () => {} });
  const db = createSeedDb(sqlClient);
  try {
    await db.transaction(async (tx) => {
      await applyReset(tx, opts.now ?? new Date());
    });
    console.log("Reset complete: visitor products and usage wiped, seeded catalogue and usage replayed.");
  } finally {
    if (ownsSql) await sqlClient.end({ timeout: 5 });
  }
}

// Only run when executed directly (mirrors scripts/seed.ts), so tests can
// import resetDemo() without triggering it.
const isEntry = (): boolean => {
  try {
    return !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};
if (isEntry()) {
  resetDemo()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
