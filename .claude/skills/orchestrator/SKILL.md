---
name: orchestrator
description: >
  Runs every approved spec to a merge into the run's integration branch, with
  up to 10 worktrees in parallel: keeps a versioned dependency registry,
  starts a spec as soon as its own dependencies are merged and a worktree is
  free, drives each one through the classic ECC flow (plan, TDD, code review,
  checks, PR, merge), takes over stuck specs, and hands the integration branch
  to the human at the end. Use when asked to implement several specs or "all
  the specs".
---

# Orchestrator

The `qa-orchestrator` skill reuses this flow as is for its fix specs
(`specs/qa/`), on its own registry and integration branch.

You are the orchestrator: the main session. You dispatch agents, track state,
merge into the integration branch and talk to the human. You do not implement
a spec yourself, except to take over one that is stuck (below).

## Run setup

1. **Integration branch:** create this run's integration branch from
   `origin/main` and record it: `pnpm tsx scripts/worktree.ts integration
   integration/<run>` (e.g. `integration/v1`). The name is yours to choose;
   everything else reads it from `git config msb.integration`. During the run
   the main checkout sits on it (`git switch <integration>`, `git pull` after
   every merge): that is where you write the registry. Every worktree starts
   from it and every pull request targets it. **You merge the spec PRs into it
   as they pass** (step 7): that is what it is for.
2. **Registry:** write the dependency registry (next section), commit and push
   it to the integration branch.
3. **Monitoring:** set up the three layers of the Monitoring section.
4. **First dispatch:** run the dispatch loop once.

## Dependency registry: continuous dispatch, no waves

The waves of `specs/README.md` are a reading aid, never a barrier: a spec
starts as soon as **its own** dependencies are merged into the integration
branch and a worktree is free, whatever the rest of its wave is doing.

The registry is `.claude/runs/<run>.json` on the integration branch: versioned,
so it survives a container reset (git is the memory, never the conversation).
You are its only writer; agents never touch it.

```json
{
  "integration": "integration/v1",
  "specs": {
    "SETUP-skeleton": { "dependsOn": [], "status": "ready", "worktree": null, "pr": null },
    "CONTRACT-types": { "dependsOn": ["SETUP-skeleton"], "status": "pending", "worktree": null, "pr": null }
  },
  "pendingIntegrations": []
}
```

Build `dependsOn` from each spec's `Dépend de` (and the index in
`specs/README.md`), expanded to exact spec names: `SETUP` is
`SETUP-skeleton`, `Contrats` the three CONTRACT specs, `V2` every V2 spec,
`Tout` every other spec; a short reference (`SA-02`, `LEDGER`) is the spec
file with that prefix. Statuses, never another:

- `pending`: at least one `dependsOn` entry is not `merged`;
- `ready`: every `dependsOn` entry is `merged` (or none); waiting for a worktree;
- `dispatched`: worktree created, going through the per-spec flow;
- `merged`: squash-merged into the integration branch (step 7);
- `blocked`: waiting for the human (see "A stuck spec");
- `deferred`: `E2E-demo`, the run's end-to-end verification, never dispatched
  as a spec; it belongs to the E2E phase and counts as done for the run.

**Dispatch loop**, run at the start and after **every** event (a merge, a
spec blocked or unblocked, a pool size change), never computed once:

1. Every `pending` spec whose `dependsOn` are now all `merged` becomes `ready`.
2. While fewer specs are `dispatched` than the pool allows
   (`monitor.ts status`) and a spec is `ready`: dispatch one (step 0 of the
   flow), preferring the critical path (the longest chain of dependants), then
   the spec that unblocks the most others. Launch the dispatches of one round
   in the same message. The worktree is created at dispatch, never earlier.
3. Commit and push the registry (`chore(run): <what changed>`) when a status
   changed.

The `ready` entries are the queue: nothing else to keep on the side.

**Dependency gaps found on the way.** `tdd-guide` reports, even when empty,
the scope it had to leave out because another spec of the run was not merged
yet (`Dependency gaps`: missing spec, scope left out). Never ignore one because
the spec is otherwise green: it is real scope not delivered. For each gap:

- if the missing spec is still to come and the gap fits in its `Périmètre`,
  record it in `pendingIntegrations` (`{ "spec", "blockedOn", "what",
  "resolved": false }`);
- otherwise add a residual spec to the registry, `<REF>b`, written by you in
  `specs/<REF>b-<name>.md` with the scope left out, `dependsOn` exactly the
  missing spec (plus the original's dependencies), never a guess.

After every merge, handle each `pendingIntegrations` entry whose `blockedOn`
is now `merged`: dispatch the integration (a short spec flow in the
`blockedOn` spec's follow-up worktree, or fold it into a spec still running
when it is inside its `Périmètre`), then set `resolved: true`. The run is not
over while one is unresolved.

## Per-spec flow (classic ECC)

Each step is one background agent working in the spec's worktree. Give it the
absolute worktree path and tell it to run every command there. Every brief
starts with the same context instruction: "Before anything else, read every
file of docs/ in full (index in docs/README.md): it is the context of your spec,
not optional reading. Then CLAUDE.md and specs/<REF>-<name>.md." When its
notification arrives, launch the next step of that spec. Launch independent
steps of different specs in the same message.

| # | Step | Who | Done when |
|---|------|-----|-----------|
| 0 | Worktree | you: `pnpm tsx scripts/worktree.ts new <slug>` | branch pushed, database migrated and seeded |
| 1 | Plan | `planner` agent, then you write and commit `.claude/plans/<REF>.plan.md` (`/plan`) | plan committed; no user wait, the merged spec is the approval |
| 2 | TDD | `tdd-guide` agent (`/tdd`) | every acceptance bullet green, coverage 80%+ on `lib/**`, pushed |
| 3 | Code review | `/review`: `code-reviewer` + specialists | no CRITICAL or HIGH left; MEDIUM fixed when possible. Findings go back to `tdd-guide`, then review again |
| 4 | Commit & push | the agent that fixed | nothing uncommitted or unpushed |
| 5 | Pre-review checks | `verification-loop` (`/verify`) after merging the integration branch into the branch | READY |
| 6 | Pull request | you: base = the integration branch, title `feat(<scope>): <REF> <summary>`, template filled | PR open |
| 7 | Merge | you: squash merge into the integration branch, commit title = PR title | merged; worktree removed, dependants start |

**Merge gate (step 7).** Merge a spec's PR into the integration branch yourself,
without waiting for the human, as soon as all of these hold on its current head:

- `/verify` READY after merging the latest integration branch into it, and
  nothing pushed since;
- the last `/review` has no CRITICAL or HIGH finding left;
- GitHub reports it mergeable (no conflict); otherwise merge the integration
  branch into it, re-run `/verify`, then merge;
- its diff stays inside the spec's `Périmètre`, and touches a frozen contract
  (`lib/db/schema.ts`, `lib/schemas/**`, DAL signatures) only if the spec is a
  CONTRACT spec.

Squash merge only, the PR title as commit title, **one merge at a time**: when
two specs pass together, merge one, pull, then the other. If one condition
fails, send it back through the flow (`tdd-guide`, review, `/verify`). If it is
still stuck after that, you take over (below). Once merged, in this order:
`pnpm tsx scripts/worktree.ts rm <slug>`, `git pull` in the main checkout, set
the spec `merged` in the registry, handle `pendingIntegrations`, run the
dispatch loop, and tell the specs still running to merge the integration
branch before their next `/verify`. Never merge into `main`, never force-push
the integration branch.

A conflict on a file every spec touches mechanically (a lockfile, a generated
file, a Drizzle migration snapshot) is resolved by regenerating it, never by
hand. A conflict anywhere else means the dependency graph was wrong: treat it
as a stuck spec, and fix the registry (`dependsOn`) for the specs still to come.


## Monitoring (continuous, three layers)

1. **Daemon:** `pnpm tsx scripts/monitor.ts start`. It samples CPU and memory
   every 5 s, checks the disk and Postgres, tunes the limits below on its own,
   and writes one line per event to `/tmp/msb-queue/monitor.log`. It does not
   depend on you: it keeps tuning while you are busy or between two turns.
   `start` is a no-op when it already runs.
2. **Event stream:** follow that log with the Monitor tool, so each event
   reaches you as it happens:
   `Monitor({ description: 'machine monitor events (msb)', timeout_ms: 1800000,
   command: 'tail -n 0 -F /tmp/msb-queue/monitor.log' })`. A Monitor expires
   after 30 min: re-arm it at each expiry.
3. **Heartbeat:** a `send_later` every 5 min, re-armed at each firing, the
   only layer that survives a container reset:
   `mcp__Claude_Code_Remote__send_later({ delay_minutes: 5, message: 'Orchestrator heartbeat: run pnpm tsx scripts/monitor.ts start (restarts the daemon if it died) and pnpm tsx scripts/monitor.ts status; re-arm the Monitor on monitor.log if it expired; post one short line with the status table state. If no spec is left running, stop here; otherwise re-arm this same send_later.' })`.

Act on each event:

| Event | What to do |
|-------|------------|
| `ADJUST` | Nothing: the daemon changed a limit. Note the new pool size before starting a spec |
| `SATURATION-MEM` | Start no new spec until it clears; if it lasts, find the heaviest job with `monitor.ts live` or `ps` |
| `SATURATION-CPU` | Usually a burst of queued jobs, already capped: check it clears; if not, look for a runaway process |
| `SATURATION-DISK` | Start no new spec; remove the worktrees of merged specs; tell the human if it does not clear |
| `SATURATION-PG-CONNS` | Look for `idle in transaction` sessions in `pg_stat_activity` and the worktree they come from |
| `CRASH-POSTGRES` | `node .claude/hooks/session-start.mjs` restarts it; agents with DB tests re-run them once it clears |
| `MONITOR-STOPPED`, `MONITOR-CRASH` | `monitor.ts start`, then read `/tmp/msb-queue/monitor.err` for a crash |
| `… cleared` | The condition is over: resume what you paused |

An alert is not always an incident: check before acting. At the end of the run:
`monitor.ts stop`, stop the Monitor (`TaskStop`) and let the heartbeat lapse.
The human follows the machine in real time with `pnpm tsx scripts/monitor.ts live`.

## Machine limits

- Typecheck and tests are queued machine-wide: `pnpm typecheck` and
  `pnpm test` each wait for a free slot (4 at the start), whatever the number
  of worktrees. Agents run single test files directly while iterating and the
  full commands at the end of a phase.
- The daemon tunes the `test` and `typecheck` slots and the worktree pool,
  one step at a time, at most every 30 s:
  - **up** when, over the last 30 s, CPU stays under 60 % and more than 40 %
    of memory is free, and the limit is the bottleneck (jobs waiting in the
    queue, or every worktree in use), up to a cap derived from the cores and
    the memory;
  - **down** on pressure: CPU over 90 % on average over 30 s, or less than
    15 % of memory free right now; the pool only on memory pressure; never
    below 2. A lowered pool never
  stops a running spec: it only delays the next one. Never edit the limit
  files by hand; `monitor.ts reset` restores the defaults.
- E2E does not run per spec: it belongs to the E2E phase after all features.

## A stuck spec: you take over

When a spec does not get through its flow (an agent reports a check it cannot
make pass, the same finding comes back after a fix round, a merge conflict it
cannot resolve, an agent that fails or loops), you take it over: read the
worktree, the plan, the failing output and the agent's report, find the root
cause, and fix it yourself in the spec's worktree, test-first like `tdd-guide`
(`tdd-workflow` skill). Then run `/review` and `/verify` again and apply the
merge gate. Other specs keep running meanwhile. Never weaken a test, skip one
or edit a check's configuration to get through.

Only two things go to the human, because they change what was approved:

- a frozen contract to change (`lib/db/schema.ts`, `lib/schemas/**`, a DAL
  signature) outside a CONTRACT spec;
- a spec that cannot be met as written (contradictory acceptance bullets, a
  business rule the dossier leaves open, a file needed outside `Périmètre`).

For those, set the spec `blocked` (keep its worktree and its PR open), say
exactly what blocks and what you propose, and keep the other specs running.

## End of the run

The run is over when every spec is `merged` (or `deferred`), no
`pendingIntegrations` entry is unresolved and the integration branch passes
`/verify`. Then: stop the monitoring (below), and hand over to the human with
the integration branch, the registry and a short report (specs merged, specs
you took over and why, residual specs added, anything left for the E2E
phase). This is the milestone: the human reviews the integration branch and
merges it into `main`. You never merge into `main`.

## Status

The registry is the source of truth. On every change, show the human a table
derived from it, with the flow step of each dispatched spec:

| Spec | Status | Step | Worktree | PR |
|------|--------|------|----------|----|
| `<REF>` | pending · ready · dispatched · merged · blocked · deferred | plan · tdd · review · verify · PR | `<slug>` | link |

Under it, one line from `monitor.ts status`: CPU, memory, slots and pool size.

After a container reset, rebuild everything from git, never from memory: the
registry on the integration branch, `pnpm tsx scripts/worktree.ts list`, the
open PRs; then restart the monitoring and run the dispatch loop.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
