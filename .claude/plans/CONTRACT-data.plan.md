# Plan: CONTRACT-data · Schéma, DAL en stubs, seed minimal

**Source spec**: specs/CONTRACT-data.md
**Complexity**: Large (9 new tables + reused `users`, 2 new migrations from SETUP's 0000, 12 DAL modules turned into real
code or constant stubs, `resolveModel` + fixture, idempotent seed; no UI)

## Summary

Replace SETUP's minimal `products` table with the full data model of docs/07 (9 new business tables; SETUP's `users` is
the tenth), through two new migrations generated from the state 0000 already applied on `integration/v1`. Give every
frozen DAL signature a body: real where docs/11 says "Réel" or the spec asks for it (`getProduct` widened to
`Product | null`, `listProducts`, `getTheme`, `getThresholds`, `getLatestMagicLink`), a constant or "insertion simple"
stub otherwise. Add `lib/ai/model.ts` (`resolveModel`, mock replays `fixtures/lettre-pro.json` as a stream) and make
`pnpm db:seed` idempotent: 4 themes, LettrePro, admin, owner, default thresholds.

`lib/dal/stubs.test.ts` is deleted in one explicit commit, replaced by two layers: permanent contract tests
(`lib/dal/contract.test.ts`, kept + one extra pin, and a new `lib/dal/contract-shape.test.ts` checking the response
shape of every function, which any real implementation must pass) and colocated value tests per module.

## Orchestrator decisions (binding for this spec)

1. **Files outside the literal Périmètre, accepted:** `package.json` / `pnpm-lock.yaml` (`pnpm add ai`, bullet 5),
   the colocated tests of Périmètre files (`scripts/seed.test.ts`, `lib/ai/model.test.ts`, `lib/security.test.ts`,
   every `lib/dal/*.test.ts`), and `e2e/skeleton.spec.ts` + `README.md` where they reference `/demo` (point them at
   `/lettre-pro` → "LettrePro", since this spec's migration removes the placeholder row). One commit each, listed in the
   PR body. Run rule from now on: the colocated `*.test.ts` of a Périmètre file is in Périmètre.
2. **`thresholdsInputSchema.minVisits`:** this is a CONTRACT spec, so align the frozen input schema with the DB
   invariant here: `z.int().min(1)` in `lib/schemas/inputs.ts`, test-first, explicit commit citing docs/07
   (`min_visits > 0`). Nothing else in `lib/schemas/**` changes.
3. **`debit` stub** returns `{ ok: true, balance: 10 }` (the spec's `{ ok: true }` alone is not a valid `DebitResult`;
   docs/11's fixed balance of 10 wins).
4. **Theme font keys** (shared with CONTRACT-ui's `lib/fonts.ts`, running in parallel): `serif` (editorial),
   `grotesk` (neon), `sans` (corporate), `rounded` (playful). The orchestrator relays them to CONTRACT-ui.
5. **Fixtures registry:** unknown slug falls back to LettrePro in mock mode; DEMO-mode will need `lib/ai/model.ts` for
   its other fixtures — the orchestrator tracks it.
6. Local Postgres is 16.13: `UNIQUE NULLS NOT DISTINCT` is available.

## Frozen inputs (not changed here)

- Every signature pinned by `lib/dal/contract.test.ts`; signatures stay byte-identical, only bodies change.
- `lib/schemas/**`, except decision 2. Enums are built from `eventTypeSchema.options`, `productStatusSchema.options`,
  `landingVariantSchema.options`, so DB and Zod cannot drift.
- `lib/db/auth-schema.ts` (Better Auth tables, `user_role`, `magic_link_outbox`): used as-is. `users` is table 10.
- `drizzle/0000_petite_tarantula.sql` and `drizzle/meta/0000_snapshot.json`: never rewritten.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| DAL module header | `lib/dal/products.ts:1-12`, `lib/dal/session.ts:7-9` | `import "server-only";` line 1, double quotes, semicolons, the `// Frozen contract (specs/CONTRACT-types.md): …` comment kept above each signature. |
| Typed const stubs | `lib/dal/credits.ts:33-68` | `export const fn: (…) => Promise<…> = async (…) => { … }`; declared type byte-identical. |
| Cached public read | `lib/dal/products.ts:22-28` | `"use cache"`, `cacheLife("max")`, `cacheTag(...)`, comment on why no session check (public data; cookies/headers not allowed in `'use cache'`, docs/04). |
| Errors as values | docs/07 debit excerpt | Expected refusal = union member; a real DB error or corrupt config throws, never swallowed. |
| Drizzle tables | `lib/db/auth-schema.ts:67-74` | `pgTable("snake_name", { camel: type("snake_col") })`; business timestamps `timestamp(…, { withTimezone: true }).notNull().defaultNow()`; no `server-only` in `lib/db/schema.ts`; **relative** imports (drizzle-kit does not resolve `@/`). |
| Scripts | `scripts/seed.ts:8-32, 60-76` | Own `postgres` client from `requireDatabaseUrl()`, relative imports, never `lib/db/index.ts` or `lib/env.ts`, `isEntry()` guard, exported constants reused by the test. |
| DB tests | `lib/dal/products.test.ts:1-11`, `scripts/seed.test.ts:10-20` | Colocated, `vi.mock("next/cache", …)`, `await import(...)` inside `it`, real worktree Postgres, `randomUUID()` for created rows, cleanup in `afterAll`/`finally`. |
| Env | `lib/env.ts:26` | Read `env.AI_MODE`; tests switch with `vi.stubEnv` + `vi.resetModules()` + dynamic import. |

## Data model (`lib/db/schema.ts`)

| Table | Columns / constraints (docs/07) | Indexes |
|---|---|---|
| `users` | reused from `auth-schema.ts` | — |
| `themes` | `id` uuid PK; `slug` unique notNull; `name` notNull; `tokens` jsonb notNull `$type<ThemeTokens>`; `landing_variant` pgEnum notNull; `is_seed` default false; `updated_at` tz | — |
| `products` | `id` uuid PK; `slug` unique + `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`; `status` pgEnum `product_status` default `test`; `theme_id` FK themes notNull; `current_version` int notNull `CHECK >= 1`; `locale` notNull `CHECK IN ('fr','en')`; `is_seed` default false; `created_by` FK users notNull; `status_note` text; `created_at`, `updated_at` tz. **`name` dropped** (lives in the config) | `slug` unique |
| `product_versions` | PK (`product_id`, `version`); `product_id` FK; `version` `CHECK >= 1`; `config` jsonb notNull `$type<ProductConfig>`; `created_by` FK users notNull; `created_at` | PK |
| `credit_transactions` | `id` uuid PK; `user_id` FK; `product_id` FK; `delta` int `CHECK <> 0`; `reason` pgEnum `credit_reason` (`signup_bonus`,`purchase`,`generation`,`refund`); `generation_id` FK nullable; `purchase_id` FK nullable; `idempotency_key` unique notNull; `created_at` | (`user_id`,`product_id`,`created_at`) |
| `balances` | PK (`user_id`,`product_id`), both FK; `balance` int default 0 `CHECK (balance >= 0)`; `updated_at` | PK |
| `generations` | `id` uuid PK; `product_id` notNull; `product_version` notNull; named composite FK `generations_product_version_fk` (`product_id`,`product_version`) → product_versions; `user_id` FK nullable; `anonymous_id`; `ip_hash` notNull; `input` jsonb notNull; `output` jsonb; `model`; `input_tokens`, `output_tokens`, `cached_input_tokens`, `cost_micros` int; `status` pgEnum `generation_status` default `pending`; `idempotency_key` unique notNull; `created_at` | (`user_id`,`created_at`), (`ip_hash`,`created_at`), (`product_id`,`created_at`) |
| `purchases` | `id` uuid PK; `user_id`, `product_id` FK; `pack_id` notNull; `credits` `CHECK > 0`; `amount_cents` `CHECK > 0`; `currency` default `'EUR'`; `idempotency_key` unique notNull; `created_at` | — |
| `events` | `id` bigint identity PK; `product_id` FK; `type` pgEnum `event_type`; `user_id` text nullable (no FK, docs/07); `anonymous_id`; `metadata` jsonb; `created_at` | (`product_id`,`type`,`created_at`) |
| `decision_thresholds` | `id` uuid PK; `product_id` FK nullable, named `unique().nullsNotDistinct()`; `min_visits` `CHECK > 0`; `kill_max_conversion`, `scale_min_conversion` `numeric(5,4)` `mode: "number"`, `CHECK BETWEEN 0 AND 1`; `CHECK (kill < scale)`; `scale_requires_positive_margin` boolean; `is_seed`; `updated_by` FK users nullable; `updated_at`. Override columns nullable (null = default) + `CHECK (product_id IS NOT NULL OR all 4 values NOT NULL)` | unique |

No FK from `products.current_version` to `product_versions` (circular insert; comment). No cascades (DEMO-mode's reset
deletes in order).

## Files to Change

| File | Action | Why |
|---|---|---|
| `lib/db/schema.ts` + `schema.test.ts` | UPDATE / CREATE | Bullet 1 |
| `drizzle/0001_drop_skeleton_product.sql` + snapshot + journal | CREATE (generated, 1 statement prepended) | `DELETE FROM "products";` then `DROP COLUMN "name"` |
| `drizzle/0002_full_data_model.sql` + snapshot + journal | CREATE (generated) | Bullet 1 |
| `lib/dal/stubs.test.ts` | DELETE (one commit, message says why) | Replaced by the two layers |
| `lib/dal/contract-shape.test.ts` | CREATE | Bullet 4 |
| `lib/dal/contract.test.ts` | UPDATE (additive) | Pin `getProduct(slug): Promise<Product \| null>` |
| `lib/dal/products.ts` + test | UPDATE | Bullet 2; `getProduct` widened, `listProducts` real; test moves `demo` → `lettre-pro` (explicit commit) |
| `lib/dal/themes.ts` + test | UPDATE / CREATE | `getTheme` real |
| `lib/dal/thresholds.ts` + test | UPDATE / CREATE | `getThresholds` real, merged, tag `thresholds` |
| `lib/dal/magic-link.ts` + test | UPDATE / CREATE | Real read over `magic_link_outbox` |
| `lib/dal/{credits,events,metrics,product-editor,product-status,generations,guards}.ts` + tests | UPDATE / CREATE | Bullet 3 |
| `lib/security.ts` + `lib/security.test.ts` | UPDATE / CREATE | Bullet 3 (`{ ok: true }`) |
| `lib/ai/model.ts` + `model.test.ts` | CREATE | Bullet 5 |
| `fixtures/lettre-pro.json`, `fixtures/lettre-pro.config.json` | CREATE | Bullets 5, 6 |
| `scripts/seed.ts` + `seed.test.ts` | UPDATE | Bullet 6 (test in an explicit commit) |
| `lib/schemas/inputs.ts` + test | UPDATE | Decision 2 (`minVisits` ≥ 1) |
| `e2e/skeleton.spec.ts`, `README.md` | UPDATE | Decision 1 (`/demo` → `/lettre-pro`) |
| `package.json`, `pnpm-lock.yaml` | UPDATE | `pnpm add ai` |

## Tasks

Each task: red → green, commit and push (`feat(db): …`, `test(db): …`). `pnpm vitest run <file>` directly;
`pnpm exec knip` after every green step.

### Task 1: schema constraint tests (bullet 1, red)
`lib/db/schema.test.ts` (imports `db` from `@/lib/db` and every table from `./schema`): `pg_indexes` has the 5 docs/07
indexes and the unique keys; each constraint rejects a bad insert (`rejects.toThrow(/violates/)`): `balance = -1`,
`delta = 0`, duplicate `idempotency_key` on credit_transactions / generations / purchases, generation on
`(lettre-pro, 99)` (composite FK), `purchases.credits = 0` and `amount_cents = 0`, second default thresholds row,
`kill >= scale`, conversion `1.5`, `min_visits = 0`, default row with a null column, `products.slug = 'Bad Slug'`,
`locale = 'de'`. Setup rows from the seed or created with `randomUUID()` and deleted in `afterAll`.

### Task 2: schema + migrations (bullet 1, green)
1. Remove only `name` from `products`; `pnpm db:generate --name drop_skeleton_product`; prepend
   `DELETE FROM "products";--> statement-breakpoint` with a SQL comment (SETUP placeholder row; nothing references
   products yet; NOT NULL columns of 0002 need an empty table). Separate generation: dropping + adding in one run
   triggers drizzle-kit's interactive rename prompt, which fails without a TTY.
2. Full table set; pgEnums from Zod `.options`; `check(...)` / `index(...)` / `unique().nullsNotDistinct()` / named
   `foreignKey(...)` in the third `pgTable` argument; `.$type<>()` on jsonb. `pnpm db:generate --name full_data_model`.
3. `pnpm db:migrate`, `pnpm exec drizzle-kit check`,
   `git diff --exit-code origin/integration/v1 -- drizzle/0000_petite_tarantula.sql drizzle/meta/0000_snapshot.json`.
Fallback if generation must be redone: delete the generated file, `pnpm tsx scripts/worktree-db.ts drop`, then
`ensure --seed`. Name long constraints explicitly (63-char limit).

### Task 3: idempotent seed (bullet 6)
- **Test first** (`scripts/seed.test.ts`, explicit commit: the test follows the full data model; SETUP's `demo`
  placeholder is replaced by LettrePro). After `seed()` twice: exactly 4 `is_seed` themes
  `editorial|neon|corporate|playful`, each `themeTokensSchema`-valid; one `lettre-pro` product (`scale`, `is_seed`,
  `current_version 1`, editorial, `fr`) and one version whose config passes `productConfigSchema`; one admin and one
  owner, each with one credential account; exactly one default thresholds row `(1000, 0.02, 0.05, true, is_seed)`;
  no `demo` product.
- **Action**: `SEED_THEMES` (light + dark tokens, `fontKey` per decision 4, `radius`, variant: editorial serif paper
  tones `centered`; neon dark vivid `split`; corporate blue sans `minimal`; playful pastel rounded `centered`), upsert by
  slug. `SEED_OWNER = { email: "owner@msb.local", password: <dev constant> }`, role `owner`. LettrePro: read
  `fixtures/lettre-pro.config.json`, `productConfigSchema.parse({ ...json, themeId: editorialId })`, insert product
  (`onConflictDoNothing(slug)`), select id, insert version 1 (`onConflictDoNothing` on the PK, `created_by` = owner).
  Thresholds `onConflictDoNothing`. One `db.transaction`. Config: inputs `poste`, `entreprise`, `experience`
  (textarea), `ton` (select `formel|dynamique`); model `anthropic/claude-haiku-4.5`, output `markdown`; pricing 3 / 1 /
  1, packs `pack-10` (10, 490) and `pack-50` (50, 1490, recommended); landing headline, subheadline, FAQ ×3, steps,
  `exampleOutput`, SEO ≤ 60/160.
- **Validate**: `pnpm vitest run scripts/seed.test.ts lib/db/schema.test.ts`, then `pnpm db:seed` twice.

### Task 4: `getProduct` widened (bullet 2)
- **Test first** (`products.test.ts`, explicit commit): `getProduct("lettre-pro")` matches `{ slug, name: "LettrePro",
  status: "scale", locale: "fr", version: 1, isSeed: true }`, `pricing.packs` length 2, config part passes
  `productConfigSchema`; `getProduct("inconnu")` → `null`; tag `product:lettre-pro`; `listProductSlugs()` contains
  `lettre-pro`. `contract.test.ts`: `expectTypeOf(getProduct).returns.resolves.toEqualTypeOf<Product | null>()`.
- **Action**: join `products` × `product_versions` on `(id, current_version)`, private `toProduct(row, version)`:
  `productConfigSchema.parse({ ...version.config, slug, status, themeId, locale })` (live row wins) + `{ id, version,
  isSeed }`. Corrupt config throws. Annotate `Promise<Product | null>`.

### Task 5: `listProducts`, `getTheme` real
`listProducts()` contains LettrePro, tag `products` + `cacheLife("max")`. `getTheme(editorialId)` → valid `Theme`, tag
`theme:{id}`; unknown uuid → `null`; non-uuid → `null` without DB error (`z.uuid().safeParse` guard); tokens parsed with
`themeTokensSchema`.

### Task 6: `getThresholds` real (bullet 3)
Default only → `{ 1000, 0.02, 0.05, true }`; override row with only `killMaxConversion = 0.01` → merged; unknown product
→ defaults; `cacheTag("thresholds")`, `cacheLife("max")`; default row missing → throws `default thresholds missing`
(rolled-back transaction or mocked query). One query `WHERE product_id IS NULL OR product_id = $1`, field-by-field `??`
merge; comment on the missing session check (cached, non-sensitive, callers behind `requireAdmin`).

### Task 7: `getLatestMagicLink` real
Two outbox rows for `visitor-<uuid>@example.com` → returns the newer `{ url, createdAt: Date }`; mixed-case email →
same; unknown → `null`. `WHERE lower(email) = lower($1) ORDER BY created_at DESC LIMIT 1`. Keep the header comment.

### Task 8: contract-shape tests + delete stubs.test.ts (bullet 4)
- `lib/dal/contract-shape.test.ts`: mock `./session` (seeded owner session) and `next/cache`; call every frozen
  function with seeded data and validate the result against local Zod shape schemas (`DebitResult` union;
  `{ balance: int ≥ 0 }`; `number ≥ 0`; `void`; `{ id: uuid }`; `Funnel` with 5 ordered steps, rates `null` or `≥ 0`,
  `daily.length ≤ days`; `PortfolioMetrics`; `Thresholds` in `[0,1]` with `kill < scale`; `Theme | null`,
  `Product | null`; `GuardResult`; `isEditable` boolean; `assertEditable` undefined for a non-seed row). **No
  stub-specific constant asserted**: LEDGER, TRACKING, SECURITY and the others must pass it unchanged. Cleanup in
  `afterAll`.
- Then its own commit: `git rm lib/dal/stubs.test.ts` — "test(db): remove temporary stubs.test.ts; every stub now has a
  body; its 'not implemented' assertions are superseded by contract-shape.test.ts (permanent shape) and colocated value
  tests".

### Task 9: constant stubs (bullet 3)
- `credits.test.ts`: `getBalance` → 10; `debit` → `{ ok: true, balance: 10 }`; `purchase` → `{ balance: 20 }`;
  `refund` → `undefined`; `grantSignupBonus` → `{ balance: 10 }`. `STUB_BALANCE = 10` with "replaced by LEDGER".
- `events.test.ts`: `track` resolves `undefined` and writes nothing.
- `metrics.test.ts`: fixed, internally consistent LettrePro numbers (4 200 visits → 1 260 first generations → 520
  signups → 180 credits exhausted → 36 purchases; 2 900 generations; 29 640 cents; 4 000 micros per generation);
  steps equal metrics, rates computed, totals = sum over products, 30 daily points, `getFunnel` echoes `productId`;
  one private builder.
- `guards.test.ts`: `isEditable({ isSeed: true })` → `true`; `assertEditable` does not throw.
- `lib/security.test.ts`: `guardRequest(kind)` → `{ ok: true }` for the 4 kinds.

### Task 10: simple-insertion stubs (bullet 3)
- `createProduct` (admin session mocked): `requireAdmin()`, `productConfigSchema.parse`, one transaction inserting
  product + version 1 with `created_by` = session user → `{ id, slug, version: 1 }`; non-admin → redirect.
- `updateStatus`: `requireAdmin()` + `UPDATE` (`status`, `status_note`, `updated_at`).
- `recordGeneration`: `onConflictDoNothing(idempotencyKey)` then select by key (replay → same id, one row); a `userId`
  that does not match `getSession()` → throws. `saveGeneration` → `succeeded` + tokens, cost, model;
  `markGenerationFailed` → `failed`.
- No `updateTag` in the DAL (the calling actions do it, docs/04). Cleanup of created rows.

### Task 11: `resolveModel` (bullet 5)
- Precondition, own commit: `pnpm add ai` (`chore(ai): add AI SDK for resolveModel mock`). Read the installed typings
  (`MockLanguageModelV*` from `ai/test`, `simulateReadableStream`, stream-part and `usage` shapes) before writing.
- **Test first** (`lib/ai/model.test.ts`): with `AI_MODE=mock`, `streamText({ model: resolveModel(
  "anthropic/claude-haiku-4.5", "lettre-pro"), prompt: "x" })` yields more than one text chunk whose concatenation
  equals the first fixture's `text`, and `usage` carries its tokens; `generateText` returns the full text; unknown slug
  still streams (LettrePro fallback); `AI_MODE=live` returns the model id unchanged; signature pinned
  `[modelId: string, slug: string]`, return type `LanguageModel`.
- **Action**: `lib/ai/model.ts` (`import "server-only"`), static JSON import of `fixtures/lettre-pro.json` validated by
  a local fixture schema, `FIXTURES` map by slug, mock model with `doStream` (chunks of ~5 words, short delay) and
  `doGenerate`; reads `env.AI_MODE`. `fixtures/lettre-pro.json`: 5 realistic hand-written generations
  `{ input, text, usage }`.

### Task 12: decision 1 and 2 follow-ups
- `lib/schemas/inputs.ts`: `minVisits` → `z.int().min(1)`, test (0 rejected, 1 accepted), explicit commit.
- `e2e/skeleton.spec.ts` and `README.md`: `/demo` → `/lettre-pro` ("LettrePro"); do not run Playwright.

### Task 13: full validation
`pnpm exec drizzle-kit check`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`, `pnpm test:coverage`
(80 %+ on `lib/**`), `pnpm check`, then drop the worktree DB and `pnpm tsx scripts/worktree-db.ts ensure --seed` to
prove 0000 → 0001 → 0002 → seed from scratch, and `pnpm build`. Fix in code, never in protected configs.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Migration from 0000 with an existing `demo` row: NOT NULL columns fail on a non-empty table | Certain | 0001 deletes the placeholder row first, then drops `name`; works on every worktree DB. |
| drizzle-kit interactive rename prompt without a TTY | High | Two generations; fallback drop + regenerate. |
| Constraint / FK names over 63 characters | Medium | Explicit names. |
| `numeric(5,4)` returned as a string | Medium | `mode: "number"`; tests assert `typeof === "number"`. |
| drizzle-kit does not resolve `@/` in `schema.ts` | High | Relative imports only. |
| Cached reads cannot check the session | Certain | Documented on `getProduct`, `listProducts`, `getTheme`, `getThresholds`; write stubs and `recordGeneration` check it. |
| CONTRACT-ui in parallel: its layout needs real `getTheme`, its Playwright test this seed, its font catalogue these keys | Medium | Decision 4; merge CONTRACT-data first. |
| AI SDK API from memory | High | Read installed typings first; report rather than patch config if `ai/test` leaks into the server bundle. |
| Parallel test files share the worktree DB | Medium | Random slugs/keys/emails, cleanup, no global counts except on seed-owned rows. |
| knip on new exports | Medium | Tables imported by `schema.test.ts`; export only what tests use; `pnpm exec knip` after each step. |
| Seeded owner password is a dev constant | Medium | Same caveat as SETUP; DEMO-mode owns real secrets. |

## Acceptance

- [ ] Bullet 1: `schema.test.ts`; 0001 and 0002 generated, 0000 untouched; `drizzle-kit check` green; fresh DB migrates
      and seeds from scratch.
- [ ] Bullet 2: `products.test.ts` (`lettre-pro` → `Product`, `inconnu` → `null`); `Promise<Product | null>` pinned.
- [ ] Bullet 3: colocated value tests (credits, events, metrics, generations, product-editor, product-status, guards,
      security) and `thresholds.test.ts`.
- [ ] Bullet 4: `contract-shape.test.ts`, `stubs.test.ts` deleted in one explicit commit, `contract.test.ts` kept.
- [ ] Bullet 5: `lib/ai/model.test.ts`.
- [ ] Bullet 6: `scripts/seed.test.ts` (run twice).
- [ ] `getLatestMagicLink` real; decisions 1-2 applied.
- [ ] `pnpm check` green, coverage 80 %+ on `lib/**`, `pnpm build` green; no protected config edited.
- [ ] PR title: `feat(db): CONTRACT-data full schema, DAL stubs and seed`.
