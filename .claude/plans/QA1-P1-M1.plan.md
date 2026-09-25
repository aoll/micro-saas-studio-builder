# Implementation Plan: QA1-P1-M1 · Formulaire produit : config complète et import « prête à coller »

## Overview
Close the gap the QA pass (M1) found between `productConfigSchema` (already
frozen with `landing.exampleOutput`, `landing.steps`, `generation.systemPrompt`)
and BO-05's form, which has no fields for them and no way to paste a ready
config. Add the three fields to steps 3 and 5 (plus their live preview), and a
paste-a-JSON-config panel on step 1 that fills every step through the same
Zod schema, with theme-by-name fallback when the pasted `themeId` doesn't
match a theme in this environment.

## Requirements (spec acceptance)
- Step 3 (Landing & SEO): fields for the example output and the "how it
  works" steps (add, remove, reorder); the preview shows them.
- Step 5 (Generation): a system prompt field.
- Pasting a JSON config (`fixtures/bio-instagram.config.json`) fills every
  step, validated by the same Zod schema, errors shown per step; the theme
  is chosen by name when the id doesn't match.
- A product created this way has the example and "how it works" on its
  landing (already true today — SA-01 renders both; this plan only has to
  not break it).

## Architecture decisions (and why)

1. **No schema change.** `productConfigSchema` already accepts all three
   fields (`Contrat` line of the spec). Nothing in `lib/schemas/` moves.
2. **Theme resolution on import, not a schema change.** The reference
   fixture (`fixtures/bio-instagram.config.json`) has **no `themeId` key at
   all** — confirmed by reading the file. So "le thème se choisit par son
   nom si l'id ne correspond pas" is designed as: read the pasted
   `themeId` value (if any) as a plain string; if it equals an existing
   theme's `id`, use it; else if it case-insensitively equals an existing
   theme's `name` (covers a human-written value like `"themeId": "Neon"`,
   or a stale/foreign id from another environment being retried as a
   name), use that theme's id; else **fall back silently to the draft's
   current theme** (no blocking error — step 2 stays a deliberate,
   separate action, matching docs/01's live demo script "choix du thème").
   This makes the BioInsta fixture (no theme field) import cleanly with
   zero step-2 error, while still implementing name-matching generically
   for configs that do carry a theme reference.
3. **Import restricted to `mode === "create"`.** Overwriting an existing
   edited draft from a paste is a separate, riskier feature the spec does
   not ask for; `/admin/products/new` is also the only place docs/01's
   "config prête à coller" script actually uses it.
4. **Import panel lives in step 1**, next to `IdentityStep`, as its own
   leaf component (`ImportConfigPanel`) — not folded into `IdentityStep`,
   so `IdentityStep` stays a narrow controlled component and the panel is
   independently testable (same pattern as `ThemeStep`'s injected
   `onUploadLogo`).
5. **Pure parsing/validation logic in its own module** (`import-config.ts`),
   so the JSON-parse → theme-resolve → `productConfigSchema.safeParse` →
   per-step-error pipeline is unit-tested without React, mirroring
   `validation.ts`'s existing `issuesToErrors`/`stepOfPath` split.
6. **`crypto.randomUUID()` (global), never `node:crypto`'s `randomUUID`**,
   in every new/edited client file — B1 (the crash this spec's Périmètre
   sits next to) is a `node:crypto` import in a client module, fixed in
   parallel by `QA1-P1-L1-lot-leger`. `fields-step.tsx` already uses the
   global form; this plan follows it everywhere new ids are minted
   (`fromConfig`'s field ids).
7. **No new trimming in `toConfig`.** `exampleOutput`/`steps` follow the
   FAQ precedent: FAQ entries aren't trimmed by `toConfig` today, so the
   two new fields aren't either — parity over new cleanup logic.
8. **Errors from a failed import are merged into the form's existing
   `errors` state** (not a separate UI): a raw "JSON illisible" parse
   failure stays local to the panel (it isn't a field error), but a
   schema validation failure is pushed up so the existing `StepNav`
   badges and existing per-field `<p>` messages just light up on whatever
   steps are wrong — reusing `issuesToErrors` from `validation.ts`
   verbatim, no new error-rendering code.

## Dependency
This worktree's spec depends on `QA1-P1-L1-lot-leger` (fixes B1, the
`node:crypto` crash that currently makes `/admin/products/new` unusable).
Do not start the TDD loop against a broken form; merge the integration
branch once L1 lands, or coordinate sequencing with the orchestrator. This
plan does **not** touch `validation.ts`'s or `form-values.ts`'s
`node:crypto` import — that's L1's fix, out of this Périmètre.

## Implementation Steps

### Phase 1: Step 3 — example output and "how it works" steps

1. **Add `exampleOutput` and `steps` to `LandingStep`**
   (File: `admin/products/_components/product-form/landing-step.tsx`)
   - Action: add a `Textarea` for "Exemple de résultat" (optional,
     `landing.exampleOutput`) below the SEO fields (or grouped with
     headline/subheadline — before FAQ, matching SA-01's content order:
     hero → example → how it works → …). Add a "Comment ça marche" list
     editor for `landing.steps` (`landing.steps ?? []`), one card per step
     with "Titre" (`Input`) and "Description" (`Textarea`), "Ajouter une
     étape" / "Supprimer cette étape" buttons (FAQ pattern) and
     "Monter"/"Descendre" buttons reusing `moveItem` from `./form-values`
     (`FieldsStep` pattern) — acceptance requires add, remove *and*
     reorder.
   - Why: the schema already carries these fields; only the form is
     missing them.
   - Dependencies: None.
   - Risk: Low. Test first: type into the exampleOutput field → `onChange`
     called with `{ exampleOutput: "…" }`; add/remove/reorder a step →
     `onChange` called with the expected `landing.steps` array.

2. **Render `landing.steps` in the live preview**
   (File: `admin/products/_components/product-form/landing-preview.tsx`)
   - Action: after the existing `exampleOutput` block, render an ordered
     list of `landing.steps` (title + description) when non-empty —
     `landing.exampleOutput` is already rendered today, only `steps` is
     missing.
   - Why: acceptance bullet "l'aperçu les montre".
   - Dependencies: Step 1 (same `landing` shape flows through unchanged).
   - Risk: Low. Test: pass a `landing` with `steps` → both titles and
     descriptions appear in the rendered preview.

### Phase 2: Step 5 — system prompt

3. **Add `systemPrompt` to `GenerationStep`**
   (File: `admin/products/_components/product-form/generation-step.tsx`)
   - Action: add a `Textarea` "Prompt système" (optional,
     `generation.systemPrompt`), placed above "Template de prompt" (the
     system prompt sets context before the per-generation template, per
     docs/05's `lib/ai/generate.ts` extract: `system` then `prompt`).
   - Why: schema already carries it; `ProductForm` already forwards any
     `GenerationPatch` to `draft.generation` unchanged, no plumbing needed
     elsewhere.
   - Dependencies: None.
   - Risk: Low. Test: type into the system prompt field → `onChange`
     called with `{ systemPrompt: "…" }`.

### Phase 3: Paste-a-config import (step 1)

4. **Pure import/validation logic**
   (File: `admin/products/_components/product-form/import-config.ts`, new)
   - Action: export
     `resolveImportedThemeId(candidate: unknown, themes: Theme[], fallbackThemeId: string): string`
     (id match → name match, case-insensitive, trimmed → fallback) and
     `parseImportedConfig(raw: string, themes: Theme[], fallbackThemeId: string): ImportResult`
     where
     `ImportResult = { ok: true; config: ProductConfig } | { ok: false; formError: string } | { ok: false; errors: Record<string, string> }`.
     Pipeline: `JSON.parse` (catch → `formError: "Configuration JSON illisible"`)
     → reject non-object candidates the same way → overwrite/insert
     `themeId` with `resolveImportedThemeId(...)` →
     `productConfigSchema.safeParse(candidate)` → success returns
     `{ ok: true, config }`; failure returns
     `{ ok: false, errors: issuesToErrors(result.error.issues) }` (import
     `issuesToErrors` from `./validation`, do not duplicate it).
   - Why: the pure, schema-driven core the panel and `product-form.tsx`
     both rely on; independently unit-testable.
   - Dependencies: None (only reads `validation.ts`'s existing export).
   - Risk: Medium — the theme-fallback branch is easy to get backwards
     (silently *keeping* an unmatched id instead of falling back). Tests
     first, one behavior at a time:
     - malformed JSON → `formError`.
     - `fixtures/bio-instagram.config.json` (no `themeId` at all) + a
       `themes` list + a `fallbackThemeId` → `ok: true`, `config.themeId
       === fallbackThemeId`, and `config.landing.exampleOutput` /
       `config.landing.steps` / `config.generation.systemPrompt` equal the
       fixture's values verbatim.
     - a candidate with `themeId` equal to an existing theme's real id →
       kept unchanged.
     - a candidate with `themeId: "Neon"` (a name, not a uuid) and a
       `themes` list containing a theme named "Neon" → resolves to that
       theme's id.
     - a candidate with `themeId: "unknown-theme"` matching neither an id
       nor a name → falls back to `fallbackThemeId`, `ok: true` (no
       `themeId` error).
     - a structurally invalid candidate (e.g. missing `landing.headline`)
       → `ok: false`, `errors["landing.headline"]` present, keyed exactly
       like `saveProduct`'s own errors (reuse `issuesToErrors`, so the
       message text matches what step 3 already renders).

5. **`fromConfig`: the inverse of `toConfig`**
   (File: `admin/products/_components/product-form/form-values.ts`)
   - Action: add
     `export function fromConfig(config: ProductConfig): ProductDraft`
     — the mirror of the existing `toConfig`: maps `config.inputs` to
     `FieldDraft[]` by adding a fresh `id: crypto.randomUUID()` per field
     (global `crypto`, not `node:crypto` — see decision 6). Everything
     else of `ProductConfig` passes through unchanged (draft and config
     share the same shape besides `inputs`).
   - Why: the import panel receives a validated `ProductConfig` from
     `parseImportedConfig`; `ProductForm`'s state is a `ProductDraft`
     (needs per-row client ids for `FieldsStep`'s `key`-based list).
   - Dependencies: None.
   - Risk: Low. Test: `fromConfig` on the bio-instagram fixture (parsed
     and merged with a valid `themeId` first) produces one `FieldDraft`
     per input, each with a non-empty `id`, and
     `toConfig(fromConfig(config))` deep-equals `config` (round trip,
     `inputs`' `id`s stripped by `toConfig` as already implemented).

6. **`ImportConfigPanel` component**
   (File: `admin/products/_components/product-form/import-config-panel.tsx`, new)
   - Action: a small `"use client"` leaf: a `Textarea` for pasting JSON,
     a "Importer" button, and inline feedback. On click: call
     `parseImportedConfig(raw, themes, currentThemeId)`.
     - `ok: true` → call `onImport(config)` prop, clear the textarea's
       local error, do **not** clear the pasted text itself (so the admin
       can re-read/re-paste); the panel itself does not toast — that's
       `ProductForm`'s job (single source of "success" feedback,
       consistent with `saveProduct`'s toast).
     - `ok: false, formError` → local `<p role="alert">` next to the
       button, `onImport`/`onErrors` not called.
     - `ok: false, errors` → call `onErrors(errors)` prop, no local
       message (the errors surface at their own steps).
   - Props: `{ themes: Theme[]; currentThemeId: string; onImport: (config: ProductConfig) => void; onErrors: (errors: Record<string, string>) => void }`.
   - Why: same "leaf receives callbacks, stays a plain controlled
     component in tests" pattern as `ThemeStep`.
   - Dependencies: Steps 4-5.
   - Risk: Low. Tests: paste malformed JSON → local error shown,
     `onImport`/`onErrors` not called; paste the bio-instagram fixture
     text → `onImport` called once with a `ProductConfig` whose
     `themeId === currentThemeId`; paste a candidate with a validation
     error → `onErrors` called with the expected error map.

7. **Wire the panel into `ProductForm`, step 1, create mode only**
   (File: `admin/products/_components/product-form/product-form.tsx`)
   - Action: inside the `currentStep === 1` `<Activity>` block, render
     `<ImportConfigPanel themes={themes} currentThemeId={draft.themeId} onImport={handleImport} onErrors={handleImportErrors} />`
     guarded by `mode === "create"` (decision 3). Add:
     ```ts
     function handleImport(config: ProductConfig) {
       setDraft(fromConfig(config));
       setSlugEdited(true);
       setErrors({});
       toast.success("Configuration importée");
       checkSlug(config.slug).then((result) => {
         if (!result.available) setErrors((current) => ({ ...current, slug: result.error ?? "Slug indisponible" }));
       });
     }
     function handleImportErrors(errors: Record<string, string>) {
       setErrors((current) => ({ ...current, ...errors }));
       toast.error("Configuration importée avec des erreurs à corriger");
     }
     ```
   - Why: reuses the exact slug-availability check `handleIdentityChange`
     already runs for a manually-typed slug (decision: an imported slug is
     as "explicit" as a typed one), and the exact `errors` state that
     already drives `StepNav`'s badges and every step's inline messages —
     zero new error-rendering code (decision 8).
   - Dependencies: Steps 4-6.
   - Risk: Medium — `setErrors({})` before the async `checkSlug` resolves
     could race with `handleImportErrors` if a slug check and a schema
     error both land; low practical risk (import is a single synchronous
     `parseImportedConfig` call, only one of `onImport`/`onErrors` ever
     fires per click) but call this out in review.

### Phase 4: Integration coverage

8. **`product-form.test.tsx`: end-to-end import scenario**
   (File: `admin/products/_components/product-form/product-form.test.tsx`)
   - Action: render `ProductForm` in create mode with the themes fixture
     already in the file; paste the bio-instagram fixture's JSON (inline
     the object, or `import` the committed
     `fixtures/bio-instagram.config.json` directly — it's already
     committed per CLAUDE.md) into the import panel, click "Importer";
     assert: step 3's "Exemple de résultat" field and "Comment ça marche"
     entries show the fixture's values; step 5's "Prompt système" field
     shows the fixture's `systemPrompt`; theme stays the mocked
     `themeOptions[0]` (fixture has no `themeId`); no step shows an error
     badge; `checkSlug` was called with the fixture's slug.
   - Why: the acceptance bullet is explicitly about *this* fixture filling
     *every* step, not just the pure-function layer.
   - Dependencies: Steps 1-7.
   - Risk: Low.

9. **E2E: paste, walk the steps, publish, check the landing**
   (File: `e2e/product-form.spec.ts`, extends the existing spec)
   - Action: new `test(...)` (or extend the existing one, whichever keeps
     it under one behavior per test per CLAUDE.md's TDD granularity):
     sign in, go to `/admin/products/new`, paste the bio-instagram fixture
     content (with the slug replaced by a fresh unique one, to avoid a
     collision with any seeded/leftover `bio-instagram`) into the import
     textarea, click "Importer", confirm step 3 and step 5 fields are
     populated, pick a theme on step 2 (still a deliberate action per
     decision 2), walk to step 7 and "Publier", then `page.goto` the
     published `/{slug}` landing and assert the example output text and
     at least one "how it works" step title are visible in the rendered
     HTML (SA-01 already renders both — this is a regression guard that
     the import → publish path actually reaches the landing, not a new
     landing feature).
   - Why: acceptance bullet 4 ("Un produit créé ainsi a sur sa landing
     l'exemple et « comment ça marche »"), and it's the two-minute demo
     moment (docs/01) this whole fixture exists for.
   - Dependencies: Steps 1-7; this file is not run by `tdd-guide`'s loop
     (CLAUDE.md: E2E phase only) — write it, don't run it as part of TDD.
   - Risk: Low.

## Testing Strategy
- Unit tests (Vitest, colocated): `import-config.test.ts` (new),
  `form-values.test.ts` (extended: `fromConfig` + round trip),
  `landing-step.test.tsx` (extended: exampleOutput, steps add/remove/
  reorder), `generation-step.test.tsx` (extended: systemPrompt),
  `landing-preview.test.tsx` (extended: steps rendering),
  `import-config-panel.test.tsx` (new).
- Integration test: `product-form.test.tsx`, the full paste → every step
  populated → no error badges scenario (step 8 above).
- E2E: `e2e/product-form.spec.ts`, paste → publish → landing shows the
  example and steps (step 9 above; written now, run in the E2E phase).

## Risks & Mitigations
- **B1 dependency**: this spec's Périmètre is unusable until
  `QA1-P1-L1-lot-leger` lands (the form crashes at all today). Mitigation:
  declared as `Dépend de` in the spec; sequence the worktree's start
  accordingly, or write/run unit tests (which don't need the running form)
  first and hold the component-integration/E2E tests until L1 is merged in.
- **Silent theme fallback could surprise an admin** pasting a config that
  *did* intend a specific theme but mistyped its name. Mitigation: out of
  this spec's acceptance (which only requires id-or-name matching, no
  error UX for a total miss); note as a candidate follow-up, not a blocker.
- **`crypto.randomUUID()` vs `node:crypto`'s `randomUUID`**: easy to
  reintroduce the exact bug L1 is fixing in a new file. Mitigation:
  explicit review checklist item; `fields-step.tsx` is the copy-paste
  source of truth for the global form.
- **Import panel scope creep into edit mode**: tempting to "just also"
  support import on `/admin/products/[slug]/edit`. Mitigation: explicitly
  out of scope (decision 3); the spec's acceptance and the QA fixture only
  exercise create mode.

## Success Criteria
- [ ] Step 3 has working exampleOutput + steps (add/remove/reorder) fields
- [ ] Step 5 has a working systemPrompt field
- [ ] The live preview renders both exampleOutput and steps
- [ ] Pasting `fixtures/bio-instagram.config.json` in create mode fills
      every step with zero validation errors, theme unchanged (fallback)
- [ ] A pasted config with an unresolvable structural error surfaces its
      errors on the right steps (existing `StepNav` badges + inline
      messages), without a separate error UI
- [ ] A pasted `themeId` that matches an existing theme's name (not its
      id) resolves to that theme
- [ ] `e2e/product-form.spec.ts` confirms the imported/published product's
      landing shows the example output and at least one "how it works"
      step
- [ ] `pnpm check` passes, coverage 80%+ on `lib/**` (this spec touches no
      `lib/**` file — `lib/schemas/product-config.ts` stays frozen)
