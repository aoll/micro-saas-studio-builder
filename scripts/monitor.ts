// Machine monitor for orchestration runs, adapted from castflow's saturation
// Monitor. A daemon samples CPU and memory every 5 s, checks disk and Postgres,
// and tunes three limits shared by every worktree: the `test` and `typecheck`
// slots and the worktree pool (WORKTREE_MAX).
//
// Tuning, one step at a time within [floor, cap], at most every 30 s:
// - up when CPU and memory are underused over the last 30 s and the limit is the
//   bottleneck (jobs waiting in its queue, or every worktree in use);
// - down on pressure: CPU over the last 30 s, or memory right now (the OOM
//   killer does not wait for an average). The worktree pool only goes down on
//   memory pressure: agents mostly wait on the model, and the CPU spikes come
//   from queued jobs, which the slots already cap.
//
// The daemon writes events only (adjustments, alerts entering and clearing,
// start and stop) to monitor.log: the orchestrator follows that file with its
// Monitor tool and is notified of each line.
//
// State lives in the queue directory (QUEUE_LOCK_DIR, default /tmp/msb-queue):
// `test.slots`, `typecheck.slots`, `worktrees.max` override the QUEUE_SLOTS_* and
// WORKTREE_MAX defaults; `monitor.pid`, `monitor.alive` and `monitor.log` belong
// to the daemon.
//
// MONITOR_SAMPLE_MS changes the sampling period (default 5000).
//
// Usage: pnpm tsx scripts/monitor.ts <start | stop | status | live [--interval <s>] | run | reset>
//   start   launch the daemon in the background (no-op when it already runs)
//   run     the daemon loop in the foreground (what `start` launches)
//   live    real-time view: machine, queues, jobs with their memory, last events

import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism, cpus, totalmem } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const DIR = process.env.QUEUE_LOCK_DIR ?? "/tmp/msb-queue";
const LOG = join(DIR, "monitor.log");
const PID = join(DIR, "monitor.pid");
const ALIVE = join(DIR, "monitor.alive");
const GB = 1024 ** 3;

const SAMPLE_MS = Number(process.env.MONITOR_SAMPLE_MS ?? 5_000);
const WINDOW = 6; // samples averaged for decisions: 30 s by default
const COOLDOWN_MS = WINDOW * SAMPLE_MS; // after a change, observe a full window before the next one
const PG_EVERY = WINDOW; // check Postgres once per window

// Underused: room for one more job. Pressure: back off before the OOM killer does.
const IDLE = { cpu: 0.6, memFree: 0.4 };
const PRESSURE = { cpu: 0.9, memFree: 0.15 };
const ALERT = { diskFree: 0.1, pgConnections: 0.8 };
const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";

const memTotal = Math.min(totalmem(), process.constrainedMemory() || Infinity);
const cores = availableParallelism();

type Limit = { file: string; env: string; fallback: number; floor: number; cap: number };
// A typecheck or a Vitest suite peaks around 1.5-2 GB; an agent session with its worktree around 1 GB.
const LIMITS = {
  test: {
    file: "test.slots",
    env: "QUEUE_SLOTS_TEST",
    fallback: 4,
    floor: 2,
    cap: Math.min(cores * 2, Math.floor(memTotal / (2 * GB))),
  },
  typecheck: {
    file: "typecheck.slots",
    env: "QUEUE_SLOTS_TYPECHECK",
    fallback: 4,
    floor: 2,
    cap: Math.min(cores * 2, Math.floor(memTotal / (2 * GB))),
  },
  worktrees: {
    file: "worktrees.max",
    env: "WORKTREE_MAX",
    fallback: 10,
    floor: 2,
    cap: Math.min(20, Math.floor(memTotal / GB)),
  },
} satisfies Record<string, Limit>;
type Name = keyof typeof LIMITS;

const readLimit = (l: Limit): number => {
  const path = join(DIR, l.file);
  const raw = existsSync(path) ? readFileSync(path, "utf8").trim() : (process.env[l.env] ?? "");
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : l.fallback;
};
const limits = (): Record<Name, number> => ({
  test: readLimit(LIMITS.test),
  typecheck: readLimit(LIMITS.typecheck),
  worktrees: readLimit(LIMITS.worktrees),
});

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const daemonPid = (): number | null => {
  const pid = existsSync(PID) ? Number(readFileSync(PID, "utf8").trim()) : NaN;
  return Number.isInteger(pid) && alive(pid) ? pid : null;
};

// ---------------------------------------------------------------- measures

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
    const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter((l) => l.startsWith("worktree ")).length - 1; // minus the main checkout
  } catch {
    return 0;
  }
};

const cpuTimes = () =>
  cpus().reduce(
    (acc, c) => {
      const t = c.times;
      acc.idle += t.idle;
      acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
      return acc;
    },
    { idle: 0, total: 0 },
  );

type Usage = { cpu: number; memFree: number };

/** CPU busy share over `ms`, and the share of memory still available. */
const sample = async (ms: number): Promise<Usage> => {
  const a = cpuTimes();
  await sleep(ms);
  const b = cpuTimes();
  const total = b.total - a.total;
  // availableMemory() honours the cgroup limit of a container; freemem() only sees the host.
  return {
    cpu: total > 0 ? 1 - (b.idle - a.idle) / total : 0,
    memFree: Math.min(process.availableMemory(), memTotal) / memTotal,
  };
};

/** Free share of the disk holding the worktrees (they are siblings of this checkout). */
const diskFree = (): number => {
  try {
    const s = statfsSync(process.cwd());
    return s.bavail / s.blocks;
  } catch {
    return 1;
  }
};

/** Postgres connections in use, or "down"; null when psql is not installed. */
const postgres = (): { used: number; max: number } | "down" | null => {
  try {
    const out = execFileSync(
      "psql",
      [ADMIN_URL, "-tAc", "select count(*), current_setting('max_connections') from pg_stat_activity"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 },
    );
    const [used, max] = out.trim().split("|").map(Number);
    return { used: used ?? 0, max: max ?? 100 };
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "ENOENT" ? null : "down";
  }
};

// ---------------------------------------------------------------- daemon

const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** One event line in monitor.log (the orchestrator's Monitor tool turns each into a notification). */
const emit = (event: string, detail: string): void => {
  mkdirSync(DIR, { recursive: true });
  const line = `${new Date().toISOString()} ${event} ${detail}`;
  appendFileSync(LOG, `${line}\n`);
  if (process.stdout.isTTY) console.log(line);
};

const run = async (): Promise<void> => {
  mkdirSync(DIR, { recursive: true });
  const other = daemonPid();
  if (other && other !== process.pid) {
    console.error(`The monitor already runs (pid ${other}).`);
    process.exit(1);
  }
  writeFileSync(PID, `${process.pid}\n`);
  const stop = (reason: string) => {
    emit("MONITOR-STOPPED", reason);
    rmSync(PID, { force: true });
    process.exit(0);
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
  emit(
    "MONITOR-STARTED",
    `pid ${process.pid}, sample ${SAMPLE_MS / 1000}s, decisions on ${(WINDOW * SAMPLE_MS) / 1000}s`,
  );

  const history: Usage[] = [];
  const active = new Map<string, string>(); // alert -> detail, to emit on enter and on clear
  let lastChange = 0;
  let pg: ReturnType<typeof postgres> = null;

  for (let n = 0; ; n++) {
    const now = await sample(SAMPLE_MS);
    writeFileSync(ALIVE, `${new Date().toISOString()}\n`);
    history.push(now);
    if (history.length > WINDOW) history.shift();
    const avg: Usage = {
      cpu: history.reduce((s, u) => s + u.cpu, 0) / history.length,
      memFree: history.reduce((s, u) => s + u.memFree, 0) / history.length,
    };
    if (n % PG_EVERY === 0) pg = postgres();

    // Alerts: one line when a condition starts, one when it clears.
    const alerts = new Map<string, string>();
    if (history.length === WINDOW && avg.cpu > PRESSURE.cpu)
      alerts.set("SATURATION-CPU", `cpu ${pct(avg.cpu)} over the window on ${cores} cores`);
    if (now.memFree < PRESSURE.memFree) alerts.set("SATURATION-MEM", `memory available ${pct(now.memFree)}`);
    const disk = diskFree();
    if (disk < ALERT.diskFree) alerts.set("SATURATION-DISK", `disk available ${pct(disk)}`);
    if (pg === "down") alerts.set("CRASH-POSTGRES", "no answer on the admin URL");
    else if (pg && pg.used / pg.max > ALERT.pgConnections)
      alerts.set("SATURATION-PG-CONNS", `${pg.used}/${pg.max} connections`);
    for (const [key, detail] of alerts) if (!active.has(key)) emit(key, detail);
    for (const key of active.keys()) if (!alerts.has(key)) emit(key, "cleared");
    active.clear();
    for (const [key, detail] of alerts) active.set(key, detail);

    // Tuning: after a full window, and not twice within the cooldown.
    if (history.length < WINDOW || Date.now() - lastChange < COOLDOWN_MS) continue;
    const current = limits();
    const all = jobs();
    const memPressure = now.memFree < PRESSURE.memFree;
    const cpuPressure = avg.cpu > PRESSURE.cpu;
    const idle = avg.cpu < IDLE.cpu && avg.memFree > IDLE.memFree && now.memFree > IDLE.memFree;
    const bottleneck: Record<Name, boolean> = {
      test: count(all, "test").waiting > 0,
      typecheck: count(all, "typecheck").waiting > 0,
      worktrees: activeWorktrees() >= current.worktrees,
    };
    const changes: string[] = [];
    for (const name of Object.keys(LIMITS) as Name[]) {
      const l = LIMITS[name];
      const from = current[name];
      const pressure = memPressure || (cpuPressure && name !== "worktrees");
      const to = pressure ? Math.max(l.floor, from - 1) : idle && bottleneck[name] ? Math.min(l.cap, from + 1) : from;
      if (to === from) continue;
      writeFileSync(join(DIR, l.file), `${to}\n`);
      changes.push(`${name} ${from} -> ${to}`);
    }
    if (changes.length) {
      lastChange = Date.now();
      emit(
        "ADJUST",
        `${changes.join(", ")} (cpu ${pct(avg.cpu)} over the window, memory available ${pct(now.memFree)})`,
      );
    }
  }
};

const start = (): void => {
  const pid = daemonPid();
  if (pid) {
    console.log(`The monitor already runs (pid ${pid}).`);
    return;
  }
  mkdirSync(DIR, { recursive: true });
  const err = openSync(join(DIR, "monitor.err"), "a"); // crash traces; events go to monitor.log
  // Same runtime and loader flags (tsx) as this process, detached so it outlives the caller.
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, "run"], {
    detached: true,
    stdio: ["ignore", "ignore", err],
  });
  child.unref();
  console.log(`Monitor started (pid ${child.pid}); events in ${LOG}`);
};

const stopDaemon = (): void => {
  const pid = daemonPid();
  if (!pid) {
    console.log("The monitor is not running.");
    return;
  }
  process.kill(pid, "SIGTERM");
  console.log(`Monitor stopped (pid ${pid}).`);
};

// ---------------------------------------------------------------- views

const daemonLine = (): string => {
  const pid = daemonPid();
  if (!pid) return "daemon     NOT RUNNING: pnpm tsx scripts/monitor.ts start";
  const last = existsSync(ALIVE) ? Date.parse(readFileSync(ALIVE, "utf8").trim()) : NaN;
  const age = Number.isNaN(last) ? "no sample yet" : `last sample ${Math.round((Date.now() - last) / 1000)}s ago`;
  return `daemon     running (pid ${pid}), ${age}`;
};

type Snapshot = Usage & { limits: Record<Name, number>; jobs: Job[]; worktrees: number };

const snapshot = async (sampleMs: number): Promise<Snapshot> => ({
  ...(await sample(sampleMs)),
  limits: limits(),
  jobs: jobs(),
  worktrees: activeWorktrees(),
});

const queueLines = (s: Snapshot): string[] =>
  (["test", "typecheck"] as const).map((q) => {
    const c = count(s.jobs, q);
    return `${q.padEnd(10)} ${c.running}/${s.limits[q]} slots · ${c.waiting} waiting (cap ${LIMITS[q].cap})`;
  });

/** Resident memory of every process tree rooted at the given pids, from one `ps` call. */
const treeMemory = (roots: number[]): Map<number, number> => {
  const result = new Map<number, number>();
  if (roots.length === 0) return result;
  let rows: number[][] = [];
  try {
    rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .map((l) => l.trim().split(/\s+/).map(Number));
  } catch {
    return result;
  }
  const children = new Map<number, number[]>();
  const rss = new Map<number, number>();
  for (const [pid = 0, ppid = 0, kb = 0] of rows) {
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

const bar = (x: number, width = 30): string => {
  const full = Math.round(Math.min(1, Math.max(0, x)) * width);
  return `[${"#".repeat(full)}${".".repeat(width - full)}] ${pct(x).padStart(4)}`;
};
const duration = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};

const lastEvents = (n: number): string[] =>
  existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").slice(-n) : [];

/** Full-screen view for `live`. */
const render = (s: Snapshot): string => {
  const used = memTotal * (1 - s.memFree);
  const lines = [
    `msb monitor · ${new Date().toLocaleTimeString()} · Ctrl-C to quit`,
    "",
    `cpu     ${bar(s.cpu)}  ${cores} cores`,
    `memory  ${bar(1 - s.memFree)}  ${(used / GB).toFixed(1)} / ${(memTotal / GB).toFixed(1)} GB`,
    `disk    ${bar(1 - diskFree())}`,
    "",
    ...queueLines(s),
    `worktrees  ${s.worktrees}/${s.limits.worktrees} active (cap ${LIMITS.worktrees.cap})`,
    daemonLine(),
    "",
  ];
  const memory = treeMemory(s.jobs.filter((j) => j.state === "run").map((j) => j.pid));
  const sorted = [...s.jobs].sort((a, b) => a.state.localeCompare(b.state) || a.since - b.since);
  lines.push(
    sorted.length ? "QUEUE      STATE  TIME     MEM      WORKTREE                        COMMAND" : "no queued jobs",
  );
  for (const j of sorted) {
    const { cmd, where } = describe(j.pid);
    const mem = j.state === "run" ? `${((memory.get(j.pid) ?? 0) / GB).toFixed(2)} GB` : "-";
    lines.push(
      [
        j.queue.padEnd(10),
        j.state.padEnd(6),
        duration(Date.now() - j.since).padEnd(8),
        mem.padEnd(8),
        where.padEnd(31),
        cmd,
      ].join(" "),
    );
  }
  const events = lastEvents(5);
  if (events.length) lines.push("", "last events:", ...events.map((l) => `  ${l}`));
  return lines.join("\n");
};

const printStatus = (s: Snapshot): void => {
  console.log(
    `cpu ${pct(s.cpu)} of ${cores} cores · memory available ${pct(s.memFree)} of ${(memTotal / GB).toFixed(1)} GB · disk available ${pct(diskFree())}`,
  );
  for (const line of queueLines(s)) console.log(line);
  console.log(`worktrees  ${s.worktrees}/${s.limits.worktrees} active (cap ${LIMITS.worktrees.cap})`);
  console.log(daemonLine());
};

// ---------------------------------------------------------------- CLI

const main = async (): Promise<void> => {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "start":
      return start();
    case "stop":
      return stopDaemon();
    case "run":
      return run();
    case "status":
      return printStatus(await snapshot(2000));
    case "live": {
      const i = args.indexOf("--interval");
      const seconds = i >= 0 ? Number(args[i + 1]) : 2;
      // The CPU sample spans the whole interval, so each frame shows the load since the previous one.
      for (;;) process.stdout.write(`\x1b[2J\x1b[H${render(await snapshot(seconds * 1000))}\n`);
    }
    case "reset":
      for (const l of Object.values(LIMITS)) rmSync(join(DIR, l.file), { force: true });
      console.log("Limits reset to QUEUE_SLOTS_* / WORKTREE_MAX defaults.");
      return;
    default:
      console.error("Usage: pnpm tsx scripts/monitor.ts <start | stop | status | live [--interval <s>] | run | reset>");
      process.exit(2);
  }
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  if (process.argv[2] === "run") emit("MONITOR-CRASH", message.split("\n")[0] ?? "");
  console.error(message);
  process.exit(1);
});
