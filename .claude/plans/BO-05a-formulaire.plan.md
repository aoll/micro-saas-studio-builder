# Plan: BO-05a · Formulaire produit, étapes 1 à 4 et sauvegarde

**Source spec**: specs/BO-05a-formulaire.md
**Complexity**: Large (two pages, a four-step client form, three Server Actions, additive DAL exports next to
`createProduct`, one dependency)

## Summary

The BO-05 form for steps 1 to 4 (Identité, Thème, Landing & SEO, Champs de l'outil) on `/admin/products/new` and
`/admin/products/[slug]/edit`. One client draft typed `ProductConfig`, validated step by step with `productConfigSchema`;
the same schema runs in the `saveProduct` Server Action, whose errors come back keyed by path and open their step. New
product → `createProduct` (product + version 1). Existing product → new `saveVersion` inserting version N+1 under a row
lock after `assertEditable`, never touching `current_version`, never updating in place. Steps 5-7 and the preview belong
to BO-05b; until then generation and pricing get documented defaults so a saved draft is a complete, valid config.

## Orchestrator decisions (binding)

1. **Theme list**: `listThemeOptions(): Promise<Theme[]>` in `lib/dal/product-editor.ts` (admin-only, ordered by name).
   BO-07 now depends on BO-05a and will import it.
2. **Additive DAL exports** in `product-editor.ts` accepted: `saveVersion`, `getProductDraft`, `isSlugAvailable`,
   `listThemeOptions`; `createProduct`'s signature stays byte-identical (its body adds `productConfigSchema.parse`).
3. **`ThemeThumbnail`** goes to `components/backoffice/theme-thumbnail.tsx` (+ test), not under `product-form/`: it is
   the thumbnail CONTRACT-ui never shipped, and BO-07 reuses it. Props `{ tokens: ThemeTokens; landingVariant:
   LandingVariant; name?: string }`, inline styles from the light tokens (not `themeCssVars`: `--primary` resolves on
   `:root`), font via `fontFor(tokens.fontKey).className`.
4. **`@vercel/blob`** accepted: `pnpm add @vercel/blob` in its own commit (`chore(bo): add @vercel/blob for logo upload`).
5. A new product's version 1 is reachable at `/{slug}` right away (status Test, nothing links to it): accepted, stated in
   the PR body. For existing products `saveVersion` never moves `current_version`.
6. Every admin page calls `await requireAdmin()` in its own `page.tsx` (BO-01's coverage test will check it).

## DAL additions (`lib/dal/product-editor.ts`)

```ts
export const createProduct: (config: ProductConfig) => Promise<{ id: string; slug: string; version: number }>; // unchanged signature
export const saveVersion: (slug: string, config: ProductConfig) => Promise<{ id: string; slug: string; version: number } | null>;
export const getProductDraft: (slug: string) => Promise<{ productId: string; isSeed: boolean; version: number; publishedVersion: number; config: ProductConfig } | null>;
export const isSlugAvailable: (slug: string) => Promise<boolean>;
export const listThemeOptions: () => Promise<Theme[]>;
```
All call `requireAdmin()`; none cached; no `updateTag` in the DAL (actions do it).

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| DAL module | `lib/dal/product-editor.ts:1-32` | `server-only`, typed const, `requireAdmin()` inside, `db.transaction` |
| Row wins over config | `lib/dal/products.ts:21-30` | `productConfigSchema.parse({ ...version.config, slug: row.slug, status: row.status, … })` |
| Theme parsing | `lib/dal/themes.ts:23-40` | `themeTokensSchema.parse(row.tokens)` |
| Server Action | `app/(backoffice)/admin/login/_actions.ts` | `"use server"`, `safeParse`, errors as values, `console.error` for unexpected failures |
| Client form | `app/(backoffice)/admin/login/_components/login-form.tsx` | `useActionState`, pending disables, `role="alert"` |
| Admin page | `app/(backoffice)/admin/page.tsx` | session read inside `<Suspense>` |
| DB tests | `lib/dal/product-editor.test.ts` | session spy set per test, seeded owner, random slugs, cleanup |
| Action tests | `app/(backoffice)/admin/login/_actions.test.ts:11-21` | `RedirectMarker`, `await import("./_actions")` |
| Component tests | `components/product/dynamic-field.test.tsx` | jsdom + `afterEach(cleanup)` |
| E2E | `e2e/skeleton.spec.ts` | sign in as `SEED_ADMIN` through the UI; Drizzle setup, `finally` |

## Files to Change

Paths under `app/(backoffice)/admin/` unless they start with `lib/`, `components/` or `e2e/`.

| File | Action |
|---|---|
| `lib/dal/product-editor.ts` + test | UPDATE (additive; existing tests unchanged) |
| `components/backoffice/theme-thumbnail.tsx` + test | CREATE (decision 3) |
| `products/_actions.ts` + test | CREATE (`saveProduct`, `checkSlug`, `uploadLogo`) |
| `products/_components/product-form/{slugify,form-values,validation}.ts` + tests | CREATE |
| `products/_components/product-form/{product-form,step-nav,identity-step,theme-step,landing-step,fields-step}.tsx` + tests | CREATE |
| `products/new/page.tsx`, `products/[slug]/edit/page.tsx` | CREATE |
| `e2e/product-form.spec.ts` | CREATE (not run) |
| `package.json`, `pnpm-lock.yaml` | UPDATE (decision 4) |

No `messages/*`: the backoffice stays in French without next-intl (docs/08).

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(bo)` UI/actions, `feat(db)` DAL), `pnpm exec knip`.
Component tests: jsdom + `afterEach(cleanup)`, mocks `next/navigation`, `sonner`, `../../_actions`.

**Phase 1 — DAL**
1. `saveVersion`: after `createProduct`, `saveVersion(slug, v2)` → 2, again → 3; `current_version` still 1,
   `updated_at` unchanged; v1 config unchanged; unknown slug → null; non-admin → redirect; signature pinned with
   `expectTypeOf`. Action: `requireAdmin()`, parse, transaction: `select … for update`, `coalesce(max(version),0)+1`,
   insert with `{ ...parsed, slug: row.slug, status: row.status }`, `createdBy` = session user.
2. `assertEditable` before any write + concurrency: mocked `./guards` throwing `"locked"` → reject, no row; called with
   the product row; `Promise.all` of two saves → versions {2, 3}, no PK error.
3. `getProductDraft` (latest version, `publishedVersion`), `isSlugAvailable` (`lettre-pro` false, random true),
   `listThemeOptions` (4 seeded, valid tokens); each redirects a non-admin.
4. `createProduct` validates first: `slug: "admin"` or duplicate keys reject, no row; existing tests untouched;
   `contract-shape.test.ts` still green.

**Phase 2 — pure logic**
5. `slugify`: "Générateur de bio Instagram" → `generateur-de-bio-instagram`; "  L'Été  2026!! " → `l-ete-2026`; "---" →
   ""; 100 chars → ≤ 60 without trailing dash; outputs pass `slugSchema` (reserved aside).
6. `form-values.ts`: `newProductDraft(themeId)` (status test, locale fr, one text field, `DEFAULT_GENERATION`,
   `DEFAULT_PRICING`) filled passes the schema; `toConfig` drops empty branding, non-select `options`, empty option
   lines, trims, does not mutate; `moveItem` swaps, no-op at edges, new array. `DEFAULT_GENERATION = { model:
   "anthropic/claude-haiku-4.5", promptTemplate: <French sentence without variables>, outputType: "markdown" }`;
   `DEFAULT_PRICING` 3 / 1 / 1, `pack-10` (10, 490), `pack-50` (50, 1490, recommended); comment "replaced by BO-05b".
7. `validation.ts`: `stepOfPath` maps slug → 1, branding → 2, landing → 3, inputs → 4, generation → 5, pricing → 6;
   `validateStep(1, slug "admin")` → `{ slug: "Ce slug est réservé" }` only; `validateStep(4, duplicate keys)` →
   `{ "inputs.1.key": "Clé déjà utilisée" }` even with step 3 empty (merge onto `VALID_BASELINE`: Zod 4 skips
   `superRefine` while the base has issues); 61-char seoTitle → "60 caractères maximum"; first message per path; known
   Zod messages translated to French.

**Phase 3 — Server Actions** (`products/_actions.ts`)
8. `saveProduct(slug: string | null, _prev, formData)`, create path: non-admin redirect with no write; unreadable JSON →
   `{ formError }`; invalid config → `{ errors, step }` and no `createProduct`; unknown theme → step 2 error; slug taken
   → step 1 error; valid → `createProduct`, `updateTag("products")` + `updateTag("product:<slug>")`, `{ ok: true, slug,
   version: 1 }`; race on slug → slug error, other errors rethrown (`unstable_rethrow` first in the `catch`).
9. Edit path: invalid bound slug → `{ formError }`; `saveVersion` null → "Produit introuvable"; valid → `{ ok, slug,
   version }`, **no** `updateTag`.
10. `checkSlug`: non-admin redirect; "Lettre Pro" → format error; "api" → reserved; "lettre-pro" → unavailable; new →
    available.
11. `uploadLogo`: non-admin redirect; no file / > 512 KB / type outside png, jpeg, webp → `{ error }`, no `put`; valid →
    `put("logos/<name>", file, { access: "public", addRandomSuffix: true, contentType, token: env.BLOB_READ_WRITE_TOKEN })`
    → `{ url }`; `put` rejects → `console.error` + `{ error: "Échec de l'envoi du logo" }` (`@vercel/blob` mocked).

**Phase 4 — form**
12. `ThemeThumbnail` (decision 3): light tokens as inline styles, font class from `fontFor`, `aria-hidden` root,
    `data-variant`.
13. Step 1: name fills slug via `slugify` until edited by hand; status Test/Learn/Scale (default Test); Langue fr/en;
    edit mode makes slug and status read-only; `errors.slug` with `aria-invalid`.
14. Step 2: one `ThemeThumbnail` per theme in a `role="radiogroup"`, click sets `themeId` (`aria-checked`); file →
    `uploadLogo` → `branding.logoUrl`, error shown; colour `#d946ef` accepted, "Couleur du thème" clears it; logo preview
    `next/image` `unoptimized`.
15. Step 3: title, subtitle; FAQ add/remove; SEO counters `n / 60` and `n / 160` (red past the limit, `aria-live`);
    `errors["landing.faq.0.answer"]` shown.
16. Step 4: add field (`champ_2`, text, not required); key, label, type, required, options (select only); up/down with
    edge disabling; remove disabled at 1 field; add disabled at 10; `errors["inputs.1.key"]`; rows keyed by a stable
    client id.
17. `ProductForm`: "Suivant" on invalid step stays; create mode calls `checkSlug`; step list switches steps, hidden steps
    keep values (`<Activity mode="hidden">`); save posts `config` JSON; `{ errors, step: 3 }` → switches to step 3 and
    shows the error; `{ ok }` → `toast.success("Brouillon enregistré · version N")`, create mode →
    `router.replace("/admin/products/<slug>/edit")`; errors for steps 5-6 → banner; `readOnly` disables save.

**Phase 5 — pages, E2E, validation**
18. Pages: thin Server Components, data read inside `<Suspense fallback={<Skeleton/>}>` by an async inner component
    calling `await requireAdmin()` (decision 6). `new`: `listThemeOptions()` → `<ProductForm mode="create" …/>`. `edit`:
    `PageProps<"/admin/products/[slug]/edit">`, `getProductDraft` → `notFound()` if null → form with `readOnly={!isEditable({ isSeed })}`
    and "brouillon vN · en ligne vM" when they differ. `pnpm typecheck`, `pnpm build`.
19. `e2e/product-form.spec.ts` (not run): sign in, create flow (slug derivation, `lettre-pro` taken, unique slug, Neon,
    landing, duplicate key then fix, reorder), save → edit URL + toast, save again → 2 versions, `current_version = 1`;
    unknown slug edit → 404; cleanup in `finally`; logo upload not covered.
20. Full validation: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm test:coverage`
    (80 %+ on `lib/**`), `pnpm check`, `pnpm build`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| New product v1 live at once | Certain | Decision 5 |
| Steps 5-6 required by the schema | Certain | Defaults, "replaced by BO-05b"; edit keeps stored values |
| Row overrides config's slug/status/theme/locale | Certain | Slug/status read-only in edit; BO-05b's `publishProduct` must sync `theme_id` and `locale` (PR body) |
| Additive exports in a DAL file | Medium | Decision 2; pinned with `expectTypeOf` |
| `@vercel/blob` lockfile conflicts | High | Own commit; regenerate on merge; `put` mocked |
| Server Action 1 MB body limit | Medium | 512 KB cap |
| Zod 4 `superRefine` skipped on base issues | High | `VALID_BASELINE` merge |
| English Zod messages vs French backoffice | Certain | `toFrenchMessage` shared by client and action |
| Redirect caught by the action `try` | Medium | `unstable_rethrow` |
| Session/params read outside `<Suspense>` | Medium | Async inner component; `pnpm build` |
| Slug `new` unreachable | Low | PR note |

## Acceptance

- [ ] Bullets 1-7 covered as in the tasks (form, slug, theme + logo, landing, fields, same schema per step, `saveVersion`)
- [ ] `createProduct` signature unchanged; `contract.test.ts` and `contract-shape.test.ts` green
- [ ] `pnpm check`, coverage 80 %+, `pnpm build` green
- [ ] PR body: decisions, v1-live deviation, BO-05b handoff (`publishProduct` syncs `theme_id` / `locale`; steps 5-7
      appended to `STEPS`)
- [ ] PR title: `feat(bo): BO-05a product form steps 1-4 and draft save`
