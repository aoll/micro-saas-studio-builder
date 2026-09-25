# Plan: DEMO-mode · Démo publique

**Source spec**: specs/DEMO-mode.md
**Complexity**: High. The spec covers real guards, a full deterministic seed that tells the story, a destructive reset tested on an isolated database, and an owner-only `/admin/ops`.

## Summary

- **Guards.** `assertEditable` and `isEditable` read `env.DEMO_MODE`. A seeded row is locked in demo mode. Every write DAL and every BO page already calls them, so this change alone locks the whole app.
- **Seed.** 3 locked products tell the scale / hesitate / kill story over 30 days of usage. The BioInsta config is a fixture only.
- **Reset.** `scripts/reset-demo.ts` deletes everything that is not seed, restores the canonical seed catalogue and replays the usage.
- **Ops page.** `/admin/ops` is owner-only (404 for anyone else). It has a two-step « Réinitialiser » button.

## Orchestrator decisions (binding)

1. **Colocated tests are in scope:**
   - `lib/dal/guards.test.ts`;
   - `fixtures/fixtures.test.ts`;
   - `scripts/seed.test.ts` and `scripts/reset-demo.test.ts`;
   - `admin/ops/**` tests.
2. **Blocked items, waiting for the human. Do NOT implement them until the orchestrator relays the answer:**
   - the 10-visitor-product limit, planner Phase 6 (it needs `lib/dal/product-editor.ts`, `admin/products/_actions.ts` and their tests);
   - disabling the BO-06 « Changer de statut » trigger on seeded products (it needs `admin/products/[slug]/**`);
   - mock fixtures for the new slugs in `lib/ai/model.ts`;
   - the credential variables in `.env.example`.

   Implement everything else now: planner phases 1–5 and 7.
3. **Guards.**
   - `isEditable = (row) => !(env.DEMO_MODE && row.isSeed)`, with env read inside the function.
   - `assertEditable` throws `new Error("demo_locked: …")`. No exported error class.
   - The frozen signatures and the contract tests stay unchanged.
   - Making the existing stub tests explicit (env mocked) is its own commit, and the message explains why.
4. **Seed.**
   - Static JSON imports. `loadEnvConfig` moves into the CLI `isEntry()` block.
   - `seed({ sql?, now? })` and an exported `applySeed(tx, now)`.
   - A pure, deterministic usage generator, `buildSeedUsage` (seeded PRNG per slug).
   - Usage is replaced in one transaction. Only seed-owned rows are deleted: `@seed.msb.local` users, `seed-` anonymous ids, `metadata.seed`, and `seed:` idempotency keys.
   - Target story, where the tests assert rules and not exact counts:
     - every product: at least 1000 visits in the last 30 UTC days;
     - LettrePro: `scale`, rate ≥ 5 %, margin > 0;
     - NomDeMarque: `kill`, rate < 2 %;
     - DescriPro: no badge, rate between 2 % and 5 %.
   - These rules are checked through the real `getPortfolioMetrics` and `evaluate`.
   - Timestamps fall between `startOfUtcDay(now − 28 d)` and `now − 10 min`.
   - NomDeMarque's output is a markdown list, because the frozen schema has no structured output. Note it in the PR.
5. **Credentials.** The seed reads `SEED_ADMIN_*` and `SEED_OWNER_*` from `process.env`, falling back to the dev constants. With `DEMO_MODE=true` and the dev constants, it refuses to seed.
6. **Reset.**
   - `resetDemo({ sql?, now? })` runs in one transaction with `pg_advisory_xact_lock(hashtext('reset-demo'))`. It deletes in foreign-key order, restores the seeded catalogue, then calls `applySeed`.
   - Its tests run ONLY on an isolated temporary database (created, migrated and seeded, then dropped). Never run a reset against the shared worktree DB.
   - Before writing `admin/ops`, spike the build: can a Server Action import `scripts/reset-demo.ts`? If not, report it as a blocker and do not move files outside the Périmètre.
7. **`/admin/ops`.**
   - `page.tsx` calls `getSession()`, then `notFound()` unless `isOwner`, then `await requireAdmin()`. The last call keeps the coverage test green.
   - `_actions.ts` `resetDemoAction`:
     - `requireAdmin()`, then an owner re-check;
     - then `resetDemo()`;
     - then `updateTag` for `products`, `thresholds`, every removed and seeded `product:<slug>`, and every seeded `theme:<id>`;
     - on failure: `unstable_rethrow`, then log, then return `{ error }`.
   - A `'use client'` two-step confirm form with a toast. `maxDuration = 60`. No navigation link.
   - The action importing `scripts/reset-demo.ts` (its own postgres client) is an accepted exception, because the spec requires it. Flag it in the PR.
8. **E2E.** `e2e/demo-mode.spec.ts` is written, not run. It has a serial demo block (skipped unless `DEMO_MODE=true`) and a read-only default block. It must be run alone.
9. **No wait loops.** Never write `until`/`while pgrep -f` wait loops. Run everything in the foreground.

## Tasks (red → green, commit + push each)

1–3. Guards: unit tests, then an integration test against the real write DALs on throwaway seeded rows (with a session mock). Planner steps 1–3.
4. Fixtures:
   - add `descri-pro`, `nom-de-marque` and `bio-instagram` configs, plus `descri-pro.json` and `nom-de-marque.json`;
   - add `systemPrompt` to the LettrePro config;
   - write `fixtures.test.ts`.
5. Seed the 3 locked products, idempotently.
6. `buildSeedUsage`: deterministic and pure, with its rules tested.
7. The seed writes the usage and only replaces seed-owned rows. The story is asserted through the real metrics.
8. Credentials from env, with the demo-mode refusal.
9. `resetDemo` on an isolated database.
10. Build spike.
11–14. `/admin/ops`: owner check, page, action, form.
16. `e2e/demo-mode.spec.ts`.
Final: `pnpm check`, `pnpm test:coverage`, `flock /tmp/msb-queue/build.lock pnpm build`. Run `pnpm db:seed` twice by hand.

## Acceptance

- [ ] Full seed and story: tasks 4–8
- [ ] Locked in demo mode, buttons disabled through `isEditable`: tasks 1–3 (BO-06 trigger pending the human)
- [ ] 10 visitor products at most: pending the human
- [ ] `/admin/ops` owner-only, with the reset: tasks 9–14
- [ ] `DEMO_MODE=false` makes everything editable: tasks 1–3
- [ ] Contract tests unchanged and green; `pnpm check` and build green
- [ ] PR title `feat(bo): DEMO-mode seeded story, demo locks and owner reset`

## Human decision, round 2 (2026-09-25, binding, overrides the above)

- **No demo lock on seeded rows.** The human resets the demo before presenting, so locking the seeded products has no value.
  - `assertEditable` and `isEditable` stay the V1 no-op stubs (frozen signatures unchanged).
  - Planner steps 1–3 are dropped.
  - The acceptance bullet « DEMO_MODE=true : … non modifiables » is waived by the human.
  - Item (b), disabling the BO-06 trigger, is moot.
- **`.env.example`** is in the Périmètre: document the `SEED_ADMIN_*` and `SEED_OWNER_*` variables there. The seed still refuses to run with the dev credentials when `DEMO_MODE=true`.
- **Still pending with the human:**
  - (a) the limit of 10 visitor products;
  - (c) the `lib/ai/model.ts` mock fixtures.

## Human decision, round 3 (2026-09-25, binding)

- (a) There is no limit on visitor products. The human waived that acceptance bullet, so no file outside the Périmètre is touched for it.
- (c) The Périmètre is extended to `lib/ai/model.ts` and its test. It registers mock fixtures for `descri-pro`, `nom-de-marque` and `bio-instagram`, so that each product streams its own mock content.
