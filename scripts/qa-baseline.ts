// The QA baseline: the git blob hash of every application file at the end of
// the last QA run whose findings were all handled (skill qa-orchestrator).
// The next `qa` pass diffs the current tree against it: an added or changed
// file is tested in depth, an unchanged one gets a light regression check.
// Hashes, not a commit SHA: they survive the squash merge of the integration
// branch into main, which leaves the run's own commits unreachable.
//
// Usage: pnpm tsx scripts/qa-baseline.ts diff
//        pnpm tsx scripts/qa-baseline.ts write --note "<run, date, scenario>"
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASELINE_PATH = ".claude/qa/route-baseline.json";
// What a QA pass can see: routes, their actions and components, the DAL, AI
// and credit code behind them, their messages, the mock fixtures, the proxy.
const TRACKED = ["app", "lib", "messages", "fixtures", "proxy.ts"];
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

type Entry = { path: string; hash: string };
type Baseline = { commitSha: string; branch: string; generatedAt: string; note: string; entries: Entry[] };

/** Parse `git ls-tree -r --format='%(objectname) %(path)'`, without test files. */
export const parseLsTree = (output: string): Entry[] =>
  output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const space = line.indexOf(" ");
      return { hash: line.slice(0, space), path: line.slice(space + 1) };
    })
    .filter((entry) => !TEST_FILE.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path));

/** Without a baseline (first pass), every current file is new. */
export const diffBaseline = (baseline: Entry[] | null, current: Entry[]) => {
  const before = new Map((baseline ?? []).map((entry) => [entry.path, entry.hash]));
  const now = new Set(current.map((entry) => entry.path));
  return {
    added: current.filter((entry) => !before.has(entry.path)).map((entry) => entry.path),
    changed: current
      .filter((entry) => before.has(entry.path) && before.get(entry.path) !== entry.hash)
      .map((entry) => entry.path),
    removed: [...before.keys()].filter((path) => !now.has(path)),
    unchanged: current.filter((entry) => before.get(entry.path) === entry.hash).map((entry) => entry.path),
  };
};

const git = (args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

const currentEntries = (): Entry[] =>
  parseLsTree(git(["ls-tree", "-r", "HEAD", "--format=%(objectname) %(path)", "--", ...TRACKED]));

const readBaseline = (): Baseline | null =>
  existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline) : null;

const cmdDiff = (): void => {
  const baseline = readBaseline();
  const diff = diffBaseline(baseline?.entries ?? null, currentEntries());
  console.log(
    baseline
      ? `Baseline: ${baseline.commitSha} (${baseline.branch}, ${baseline.generatedAt}) — ${baseline.note}`
      : "No baseline: first pass, every file is new",
  );
  for (const path of diff.added) console.log(`A ${path}`);
  for (const path of diff.changed) console.log(`M ${path}`);
  for (const path of diff.removed) console.log(`D ${path}`);
  console.log(
    `${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed, ${diff.unchanged.length} unchanged`,
  );
};

const cmdWrite = (note: string | undefined): void => {
  if (!note) throw new Error('write needs --note "<run, date, scenario>"');
  const baseline: Baseline = {
    commitSha: git(["rev-parse", "HEAD"]),
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    generatedAt: new Date().toISOString().slice(0, 10),
    note,
    entries: currentEntries(),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${BASELINE_PATH}: ${baseline.entries.length} files at ${baseline.commitSha}`);
};

const isEntry = (): boolean => {
  try {
    return !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};
if (isEntry()) {
  const [command, ...args] = process.argv.slice(2);
  const noteAt = args.indexOf("--note");
  try {
    if (command === "diff") cmdDiff();
    else if (command === "write") cmdWrite(noteAt === -1 ? undefined : args[noteAt + 1]);
    else throw new Error('Usage: pnpm tsx scripts/qa-baseline.ts diff | write --note "<run, date, scenario>"');
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
