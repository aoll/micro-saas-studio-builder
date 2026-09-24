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
// `live` redraws the usage in real time (machine, queues, jobs with their memory).
//
// Usage: pnpm tsx scripts/monitor.ts <status | live [--interval <seconds>] | tick | watch [--interval <seconds>] | reset>

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, totalmem } from "node:os";
import { basename, join } from "node:path";
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

type Job = { queue: string; state: "run" | "wait"; pid: number; since: number };

/** Live jobs, from the `<queue>.run.<pid>` / `<queue>.wait.<pid>` markers queued.sh keeps. */
const jobs = (): Job[] => {
  if (!existsSync(DIR)) return [];
  const list: Job[] = [];
  for (const f of readdirSync(DIR)) {
    const m = f.match(/^([a-z0-9]+)\.(run|wait)\.(\d+)$/);
    if (!m) continue;
    const pid = Number(m[3]);
    const path = join(DIR, f);
    if (!alive(pid)) {
      rmSync(path, { force: true }); // killed before its trap ran
      continue;
    }
    try {
      list.push({ queue: m[1]!, state: m[2] as Job["state"], pid, since: statSync(path).mtimeMs });
    } catch {
      // finished between readdir and stat
    }
  }
  return list;
};

const count = (all: Job[], queue: string) => ({
  running: all.filter((j) => j.queue === queue && j.state === "run").length,
  waiting: all.filter((j) => j.queue === queue && j.state === "wait").length,
});

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
  jobs: Job[];
  test: { running: number; waiting: number };
  typecheck: { running: number; waiting: number };
  worktrees: number;
};

const snapshot = async (sampleMs = 2000): Promise<Snapshot> => {
  const usage = await sample(sampleMs);
  const all = jobs();
  return {
    ...usage,
    limits: { test: readLimit(LIMITS.test), typecheck: readLimit(LIMITS.typecheck), worktrees: readLimit(LIMITS.worktrees) },
    jobs: all,
    test: count(all, "test"),
    typecheck: count(all, "typecheck"),
    worktrees: activeWorktrees(),
  };
};

/** Resident memory of every process tree rooted at the given pids, from one `ps` call. */
const treeMemory = (roots: number[]): Map<number, number> => {
  const result = new Map<number, number>();
  if (roots.length === 0) return result;
  let rows: [number, number, number][] = [];
  try {
    rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim()
      .split("\n")
      .map((l) => l.trim().split(/\s+/).map(Number) as [number, number, number]);
  } catch {
    return result;
  }
  const children = new Map<number, number[]>();
  const rss = new Map<number, number>();
  for (const [pid, ppid, kb] of rows) {
    rss.set(pid, kb * 1024);
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  for (const root of roots) {
    let total = 0;
    const stack = [root];
    while (stack.length) {
      const pid = stack.pop()!;
      total += rss.get(pid) ?? 0;
      stack.push(...(children.get(pid) ?? []));
    }
    result.set(root, total);
  }
  return result;
};

/** The command a job runs (queued.sh's arguments after the queue name), and the worktree it runs in. */
const describe = (pid: number): { cmd: string; where: string } => {
  try {
    const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
    const i = argv.findIndex((a) => a.endsWith("queued.sh"));
    return { cmd: argv.slice(i + 2).join(" "), where: basename(readlinkSync(`/proc/${pid}/cwd`)) };
  } catch {
    return { cmd: "?", where: "?" }; // no /proc (macOS) or the job just ended
  }
};

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const bar = (x: number, width = 30): string => {
  const full = Math.round(Math.min(1, Math.max(0, x)) * width);
  return `[${"#".repeat(full)}${".".repeat(width - full)}] ${pct(x).padStart(4)}`;
};
const duration = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};

/** Full-screen view for `live`. */
const render = (s: Snapshot): string => {
  const used = memTotal * (1 - s.memFree);
  const lines = [
    `msb monitor · ${new Date().toLocaleTimeString()} · Ctrl-C to quit`,
    "",
    `cpu     ${bar(s.cpu)}  ${cores} cores`,
    `memory  ${bar(1 - s.memFree)}  ${(used / GB).toFixed(1)} / ${(memTotal / GB).toFixed(1)} GB`,
    "",
    `test       ${s.test.running}/${s.limits.test} slots · ${s.test.waiting} waiting (cap ${LIMITS.test.cap})`,
    `typecheck  ${s.typecheck.running}/${s.limits.typecheck} slots · ${s.typecheck.waiting} waiting (cap ${LIMITS.typecheck.cap})`,
    `worktrees  ${s.worktrees}/${s.limits.worktrees} active (cap ${LIMITS.worktrees.cap})`,
    "",
  ];
  const memory = treeMemory(s.jobs.filter((j) => j.state === "run").map((j) => j.pid));
  const sorted = [...s.jobs].sort((a, b) => a.state.localeCompare(b.state) || a.since - b.since);
  lines.push(sorted.length ? "QUEUE      STATE  TIME     MEM      WORKTREE                        COMMAND" : "no queued jobs");
  for (const j of sorted) {
    const { cmd, where } = describe(j.pid);
    const mem = j.state === "run" ? `${((memory.get(j.pid) ?? 0) / GB).toFixed(2)} GB` : "-";
    lines.push(
      [j.queue.padEnd(10), (j.state === "run" ? "run" : "wait").padEnd(6), duration(Date.now() - j.since).padEnd(8), mem.padEnd(8), where.padEnd(31), cmd].join(" "),
    );
  }
  const log = existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").slice(-3) : [];
  if (log.length) lines.push("", "last adjustments:", ...log.map((l) => `  ${l}`));
  return lines.join("\n");
};

const print = (s: Snapshot): void => {
  console.log(`cpu ${pct(s.cpu)} of ${cores} cores · memory available ${pct(s.memFree)} of ${(memTotal / GB).toFixed(1)} GB`);
  for (const q of ["test", "typecheck"] as const)
    console.log(`${q.padEnd(10)} slots ${s.limits[q]} (cap ${LIMITS[q].cap}) · running ${s[q].running} · waiting ${s[q].waiting}`);
  console.log(`${"worktrees".padEnd(10)} max ${s.limits.worktrees} (cap ${LIMITS.worktrees.cap}) · active ${s.worktrees}`);
};

/** One line of usage, printed by `watch` at every tick. */
const summary = (s: Snapshot): string =>
  `${new Date().toLocaleTimeString()} cpu ${pct(s.cpu)} mem ${pct(1 - s.memFree)} · ` +
  `test ${s.test.running}/${s.limits.test} (+${s.test.waiting} waiting) · ` +
  `typecheck ${s.typecheck.running}/${s.limits.typecheck} (+${s.typecheck.waiting} waiting) · ` +
  `worktrees ${s.worktrees}/${s.limits.worktrees}`;

/** One adjustment step. Returns the changes made. */
const tick = async (verbose = false): Promise<string[]> => {
  const s = await snapshot();
  if (verbose) console.log(summary(s));
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
    case "live": {
      const i = args.indexOf("--interval");
      const seconds = i >= 0 ? Number(args[i + 1]) : 2;
      // The CPU sample spans the whole interval, so each frame shows the load since the previous one.
      for (;;) process.stdout.write(`\x1b[2J\x1b[H${render(await snapshot(seconds * 1000))}\n`);
    }
    case "tick":
      await tick();
      return;
    case "watch": {
      const i = args.indexOf("--interval");
      const seconds = i >= 0 ? Number(args[i + 1]) : 60;
      console.log(`Monitoring every ${seconds}s; changes are logged to ${LOG}`);
      for (;;) {
        await tick(true);
        await sleep(seconds * 1000);
      }
    }
    case "reset":
      for (const l of Object.values(LIMITS)) rmSync(join(DIR, l.file), { force: true });
      console.log("Limits reset to QUEUE_SLOTS_* / WORKTREE_MAX defaults.");
      return;
    default:
      console.error("Usage: pnpm tsx scripts/monitor.ts <status | live [--interval <seconds>] | tick | watch [--interval <seconds>] | reset>");
      process.exit(2);
  }
};

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
