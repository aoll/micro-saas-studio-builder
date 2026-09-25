// Guards the automatic seed step in scripts/vercel-build.sh: idempotent by
// design, the same way drizzle-kit's own migration tracking makes it safe to
// run `pnpm db:migrate` on every deploy (docs/06-vercel.md). Seeds a fresh
// database exactly once — deploys after that see products already there and
// skip, so the demo's usage data is never reset by a routine deploy. Unlike
// scripts/seed.ts, never called directly by a developer who wants to refresh
// fixtures; that's still plain `pnpm db:seed`.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as nextEnvNs from "@next/env";
import postgres from "postgres";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { seed } from "./seed";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;

export async function seedIfEmpty(): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 5, onnotice: () => {} });
  let productCount: number;
  try {
    const [row] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM products`;
    productCount = row!.count;
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (productCount > 0) {
    console.log(`seed-if-empty: ${productCount} product(s) already in the database, skipping seed.`);
    return;
  }

  await seed();
}

const isEntry = (): boolean => {
  try {
    return !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};
if (isEntry()) {
  loadEnvConfig(process.cwd());
  seedIfEmpty()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
