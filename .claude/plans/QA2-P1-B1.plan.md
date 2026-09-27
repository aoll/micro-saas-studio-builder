# Implementation Plan: QA2-P1-B1 · Brouillon publié dès le premier « Enregistrer »

Worktree: `/home/user/micro-saas-studio-builder-qa2-p1-b1-brouillon-publie`
Spec: `specs/qa/QA2-P1-B1-brouillon-publie.md`

## Overview

`createProduct()` currently writes `products.current_version = 1` at creation time, so a brand-new product is served publicly (`/{slug}` → 200) as soon as the admin clicks "Enregistrer", before ever clicking "Publier". The fix makes `current_version` nullable in the schema (`NULL` = "never published") and stops `createProduct()` from setting it. Every other reader of `current_version` either already treats "not found" as `null`/`notFound()` (no change needed) or is unreachable for an unpublished product by construction — except `lib/dal/credits.ts`, which needs a small null-guard purely for TypeScript strictness, not because it's reachable at runtime.

## Requirements (from the spec's Acceptation)

1. `/admin/products/new` → fill → "Enregistrer" (never "Publier") → `/<slug>` (no session) → 404 (SA-08), not 200.
2. `listProducts()` (BO-02, sitemap, SA-08 "other products", theme usage) never includes a never-published product — verified by a test, not just inferred from the `INNER JOIN`.
3. `getProduct(slug)` returns `null` for `current_version IS NULL`, instead of throwing (throwing stays reserved for a genuine data-integrity break: `current_version` set but pointing at a missing `product_versions` row).
4. `getProductDraft(slug)` returns `publishedVersion: null` for a never-published product; the edit page then shows only "brouillon vN" (no "· en ligne vM"). A published-then-redrafted product must still show both, unregressed.
5. Every other read of `current_version`/`currentVersion` in `app/`, `lib/`, `scripts/seed.ts` (non-test files) keeps working without throwing for a never-published product — documented per file below.
6. Seed and already-published products are unaffected (additive migration, no existing row becomes `NULL`).

## Architecture Changes (CONTRACT — pre-authorized by the human)

- `lib/db/schema.ts` — `products.current_version`: drop `.notNull()`; replace the check constraint `products_current_version_positive: current_version >= 1` with `current_version IS NULL OR current_version >= 1` (same pattern already used by `decision_thresholds`' nullable-column checks, e.g. `decision_thresholds_min_visits_positive`).
- New Drizzle migration in `drizzle/` (next number after `0003_deep_martin_li.sql`, so `0004_*.sql` + its `meta/0004_snapshot.json`), generated with `pnpm db:generate`, additive only (`ALTER COLUMN … DROP NOT NULL`, drop+recreate the check constraint). No manual SQL hand-written — generate, read, commit.
- `lib/dal/product-editor.ts` — `createProduct()`: remove the `currentVersion: 1` line from the `products` insert (nullable column with no default ⇒ omitting it inserts `NULL`). `getProductDraft()`: change the return type annotation `publishedVersion: number` → `publishedVersion: number | null` (body unchanged — it already returns `row.currentVersion` verbatim, which will just carry `null` naturally once the DB does).
- `lib/dal/products.ts` — `getProduct()`: guard before querying the version row: `if (!row || row.currentVersion === null) return null;` (currently `if (!row) return null;` only). This both implements the new behavior and keeps `eq(productVersions.version, row.currentVersion)` below it type-safe (TS narrows `row.currentVersion` to `number` after the guard). `listProducts()`: **no code change** — the `INNER JOIN … ON pv.version = p.current_version` already excludes a row where `current_version IS NULL` (SQL: comparison with `NULL` is never true) — needs a **test**, not a code change, per the spec.
- `lib/dal/credits.ts` — `readConfig()` (private helper used only by `grantSignupBonus` and `purchase`): add a null-guard, e.g. `if (product.currentVersion === null) throw new Error(...)`, before the existing `eq(productVersions.version, product.currentVersion)` lookup. **This is required for `pnpm typecheck` to pass**, not because it's reachable: `product.currentVersion`'s TS type becomes `number | null` once the schema changes, and `productVersions.version` is a `NOT NULL` Drizzle column — comparing a `number | null` value against it will not compile without narrowing first, even though the branch is functionally dead code (see "Per-file audit" below).
- `lib/dal/metrics.ts` — **no code change**. `selectProductRows()`'s raw `sql` template (`inner join product_versions pv on pv.product_id = p.id and pv.version = p.current_version`) is a plain SQL string, not a Drizzle-typed query builder call, so there is no TypeScript impact, and the `INNER JOIN` semantics exclude a `NULL current_version` row exactly like `listProducts()`. Covered by a test only (see below).
- `admin/products/[slug]/edit/page.tsx` — `getProductDraft()`'s `publishedVersion` is now `number | null`, but `<ProductForm publishedVersion={...}>`'s prop type is `number | undefined` (unchanged, frozen per spec: "déjà optionnel côté props"). Convert at the call site: `publishedVersion={draft.publishedVersion ?? undefined}`.
- `admin/products/_components/product-form/product-form.tsx` — **type-only**: no logic change (the `!== undefined` check at the "brouillon vN · en ligne vM" display already does the right thing once `publishedVersion` is `undefined` for a never-published draft). Nothing to touch here beyond confirming `pnpm typecheck` is clean with the mapped prop.

**Nothing found beyond what the spec already authorizes.** No other frozen contract (`lib/schemas/**`, other DAL signatures) needs to change. `getProduct`'s and `listProducts`'s exported signatures (`Promise<Product | null>` / `Promise<Product[]>`) are untouched — only their internal behavior for a state (`current_version IS NULL`) that used to be structurally impossible. The only DAL type-shape change is the one the spec itself calls out (`getProductDraft`'s `publishedVersion`).

## Per-file audit (spec's explicit ask: "documenter dans le plan lequel des deux")

Exhaustive `git grep -n "currentVersion\|current_version"` in `app/`, `lib/`, `scripts/seed.ts`, excluding `**/*.test.ts*`, returns exactly 6 files:

| File | Verdict | Why |
|---|---|---|
| `lib/db/schema.ts` | The contract itself | In Périmètre, see above |
| `lib/dal/product-editor.ts` | Fixed | In Périmètre, see above |
| `lib/dal/products.ts` | Fixed | In Périmètre, see above |
| `lib/dal/metrics.ts` | **Cannot occur** (defense-in-depth also holds) | `selectProductRows`'s SQL join naturally excludes `NULL current_version`. Additionally, the only caller that resolves a `productId` for `getFunnel` (`admin/products/[slug]/page.tsx`'s `ProductSheet`) already calls `getProduct(slug)` first and `notFound()`s when it's `null` — so `getFunnel`/`getPortfolioMetrics` are never invoked with an unpublished product's id in the reachable app. If they somehow were, `selectProductRows` would just return zero rows for that product, and `getFunnel` already throws its pre-existing (unrelated) `"unknown product"` error for a missing row — no new crash shape introduced. |
| `lib/dal/credits.ts` | **Cannot occur, but needs a type-safety guard** | `readConfig` (only called by `grantSignupBonus` and `purchase`) always receives a `productId` that was just resolved via a successful `getProduct(slug)` call in the caller (`app/(products)/[app]/signup/complete/_lib/claim.ts:22`, `app/(products)/[app]/signup/_actions.ts:43`, `app/(products)/[app]/checkout/_actions.ts:39` — all three bail out before reaching credits.ts when `getProduct` returns `null`). `debit()` and `refund()` don't call `readConfig` at all. So this is functionally dead for a never-published product — but the nullable `currentVersion` type still needs a guard so the file typechecks (see Architecture Changes). |
| `scripts/seed.ts` | **Unaffected, must not change** | Line 614 sets `currentVersion: 1` explicitly for every seeded (always-published) product — spec's own acceptance bullet says seed behavior must not change. |

(`app/(backoffice)/admin/products/_actions.ts` also matched the grep, but only inside a comment — `// … cache-visible move of \`current_version\`.` — no code to change there.)

## Implementation Steps

### Phase 1: Schema + migration (contract, do first, alone)
1. **Make `current_version` nullable** (File: `lib/db/schema.ts`)
   - Action: drop `.notNull()` on `currentVersion`; replace the `products_current_version_positive` check with `sql\`${table.currentVersion} IS NULL OR ${table.currentVersion} >= 1\`` (mirror the existing `decision_thresholds` nullable-check style already in this file).
   - Why: the frozen contract this spec authorizes.
   - Dependencies: none.
   - Risk: Low (additive), but it's the one true CONTRACT step — get it right in one commit, then everything else builds on it.
2. **Generate and commit the migration** (Files: `drizzle/0004_*.sql`, `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json`)
   - Action: `pnpm db:generate`, read the generated SQL to confirm it's `ALTER COLUMN … DROP NOT NULL` + constraint drop/recreate only (no data-destructive statement), then `pnpm db:migrate` against the worktree DB.
   - Why: required before any DAL test can exercise a `NULL` `current_version` row.
   - Dependencies: Step 1.
   - Risk: Low.

### Phase 2: DAL — stop publishing on save, read `NULL` correctly
3. **`createProduct` no longer sets `current_version`** (File: `lib/dal/product-editor.ts`)
   - Action (red first): flip `lib/dal/product-editor.test.ts`'s existing assertion `expect(productRow).toMatchObject({ ..., currentVersion: 1 })` (line ~77) to `currentVersion: null`; flip `expect(after?.currentVersion).toBe(1)` (line ~139, "inserts a new version without moving current_version") to `toBeNull()`; flip `expect(draft).toMatchObject({ ..., publishedVersion: 1 })` (line ~187) to `publishedVersion: null` — these three already-green tests currently pin the buggy behavior directly, so each change needs its own commit explaining why (CLAUDE.md: "A committed test is never weakened silently"). Then (green) remove `currentVersion: 1,` from `createProduct`'s insert.
   - Why: this line is the bug's root cause.
   - Dependencies: Phase 1.
   - Risk: Medium — three pre-existing tests encode the wrong expectation; get the red/green order right (test change is its own commit, then the code fix commit).
4. **`getProductDraft`'s return type** (File: `lib/dal/product-editor.ts`)
   - Action: `publishedVersion: number` → `publishedVersion: number | null` in the return type annotation. No body change.
   - Dependencies: Step 3 (same file, same test pass covers both).
   - Risk: Low.
5. **`getProduct` returns `null` instead of throwing for `current_version IS NULL`** (File: `lib/dal/products.ts`)
   - Action (red first): add a test in `lib/dal/products.test.ts` — e.g. insert a real never-published product row (via `db`, in the `describe("getProduct")` block, next to the existing "throws when the product_versions row … is missing" test) and assert `getProduct(slug)` resolves to `null`, not a throw. Then (green) add the `|| row.currentVersion === null` branch to the existing `if (!row) return null;` guard.
   - Why: spec's explicit acceptance bullet; also the mechanism that makes `app/(products)/[app]/layout.tsx:82-83`'s `if (!product) notFound();` fire for a never-published slug (already-correct code downstream, no change needed there).
   - Dependencies: Phase 1.
   - Risk: Low — the existing "missing product_versions row" throw test (mocked db) must keep passing unchanged (it sets `currentVersion: 1` with no matching version row — still a real inconsistency, still throws).
6. **`listProducts` excludes a never-published product — add the test the spec asks for** (File: `lib/dal/products.test.ts`)
   - Action: in `describe("listProducts")`, insert (and clean up) a never-published product row and assert its slug is absent from `listProducts()`'s result. No production code change (the `INNER JOIN` already does this).
   - Dependencies: Phase 1.
   - Risk: Low.
7. **`readConfig`'s type-safety guard** (File: `lib/dal/credits.ts`)
   - Action: add `if (product.currentVersion === null) throw new Error(\`readConfig: product ${productId} has never been published\`);` right after the `!product` check, before the version lookup. No new test strictly required (this path is unreachable from any real caller — see audit table), but a cheap unit test exercising `readConfig` via a mocked/never-published product is welcome if `grantSignupBonus`/`purchase` already have a seam for it; otherwise a one-line comment explaining unreachability (matching this plan's audit) is enough.
   - Why: required for `pnpm typecheck`, not for runtime correctness (see audit table).
   - Dependencies: Phase 1.
   - Risk: Low, but don't skip it — `pnpm check` will fail on this file's typecheck otherwise.
8. **Verify `metrics.ts` needs no code change, add the coverage test the spec asks for** (File: `lib/dal/metrics.test.ts`)
   - Action: add a test (portfolio-wide, `getPortfolioMetrics` or the exported `toProductMetrics`/`selectProductRows`-level pathway already used by existing tests) confirming a never-published product contributes nothing to `getPortfolioMetrics()`'s `products` array or `totals`. No production code change.
   - Dependencies: Phase 1.
   - Risk: Low.

### Phase 3: Admin UI — edit page prop mapping
9. **Map `publishedVersion: null` to `undefined` for `ProductForm`** (File: `admin/products/[slug]/edit/page.tsx`)
   - Action: `publishedVersion={draft.publishedVersion}` → `publishedVersion={draft.publishedVersion ?? undefined}`.
   - Why: keeps `product-form.tsx`'s prop type (`number | undefined`, frozen per spec) untouched while accepting the DAL's new `number | null`.
   - Dependencies: Step 4.
   - Risk: Low.
10. **Confirm `product-form.tsx` needs no logic change** (File: `admin/products/_components/product-form/product-form.tsx`)
    - Action: no edit expected; run `pnpm typecheck` and the existing component test to confirm the "brouillon vN · en ligne vM" line correctly shows nothing for a never-published draft (i.e. `draftVersion !== undefined && publishedVersion !== undefined` already excludes it once `publishedVersion` is `undefined`).
    - Dependencies: Step 9.
    - Risk: Low.

### Phase 4: E2E — close the loop on the actual repro
11. **Update the e2e test that currently pins the bug, and extend it to the repro itself** (File: `e2e/product-form.spec.ts`)
    - Action: in `"creates a product through steps 1-4, then saves a second draft version"`, change `expect(productRow?.currentVersion).toBe(1);` (line ~90) to `expect(productRow?.currentVersion).toBeNull();`, update the stale comment above it ("current_version still 1"), and add the spec's own repro as a new assertion in the same test (or a new one): after the two "Enregistrer" saves and before any "Publier", `await page.goto(\`/${uniqueSlug}\`)` (unauthenticated context, or a fresh context/page) and assert a 404 / SA-08 content, mirroring the "editing an unknown slug 404s" test's pattern (`await expect(page.getByText(/introuvable|404/i)).toBeVisible();`).
    - Why: this is the one place that shows the bug in a real navigator, and the spec's Périmètre explicitly calls it out for extension.
    - Dependencies: Phase 2, Phase 3.
    - Risk: Low — not run by the tdd-guide loop per this file's own header comment ("Not run by the tdd-guide loop … kept here for the E2E phase"); still commit it now so it's ready for that phase, but don't block the TDD loop on running Playwright.
12. **`e2e/publish.spec.ts`** — audited, no change needed: its flow already goes straight to "Publier" and never asserts on a pre-publish `current_version`, so it's unaffected.

## Testing Strategy

- **Unit (Vitest, `lib/dal/**`)**: the red→green pairs in steps 3, 5, 6, 8 above are the core of this spec's TDD loop. Each must independently fail before the corresponding production change and pass after — that's the whole bug, contained in `lib/dal/product-editor.ts` and `lib/dal/products.ts`.
- **Schema (`lib/db/schema.test.ts`)**: add a test that a `products` row can be inserted with `currentVersion` omitted (defaults to `NULL`), and that the check constraint still rejects `currentVersion: 0` when explicitly set (even though `NULL` is now allowed) — reusing the `expectViolation` helper already in that file.
- **Integration**: `lib/dal/product-editor.test.ts`'s DB-backed tests already run against the worktree Postgres — no new integration harness needed.
- **E2E**: Phase 4, run in the E2E phase per project convention (not by `tdd-guide`).

## Risks & Mitigations

- **Risk**: weakening a committed test silently (three existing tests currently assert the buggy `currentVersion: 1` / `publishedVersion: 1`).
  - Mitigation: each change gets its own commit with a message explaining why (CLAUDE.md rule), reviewed first in code review, exactly as the three tests are flagged above.
- **Risk**: `pnpm typecheck` breaks in `lib/dal/credits.ts` if the null-guard (step 7) is skipped, since `productVersions.version` (NOT NULL) can no longer be compared against `product.currentVersion` (now `number | null`) without narrowing.
  - Mitigation: step 7 is listed as required, not optional, despite being functionally unreachable.
  - Suggested check: after step 1 alone, run `pnpm typecheck` in the worktree before touching `credits.ts`, to confirm this is indeed where it breaks (and that nothing else does).
- **Risk**: a future caller reaches `getFunnel`/`getPortfolioMetrics` or `credits.readConfig` with an unpublished product's id, bypassing the `getProduct`-gate this plan relies on for "cannot occur".
  - Mitigation: both throw a clear, pre-existing-style error (`"unknown product"` / `readConfig: … has never been published`) rather than crash unrecognizably or silently misbehave — acceptable per the spec's "soit … soit le code le gère explicitement".
- **Risk**: migration review — this is the one CONTRACT step; a mis-generated migration (e.g. Drizzle deciding to recreate the column) would be data-destructive.
  - Mitigation: read the generated SQL before running `db:migrate`; expect exactly an `ALTER COLUMN DROP NOT NULL` + constraint swap, nothing else.

## Success Criteria

- [ ] Every Acceptation bullet of `specs/qa/QA2-P1-B1-brouillon-publie.md` has a passing test.
- [ ] The QA repro (create → "Enregistrer" only → `/{slug}` unauthenticated) now returns 404/SA-08, verified by the extended `e2e/product-form.spec.ts` test.
- [ ] A product published before this change (seed, or any already-`current_version`-set row) is unaffected — `lib/dal/product-editor.test.ts`'s `publishProduct`/`saveVersion` tests (lines ~124-287, untouched by this plan) stay green as-is.
- [ ] `pnpm check` passes, including `pnpm typecheck` on `lib/dal/credits.ts` after its null-guard.
- [ ] No file outside the spec's Périmètre was touched; no frozen contract other than `lib/db/schema.ts` (pre-authorized) changed.

## Nothing to escalate

Everything above stays inside what the spec already authorizes: the only schema change is the pre-approved `current_version` nullability, the only DAL type-shape change is `getProductDraft`'s already-documented `publishedVersion: number | null`, and `lib/dal/credits.ts`'s change is a local, private-function null-guard forced by TypeScript strictness on the now-nullable column — not a change to `credits.ts`'s exported signatures (`Debit`, `Purchase`, `DebitResult`, `debit`, `refund`, `grantSignupBonus`, `purchase` are all untouched). No other frozen contract (`lib/schemas/**`, other DAL signatures) is touched.
