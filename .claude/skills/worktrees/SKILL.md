---
name: worktrees
description: >
  How to run several agents in parallel safely: one git worktree per spec, its
  own database, disjoint write scopes, machine-wide queues for
  heavy checks. Use before creating or removing a worktree, before dispatching
  parallel agents, and when a worktree's database looks wrong.
---

# Parallel work with worktrees

Up to ten agents implement specs at the same time (`orchestrator` skill). Each one gets an isolated
checkout so that their branches, dev servers and databases never collide.

## Model

| Resource  | Main checkout | Each worktree `../micro-saas-studio-builder-<slug>` |
|-----------|---------------|------------------------------------------------------|
| Branch    | `main`; the run's integration branch lives on origin | `feat/<slug>` from the integration branch (pushed with upstream set at creation) |
| Dev server | port 3000     | none: typecheck and Vitest need no server; Playwright starts its own |
| Database  | `msb`         | `msb_feat_<slug>`, migrated and seeded                |
| Postgres  | one local cluster (native, or the Docker service), shared by all |           |
| Queues    | `scripts/queued.sh` slots are shared by every checkout |                     |

## Lifecycle

```bash
# once per orchestration run: create the integration branch from origin/main
pnpm tsx scripts/worktree.ts integration integration/<run>

# create: branch from the integration branch + push -u, .env.local, pnpm install, database (migrate + seed)
pnpm tsx scripts/worktree.ts new <slug>

# work inside it: Vitest and typecheck in the loop (E2E come in a later phase)
cd ../micro-saas-studio-builder-<slug>

# inspect
pnpm tsx scripts/worktree.ts list
pnpm tsx scripts/worktree-db.ts list

# remove after the squash merge: drops its database, removes the worktree and the merged branch
pnpm tsx scripts/worktree.ts rm <slug>

# clean databases whose branch no longer exists (dry run without --yes)
pnpm tsx scripts/worktree-db.ts prune --yes
```

`worktree.ts new` refuses to go beyond the pool size: `WORKTREE_MAX` (default 10),
or the value `scripts/monitor.ts` tuned to the machine's load during a run.

## Rules for dispatching agents

1. **One worktree per writing agent.** Never two writers in one checkout.
   Read-only agents (review, architect) can share the main checkout.
2. **Disjoint write scopes.** Before launching a wave, compare the `Périmètre`
   of every spec. Any shared file — `lib/db/schema.ts`, `lib/schemas/**`,
   `messages/*`, `components/ui/**` — is either split per spec or handled by
   the integrator after the merges.
3. **Frozen contracts.** A change to the schema, a Zod schema or a DAL
   signature goes through a dedicated contract PR, merged first; the other
   branches then merge the integration branch.
4. **Merge order.** The branch that replaces a stub with the real
   implementation merges first; the others merge the integration branch into their branch
   (never rebase a pushed branch) and re-run the checks.
5. **Heavy commands are queued by their own scripts.** `package.json` wraps
   them in `scripts/queued.sh`, so every checkout shares the same slots:

   | Script | Queue | Slots (default) |
   |--------|-------|-----------------|
   | `pnpm test`, `pnpm test:coverage` | `test` | `QUEUE_SLOTS_TEST=4` |
   | `pnpm typecheck` | `typecheck` | `QUEUE_SLOTS_TYPECHECK=4` |
   | `pnpm test:e2e` | `e2e` | `QUEUE_SLOTS_E2E=1` |

   During an orchestration run, `scripts/monitor.ts` raises or lowers the
   `test` and `typecheck` slots with the machine's load (`<queue>.slots` in
   the queue directory); `pnpm tsx scripts/monitor.ts status` shows them.

   Never wrap these scripts in `scripts/queued.sh` again: the nested call
   would wait for a second slot of the queue it already holds. A single test
   file (`pnpm vitest run lib/dal/credits.test.ts`) runs directly.
6. **E2E on a fixed port.** `playwright.config.ts` builds and starts the app
   on `$E2E_PORT` (default 3100) with `reuseExistingServer: false` and `BETTER_AUTH_URL` set to
   that port. The `e2e` queue has one slot, so two worktrees never share it.

## Troubleshooting

- **Postgres down**: the SessionStart hook starts it (native cluster first,
  then Docker) and raises a native cluster's `max_connections` to 300;
  otherwise `pg_ctlcluster <version> main start` or
  `docker compose up -d postgres`.
- **`DATABASE_URL` missing or pointing at `msb` in a worktree**:
  `pnpm tsx scripts/worktree-db.ts ensure --seed`.
- **Need to see the UI**: use the PR's Vercel preview, or run the branch in the
  main checkout. A dev server in a worktree (`pnpm dev -- -p 3005`) works for
  pages, not for magic links (`BETTER_AUTH_URL` stays on 3000).
- **Branch tracks the integration branch**: the worktree was created by hand; run
  `git push -u origin feat/<slug>`.
