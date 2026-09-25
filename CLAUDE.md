# micro-saas-studio-builder

A Next.js back-office that launches AI micro-SaaS products from a form and runs
each one on data (funnel, AI cost, margin, status Test → Learn → Scale → Killed).
Every product is an AI tool with credits, served at `/{slug}`.

The design dossier lives in `docs/` (French, index in `docs/README.md`). It is
the source of truth for screens, data model, contracts and decisions, and the
context of every spec: an agent working on a spec reads every file of `docs/`
in full before starting, not only the sections its `Réf` cites. Specs live in
`specs/` (index, dependencies and conventions in `specs/README.md`). Next.js 16.3 documentation for the installed version is
referenced from `AGENTS.md` (managed by `next dev`): trust it over memory.

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Dev server on port 3000, main checkout only |
| `pnpm check` | typecheck + lint + format check + knip + unit tests |
| `pnpm typecheck` | Full typecheck, queued: 4 slots per machine |
| `pnpm test` / `pnpm test:coverage` | Full Vitest suite / with coverage, queued: 4 slots per machine |
| `pnpm vitest run <file>` | One test file, direct: the TDD loop |
| `pnpm test:e2e` | Playwright on `$E2E_PORT` (default 3100; slot n of the queue adds n - 1), E2E phase only, queued: 1 slot unless `/tmp/msb-queue/e2e.slots` says more |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / seed the current database |
| `pnpm tsx scripts/worktree.ts integration\|new\|rm\|list` | Integration branch of a run, parallel worktrees (`worktrees` skill) |
| `pnpm tsx scripts/monitor.ts start\|stop\|status\|live` | Monitoring daemon (tunes slots and pool, logs events); `live` shows usage in real time |
| `pnpm tsx scripts/qa-baseline.ts diff\|write` | What changed since the last completed QA run / rewrite `.claude/qa/route-baseline.json` (`qa-orchestrator` only) |

Up to 10 worktrees share this machine at the start of a run; the monitor
raises or lowers that pool and the 4 + 4 slots with the load. `typecheck`, `test`, `test:coverage` and
`test:e2e` wrap themselves in `scripts/queued.sh`: never wrap them again (a
nested call waits for a second slot of the queue it already holds).

## Workflow

The `orchestrator` skill runs the approved specs with up to 10 worktrees, from
a dependency registry versioned on the integration branch: a spec starts as
soon as its own dependencies are merged and a worktree is free (the waves of
`specs/README.md` are a reading aid, never a barrier), and each one goes
through the classic ECC flow below.

1. **Spec.** One feature = one spec `specs/<REF>-<name>.md`, written from the
   dossier. A human approves the specs by merging them into `main` (gate 1).
2. **Plan.** `/plan <spec>`: the `planner` agent turns the spec into tasks,
   files and risks, committed as `.claude/plans/<REF>.plan.md`.
3. **Test-first loop.** `/tdd <spec>` inside the spec's worktree: the
   `tdd-guide` agent takes one acceptance behavior at a time, red then green,
   commits and pushes at every green step, and keeps going without waiting
   for anything until the spec is done. It stays inside `Périmètre`. A
   committed test is never weakened silently: its commit message says why.
4. **Code review.** `/review`: `code-reviewer` plus the specialists; findings
   go back to `tdd-guide` until no CRITICAL or HIGH is left.
5. **Verify.** `/verify` (`pnpm check`, spec conformance) must end READY
   before the PR is opened.
6. **Pull request and merge.** The orchestrator opens the PR against the
   integration branch and squash-merges it once `/verify` is READY and the
   review is clean, and takes over any spec that gets stuck. Other agents never
   merge; nobody but a human merges into `main`.
7. **E2E phase.** Once the features are done, Playwright journeys and fixes,
   with `next-dev-loop` and `agent-browser` on a running dev server.

Priority when rules pull in different directions: **approved spec > tests
written first > readability for the reviewer > minimal code** (`ponytail`).

## Architecture rules

- `lib/dal/**` is the only code that imports `db`; every DAL module starts with
  `import 'server-only'` and checks the session.
- Every Server Action and Route Handler re-checks auth and parses input with
  the shared Zod schema from `lib/schemas/`. Return only what the UI needs.
- Frozen contracts: `lib/db/schema.ts`, `lib/schemas/**`, DAL signatures. A
  change goes through a dedicated contract PR.
- Credits: insert-only ledger, debit before the AI call, refund on failure,
  idempotency key on every movement. `debit()` returns
  `{ ok: false, reason: 'insufficient_balance' }`; it never throws for that.
- Cache: `'use cache'` + explicit `cacheLife` + `cacheTag`, invalidated with
  `updateTag()` in the action that writes. User-specific data is never cached;
  it streams under `<Suspense>`.
- Server Actions live in `<domain>/_actions.ts`, next to `<domain>/_components/`
  (e.g. `[app]/checkout/_actions.ts`); never a shared actions file, so parallel
  agents never write the same file. Each spec ships its `messages/*/<zone>.json`
  in French and English.
- `'use client'` only on interactive leaves. No barrel files. Alias `@/*`.
- AI calls only through `lib/ai/*`; `AI_MODE=mock` in dev, tests and
  previews.

## Git

- Each orchestration run has its own integration branch, named by the
  orchestrator and created from `main` with `pnpm tsx scripts/worktree.ts
  integration <branch>`; `git config msb.integration` gives its name. Feature
  branches start from it and their PRs target it. `main` is production: a
  human reviews the integration branch and merges it into `main` once every
  spec of the run is merged; the orchestrator merges the spec PRs into the
  integration branch as they pass.
- Commit messages and PR titles and bodies in English.
- Branches `feat/<slug>`, one worktree each. Conventional PR titles:
  `feat(<scope>): …` with scopes `bo`, `app`, `credits`, `ai`, `db`, `auth`,
  `tooling`. The PR title becomes the squash commit on the integration branch.
- Merge the integration branch into a feature branch to update it; never rebase or force-push a
  pushed branch.
- Never bypass hooks (`--no-verify`) and never edit lint, format, TypeScript or
  test configuration to make a check pass.

## Agents, skills and commands

| | Name | Use it to |
|---|---|---|
| Agent | `planner` | Plan one approved spec: tasks, files, risks |
| Agent | `tdd-guide` | Implement a spec, test-first, commit at every green step |
| Agent | `code-reviewer`, `nextjs-reviewer`, `database-reviewer`, `security-reviewer`, `silent-failure-hunter` | Review a diff |
| Agent | `e2e-runner` | Write and run Playwright journeys |
| Skill | `orchestrator` | Run every approved spec to a PR, 10 worktrees in parallel |
| Skill | `tdd-workflow`, `verification-loop`, `worktrees`, `ponytail`, `ponytail-review` | Loaded on demand |
| Skill | `qa` | Run a local QA pass on the dev server (full platform, or one scenario of `.claude/skills/qa/scenarios/`); findings go to `.claude/qa/reports/` as BUG or MANQUE |
| Skill | `qa-orchestrator` | Run QA passes until no finding is left: the human validates the findings, each one becomes a fix spec in `specs/qa/`, fixed in worktrees with the `orchestrator` flow on the run's own integration branch |
| Command | `/plan`, `/tdd`, `/verify`, `/review` | The workflow above |
