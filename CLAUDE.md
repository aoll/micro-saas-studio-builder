# micro-saas-studio-builder

A Next.js back-office that launches AI micro-SaaS products from a form and runs
each one on data (funnel, AI cost, margin, status Test → Learn → Scale → Killed).
Every product is an AI tool with credits, served at `/{slug}`.

The design dossier lives in `docs/` (French). It is the source of truth for
screens, data model, contracts and decisions: read the relevant section before
changing anything. Next.js 16.3 documentation for the installed version is
referenced from `AGENTS.md` (managed by `next dev`): trust it over memory.

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Dev server on port 3000, main checkout only |
| `pnpm check` | typecheck + lint + format check + knip + unit tests |
| `pnpm typecheck` | Full typecheck, queued: 4 slots per machine |
| `pnpm test` / `pnpm test:coverage` | Full Vitest suite / with coverage, queued: 4 slots per machine |
| `pnpm vitest run <file>` | One test file, direct: the TDD loop |
| `pnpm test:e2e` | Playwright on `$E2E_PORT` (default 3100), E2E phase only, queued: 1 slot |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / seed the current database |
| `pnpm tsx scripts/worktree.ts new\|rm\|list` | Parallel worktrees (see the `worktrees` skill) |

Up to 10 worktrees share this machine. `typecheck`, `test`, `test:coverage` and
`test:e2e` wrap themselves in `scripts/queued.sh`: never wrap them again (a
nested call waits for a second slot of the queue it already holds).

## Workflow

The `orchestrator` skill runs the approved specs with up to 10 worktrees: a
spec starts as soon as its dependencies are merged and a worktree is free, and
each one goes through the classic ECC flow below.

1. **Spec.** One feature = one spec `specs/<REF>-<name>.md` = one PR, written
   from the dossier and reviewed by `architect`. A human approves and merges it.
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
6. **Pull request.** A human reviews and squash-merges. Agents never merge.
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

- `$INTEGRATION_BRANCH` (default `orchestration`) is the integration branch.
  The orchestrator creates it from `main` at the start of a run; feature
  branches start from it and their PRs target it. `main` is production: a
  human merges the integration branch into it at each validated milestone.
- Commit messages and PR titles and bodies in English.
- Branches `feat/<slug>`, one worktree each. Conventional PR titles:
  `feat(<scope>): …` with scopes `bo`, `app`, `credits`, `ai`, `db`, `auth`,
  `tooling`. The PR title becomes the squash commit on the integration branch.
- Merge `origin/$INTEGRATION_BRANCH` into a feature branch to update it; never rebase or force-push a
  pushed branch.
- Never bypass hooks (`--no-verify`) and never edit lint, format, TypeScript or
  test configuration to make a check pass.

## Agents, skills and commands

| | Name | Use it to |
|---|---|---|
| Agent | `planner` | Plan one approved spec: tasks, files, risks |
| Agent | `architect` | Review the dossier, a spec or a plan before code |
| Agent | `tdd-guide` | Implement a spec, test-first, commit at every green step |
| Agent | `code-reviewer`, `nextjs-reviewer`, `database-reviewer`, `security-reviewer`, `silent-failure-hunter` | Review a diff |
| Agent | `e2e-runner` | Write and run Playwright journeys |
| Skill | `orchestrator` | Run every approved spec to a PR, 10 worktrees in parallel |
| Skill | `tdd-workflow`, `verification-loop`, `worktrees`, `ponytail`, `ponytail-review` | Loaded on demand |
| Command | `/plan`, `/tdd`, `/verify`, `/review` | The workflow above |
