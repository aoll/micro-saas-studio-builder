# Plan: BO-09 · Réglages des seuils

**Source spec**: specs/BO-09-seuils.md
**Complexity**: Medium (three additive DAL functions, one Server Action file, one page with a client form and a live
preview, one e2e file; no schema, `lib/schemas`, frozen signature or message change)

## Summary

`/admin/settings` shows the studio defaults in one form and a per-product override in a second form (product picked
from a list). Rates are entered in %. Each form previews which BO-02 badges would change before saving, from the real
30-day `getPortfolioMetrics` and the pure `evaluate()`, on the client. Two Server Actions, `saveThresholdSettings` and
`resetProductThresholds`, re-check the admin, parse with the frozen `thresholdsInputSchema`, write through additive
DAL functions, then `updateTag("thresholds")`, so `getThresholds` readers (BO-02 now, BO-03 next) follow on the next
request. Writes call `assertEditable`; the page calls `isEditable` (DEMO-mode stubs).

## Orchestrator decisions (binding)

1. The admin read `getThresholdSettings()` in `lib/dal/thresholds.ts` is allowed (additive, admin-gated), next to the
   two writes.
2. `productId` is validated with a local `z.uuid().nullable()` in the action; values use the shared
   `thresholdsInputSchema`. No contract PR.
3. Override storage: diff against the default, conversions stored as a pair (design decision 2).
4. The DEMO-mode end-to-end lock check is recorded on DEMO-mode by the orchestrator.
5. The sidebar `/admin/settings` cast is removed by the orchestrator's follow-up after merge.
6. PG error codes: drizzle wraps them on `err.cause` (`lib/db/schema.test.ts:24-31`); map `err.cause?.code ?? err.code`.

## Frozen inputs (read, never changed)

`Thresholds`, `getThresholds` `lib/dal/thresholds.ts:25-55` (pinned by `contract.test.ts:151-157`,
`contract-shape.test.ts:206-216`); `thresholdsInputSchema` `lib/schemas/inputs.ts:71-82`; `decision_thresholds`
`lib/db/schema.ts:235-273` (per-row `kill_lt_scale` CHECK, `unique(product_id) NULLS NOT DISTINCT`, `numeric(5,4)`,
`updated_by` FK); `evaluate` `lib/decision.ts:6-26`; `toProductMetrics`, `getPortfolioMetrics` `lib/dal/metrics.ts`;
`assertEditable` / `isEditable` `lib/dal/guards.ts:8-13`; `requireAdmin`; seeded default `scripts/seed.ts:309-318`.

## Patterns to Mirror

| Category | Source |
|---|---|
| DAL write with lock + `assertEditable` | `lib/dal/product-editor.ts:48-77` |
| Merge default + override | `lib/dal/thresholds.ts:37-54` |
| DAL test mocks | `lib/dal/thresholds.test.ts:6-13` (+ `./session`, `./guards` spies) |
| PG error shape | `lib/db/schema.test.ts:24-31` |
| Page shell + guarded child | `admin/products/new/page.tsx:12-27`, `admin/page.tsx:15-25` |
| Server Action | `admin/products/_actions.ts:36-87` |
| Action tests | `admin/products/_actions.test.ts:16-35` |
| Schema-valid config | `admin/products/_actions.test.ts:37-67` |
| Client form | `product-form/product-form.tsx:64-92` |
| Client form test | `product-form/product-form.test.tsx:1-45` |
| Badge | `admin/_components/portfolio/decision-badge.tsx:6-10` |
| E2E | `e2e/portfolio.spec.ts:18-27,101-108,177-179` |

## Design decisions

1. Additive, `requireAdmin()`-gated, uncached DAL exports:
   ```ts
   export type ThresholdOverride = { [K in keyof Thresholds]: Thresholds[K] | null };
   export type ThresholdSettings = {
     defaults: { values: Thresholds; isSeed: boolean };
     products: { productId: string; isSeed: boolean; override: ThresholdOverride | null }[];
   };
   export type ThresholdsWriteResult = { ok: true } | { ok: false; reason: "product_not_found" };
   export async function getThresholdSettings(): Promise<ThresholdSettings>;
   export async function saveThresholds(productId: string | null, values: ThresholdsInput): Promise<ThresholdsWriteResult>;
   export async function resetThresholds(productId: string): Promise<ThresholdsWriteResult>;
   ```
2. Override storage: inside the transaction, read the default row; `min_visits` and `scale_requires_positive_margin`
   null when equal to the default; the two conversions both null when both equal, otherwise both stored; all null →
   delete the row. Upsert `onConflictDoUpdate({ target: productId })` with `updatedBy`, `updatedAt`. Equality on
   `Math.round(x * 1e4)`.
3. Default save: `select … where product_id is null for update` (missing → throw), `assertEditable({ isSeed })`,
   update the 4 fields + `updatedBy` / `updatedAt`; `is_seed` never changed.
4. Product save / reset: product row lookup (missing → `product_not_found`), `assertEditable({ isSeed })`; reset
   deletes the override row, idempotent.
5. Rates in %, rounded to 4 decimals before Zod: `percentToRate`, `rateToPercent`; `""` → NaN; checkbox `=== "on"`.
6. Validation in 3 layers: client live `safeParse` (inline errors, save disabled), action `safeParse` with French
   messages (`_components/validation.ts`), DAL `.parse`; DB CHECK `23514` (on `err.cause?.code ?? err.code`) mapped to
   `errors.scaleMinConversion`.
7. Preview (pure `_components/preview.ts`): `mergeThresholds`, `previewChanges(products, defaults, scope, candidate)`
   returns the rows whose decision changes; invalid candidate → no preview.
8. Actions `saveThresholdSettings(productId | null, _prev, formData)`, `resetProductThresholds(productId, _prev,
   _formData)`: `requireAdmin` → id parse → `percentToRate` → `safeParse` → DAL → `updateTag("thresholds")` on ok;
   `unstable_rethrow`, 23514 mapping, else `console.error` + rethrow.
9. UI: sync `page.tsx` shell + `<Suspense fallback={<SettingsSkeleton/>}>`; `GuardedSettings` →
   `Promise.all([getPortfolioMetrics({ days: 30 }), getThresholdSettings()])` → `toSettingsView` →
   `<ThresholdsSettings>`; client `thresholds-form.tsx` and `thresholds-settings.tsx` (native `<select>`, « (surchargé) »
   suffix, `key={productId}`); read-only when not editable; toasts; `settings/loading.tsx`.
10. No change to `getThresholds`, the sidebar, `lib/decision.ts` or BO-02 files.

## Files to Change

| File | Action |
|---|---|
| `lib/dal/thresholds.ts` + test | UPDATE (additive; existing tests untouched) |
| `app/(backoffice)/admin/settings/page.tsx`, `loading.tsx` | CREATE |
| `…/settings/_actions.ts` + test | CREATE |
| `…/settings/_components/{percent,validation,preview,settings-view}.ts` + tests | CREATE |
| `…/settings/_components/{thresholds-form,thresholds-settings,settings-skeleton}.tsx` + tests | CREATE |
| `e2e/settings.spec.ts` | CREATE (not run) |

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push at each green (`feat(db)` DAL, `feat(bo)` UI/actions).

- T1 `getThresholdSettings` (admin first; seeded defaults with `isSeed`; fresh product `override: null`; partial row).
- T2 `saveThresholds(null, …)` with the seeded values only (`updatedBy`, `updatedAt`, `assertEditable({ isSeed: true
  })`, kill ≥ scale → ZodError, no write; `afterAll` restores `updatedBy`).
- T3 `saveThresholds(productId, …)` (diff and pair rules, delete when all equal, not found, `assertEditable`).
- T4 `resetThresholds` (delete, idempotent, not found, `assertEditable`).
- T5 raw override insert kill 0.06 / scale 0.05 → `cause.code === "23514"`.
- T6 `percent.ts`. T7 `validation.ts`. T8 `preview.ts`. T9 `settings-view.ts`.
- T10 `saveThresholdSettings`. T11 `resetProductThresholds`.
- T12 `ThresholdsForm` (default scope). T13 `ThresholdsSettings` (override section).
- T14 `page.tsx` + `loading.tsx` + skeleton (coverage test, build).
- T15 `e2e/settings.spec.ts` (written, not run; fresh data; default round trip restored in `finally`).
- T16 full checks: knip, typecheck, lint, format:check, test:coverage, build, check.

Tests on the shared DB: never change the seeded default values (only `updatedBy`, restored); overrides only on fresh
products with schema-valid configs; cleanup `decision_thresholds` → `product_versions` → `products`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Parallel files assert the seeded default | High | T2 writes identical values only |
| drizzle wraps PG errors on `cause` | Certain | Decision 6, pinned by T5 |
| numeric(5,4) rounding vs Zod | Medium | Round before Zod; 23514 mapped anyway |
| Cross-row kill ≥ scale after a default change | Medium | Pair rule |
| Stub locks | Certain | Calls wired and spied; DEMO-mode implements |
| `admin/loading.tsx` portfolio skeleton | Medium | `settings/loading.tsx` |

## Acceptance

- [ ] Bullet 1 defaults form: T1, T2, T6, T12, T14, T15
- [ ] Bullet 2 per-product override + reset: T3, T4, T8, T11, T13, T15
- [ ] Bullet 3 kill ≥ scale → Zod + DB CHECK: T5, T7, T10, T12, T15
- [ ] Bullet 4 preview: T8, T12, T15
- [ ] Bullet 5 `updateTag('thresholds')`: T3, T10, T11, T15
- [ ] Bullet 6 demo lock wiring: T2-T4, T9, T12, T13
- [ ] Contract tests and existing thresholds tests unchanged; `pnpm check`, coverage, `pnpm build` green; PR title `feat(bo): BO-09 decision threshold settings with per-product overrides and badge preview`
