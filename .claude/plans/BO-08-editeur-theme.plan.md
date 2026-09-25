# Plan: BO-08 · Éditeur de thème

**Source spec**: specs/BO-08-editeur-theme.md
**Complexity**: Medium (one page, one Server Action, one additive DAL write, ~8 small `_components/` files; no
migration, no `lib/schemas/**` change, no `messages/*`)

## Summary

`/admin/themes/[id]` loads the theme through the uncached admin read `listThemeOptions()` and its usage through
`listProducts()` + BO-07's `productsByTheme()`. A client editor covers light and dark colour tokens (the 16 keys of the
schema, Clair/Sombre switch), the font key (`FONT_KEYS`), a radius slider and the landing variant, with a live preview
(mini landing + components column) driven by the draft tokens as scoped CSS variables, and a warning « Utilisé par N
produits · … ». Save calls `saveTheme(id)`: `requireAdmin`, shared Zod schema, new additive DAL write `updateTheme()` in
`lib/dal/themes.ts` (transaction, `FOR UPDATE`, `assertEditable`, returns the theme's product slugs), then
`updateTag("theme:<id>")` and `updateTag("product:<slug>")` for each product on the theme.

## Orchestrator decisions (binding)

1. Stacked `<fieldset>` sections (Couleurs, Typographie, Forme, Landing) instead of the mockup's tabs.
2. Typography scale, shadows and density (docs/01) are not in the frozen `themeTokensSchema`: out of scope (recorded
   for the human as a possible contract PR).
3. DEMO-mode locking of seeded themes is DEMO-mode's: `isEditable` / `assertEditable` are only called here.
4. Accepted: radius slider 0–2 rem step 0.125; killed products' tags invalidated too; `listThemeOptions().find()`
   for the editor read.
5. Linking BO-07's `theme-card.tsx` to this page is a follow-up after merge (outside Périmètre): do not edit it.

## Frozen inputs (consumed, never changed)

`themeTokensSchema`, `landingVariantSchema` `lib/schemas/theme-tokens.ts:8-49`; `Theme`, `getTheme` `lib/dal/themes.ts:12-40`
(signature pinned by `contract.test.ts:97-103`, `contract-shape.test.ts:133-139`); `listThemeOptions`
`lib/dal/product-editor.ts:119-130`; `listProducts` `lib/dal/products.ts:34-46`; `requireAdmin`; `assertEditable` /
`isEditable` `lib/dal/guards.ts:8-13`; `productsByTheme`, `formatUsage`, `LANDING_VARIANT_LABELS`
(`admin/themes/_components/`); `FONT_KEYS`, `fontFor` `lib/fonts.ts:9-29`; `components/ui/*`.

## Patterns to Mirror

| What | Source |
|---|---|
| Admin page with Suspense, `requireAdmin` then `params` | `app/(backoffice)/admin/products/[slug]/edit/page.tsx:24-52` |
| Server Action shape | `app/(backoffice)/admin/products/_actions.ts:36-87` |
| Action test mocks | `app/(backoffice)/admin/products/_actions.test.ts:16-35` |
| DAL write with `FOR UPDATE` + `assertEditable` | `lib/dal/product-editor.ts:48-77` |
| DAL test mocks | `lib/dal/product-editor.test.ts:11-33` |
| Client form with `useActionState`, hidden JSON | `product-form/product-form.tsx:64-92,145,204` |
| Client test mocks | `product-form/product-form.test.tsx:1-27` |
| Async Server Component test | `admin/themes/_components/theme-library.test.tsx:9-18` |
| Zod issues → French messages | `product-form/validation.ts:58-97` |
| camelCase token → CSS var | `components/product/theme-vars.ts:7-33` |

## Design decisions

1. `updateTheme(id, { tokens, landingVariant }): Promise<{ id; productSlugs: string[] } | null>` (additive):
   `requireAdmin()`, non-uuid → null (no query), parse both schemas; transaction: `select … for update` (missing →
   null), `assertEditable(row)`, update tokens / landingVariant / updatedAt, `select slug from products where theme_id =
   id order by slug` (killed included). `getTheme` untouched.
2. `saveTheme(id, _prev, formData)`: `requireAdmin()` → `z.uuid()` on id (« Thème introuvable ») → JSON parse
   (« Données illisibles ») → `z.object({ tokens: themeTokensSchema, landingVariant: landingVariantSchema })` →
   `FONT_KEYS` check (« Police hors catalogue ») → `updateTheme` (null → formError, no `updateTag`) →
   `updateTag("theme:<id>")` + `updateTag("product:<slug>")` each → `{ ok: true }`; errors: `unstable_rethrow`,
   `console.error`, rethrow; no `updateTag` on failure.
3. Editor data uncached (`listThemeOptions().find`), unknown / non-uuid id → `notFound()`.
4. Colour rows in schema order, kebab labels, text input + swatch + native colour input for `#rrggbb`, field errors
   with `aria-invalid`.
5. Radius `<input type="range">` 0–2 rem step 0.125 with readout; `radiusToRem` / `remToRadius`.
6. Preview: pure `previewCssVars(tokens, mode)` returning the direct shadcn variables + `--radius` inline; font class,
   `data-mode`, `data-variant`; mini landing per variant + components column; sample = first product on the theme by
   name, generic fallback.
7. `UsageWarning`: N ≥ 1 `role="status"` « {formatUsage}. Les modifications s'appliquent immédiatement. »; 0 « Aucun
   produit ».
8. Read-only via `isEditable(theme)` (`<fieldset disabled>` + save disabled); « Annuler » → `/admin/themes`; toast on
   success; alert banner when any field error.
9. Theme name in `<h1>` « Thème · {name} », not editable.

## Files to Change (under `app/(backoffice)/admin/themes/[id]/` unless noted)

| File | Action |
|---|---|
| `lib/dal/themes.ts` + `lib/dal/themes.test.ts` | ADD `updateTheme` (+ tests) |
| `_components/theme-errors.ts` + test | CREATE |
| `_components/radius.ts` + test | CREATE |
| `_components/preview-vars.ts` + test | CREATE |
| `_components/font-labels.ts` | CREATE |
| `_components/theme-preview.tsx` + test | CREATE |
| `_components/theme-editor.tsx` (+ `color-fields.tsx` if large) + test | CREATE (`'use client'`) |
| `_components/usage-warning.tsx` + test | CREATE |
| `_components/theme-editor-loader.tsx` + test | CREATE |
| `_actions.ts` + test | CREATE |
| `page.tsx` | CREATE |

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push `feat(bo)` / `feat(db)` at each green.

1. `toThemeErrors` (colour, radius, first message per path, unknown message kept).
2. `radiusToRem` / `remToRadius` (outputs pass the schema).
3. `previewCssVars` (mode, kebab, `--radius`, 17 keys).
4. `updateTheme` on the worktree DB with temporary theme/product rows: non-admin redirect; persisted + `updatedAt`;
   unknown / non-uuid → null; invalid tokens rejected; `assertEditable` called and throwing blocks the write;
   `productSlugs` sorted, `[]` when unused; `getTheme` and contract tests green.
5. `saveTheme`: auth first; non-uuid; unreadable JSON; invalid colour; `fontKey` out of catalogue; invalid variant;
   happy path with both tag kinds; DAL null → no tag; DAL throw → rejects, no tag.
6. `ThemePreview` (variants, mode, sample and fallback, font class, components column).
7. `ThemeEditor` (16 inputs, mode switch, JSON updates, font, radius, variant, errors + banner, toasts, read-only,
   Annuler link).
8. `UsageWarning` (0 / 1 / 2).
9. `ThemeEditorLoader` (notFound, h1, count incl. killed, sample, read-only, DAL rejection propagates).
10. `page.tsx` (red via `require-admin-coverage.test.ts`, then `GuardedThemeEditor` inside `<Suspense>`).
11. Validation: typecheck, lint, format:check, knip, build, check.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `theme:<id>` does not reach the prerendered landing | Medium | Also `product:<slug>` per product; E2E phase checks it on `build && start` |
| `./session` import in `themes.ts` pulls auth into the product layout's graph | Low | Server-only; `vi.mock("./session")` in tests; `getTheme` never calls it |
| Frozen schema accepts any `fontKey` | Certain | Action checks `FONT_KEYS` |
| Concurrent saves | Low | `FOR UPDATE`, last write wins |
| Tests mutating seed rows | Medium | Temporary rows only |

## Acceptance

- [ ] Bullet 1 (tokens light/dark, typography, radius, variant, preview): Tasks 2, 3, 6, 7, 9, 10
- [ ] Bullet 2 (warning; save → `updateTag theme:{id}`; every product changes): Tasks 4, 5, 8, 9
- [ ] Frozen contracts unchanged; `pnpm check`, `pnpm build` green; PR title `feat(bo): BO-08 theme editor`
