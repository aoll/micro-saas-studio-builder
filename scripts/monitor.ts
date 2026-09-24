// Machine monitor for orchestration runs. Samples CPU and memory, reads the
// queues of scripts/queued.sh, and tunes three limits shared by every worktree:
// the `test` and `typecheck` slots and the worktree pool (WORKTREE_MAX).
//
// - More: when CPU and memory are underused and a limit is the bottleneck
//   (a queue has jobs waiting, or every worktree is in use), raise it by one.
// - Less: when CPU or memory is under pressure, lower the slots by one; lower
//   the worktree pool only on memory pressure (agents mostly wait on the model,
//   their CPU spikes come from the queued jobs, which the slots already cap).
// One step per tick, within [floor, cap], so a change is observed before the next.
//
// Limits live in files of the queue directory (QUEUE_LOCK_DIR, default
// /tmp/msb-queue): `test.slots`, `typecheck.slots`, `worktrees.max`. They
// override the QUEUE_SLOTS_* and WORKTREE_MAX defaults; `reset` removes them.
//
// Usage: pnpm tsx scripts/monitor.ts <status | tick | watch [--interval <seconds>] | reset>

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, totalmem } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const DIR = process.env.QUEUE_LOCK_DIR ?? "/tmp/msb-queue";
const LOG = join(DIR, "monitor.log");
const GB = 1024 ** 3;

// Underused: room for one more job. Pressure: back off before the OOM killer does.
const IDLE = { cpu: 0.6, memFree: 0.4 };
const PRESSURE = { cpu: 0.9, memFree: 0.15 };

const memTotal = Math.min(totalmem(), process.constrainedMemory() || Infinity);
const cores = availableParallelism();

type Limit = { file: string; env: string; fallback: number; floor: number; cap: number };
// A typecheck or a Vitest suite peaks around 1.5-2 GB; an agent session with its worktree around 1 GB.
const LIMITS = {
  test: { file: "test.slots", env: "QUEUE_SLOTS_TEST", fallback: 4, floor: 2, cap: Math.min(cores * 2, Math.floor(memTotal / (2 * GB))) },
  typecheck: { file: "typecheck.slots", env: "QUEUE_SLOTS_TYPECHECK", fallback: 4, floor: 2, cap: Math.min(cores * 2, Math.floor(memTotal / (2 * GB))) },
  worktrees: { file: "worktrees.max", env: "WORKTREE_MAX", fallback: 10, floor: 2, cap: Math.min(20, Math.floor(memTotal / GB)) },
} satisfies Record<string, Limit>;
type Name = keyof typeof LIMITS;

const readLimit = (l: Limit): number => {
  const path = join(DIR, l.file);
  const raw = existsSync(path) ? readFileSync(path, "utf8").trim() : (process.env[l.env] ?? "");
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : l.fallback;
};

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Jobs of a queue, from the `<queue>.run.<pid>` / `<queue>.wait.<pid>` markers queued.sh keeps. */
const queueJobs = (queue: string): { running: number; waiting: number } => {
  const count = { running: 0, waiting: 0 };
  if (!existsSync(DIR)) return count;
  for (const f of readdirSync(DIR)) {
    const m = f.match(/^([a-z]+)\.(run|wait)\.(\d+)$/);
    if (!m || m[1] !== queue) continue;
    if (!alive(Number(m[3]))) {
      rmSync(join(DIR, f), { force: true }); // killed before its trap ran
      continue;
    }
    if (m[2] === "run") count.running++;
    else count.waiting++;
  }
  return count;
};

const activeWorktrees = (): number => {
  try {
    const out = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").filter((l) => l.startsWith("worktree ")).length - 1; // minus the main checkout
  } catch {
    return 0;
  }
};

const cpuTimes = () => cpus().reduce((acc, c) => {
  const t = c.times;
  acc.idle += t.idle;
  acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
  return acc;
}, { idle: 0, total: 0 });

/** CPU busy share over `ms`, and the share of memory still available. */
const sample = async (ms: number) => {
  const a = cpuTimes();
  await sleep(ms);
  const b = cpuTimes();
  const total = b.total - a.total;
  // availableMemory() honours the cgroup limit of a container; freemem() only sees the host.
  return { cpu: total > 0 ? 1 - (b.idle - a.idle) / total : 0, memFree: Math.min(process.availableMemory(), memTotal) / memTotal };
};

type Snapshot = Awaited<ReturnType<typeof sample>> & {
  limits: Record<Name, number>;
  test: { running: number; waiting: number };
  typecheck: { running: number; waiting: number };
  worktrees: number;
};

const snapshot = async (): Promise<Snapshot> => ({
  ...(await sample(2000)),
  limits: { test: readLimit(LIMITS.test), typecheck: readLimit(LIMITS.typecheck), worktrees: readLimit(LIMITS.worktrees) },
  test: queueJobs("test"),
  typecheck: queueJobs("typecheck"),
  worktrees: activeWorktrees(),
});

const pct = (x: number): string => `${Math.round(x * 100)}%`;

const print = (s: Snapshot): void => {
  console.log(`cpu ${pct(s.cpu)} of ${cores} cores · memory available ${pct(s.memFree)} of ${(memTotal / GB).toFixed(1)} GB`);
  for (const q of ["test", "typecheck"] as const)
    console.log(`${q.padEnd(10)} slots ${s.limits[q]} (cap ${LIMITS[q].cap}) · running ${s[q].running} · waiting ${s[q].waiting}`);
  console.log(`${"worktrees".padEnd(10)} max ${s.limits.worktrees} (cap ${LIMITS.worktrees.cap}) · active ${s.worktrees}`);
};

/** One adjustment step. Returns the changes made. */
const tick = async (): Promise<string[]> => {
  const s = await snapshot();
  const memPressure = s.memFree < PRESSURE.memFree;
  const cpuPressure = s.cpu > PRESSURE.cpu;
  const idle = s.cpu < IDLE.cpu && s.memFree > IDLE.memFree;
  const bottleneck: Record<Name, boolean> = {
    test: s.test.waiting > 0,
    typecheck: s.typecheck.waiting > 0,
    worktrees: s.worktrees >= s.limits.worktrees,
  };
  const changes: string[] = [];
  for (const name of Object.keys(LIMITS) as Name[]) {
    const l = LIMITS[name];
    const from = s.limits[name];
    const pressure = memPressure || (cpuPressure && name !== "worktrees");
    const to = pressure ? Math.max(l.floor, from - 1) : idle && bottleneck[name] ? Math.min(l.cap, from + 1) : from;
    if (to === from) continue;
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, l.file), `${to}\n`);
    changes.push(`${name} ${from} -> ${to}`);
  }
  if (changes.length) {
    const line = `${new Date().toISOString()} cpu ${pct(s.cpu)} mem free ${pct(s.memFree)}: ${changes.join(", ")}`;
    appendFileSync(LOG, `${line}\n`);
    console.log(line);
  }
  return changes;
};

const main = async (): Promise<void> => {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "status":
      return print(await snapshot());
    case "tick":
      await tick();
      return;
    case "watch": {
      const i = args.indexOf("--interval");
      const seconds = i >= 0 ? Number(args[i + 1]) : 60;
      console.log(`Monitoring every ${seconds}s; changes are logged to ${LOG}`);
      for (;;) {
        await tick();
        await sleep(seconds * 1000);
      }
    }
    case "reset":
      for (const l of Object.values(LIMITS)) rmSync(join(DIR, l.file), { force: true });
      console.log("Limits reset to QUEUE_SLOTS_* / WORKTREE_MAX defaults.");
      return;
    default:
      console.error("Usage: pnpm tsx scripts/monitor.ts <status | tick | watch [--interval <seconds>] | reset>");
      process.exit(2);
  }
};

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
