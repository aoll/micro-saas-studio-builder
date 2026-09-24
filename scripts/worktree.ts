// Create, remove and list sibling git worktrees, one per feature agent. Each
// worktree gets its own branch (feat/<slug>) and its own Postgres database, so
// up to WORKTREE_MAX agents can run side by side. No dev server runs in a
// worktree: agents loop on typecheck and Vitest, and Playwright starts its own
// server on E2E_PORT, serialised by the `e2e` queue that `pnpm test:e2e` takes itself.
//
// Usage: pnpm tsx scripts/worktree.ts <new <slug> [--from <ref>] | rm <slug> [--keep-branch] | list>

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { dbNameForBranch, dbUrlFor, readEnvVar, setEnvVar } from "./worktree-db";

const WORKTREE_MAX = Number(process.env.WORKTREE_MAX ?? 10);
// Feature branches start from, and open their PRs against, the integration branch.
const INTEGRATION_BRANCH = process.env.INTEGRATION_BRANCH ?? "develop";

type Worktree = { path: string; branch: string | null };

const run = (cmd: string, args: string[], cwd?: string): void => {
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
};
const git = (args: string[], cwd?: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const fail = (message: string): never => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

/** The main checkout, found from any worktree via the shared git dir. */
const mainRoot = (): string => dirname(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));

const worktrees = (): Worktree[] => {
  const list: Worktree[] = [];
  for (const line of git(["worktree", "list", "--porcelain"]).split("\n")) {
    if (line.startsWith("worktree ")) list.push({ path: line.slice("worktree ".length), branch: null });
    else if (line.startsWith("branch refs/heads/") && list.length > 0)
      list[list.length - 1]!.branch = line.slice("branch refs/heads/".length);
  }
  return list;
};

const extraWorktrees = (root: string): Worktree[] => worktrees().filter((w) => resolve(w.path) !== resolve(root));

const pathFor = (root: string, slug: string): string => resolve(root, "..", `${basename(root)}-${slug}`);

const validateSlug = (slug: string | undefined): string => {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail("slug must match [a-z0-9][a-z0-9-]* (e.g. credits-ledger)");
  return slug as string;
};

const branchExists = (branch: string): boolean => {
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
};

const cmdNew = (slug: string, from: string): void => {
  const root = mainRoot();
  const path = pathFor(root, slug);
  const branch = `feat/${slug}`;
  git(["worktree", "prune"]);
  const existing = worktrees().find((w) => resolve(w.path) === path);

  if (existing) {
    if (existing.branch !== branch) fail(`${path} exists on branch ${existing.branch ?? "(detached)"}, expected ${branch}`);
    console.log(`Worktree ${path} already exists, re-running setup`);
  } else {
    if (existsSync(path)) fail(`${path} exists but is not a git worktree; move it away first`);
    const active = extraWorktrees(root).length;
    if (active >= WORKTREE_MAX) fail(`${active} worktrees already active (WORKTREE_MAX=${WORKTREE_MAX}); remove one first`);
    run("git", ["fetch", "origin"], root);
    if (branchExists(branch)) run("git", ["worktree", "add", path, branch], root);
    else run("git", ["worktree", "add", path, "-b", branch, from], root);
  }

  // `worktree add -b <branch> origin/<integration>` sets the new branch's
  // upstream to the integration branch. A bare `git push` from an agent would
  // then push feature commits straight to it. Pushing with -u rebinds the upstream to
  // origin/feat/<slug> before anything else can push.
  run("git", ["push", "-u", "origin", branch], path);

  const envLocal = resolve(path, ".env.local");
  if (!existsSync(envLocal)) {
    const source = [resolve(root, ".env.local"), resolve(path, ".env.example")].find(existsSync);
    if (source) copyFileSync(source, envLocal);
  }
  const dbName = dbNameForBranch(branch);
  // Point at the worktree's own database right away so a copied main
  // DATABASE_URL is never left in place if a later step fails.
  setEnvVar(envLocal, "DATABASE_URL", dbUrlFor(dbName));

  if (existsSync(resolve(path, "package.json"))) {
    run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], path);
    run("pnpm", ["tsx", "scripts/worktree-db.ts", "ensure", "--seed"], path);
  } else {
    console.warn("No package.json in the worktree yet: skipped pnpm install and database setup.");
  }

  console.log(
    [
      "",
      `Worktree ready`,
      `  path    ${path}`,
      `  branch  ${branch}`,
      `  db      ${dbName}`,
      `Next: cd ${path}`,
    ].join("\n"),
  );
};

const cmdRm = (slug: string, keepBranch: boolean): void => {
  const root = mainRoot();
  const path = pathFor(root, slug);
  const branch = `feat/${slug}`;
  const cwd = resolve(process.cwd());
  if (cwd === path || cwd.startsWith(path + sep)) fail(`run this from outside ${path}`);

  const existing = worktrees().find((w) => resolve(w.path) === path);
  if (existing) {
    // Check before dropping the database: a dirty worktree is kept, so its data must be too.
    if (existsSync(path) && git(["status", "--porcelain"], path))
      fail(`${path} has uncommitted changes; commit, push or discard them first`);
    try {
      run("pnpm", ["tsx", "scripts/worktree-db.ts", "drop"], path);
    } catch {
      console.warn(`Could not drop the database of ${branch}; clean up later with: pnpm tsx scripts/worktree-db.ts prune`);
    }
    try {
      // No --force: a dirty worktree must be committed or discarded by a human.
      run("git", ["worktree", "remove", path], root);
    } catch {
      fail(`git worktree remove failed (uncommitted changes?). Inspect ${path}`);
    }
  } else {
    console.log(`No worktree at ${path}`);
  }

  if (!keepBranch && branchExists(branch)) {
    try {
      // -d only: refuses unmerged work. A pushed branch counts as merged into its upstream.
      run("git", ["branch", "-d", branch], root);
    } catch {
      fail(`branch ${branch} has unpushed or unmerged commits; kept. Delete it yourself once checked.`);
    }
  }
};

const cmdList = (): void => {
  const root = mainRoot();
  const prefix = `${basename(root)}-`;
  const rows = extraWorktrees(root).map((w) => {
    const env = resolve(w.path, ".env.local");
    const dbUrl = readEnvVar(env, "DATABASE_URL");
    let dirty = "?";
    try {
      dirty = git(["status", "--porcelain"], w.path) ? "yes" : "no";
    } catch {
      // missing directory: leave "?"
    }
    const name = basename(w.path);
    return [
      name.startsWith(prefix) ? name.slice(prefix.length) : name,
      w.branch ?? "(detached)",
      dbUrl ? new URL(dbUrl).pathname.slice(1) : "-",
      dirty,
    ];
  });
  if (rows.length === 0) {
    console.log("No extra worktrees.");
    return;
  }
  const table = [["SLUG", "BRANCH", "DB", "DIRTY"], ...rows];
  const widths = table[0]!.map((_, i) => Math.max(...table.map((r) => r[i]!.length)));
  for (const r of table) console.log(r.map((c, i) => c.padEnd(widths[i]!)).join("  "));
};

const main = async (): Promise<void> => {
  const [command, ...args] = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  switch (command) {
    case "new":
      return cmdNew(validateSlug(args[0]), flag("--from") ?? `origin/${INTEGRATION_BRANCH}`);
    case "rm":
      return cmdRm(validateSlug(args[0]), args.includes("--keep-branch"));
    case "list":
      return cmdList();
    default:
      console.error(
        "Usage: pnpm tsx scripts/worktree.ts <new <slug> [--from <ref>] | rm <slug> [--keep-branch] | list>",
      );
      process.exit(2);
  }
};

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
