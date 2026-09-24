// One Postgres database per git worktree, all on the shared local cluster
// (native cluster, or `docker compose up -d postgres`). The database name derives from the current
// branch: main/master -> `msb`, anything else -> `msb_<sanitized branch>`.
//
// Usage: pnpm tsx scripts/worktree-db.ts <ensure [--seed] | drop | url | list | prune [--yes]>
// Admin connection: POSTGRES_ADMIN_URL (default postgres://postgres:postgres@localhost:5432/postgres).

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ADMIN_URL =
  process.env.POSTGRES_ADMIN_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres";
const MAIN_DB = "msb";
const PROTECTED_BRANCHES = new Set(["main", "master"]);

const git = (args: string[], cwd?: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

export const dbNameForBranch = (branch: string): string => {
  if (PROTECTED_BRANCHES.has(branch)) return MAIN_DB;
  // Postgres identifiers are capped at 63 bytes; "msb_" takes 4.
  const sanitized = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 59);
  return `${MAIN_DB}_${sanitized}`;
};

export const dbUrlFor = (dbName: string): string => {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  return url.toString();
};

/** Set or replace KEY=value in an env file, keeping every other line. Creates the file if missing. */
export const setEnvVar = (filePath: string, key: string, value: string): void => {
  const content = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content.trimEnd()}${content.trim() ? "\n" : ""}${line}\n`;
  writeFileSync(filePath, next, "utf8");
};

export const readEnvVar = (filePath: string, key: string): string | undefined => {
  if (!existsSync(filePath)) return undefined;
  const match = readFileSync(filePath, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim();
};

const currentBranch = (): string => {
  const branch = git(["branch", "--show-current"]);
  if (!branch) throw new Error("Detached HEAD: check out a branch first.");
  return branch;
};

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;

const withAdmin = async <T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> => {
  const sql = postgres(ADMIN_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await sql`SELECT 1`;
  } catch (err) {
    await sql.end({ timeout: 1 }).catch(() => {});
    const reason = err instanceof Error ? err.message : String(err);
    console.error(
      `\nERROR: cannot reach Postgres at ${new URL(ADMIN_URL).host} (${reason}).\n` +
        "Start it with `pg_ctlcluster <version> main start` (native) or `docker compose up -d postgres`.\n",
    );
    process.exit(1);
  }
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
};

const listDatabases = (sql: postgres.Sql): Promise<string[]> =>
  sql<{ datname: string }[]>`
    SELECT datname FROM pg_database
    WHERE datname = ${MAIN_DB} OR datname LIKE ${`${MAIN_DB}\\_%`}
    ORDER BY datname
  `.then((rows) => rows.map((r) => r.datname));

/** branch -> worktree path, from `git worktree list --porcelain`. */
const worktreesByBranch = (): Map<string, string> => {
  const map = new Map<string, string>();
  let path = "";
  for (const line of git(["worktree", "list", "--porcelain"]).split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    else if (line.startsWith("branch refs/heads/")) map.set(line.slice("branch refs/heads/".length), path);
  }
  return map;
};

const ensure = async (seed: boolean): Promise<void> => {
  const root = git(["rev-parse", "--show-toplevel"]);
  const dbName = dbNameForBranch(currentBranch());
  const dbUrl = dbUrlFor(dbName);

  await withAdmin(async (sql) => {
    const [exists] = await sql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists) {
      console.log(`Database ${dbName} already exists`);
    } else {
      await sql.unsafe(`CREATE DATABASE ${quoteIdent(dbName)}`);
      console.log(`Created database ${dbName}`);
    }
    // All worktree databases share one cluster and one max_connections budget.
    // A leaked connection or abandoned transaction in one worktree must fail
    // fast instead of starving the others. ALTER DATABASE applies to every
    // future connection and is idempotent.
    const q = quoteIdent(dbName);
    await sql.unsafe(`ALTER DATABASE ${q} SET idle_in_transaction_session_timeout = '30s'`);
    await sql.unsafe(`ALTER DATABASE ${q} SET lock_timeout = '15s'`);
    await sql.unsafe(`ALTER DATABASE ${q} SET idle_session_timeout = '5min'`);
  });

  const envLocal = resolve(root, ".env.local");
  const envExample = resolve(root, ".env.example");
  if (!existsSync(envLocal) && existsSync(envExample)) {
    copyFileSync(envExample, envLocal);
    console.log("Created .env.local from .env.example");
  }
  setEnvVar(envLocal, "DATABASE_URL", dbUrl);
  console.log(`Set DATABASE_URL in .env.local -> ${dbName}`);

  const env = { ...process.env, DATABASE_URL: dbUrl };
  execFileSync("pnpm", ["db:migrate"], { cwd: root, stdio: "inherit", env });
  if (seed) execFileSync("pnpm", ["db:seed"], { cwd: root, stdio: "inherit", env });
  console.log(`Database ${dbName} is ready`);
};

const drop = async (): Promise<void> => {
  const dbName = dbNameForBranch(currentBranch());
  if (dbName === MAIN_DB) {
    console.error(`Refusing to drop the main database "${MAIN_DB}".`);
    process.exit(1);
  }
  await withAdmin(async (sql) => {
    // WITH (FORCE) terminates the worktree's own lingering connections (dev server, tests).
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)} WITH (FORCE)`);
  });
  console.log(`Dropped database ${dbName}`);
};

const list = async (): Promise<void> => {
  const byDb = new Map<string, string>();
  for (const [branch, path] of worktreesByBranch()) byDb.set(dbNameForBranch(branch), `${path} (${branch})`);
  const dbs = await withAdmin(listDatabases);
  if (dbs.length === 0) {
    console.log("No msb databases.");
    return;
  }
  const width = Math.max(...dbs.map((d) => d.length));
  for (const db of dbs) console.log(`${db.padEnd(width)}  ${byDb.get(db) ?? "-"}`);
};

const prune = async (apply: boolean): Promise<void> => {
  const branches = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]).split("\n").filter(Boolean);
  const live = new Set(branches.map(dbNameForBranch));
  live.add(MAIN_DB);
  await withAdmin(async (sql) => {
    const orphans = (await listDatabases(sql)).filter((db) => !live.has(db));
    if (orphans.length === 0) {
      console.log("Nothing to prune.");
      return;
    }
    for (const db of orphans) {
      if (apply) {
        await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(db)} WITH (FORCE)`);
        console.log(`Dropped ${db}`);
      } else {
        console.log(`Would drop ${db}`);
      }
    }
    if (!apply) console.log("Dry run. Re-run with --yes to drop.");
  });
};

const main = async (): Promise<void> => {
  const [command, ...flags] = process.argv.slice(2);
  switch (command) {
    case "ensure":
      return ensure(flags.includes("--seed"));
    case "drop":
      return drop();
    case "url":
      console.log(dbUrlFor(dbNameForBranch(currentBranch())));
      return;
    case "list":
      return list();
    case "prune":
      return prune(flags.includes("--yes"));
    default:
      console.error("Usage: pnpm tsx scripts/worktree-db.ts <ensure [--seed] | drop | url | list | prune [--yes]>");
      process.exit(2);
  }
};

// Only run when executed directly, so scripts/worktree.ts can import the helpers.
const isEntry = (): boolean => {
  try {
    return !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};
if (isEntry()) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
