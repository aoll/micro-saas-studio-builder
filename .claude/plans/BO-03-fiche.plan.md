# Plan: BO-03 · Fiche produit

**Source spec**: specs/BO-03-fiche.md
**Complexity**: Medium (`getFunnel` becomes real SQL reusing BO-02's query and mapping; one admin page from a pure
view model, small server components and one Recharts client leaf; no schema, Zod, DAL-signature or message change)

## Summary

`getFunnel(productId, range)` returns, over BO-02's UTC calendar-day range: `metrics` (the portfolio SQL and
`toProductMetrics`, filtered to one product), `steps` (the 5 funnel event counts with pass rates, BO-02's `buildSteps`)
and `daily` (one zero-filled point per UTC day). `/admin/products/[slug]` renders a static shell and streams under
`<Suspense>`: header (name, status, suggested badge, link to `/{slug}`, link to edit, BO-06 slot), 4 KPIs (revenu,
ARPU, coût IA, marge / génération), the 5-step funnel, a 30-day Recharts curve and a decision panel (thresholds,
current values, suggested status), with « no data » and « killed » states.

## Orchestrator decisions (binding)

1. `recharts` is authorized: `pnpm add recharts` in its own `chore(bo)` commit (`package.json` + `pnpm-lock.yaml`),
   as CONTRACT-ui deferred it here.
2. `lib/dal/metrics.test.ts` is in scope (colocated test); the two stub-dependent `getFunnel` tests are replaced in
   an explained commit (Task 0). The admin-check test stays.
3. Killed product: hide the suggestion and the header `DecisionBadge`, show a « Produit fermé » banner; data and the
   sub-app link stay.
4. Mockup extras left out: the « Visites » KPI card, KPI deltas, the « Vue d'ensemble / Activité » tabs.
5. `instant()` portfolio → fiche (name and status in the static shell) is relayed to E2E-demo by the orchestrator;
   one Suspense boundary here.
6. BO-06 hand-off: BO-03 creates `_components/status/status-change.tsx` with the props of design decision 8 and a
   body returning `null` with a comment naming BO-06; mounted in the header and the decision panel.
7. Follow-ups after merge are the orchestrator's: portfolio-table `as Route` cast, `e2e/portfolio.spec.ts:50`
   schema-valid configs, optional `[slug]/loading.tsx`.

## Frozen inputs (read, never changed)

`lib/dal/metrics.ts` types (`:18-53`), `getFunnel` signature (`:300`), `getPortfolioMetrics` signature (`:225`);
`contract.test.ts:138-148`, `contract-shape.test.ts:189-203` pass unchanged; `getThresholds` `lib/dal/thresholds.ts:32-55`;
`evaluate` `lib/decision.ts:6-26`; `getProduct` `lib/dal/products.ts:50-61`; `require-admin-coverage.test.ts:17-39`.

## Patterns to Mirror

| Category | Source |
|---|---|
| Admin first, then range | `lib/dal/metrics.ts:225-230` |
| Aggregation without fan-out | `lib/dal/metrics.ts:232-283` |
| Row → metrics | `lib/dal/metrics.ts:188-213` |
| Funnel steps | `lib/dal/metrics.ts:72,98-115` (`FUNNEL_STEP_TYPES`, `buildSteps`) |
| Page shell + guarded child | `admin/products/[slug]/edit/page.tsx:24-52` |
| Data child | `admin/page.tsx:15-25` |
| `evaluate` call | `admin/_components/portfolio/rows.ts:30-40` |
| French formatting | `admin/_components/portfolio/format.ts:5-29` (read-only reuse) |
| Badges / cards / empty / skeleton | `status-badge.tsx`, `decision-badge.tsx`, `kpi-card.tsx`, `empty-state.tsx`, `portfolio-skeleton.tsx` |
| DB tests | `lib/dal/metrics.test.ts:42-106,590-635` (`buildValidConfig`, `createTempProduct`, cleanup) |
| Component tests | `admin/_components/portfolio/portfolio-view.test.tsx:1-9` |
| E2E | `e2e/portfolio.spec.ts:18-27,101-108,177-179` (not `:50`: schema-invalid config) |

## Design decisions

1. **`getFunnel` body**: `requireAdmin()` → `validateRangeDays` → `z.uuid()` on `productId` (non-uuid or no row →
   `Error("getFunnel: unknown product <id>")`). `metrics` from a private `selectProductRows(since, productId?)`
   extracted from the portfolio SQL (`getPortfolioMetrics` calls it with no id). `steps` = `buildSteps(metrics)`.
   `daily`: own SQL in `Promise.all`, `generate_series(0, days-1)` + `since::date`, buckets
   `(created_at at time zone 'UTC')::date`, `to_char(day,'YYYY-MM-DD')`, fields visits/signups/purchases (events),
   revenueCents (purchases), aiCostMicros (generations, all statuses); daily sums equal `metrics`. Remove the stub
   `FIXTURE`, `buildProductMetrics`, `buildDaily` if unused (grep + knip); update the header comment. Uncached.
2. **Page**: inner async `ProductSheet({ params })`: `requireAdmin()` → `params` → `getProduct(slug)` → `notFound()` →
   `Promise.all([getFunnel(id, { days: 30 }), getThresholds(id)])` → `toProductSheet` → `<ProductSheetView>`. Header
   status/name from the uncached `funnel.metrics`.
3. **View model** `_components/sheet.ts` `toProductSheet(funnel, thresholds)`: ARPU = revenueCents / signups (« — »
   at 0); margin « — » when null; KPIs « Revenu · 30 j », « ARPU », « Coût IA · 30 j », « Marge / génération »; funnel
   rows « Visites landing », « 1re génération », « Inscription », « Crédits épuisés », « Achat » with count and
   « taux de passage » (step 1 « — »); bar width = count / visits × 100 clamped [0,100]; trend points `dd/MM` sliced
   from the ISO string; `hasData`.
4. **Decision copy** `_components/decision-copy.ts`: threshold lines, current values, suggestion per `evaluate`
   (kill « Seuil de décision atteint » / « Statut suggéré : Killed (à couper) » with actual values; scale; below
   volume « Pas assez de visites pour décider (X / N) »; otherwise « Pas de suggestion : on continue d'observer »;
   killed: none).
5. **States**: no data → KPIs stay, funnel and chart replaced by one `EmptyState` + sub-app link, decision panel
   stays; killed → banner « Produit fermé (Killed) : /{slug} affiche la page introuvable aux visiteurs (SA-08). »;
   unknown slug → `notFound()`.
6. **Links**: « Voir /{slug} ↗ » plain `<a target="_blank" rel="noopener noreferrer">`; « Modifier la config » →
   `/admin/products/{slug}/edit` (typed).
7. **Recharts**: only `_components/trend-chart.tsx` is `'use client'`; `LineChart` with « Visites » and « Achats »,
   HTML legend, installed responsive API; stub `ResizeObserver` in tests if needed.
8. **BO-06 slot** `_components/status/status-change.tsx`: `StatusChange(props: { productId: string; slug: string;
   name: string; status: ProductStatus; decision: Decision; justification: { visits: string; conversion: string;
   margin: string } })` returns `null` for now.
9. No `messages/*`.

## Files to Change

| File | Action |
|---|---|
| `lib/dal/metrics.ts` + `metrics.test.ts` | UPDATE |
| `app/(backoffice)/admin/products/[slug]/page.tsx` | CREATE |
| `…/[slug]/_components/{sheet,decision-copy}.ts` + tests | CREATE |
| `…/[slug]/_components/{sheet-header,sheet-kpis,funnel-card,trend-chart,decision-panel,product-sheet-view}.tsx` + tests | CREATE |
| `…/[slug]/_components/product-sheet-skeleton.tsx` | CREATE |
| `…/[slug]/_components/status/status-change.tsx` | CREATE (BO-06 slot) |
| `e2e/product.spec.ts` | CREATE (not run) |
| `package.json`, `pnpm-lock.yaml` | `pnpm add recharts` (decision 1) |

## Tasks

Red → green, `pnpm vitest run <file>`, commit + push, `pnpm exec knip` after each green (`feat(db)` DAL, `feat(bo)` UI).

0. Replace the stub `getFunnel` tests (`metrics.test.ts:553-581`) in an explained commit; keep the admin test.
1. Guards: admin before range; `RangeError` on {0, 1.5, 400}; unknown uuid and non-uuid → « unknown product ».
2. `metrics` equals the portfolio row for the same product (extract `selectProductRows`; BO-02 tests stay green).
3. Steps: 12/5/4/2/1 → counts and rates, step 1 null; idle → zeros and nulls; 0 first generations → signup rate null.
4. Daily: 30 points ascending ending today UTC, zero-filled; day boundaries at ±1 min; sums equal `metrics`; other
   products excluded.
5. Killed product: status killed, data returned.
6. Remove the stub parts; contract tests unchanged and green; `metrics.ts` ≥ 80 % branches.
7. KPIs (ARPU 2470 / 4 → « 6,18 € », 0 → « — »; margin null → « — »).
8. Funnel rows (labels, fr-FR counts, rates, clamped widths).
9. Trend points and `hasData`.
10. Decision copy (all cases, both margin-rule variants, killed).
11. `SheetHeader`. 12. `SheetKpis`. 13. `FunnelCard`. 14. `TrendChart` (+ `recharts` commit). 15. `DecisionPanel`.
16. `ProductSheetView` (no data, killed). 17. `page.tsx` + skeleton (coverage test, build).
18. `e2e/product.spec.ts` (written, not run; schema-valid configs).
19. Full checks: knip, typecheck, lint, format:check, test:coverage (80 %+ on `lib/**`), build, check.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stub-dependent `getFunnel` tests | Certain | Task 0, explained commit |
| Shared test DB | High | `buildValidConfig`, own ids, `where p.id =` |
| `admin/loading.tsx` shows the portfolio skeleton | Medium | Own Suspense fallback |
| Recharts in jsdom | Medium | HTML legend, `ResizeObserver` stub |
| `timestamptz → date` time zone | Low | `at time zone 'UTC'` |
| Pass rates > 100 % | Low | Width clamped in the view model |

## Acceptance

- [ ] Bullet 1 (funnel 5 steps, volumes, rates): Tasks 3, 8, 13, 18
- [ ] Bullet 2 (KPIs, 30-day Recharts curves): Tasks 2, 4, 7, 9, 12, 14, 18
- [ ] Bullet 3 (status, thresholds, suggestion, `/{slug}` link): Tasks 10, 11, 15, 18
- [ ] Bullet 4 (no data, killed): Tasks 3, 5, 9, 16, 18
- [ ] `getFunnel` signature untouched; contract tests green; `pnpm check`, `pnpm build` green; PR title `feat(bo): BO-03 product sheet with real funnel, KPIs and decision panel`
