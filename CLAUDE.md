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
| `pnpm test` / `pnpm test:e2e` | Vitest / Playwright |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / seed the current database |
| `scripts/queued.sh <test\|typecheck\|e2e> <cmd>` | Run a heavy command in a machine-wide slot |
| `pnpm tsx scripts/worktree.ts new\|rm\|list` | Parallel worktrees (see the `worktrees` skill) |

Full test, typecheck and E2E runs always go through `scripts/queued.sh`: several
agents share this machine.

## Workflow

1. **Spec.** One feature = one spec `specs/<REF>-<name>.md` = one PR. `/plan`
   drafts it (planner, then architect review). A human approves and merges it.
2. **Tests first.** The implementing agent pushes failing tests for every
   acceptance bullet as a draft PR. Red CI is expected.
3. **Implement to green.** `/tdd <spec>` inside the spec's worktree. Stay inside
   `Périmètre`. Tests from the first push are the contract: changing one must
   be explained in the PR.
4. **Verify.** `/verify` must end READY before the PR is marked ready.
5. **Review and merge.** `/review` for a first pass; a human reviews and
   squash-merges. Agents never merge.

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
- `'use client'` only on interactive leaves. No barrel files. Alias `@/*`.
- AI calls only through `lib/ai/*`; `AI_MODE=mock` in dev, tests, CI and
  previews.

## Git

- Branches `feat/<slug>`, one worktree each. Conventional PR titles:
  `feat(<scope>): …` with scopes `bo`, `app`, `credits`, `ai`, `db`, `auth`,
  `tooling`. The PR title becomes the squash commit on `main`.
- Merge `main` into a feature branch to update it; never rebase or force-push a
  pushed branch.
- Never bypass hooks (`--no-verify`) and never edit lint, format, TypeScript or
  test configuration to make a check pass.

## Agents, skills and commands

| | Name | Use it to |
|---|---|---|
| Agent | `planner` | Turn a need or a dossier section into minimal specs |
| Agent | `architect` | Review the dossier, a spec, a blueprint or a plan before code |
| Agent | `code-architect` | Blueprint a non-trivial spec before implementing it |
| Agent | `tdd-writer` | Implement a spec, tests first |
| Agent | `code-reviewer`, `nextjs-reviewer`, `database-reviewer`, `security-reviewer`, `silent-failure-hunter` | Review a diff |
| Agent | `e2e-runner` | Write and run Playwright journeys |
| Skill | `tdd-workflow`, `verification-loop`, `worktrees`, `ponytail`, `ponytail-review` | Loaded on demand |
| Command | `/plan`, `/tdd`, `/verify`, `/review` | The workflow above |
