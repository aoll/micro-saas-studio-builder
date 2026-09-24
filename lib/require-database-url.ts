// Small helper reused by everything that builds its own Postgres client
// outside lib/env.ts's full validation (drizzle.config.ts, scripts/seed.ts,
// and the DB integration tests): a single readable error instead of a bare
// `process.env.DATABASE_URL!` non-null assertion scattered across files.
//
// No `import "server-only"`: drizzle-kit and tsx import this module too.
export const requireDatabaseUrl = (source: Record<string, string | undefined> = process.env): string => {
  const value = source.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is not set. Run `pnpm tsx scripts/worktree-db.ts ensure --seed` to create and migrate this worktree's database.",
    );
  }
  return value;
};
