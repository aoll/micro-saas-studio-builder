# Plan: BO-05b · Génération, pricing, publication

**Source spec**: specs/BO-05b-generation-publication.md
**Complexity**: Medium-large (three form steps, a live preview, three Server Actions, one additive DAL function, one
e2e file; no frozen contract change)

## Summary

Adds steps 5-7 to the BO-05 form and a live landing preview. Step 5 (Génération): model, template with clickable
`{{variables}}`, output type, « Tester le prompt » through `lib/ai/*`. Step 6 (Pricing): signup credits, cost per
generation, packs, estimated margin. Step 7 (Récapitulatif): summary and « Publier ». Publishing saves the form as a
new version and calls the new DAL `publishProduct(slug, version)`, which moves `current_version` and syncs
`theme_id` / `locale` from that version's config; the action then calls `updateTag("product:<slug>")` and
`updateTag("products")`.

## Orchestrator decisions (binding)

1. « Publier » saves the current form as a new version, then publishes it (what you see goes live). Create mode:
   `createProduct` then `publishProduct(slug, 1)`; no prior « Enregistrer » required.
2. Margin before any test: `estimateGenerationCost(model)` action with the docs/05 reference usage (1000 in / 500
   out); after a test, the measured cost is used; the source is labelled.
3. Importing the pure `toolInputSchema` from `app/(products)/[app]/tool/_lib/` into the backoffice action is allowed
   (no duplication).
4. Currency: EUR prices and USD AI cost treated 1:1, as in `lib/dal/metrics.ts`; shown as an estimate.
5. Image output: shown disabled in the picker (« bientôt »); a stored `image` value is kept.
6. The committed `product-form.test.tsx` action mock is extended in its own commit (`test(bo): extend product-form
   action mock for BO-05b actions`), adding mock entries only, no assertion changed.

## Frozen inputs (consumed, not modified)

`productConfigSchema` (+ `.shape.generation`, `.shape.inputs`, `templateVariables`, `slugSchema`)
`lib/schemas/product-config.ts`; `generateInputSchema` `lib/schemas/inputs.ts:21`; `guardRequest("test-prompt")`
`lib/security.ts:13` (stub); `streamGeneration`, `costMicros`, `PLATFORM_MAX_OUTPUT_TOKENS` `lib/ai/generate.ts`;
`resolveModel` `lib/ai/model.ts`; `assertEditable`/`isEditable` `lib/dal/guards.ts` (DEMO-mode stubs, called only);
`createProduct` (signature pinned), `saveVersion`, `isSlugAvailable`, `listThemeOptions`, `getProductDraft`
`lib/dal/product-editor.ts`; `toolInputSchema` `app/(products)/[app]/tool/_lib/tool-input-schema.ts:15`.

## Patterns to Mirror

| What | Source |
|---|---|
| DAL write: `requireAdmin` → parse → transaction → `select … for update` → `assertEditable(row)` | `lib/dal/product-editor.ts:48-77` |
| Row wins over config for slug/status | `lib/dal/product-editor.ts:69-73` |
| DAL tests | `lib/dal/product-editor.test.ts:11-33,131-189` |
| Action shape and error handling | `admin/products/_actions.ts:36-87` |
| Action tests | `admin/products/_actions.test.ts:10-35,143-195` |
| Consuming `streamGeneration` | `app/(products)/[app]/api/generate/route.ts:145-190`, `lib/ai/generate.test.ts:196-221` |
| Radiogroup / `aria-live` | `product-form/theme-step.tsx:56-64`, `landing-step.tsx:18` |
| Inline theme tokens + font | `components/backoffice/theme-thumbnail.tsx:17-53`, `components/product/theme-vars.ts:27-30` |
| Cents × 10 000 vs micros | `lib/dal/metrics.ts:74,92` |
| Component tests | `product-form/product-form.test.tsx:1-45` |
| E2E | `e2e/product-form.spec.ts:15-91` |

## Design decisions

1. **`publishProduct(slug, version): Promise<{ id; slug; version } | null>`** (additive): `requireAdmin()`; one
   transaction: `select … for update` (unknown → null), `assertEditable(row)`, load `(productId, version)` (missing →
   null), `productConfigSchema.parse` the stored config (throw if corrupt), update `currentVersion`, `themeId`,
   `locale`, `updatedAt`. Any existing version (rollback works). No cache invalidation in the DAL.
2. **Actions** in `_actions.ts` (`"use server"`: only async exports; shared parsing in a non-exported
   `parseConfigForm`):
   - `testPrompt(slug | null, _prev, formData)`: `requireAdmin()` → `guardRequest("test-prompt")` (refused → error, no
     AI call) → parse `{ inputs, generation }` + `templateVariables` check → sample input via
     `generateInputSchema.shape.input` + `toolInputSchema` (French messages) → image → error →
     `streamGeneration` with a deferred settled by onSuccess/onError, `await result.consumeStream()`, bounded
     `Promise.race` → `{ ok, output, inputTokens, outputTokens, costMicros }`; failure → `console.error` +
     `{ error: "La génération de test a échoué" }`, never throws.
   - `estimateGenerationCost(model)`: `requireAdmin()`, model parsed, `{ costMicros: costMicros(model,
     REFERENCE_USAGE) }`, no AI call.
   - `publish(slug | null, _prev, formData)`: full parse (`{ errors, step }`), theme check; edit: `slugSchema`,
     `saveVersion` (null → « Produit introuvable », no `updateTag`), `publishProduct(slug, saved.version)`; create:
     `isSlugAvailable` → `createProduct` → `publishProduct(slug, 1)`; then `updateTag("product:<slug>")`,
     `updateTag("products")`; returns `{ ok, slug, version, url: "/<slug>" }`; 23505 race → slug error; other errors
     logged and rethrown (`unstable_rethrow` first).
3. **Form wiring**: `STEPS` + 5 Génération, 6 Pricing, 7 Récapitulatif; `stepPatch`/`handleNext` for 5-6;
   « Enregistrer » on every step, first submit button in DOM order; the « étape pas encore disponible » banner goes;
   `lastTest` lifted; `publish` via its own `useActionState` + `formAction`; create mode keeps `createdSlug` so a
   second publish takes the edit path; edit mode `router.refresh()` after publish.
4. `ProductDraft` type unchanged (`edit/page.tsx` is outside Périmètre); packs keyed by index.
5. **Validation**: `validateStep(5)` merges schema issues for `generation.*` with a direct `templateVariables` vs
   `inputs` check (Zod 4 skips `superRefine` when step 4 has an issue); `validateStep(6)` on `VALID_BASELINE`.
6. **Margin** (pure, client-safe `margin.ts`): per pack, `priceCents × 10 000 / credits × costPerGeneration` − AI cost
   micros; measured cost if tested, else the estimate; source labelled; negative in red.
7. **Live preview** (`landing-preview.tsx`, client): header, headline, subheadline, CTA, example, FAQ, packs with the
   chosen theme's light tokens inline, `primaryColor` override, `fontFor`; third column, title « Aperçu · /{slug} »,
   `aria-label="Aperçu de la landing"`; no labels or button names that collide with the committed tests' queries.
8. Model select: Claude Haiku 4.5 (default), Claude Sonnet 5, plus the stored model if neither.

## Files to Change (under `app/(backoffice)/admin/products/` unless noted)

| File | Action |
|---|---|
| `lib/dal/product-editor.ts` + test | UPDATE: add `publishProduct` |
| `_actions.ts` + test | UPDATE: `testPrompt`, `estimateGenerationCost`, `publish`, `parseConfigForm` |
| `_components/product-form/step-nav.tsx`, `product-form.tsx`, `validation.ts` (+ tests), `form-values.ts` (comments) | UPDATE |
| `_components/product-form/product-form.test.tsx` | UPDATE, own commit (decision 6) |
| `_components/product-form/{prompt-variables,margin}.ts` + tests | CREATE |
| `_components/product-form/{generation-step,prompt-tester,pricing-step,summary-step,landing-preview}.tsx` + tests | CREATE |
| `e2e/publish.spec.ts` | CREATE (not run) |

No `messages/*`, no page change.

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push each green step (`feat(db)` DAL, `feat(bo)` rest).

1. **`publishProduct`**: non-admin redirected; unknown slug / version → null, row unchanged; createProduct
   (editorial, fr) + saveVersion (neon, en) → publish v2 → currentVersion 2, neon, en, later `updatedAt`, v1 intact;
   rollback to v1; `expectTypeOf` pin.
2. **Lock**: mocked `assertEditable` gets the row; throwing → rejects, nothing changed; contract tests green.
3. **`validateStep(5)` / `(6)`**: unknown `{{ton}}` error even with step-4 issues; empty template; costPerGeneration
   0; duplicate pack id; empty packs.
4. **`insertVariable(template, start, end, key)`** → `{ value, caret }`.
5. **`margin.ts`**: `revenuePerGenerationMicros`, `estimateMargins` (can be negative), `formatUsd`, `formatEur`.
6. **`testPrompt`**: non-admin; guard refused (no AI call); unknown variable; empty required sample; image; mock happy
   path (fixture output, tokens, `costMicros`); AI failure → logged error value; only UI fields returned.
7. **`estimateGenerationCost`**: non-admin; empty model; haiku → reference cost.
8. **`publish`**: non-admin; invalid config; unknown theme → step 2; edit path v2 + both `updateTag`s; unknown slug →
   « Produit introuvable », no `updateTag`; create path (taken slug → step 1; new → v1 published and tagged); 23505
   race; other errors rethrown.
9. **Mock extension commit** (decision 6).
10. **ProductForm**: 7 steps; « Enregistrer » on every step (Enter submits it); step 5 blocked on unknown variable;
    server error `step: 6` switches; read-only disables Enregistrer and Publier.
11. **GenerationStep**: model select, template, chips insert at caret, live unknown-variable error with `aria-invalid`,
    output type radio with image disabled.
12. **PromptTester**: sample fields, button pending state, output, tokens, cost, `role="alert"` errors, `onTested`.
13. **PricingStep**: numbers, packs add/remove/edit (€ → cents), recommended, errors, margin panel (measured or
    estimated, labelled; negative red).
14. **LandingPreview**: headline live, theme background, `primaryColor` CTA, `/{slug}`.
15. **SummaryStep**: recap, « Publier » (disabled read-only), success link to `/{slug}` (`as Route`), errors jump to
    step, second create-mode publish takes the edit path, edit mode refresh.
16. **`e2e/publish.spec.ts`** (written, not run).
17. **Full checks**: knip, typecheck, lint, format:check, test:coverage (80 %+ on `lib/**`), check, build.

## Risks

| Risk | Mitigation |
|---|---|
| Committed `product-form.test.tsx` mock breaks on new imports | Decision 6 |
| `onSuccess` settling after `consumeStream()` | Deferred + bounded race; mock-mode test |
| Enter submits « Publier » | « Enregistrer » first in DOM order; tested |
| Second create-mode publish re-creates | `createdSlug` |
| Each publish adds a version | Accepted: append-only, traceable |
| `saveVersion` and `publishProduct` in two transactions | A failed publish leaves an unpublished draft; logged |
| `.shape` on a refined schema | First `testPrompt` test; fallback from exported pieces |
| Preview duplicates the landing look | Backoffice has no next-intl; cuttable to « Voir la landing » |
| Rate limit | `guardRequest("test-prompt")` called; SECURITY implements it |

## Acceptance

- [ ] Step 5: Tasks 3, 4, 6, 8, 10, 11, 16
- [ ] « Tester le prompt »: Tasks 6, 12, 16
- [ ] Step 6: Tasks 3, 5, 7, 13, 16
- [ ] Step 7 + publish + `updateTag` + link: Tasks 1, 2, 8, 15, 16
- [ ] Live preview: Task 14
- [ ] No frozen contract changed; `pnpm check`, `pnpm build` green; PR title `feat(bo): BO-05b generation, pricing and publication`
