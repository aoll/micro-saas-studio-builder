# Plan: BO-02 · Portefeuille

**Source spec**: specs/BO-02-portefeuille.md
**Complexity**: Medium (one real SQL aggregation replacing a V1 stub, one pure decision function, one page with a client
sortable table, one e2e file; no schema, Zod, DAL-signature or message change)

## Summary

`getPortfolioMetrics(range)` in `lib/dal/metrics.ts` becomes a real, uncached SQL aggregation per product over `events`
(funnel counts), `purchases` (revenue, buyers) and `generations` (AI cost, generations), over the last `range.days` UTC
calendar days. `lib/decision.ts` (new) exports the pure `evaluate(metrics, thresholds) → "kill" | "scale" | null`.
`/admin` renders a static shell (title, "Nouveau produit") and streams the 4 KPI cards and a sortable table under
`<Suspense>` with a skeleton; empty state when there is no product. `getFunnel` and its V1 stub stay as they are (BO-03).

## Orchestrator decisions (binding)

1. `lib/dal/metrics.test.ts` is in scope (colocated test of a Périmètre file); the stub test is replaced in its own
   explained commit (Task 0).
2. Margin per generation: price per credit from actual purchases in range × `costPerGeneration` − AI cost per succeeded
   generation; `null` when no credits sold, no generation or no `costPerGeneration`.
3. Signup → purchase conversion = distinct buyers (`purchases`) / signup events; `null` when signups = 0.
4. `evaluate` with visits ≥ min_visits and rate `null` → no badge (literal rule).
5. Bullet 4 against the real seed is not BO-02's: Tasks 8 and 15 prove it on an inserted dataset with the dossier's
   ratios. The orchestrator records on DEMO-mode that its seed must give each product ≥ 1000 visits in 30 UTC days,
   LettrePro ≥ 5 % distinct-buyer conversion and positive margin, NomDeMarque < 2 %, DescriPro in between; E2E-demo
   checks it in the UI. `scripts/seed.ts` is not touched here.
6. Currency: AI cost shown in € at USD = EUR 1:1 (as the frozen `marginMicros` already does), stated in the header
   comment and the PR.
7. Mockup extras not in the spec (search, status filter, « nouveau » badge, KPI deltas, sparklines) are left out.
8. Badges on `killed` products: whatever `evaluate` returns (spec literal).
9. The orchestrator relays the `evaluate` / `Decision` / `DecisionMetrics` signature, the metric definitions and
   `admin/loading.tsx` to BO-03 and BO-09.

## Frozen inputs (read, never changed)

`lib/dal/metrics.ts:16-38` types and `getPortfolioMetrics` signature (body only changes); `:53-133`, `:154-159`
(`FIXTURE`, builders, `getFunnel`) untouched, `metrics.test.ts:54-90` stays green; `lib/dal/thresholds.ts:25-55`
`getThresholds` (cached, tag `thresholds`); `lib/dal/contract.test.ts:131-156`, `contract-shape.test.ts:181-187` pass
unchanged; `lib/db/schema.ts` (`events` 215-230, `purchases` 151-172, `generations` 117-149, `products` 72-96,
`product_versions` 98-115: name, `pricing.costPerGeneration` and packs live in `config` jsonb);
`app/(backoffice)/admin/require-admin-coverage.test.ts:34-39`.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| DAL header | `lib/dal/metrics.ts:1-15` | `import "server-only";`, frozen comment kept, "cached" sentence updated (decision 1 below) |
| Session first | `lib/dal/metrics.ts:136-137` | `await requireAdmin();` before any query |
| Page shell + guarded child | `app/(backoffice)/admin/page.tsx:4-17` | sync default export, inner async with `await requireAdmin()` inside `<Suspense>` |
| Temp product in DB test | `lib/dal/events.test.ts:30-53` | random slug, `cleanup()` children first |
| DAL test mocks | `lib/dal/metrics.test.ts:15-16`, `lib/dal/thresholds.test.ts:6-8` | `vi.mock("./session")`, `vi.mock("next/cache")` |
| Component tests | `components/backoffice/kpi-card.test.tsx:1-7` | jsdom, `afterEach(cleanup)` |
| Shared UI | `kpi-card.tsx`, `status-badge.tsx`, `components/shared/empty-state.tsx`, `components/ui/skeleton.tsx`, `components/ui/card.tsx` | reuse; plain `<table>` |
| Links to routes not merged yet | `components/backoffice/admin-sidebar.tsx:13-14,26` | `as Route` + comment naming the spec |
| E2E DB + admin sign-in | `e2e/admin-auth.spec.ts:45-51,65-95` | own `postgres` client, `SEED_ADMIN`, cleanup in `finally` |
| Seeded thresholds | `scripts/seed.ts:309-318` | 1000 visits, 0.02, 0.05, positive margin |

## Design decisions

1. **No cache on `getPortfolioMetrics`**: it calls `requireAdmin()` (headers), and admin data is never cached; streamed
   under `<Suspense>`. Divergence from docs/04's `metrics:{slug}` noted in the header comment and PR.
2. **Own SQL, not `listProducts()`**: `products` join `product_versions` on `current_version`, `left join` three
   subqueries grouped by `product_id` (no fan-out): events `count(*) filter (where type = …)` × 5; purchases
   `sum(amount_cents)`, `sum(credits)`, `count(distinct user_id)`; generations `count(*) filter (where status =
   'succeeded')`, `coalesce(sum(cost_micros),0)`. Name `coalesce(config->>'name', slug)`; `costPerGeneration`
   `(config->'pricing'->>'costPerGeneration')::int` (nullable). Counts `::int`, sums `::bigint` `.mapWith(Number)`. All
   products, `killed` included, zeros when idle.
3. **Range = UTC calendar days**: `since = startOfUtcDay(now) − (days − 1) days`, computed once, `created_at >= since`
   in the three subqueries. `days` integer 1..365, else `RangeError`.
4. **Metric definitions** (header comment + tests): counts from events; `revenueCents` = Σ `amount_cents`;
   `aiCostMicros` = Σ `cost_micros` all statuses; `generations` = succeeded count; rate and margin per orchestrator
   decisions 2-3; totals Σ visits/revenue/cost, `marginMicros = Σ(revenueCents·10 000 − aiCostMicros)`. Ratios in a
   private `toProductMetrics(row)`.
5. **`evaluate` contract**:
   ```ts
   export type Decision = "kill" | "scale" | null;
   export type DecisionMetrics = { visits: number; signupToPurchaseRate: number | null; marginPerGenerationMicros: number | null };
   export function evaluate(metrics: DecisionMetrics, thresholds: Thresholds): Decision
   ```
   `Thresholds` type-only import. Order: `visits < minVisits` → null; rate null → null; `rate < killMaxConversion` →
   kill; `rate ≥ scaleMinConversion && (!scaleRequiresPositiveMargin || (margin !== null && margin > 0))` → scale;
   else null. Independent of current status.
6. **UI split**: pure `rows.ts` (`toPortfolioRows(metrics, thresholdsById)`: sort keys, decision, gross margin rate,
   display strings formatted on the server via `format.ts`, `Intl` `fr-FR`); pure `sort.ts`; `'use client'` only on
   `portfolio-table.tsx` (sort state, `<button>` headers in `<th aria-sort>`). Columns: statut (test < learn < scale <
   killed), visites, conversion, revenu, coût IA, marge; nulls last; name tie-break; default revenue desc. Null → « — ».
7. **KPIs**: « Visites · 30 j », « Revenu · 30 j », « Coût IA · 30 j », « Marge brute » (% or « — »). No deltas.
8. **Empty state**: `EmptyState` « Aucun produit » + « Créer un produit » → `/admin/products/new`; KPIs stay.
   `portfolio-skeleton.tsx` shared by the Suspense fallback and `loading.tsx`.
9. Backoffice stays French without next-intl: no `messages/*`. BO-01's `AdminEmail` placeholder leaves `page.tsx`.

## Files to Change

| File | Action |
|---|---|
| `lib/decision.ts` + `lib/decision.test.ts` | CREATE |
| `lib/dal/metrics.ts` | UPDATE `getPortfolioMetrics` body + private helpers |
| `lib/dal/metrics.test.ts` | UPDATE (stub test replaced, real-DB tests) |
| `app/(backoffice)/admin/page.tsx` | REWRITE |
| `app/(backoffice)/admin/loading.tsx` | CREATE |
| `app/(backoffice)/admin/_components/portfolio/{format,rows,sort}.ts` + tests | CREATE |
| `…/portfolio/{decision-badge,portfolio-kpis,portfolio-table,portfolio-view,portfolio-skeleton}.tsx` + tests | CREATE |
| `e2e/portfolio.spec.ts` | CREATE (not run) |

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(bo)` UI and `lib/decision.ts`, `feat(db)` DAL, `test(…)`
test-only), `pnpm exec knip` after each green.

- **Task 0 — retire the stub test** (`metrics.test.ts:29-51`): `test(db): replace getPortfolioMetrics stub test — the portfolio now aggregates events, purchases and generations in SQL (specs/BO-02 bullet 5); the fixed LettrePro numbers described the V1 stub only`.
- **Task 1 — volume gate**: defaults {1000, 0.02, 0.05, true}; 999 visits rate 0 → null; 999 rate 0.5 → null; 1000 evaluated.
- **Task 2 — kill**: 0.019 → kill; 0.02 → not kill; 0 → kill; custom `killMaxConversion` respected.
- **Task 3 — scale**: 0.05 margin 1 → scale; 0.07 margin 0 / −5 / null → null; `scaleRequiresPositiveMargin: false`, margin −5 → scale.
- **Task 4 — otherwise null**: 0.03 → null; rate null, 5000 visits → null. 100 % branches on `lib/decision.ts`.
- **Task 5 — SQL counts** (real DB): product P (name, `costPerGeneration: 1`) with 12 visit, 5 first_generation, 4 signup, 2 credits_exhausted, 1 purchase, 3 generation events → counts, name, slug, status; idle Q → zeros, nulls; `{}` config → slug as name, no throw. Assert own ids only; cleanup events, purchases, generations, product_versions, products, users.
- **Task 6 — revenue, cost, conversion, margin, totals**: 2 buyers, 3 purchases (490+490+1490, 70 credits) → 2470; 4 signups → 0.5; 3 succeeded at 4000 µ$, 1 failed null cost, 1 pending → generations 3, cost 12000; margin = round(2470·10 000/70 × 1 − 4000); totals = Σ products.
- **Task 7 — range**: rows at `since ± 1 min`; `days: 1` today only; `{0}`, `{1.5}`, `{400}` → `RangeError`; admin check first.
- **Task 8 — seed story**: fresh "LettrePro" (1200 visits via `generate_series`, 100 signups, 7 buyers, 20 succeeded at 4000 µ$) → scale; "NomDeMarque" (1100, 100, 1) → kill; "DescriPro" (1050, 100, 3) → null; 10-visit product → null; via `getPortfolioMetrics({days:30})` + real `getThresholds` + `evaluate`.
- **Task 9 — `format.ts` + `rows.ts`**: € from cents and micros, %, null → « — »; rows carry decision and margin rate.
- **Task 10 — `sort.ts`**: each column both ways, nulls last, lifecycle status order, name tie-break, default revenue desc, no mutation.
- **Task 11 — `PortfolioTable` + `DecisionBadge`**: 6 sortable headers, `aria-sort` toggles and reorders; « à couper » / « à scaler » next to `StatusBadge`; row links `/admin/products/{slug}`; « Produits (N) ».
- **Task 12 — `PortfolioKpis`**: 4 labels with values; « — » when revenue 0.
- **Task 13 — `PortfolioView` + `PortfolioSkeleton`**: empty → « Aucun produit » + link, no table; skeleton blocks.
- **Task 14 — `page.tsx` + `loading.tsx`**: sync shell; inner async: `requireAdmin` → `getPortfolioMetrics({days:30})` → `Promise.all(getThresholds)` → `toPortfolioRows` → `PortfolioView`. `require-admin-coverage.test.ts` and `pnpm build` green.
- **Task 15 — `e2e/portfolio.spec.ts`** (written, not run): admin sign-in, Task 8 story on seeded `lettre-pro` + fresh products, KPIs, badges, conversion, « Visites » sort, unauthenticated redirect, cleanup.
- **Task 16 — full checks**: knip, typecheck, lint, format:check, test:coverage (80 %+ on `lib/**`), build, check.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bullet 4 « avec le seed »: seed has only LettrePro, no events | Certain | Orchestrator decision 5 |
| LEDGER / SA-02 not merged | Certain | Direct inserts against the frozen schema |
| Concurrent test files on the same DB | High | Fresh products, own-id assertions, `coalesce`, no `listProducts` |
| `admin/loading.tsx` wraps nested admin routes | Medium | Generic skeleton; relayed |
| EUR cents vs USD micros | Medium | Orchestrator decision 6 |
| Near UTC midnight | Low | `since` from one formula, rows at ±1 min |
| Links before BO-05a / BO-03 | Certain | `as Route` + comment |
| `Intl` hydration mismatch | Low | Strings formatted on the server |

## Acceptance

- [ ] Bullet 1: Tasks 12, 15
- [ ] Bullet 2: Tasks 10, 11, 15
- [ ] Bullet 3: Tasks 1-4 (no DB import in `lib/decision.test.ts`)
- [ ] Bullet 4: Tasks 8, 15 (real seed: DEMO-mode, decision 5)
- [ ] Bullet 5: Tasks 5-7
- [ ] Bullet 6: Tasks 13, 14
- [ ] Contract tests, `getFunnel` tests, `require-admin-coverage.test.ts` unchanged and green
- [ ] `pnpm check`, coverage 80 %+, `pnpm build` green; PR title `feat(bo): BO-02 portfolio with SQL metrics and kill/scale badges`
