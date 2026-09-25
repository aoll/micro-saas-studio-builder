# Plan: BO-07 · Bibliothèque de thèmes

**Source spec**: specs/BO-07-themes.md
**Complexity**: Small (one page, four files in `_components/`, no Server Action, no DAL change, no messages)

## Summary

`/admin/themes` shows a grid of theme cards: BO-05a's `ThemeThumbnail`, the theme name, how many products use it (with
their names, as in the mockup) and the landing variant. Data from two existing DAL reads: `listThemeOptions()` (admin,
uncached) and `listProducts()` (frozen, cached, tag `products`). The per-theme count is a pure function in
`_components/`. Read-only: no action, no `updateTag`. Page shape as `products/new/page.tsx`: static header, async inner
component inside `<Suspense>` calling `await requireAdmin()`.

## Orchestrator decisions (binding)

1. No link from a card to `/admin/themes/[id]` in BO-07. The orchestrator records a pending integration for BO-08:
   wrap `ThemeCard` in a `<Link>` once `/admin/themes/[id]` exists (no cast needed then).
2. No « + Nouveau thème » button (no spec creates themes).
3. Killed products are counted (they still reference the theme).
4. The count uses the cached `listProducts()` (catalogue data, cached by design in docs/04); themes stay uncached.
5. No e2e file in BO-07 (`e2e/**` outside Périmètre): the journey belongs to the E2E phase.
6. The `"/admin/themes" as Route` cast in `components/backoffice/admin-sidebar.tsx` is removed by the orchestrator's
   follow-up after BO-07 merges (pending integration), not here.
7. Relay to BO-05b: its publish must `updateTag("products")` when a product's `theme_id` changes.

## Frozen inputs (consumed, never changed)

`listThemeOptions()` `lib/dal/product-editor.ts:117-130`; `listProducts()` `lib/dal/products.ts:32-46` (row wins for
`themeId`, killed included); `requireAdmin()` `lib/dal/session.ts:18-24`; `Theme` `lib/dal/themes.ts:12-19`;
`LandingVariant` `lib/schemas/theme-tokens.ts:47-49`; `ThemeThumbnail` `components/backoffice/theme-thumbnail.tsx:17-54`
(reused as is); `EmptyState`, `Skeleton`, `Card`.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Admin page + Suspense | `app/(backoffice)/admin/products/new/page.tsx:8-27` | static `<main>`/`<h1>`, async inner with `await requireAdmin()` in `<Suspense>` |
| requireAdmin coverage | `app/(backoffice)/admin/require-admin-coverage.test.ts:34-39` | new page picked up automatically |
| Grid of thumbnails | `…/product-form/theme-step.tsx:56-71` | `themes.map` → `<ThemeThumbnail tokens landingVariant />` |
| Async Server Component test | `app/(products)/[app]/page.test.tsx:9-16,82-84` | `vi.mock` DAL, `render(await Component())` |
| next/font mock | `components/backoffice/theme-thumbnail.test.tsx:1,8-15` | jsdom, `vi.mock("next/font/google")`, `afterEach(cleanup)` |

## Design decisions

1. Count from `listProducts()`, grouped by a pure function; no DAL change.
2. `formatUsage(names)`: 0 → `Aucun produit`; 1 → `Utilisé par 1 produit · LettrePro`; n → `Utilisé par n produits ·
   A, B, C` (names sorted with `localeCompare(…, "fr")`).
3. `LANDING_VARIANT_LABELS: Record<LandingVariant, string>`: `centered` → `hero centré`, `split` → `hero + exemple`,
   `minimal` → `minimal`; shown as `Variante « … »`. BO-08 reuses it.
4. `ThemeThumbnail` without `name` (the card's `<h2>` carries it, thumbnail `aria-hidden`); grid `<ul>` of
   `<li><article>`.
5. Themes in DAL order (by name).
6. Async data component `ThemeLibrary` in `_components/` (testable); `page.tsx` guards and lays out; `Promise.all` of
   both reads; errors propagate, never caught.
7. No `messages/*`, no `updateTag`.

## Files to Change (under `app/(backoffice)/admin/themes/`)

| File | Action |
|---|---|
| `_components/theme-usage.ts` + test | CREATE: `productsByTheme(products)`, `formatUsage(names)` |
| `_components/landing-variant-labels.ts` | CREATE |
| `_components/theme-card.tsx` + test | CREATE (no `'use client'`) |
| `_components/theme-library.tsx` + test | CREATE (`export async function ThemeLibrary()`) |
| `page.tsx` | CREATE |

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push `feat(bo): …` at each green.

1. **`productsByTheme`**: `[]` → empty Map; grouped by `themeId`; names sorted (`"Été"` before `"Zeta"`, `fr`); unknown
   `themeId` kept but never displayed; input not mutated.
2. **`formatUsage`**: 0 / 1 / 3 names.
3. **`ThemeCard`**: `<h2>` name; one `theme-thumbnail` with `data-variant`, no duplicated name; `theme-usage` text and
   `data-count` (0/1/2); `it.each` over the 3 variant labels.
4. **`ThemeLibrary`**: 4 themes, 3 products → 4 `listitem`s in DAL order; Editorial `Utilisé par 2 produits ·
   DescriPro, LettrePro`, Neon `Aucun produit`; killed counted; each DAL called once; `[]` → EmptyState « Aucun thème
   en base »; a DAL rejection rejects `ThemeLibrary()`.
5. **`page.tsx`**: red via `require-admin-coverage.test.ts`, green with `GuardedThemeLibrary`; `pnpm typecheck`,
   `pnpm build`.
6. **Validation**: `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm check`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Count stale until `updateTag("products")` | Medium | Decision 7 relayed to BO-05b |
| One corrupt product config breaks `listProducts` | Low | Fails loudly by design |
| `requireAdmin` outside `<Suspense>` breaks the build | Medium | Inner async component; `pnpm build` |
| Card order / thumbnail simpler than the mockup | Certain, cosmetic | Noted in the PR |

## Acceptance

- [ ] Thumbnail grid: Tasks 3, 4, 5
- [ ] Number of products per theme: Tasks 1-4
- [ ] `pnpm check`, `pnpm build` green; PR title `feat(bo): BO-07 theme library`; PR body lists what BO-08 reuses
  (`formatUsage`, `productsByTheme`, `LANDING_VARIANT_LABELS`, `updateTag("theme:<id>")` and product tags on save)
