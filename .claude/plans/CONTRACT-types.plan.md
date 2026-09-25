# Plan: CONTRACT-types · Types et signatures figés

**Source spec**: specs/CONTRACT-types.md
**Complexity**: Medium (4 Zod schema files with real logic, input schemas, 11 DAL modules plus `lib/security.ts` as
typed stubs, no database, no UI)

## Summary

This spec freezes the V1 contracts that every later spec consumes:

- **Zod schemas** in `lib/schemas/`: `productConfig`, `themeTokens`, `eventType`, `pack`, their inferred types, and
  the input schemas of later Server Actions and Route Handlers (orchestrator decision 2). These are real code.
  `productConfig` rejects a `{{x}}` with no matching field and the reserved slugs `admin` and `api`.
- **DAL signatures** for every row of the contract table (docs/11), plus `assertEditable` / `isEditable`,
  `guardRequest(kind)` and the magic-link read (orchestrator decision 1). Each is a typed stub whose body is
  `throw new Error("not implemented")`.

The real functions SETUP shipped (`getSession`, `requireAdmin`, `getProduct(slug)`, `listProductSlugs`) keep their
bodies and their tests. This spec only adds exports next to them.

Two test files keep knip and the 80 % coverage on `lib/**` green without weakening any later test: a permanent
signature test (`expectTypeOf`) and a temporary stub test, which CONTRACT-data deletes in one explicit commit.

## Orchestrator decisions (binding for this spec)

1. **Magic-link read for SA-03.** SA-03 has no `lib/dal` file in its Périmètre and must show the simulated inbox
   (docs/08: "Après « Recevoir mon lien », une modale « Boîte de réception (démo) » s'ouvre et affiche l'email").
   This CONTRACT spec freezes it: `lib/dal/magic-link.ts`, stub
   `getLatestMagicLink(email: string): Promise<{ url: string; createdAt: Date } | null>`, with a header comment:
   called only by the SA-03 signup action, right after `signInMagicLink` for that same email, in the same request;
   admin and owner emails never have a row (SETUP's `sendMagicLink`); showing the link to whoever typed the email is
   the dossier's accepted demo design (docs/08), throttled by `guardRequest("signup")`. CONTRACT-data implements it.
   Add it to `contract.test.ts` and `stubs.test.ts`.
2. **Input schemas of later actions and routes.** CLAUDE.md requires every Server Action and Route Handler to parse
   its input with a shared Zod schema from `lib/schemas/`, and no later spec has `lib/schemas` in its Périmètre.
   Freeze them here, in `lib/schemas/inputs.ts`, each with its inferred type and a test (valid input parses, one
   invalid case rejected), built from the frozen building blocks:
   - `generateInputSchema`: `{ input: z.record(z.string(), z.string().max(5000)), idempotencyKey: z.uuid() }` (SA-02;
     the per-field check against `config.inputs` happens in the route, from the product config);
   - `signupInputSchema`: `{ email: z.email() }` (SA-03);
   - `purchaseInputSchema`: `{ packId: packSchema.shape.id, idempotencyKey: z.uuid() }` (SA-05);
   - `trackEventInputSchema`: `{ type: eventTypeSchema, anonymousId: z.uuid(), metadata? }` (TRACKING beacon; the
     product comes from the route's `[app]`);
   - `statusChangeInputSchema`: `{ status: productStatusSchema, note: z.string().max(500).nullable() }` (BO-06);
   - `thresholdsInputSchema`: the `Thresholds` fields with bounds (`minVisits` int ≥ 0, rates 0..1) (BO-09).
   BO-05 uses `productConfigSchema` itself. Nothing else is added "for later".
3. **Optional config fields.** Freeze `landing.exampleOutput`, `landing.steps`, `generation.systemPrompt`,
   `generation.fallbackModels` as optional. No structured-output descriptor.
4. The † divergences below are accepted; list each one in the PR body.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming / style | `lib/dal/products.ts:1-15` | Double quotes, semicolons, `import "server-only";` on line 1, a short comment explaining any exception to the DAL rules. Files in kebab-case. |
| Frozen-contract marker | `lib/dal/session.ts:7-9` | A header comment `// Frozen contract (specs/CONTRACT-types.md): …` above the exported types and signatures. |
| Zod schemas | `lib/schemas/admin-login.ts:1-6` | `export const <name>Schema = z.object({...})`, Zod 4 top-level helpers (`z.email()`, `z.url()`, `z.uuid()`, `z.int()`). Schema files never import `server-only` or `lib/dal` (client forms import them). |
| Errors as values | `docs/07-modele-de-donnees.md` (debit excerpt) | An expected refusal is a union member (`{ ok: false; reason: … }`), never an exception. |
| Tests | `lib/dal/products.test.ts:1-15`, `vitest.setup.ts:5` | Colocated `*.test.ts`, `await import("./module")` inside `it`, `server-only` already mocked globally, `describe` per function. |
| Test runner | `vitest.config.mts` | Node env, `.env.local` loaded, coverage on `lib/**` at 80 %. |

No DAL stub exists yet. This PR sets the stub pattern (see Task 8).

## Frozen signatures (the contract this PR writes)

Each argument or return type below matches the dossier unless marked with a † (a divergence, explained under Risks).

```ts
// lib/schemas/pack.ts
export const packSchema;            // { id: kebab slug, credits: int > 0, priceCents: int > 0, recommended?: boolean }
export type Pack = z.infer<typeof packSchema>;

// lib/schemas/event-type.ts
export const eventTypeSchema;       // z.enum(["visit","first_generation","signup","generation","credits_exhausted","purchase"])
export type EventType = z.infer<typeof eventTypeSchema>;

// lib/schemas/theme-tokens.ts
export const themeTokensSchema;     // { light: ColorTokens, dark: ColorTokens, fontKey: string, radius: css length }
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export const landingVariantSchema;  // z.enum(["centered","split","minimal"])
export type LandingVariant = z.infer<typeof landingVariantSchema>;

// lib/schemas/product-config.ts
export const RESERVED_SLUGS;        // ["admin", "api"] as const
export const slugSchema, productStatusSchema /* test|learn|scale|killed */, localeSchema /* fr|en */, inputFieldSchema;
export function templateVariables(template: string): string[];
export const productConfigSchema;   // docs/01 shape, refined (see Tasks 4-7)
export type ProductConfig = z.infer<typeof productConfigSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;

// lib/schemas/inputs.ts (orchestrator decision 2)
export const generateInputSchema, signupInputSchema, purchaseInputSchema, trackEventInputSchema,
  statusChangeInputSchema, thresholdsInputSchema; // + their z.infer types

// lib/dal/products.ts (existing getProduct / listProductSlugs untouched)
export type Product = ProductConfig & { id: string; version: number; isSeed: boolean };
export const listProducts: () => Promise<Product[]>;

// lib/dal/themes.ts   († not in the contract table; named in docs/04)
export type Theme = { id: string; slug: string; name: string; tokens: ThemeTokens; landingVariant: LandingVariant; isSeed: boolean };
export const getTheme: (id: string) => Promise<Theme | null>;

// lib/dal/credits.ts
export type Debit = { userId: string; productId: string; cost: number; generationId: string; idempotencyKey: string }; // † key -> idempotencyKey
export type DebitResult = { ok: true; balance: number } | { ok: true; replay: true } | { ok: false; reason: "insufficient_balance" };
export type Purchase = { userId: string; productId: string; packId: string; idempotencyKey: string };
export const getBalance: (userId: string, productId: string) => Promise<number>;
export const debit: (args: Debit) => Promise<DebitResult>;
export const refund: (generationId: string) => Promise<void>;                        // docs/05; key derived from generationId
export const grantSignupBonus: (args: { userId: string; productId: string }) => Promise<{ balance: number }>;
export const purchase: (args: Purchase) => Promise<{ balance: number }>;

// lib/dal/generations.ts
export type NewGeneration = { productId: string; productVersion: number; userId: string | null; anonymousId: string | null;
  ipHash: string; input: Record<string, string>; idempotencyKey: string };
export type GenerationResult = { output: string | Record<string, unknown>; model: string; inputTokens: number;
  outputTokens: number; cachedInputTokens: number; costMicros: number };
export const recordGeneration: (generation: NewGeneration) => Promise<{ id: string }>;  // inserts status "pending"
export const saveGeneration: (generationId: string, result: GenerationResult) => Promise<void>; // † docs/05 name, not in table
export const markGenerationFailed: (generationId: string) => Promise<void>;

// lib/dal/events.ts
export type TrackEvent = { type: EventType; productId: string; userId: string | null; anonymousId: string | null;
  metadata?: Record<string, string | number | boolean | null> };
export const track: (event: TrackEvent) => Promise<void>;

// lib/dal/metrics.ts   († return shapes proposed from BO-02 / BO-03 bullets)
export type MetricsRange = { days: number };
export type ProductMetrics = { productId: string; slug: string; name: string; status: ProductStatus; visits: number;
  firstGenerations: number; signups: number; creditsExhausted: number; purchases: number; generations: number;
  revenueCents: number; aiCostMicros: number; signupToPurchaseRate: number | null; marginPerGenerationMicros: number | null };
export type PortfolioMetrics = { totals: { visits: number; revenueCents: number; aiCostMicros: number; marginMicros: number };
  products: ProductMetrics[] };
export type FunnelStep = { type: Exclude<EventType, "generation">; count: number; rateFromPrevious: number | null };
export type DailyPoint = { date: string; visits: number; signups: number; purchases: number; revenueCents: number; aiCostMicros: number };
export type Funnel = { metrics: ProductMetrics; steps: FunnelStep[]; daily: DailyPoint[] };
export const getPortfolioMetrics: (range: MetricsRange) => Promise<PortfolioMetrics>;
export const getFunnel: (productId: string, range: MetricsRange) => Promise<Funnel>;

// lib/dal/thresholds.ts
export type Thresholds = { minVisits: number; killMaxConversion: number; scaleMinConversion: number; scaleRequiresPositiveMargin: boolean };
export const getThresholds: (productId: string) => Promise<Thresholds>;

// lib/dal/product-editor.ts
export const createProduct: (config: ProductConfig) => Promise<{ id: string; slug: string; version: number }>;

// lib/dal/product-status.ts
export const updateStatus: (productId: string, status: ProductStatus, note: string | null) => Promise<void>;

// lib/dal/magic-link.ts (orchestrator decision 1)
export const getLatestMagicLink: (email: string) => Promise<{ url: string; createdAt: Date } | null>;

// lib/dal/guards.ts
export type Lockable = { isSeed: boolean };
export const assertEditable: (row: Lockable) => void;
export const isEditable: (row: Lockable) => boolean;

// lib/security.ts
export type GuardKind = "generate" | "signup" | "purchase" | "test-prompt";
export type GuardResult = { ok: true } | { ok: false; reason: "bot" | "rate_limited" };
export const guardRequest: (kind: GuardKind) => Promise<GuardResult>;
```

Each stub also carries a one-line comment stating who authorizes the call, so the real implementation keeps the rule
"every DAL module checks the session" (e.g. `createProduct` / `updateStatus` / metrics call `requireAdmin()` inside;
`getBalance` checks that the session user is `userId`).

## Files to Change

| File | Action | Why |
|---|---|---|
| `lib/schemas/pack.ts` + `pack.test.ts` | CREATE | Bullet 1 (pack) |
| `lib/schemas/event-type.ts` + `event-type.test.ts` | CREATE | Bullet 1 (eventType) |
| `lib/schemas/theme-tokens.ts` + `theme-tokens.test.ts` | CREATE | Bullet 1 (themeTokens, landingVariant) |
| `lib/schemas/product-config.ts` + `product-config.test.ts` | CREATE | Bullet 1 (productConfig, `{{x}}`, reserved slugs) |
| `lib/schemas/inputs.ts` + `inputs.test.ts` | CREATE | Orchestrator decision 2 |
| `lib/dal/products.ts` | UPDATE (additive) | `Product` type + `listProducts` stub; `getProduct` / `listProductSlugs` untouched |
| `lib/dal/credits.ts`, `generations.ts`, `events.ts`, `metrics.ts`, `thresholds.ts`, `product-editor.ts`, `product-status.ts`, `guards.ts`, `themes.ts`, `magic-link.ts` | CREATE | Bullet 2: stubs |
| `lib/security.ts` | CREATE | Bullet 2: `guardRequest(kind)` |
| `lib/dal/contract.test.ts` | CREATE | Permanent signature tests (`expectTypeOf`), including `lib/security.ts` and the SETUP functions |
| `lib/dal/stubs.test.ts` | CREATE | Temporary: every stub throws `not implemented`. CONTRACT-data deletes it in a commit that says why |
| `lib/dal/session.ts`, `lib/schemas/admin-login.ts`, `lib/db/**` | UNCHANGED | SETUP's frozen code / out of Périmètre |

## Tasks

Each task is one red → green cycle, then commit and push (`feat(db): …`). Run `pnpm vitest run <file>` directly, and
after every green step run `pnpm exec knip` to catch an unused export straight away.

### Task 1: pack schema (bullet 1)
- **Test first** (`lib/schemas/pack.test.ts`): `{ id: "pack-10", credits: 10, priceCents: 490 }` parses; rejected:
  `credits: 0`, `credits: 1.5`, `priceCents: -1`, `id: "Pack 10"`; `recommended` optional;
  `expectTypeOf<Pack>()` has `credits: number`.
- **Action**: `packSchema = z.object({ id: kebabSlug, credits: z.int().positive(), priceCents: z.int().positive(),
  recommended: z.boolean().optional() })`.
- **Validate**: `pnpm vitest run lib/schemas/pack.test.ts`

### Task 2: eventType schema (bullet 1)
- **Test first**: `it.each` over the 6 values of docs/07 → parse; `"click"` → rejected.
- **Action**: `eventTypeSchema = z.enum([...])`. CONTRACT-data can build the pgEnum from `eventTypeSchema.options`.
- **Validate**: `pnpm vitest run lib/schemas/event-type.test.ts`

### Task 3: themeTokens + landingVariant (bullet 1)
- **Test first**: a full token set (light + dark) parses; missing `dark` rejected; a color value that could inject CSS
  (`"red;}body{"`, `"url(x)"`) rejected; `#1a2b3c` and `oklch(0.7 0.1 250)` accepted; `landingVariantSchema` accepts
  only `centered | split | minimal`.
- **Action**: `colorTokensSchema` with the shadcn variable set (`background, foreground, card, cardForeground,
  primary, primaryForeground, secondary, secondaryForeground, muted, mutedForeground, accent, accentForeground,
  destructive, border, input, ring`). Each value is a CSS color validated by regex (`#hex` or `oklch()/hsl()/rgb()`
  with digits, `.`, `%`, spaces, `/`, `,` only): the layout injects them into `style`.
  `themeTokensSchema = { light, dark, fontKey: z.string().min(1), radius: /^\d+(\.\d+)?(rem|px)$/ }`.
- **Validate**: `pnpm vitest run lib/schemas/theme-tokens.test.ts`

### Task 4: productConfig, valid config (bullet 1)
- **Test first** (`lib/schemas/product-config.test.ts`): a LettrePro fixture shaped like docs/01 parses (slug, name,
  status, themeId uuid, locale, branding, landing, inputs, generation, pricing with 2 packs);
  `expectTypeOf<ProductConfig["status"]>().toEqualTypeOf<"test" | "learn" | "scale" | "killed">()`.
- **Action**: build an **unrefined base object** first (Zod 4 throws on `.pick/.omit/.extend` of a refined object),
  then refine last. Fields:
  - `slug`, `name` (1-60), `status: productStatusSchema`, `themeId: z.uuid()`, `locale: z.enum(["fr","en"])`
  - `branding: { logoUrl?: z.url(), primaryColor?: /^#[0-9a-f]{6}$/i }`
  - `landing`: `headline`, `subheadline`, `faq: {question, answer}[]`, `seoTitle ≤ 60`, `seoDescription ≤ 160`,
    optional `exampleOutput`, optional `steps: {title, description}[]`
  - `inputs: inputFieldSchema[]` (1-10), each `{ key: /^[a-z][a-z0-9_]*$/, label, type: text|textarea|select,
    required: boolean, options?: string[], maxLength?: int }`
  - `generation`: `model` and optional `fallbackModels[]` (format `provider/model`), optional `systemPrompt`,
    `promptTemplate`, `outputType: markdown|image`
  - `pricing`: `freeCreditsOnSignup ≥ 0`, `anonymousFreeGenerations ≥ 0`, `costPerGeneration ≥ 1`,
    `packs: packSchema[]` (at least 1)
  - No `.default()`: the form's input type and the stored type stay identical.
- **Validate**: `pnpm vitest run lib/schemas/product-config.test.ts`

### Task 5: `{{x}}` without a field x is rejected (bullet 1, first example)
- **Test first**: `promptTemplate: "… {{entreprise}}"` with no `entreprise` input → `success: false`, issue path
  `["generation","promptTemplate"]`, message `Variable {{entreprise}} sans champ correspondant`; `{{ poste }}` accepted;
  `templateVariables("{{a}} {{ b }} {{a}}")` → `["a","b"]`.
- **Action**: `templateVariables()` (regex `/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g`, deduplicated) plus a `superRefine`
  adding one issue per unknown variable.

### Task 6: reserved and malformed slugs are rejected (bullet 1, second example)
- **Test first**: `it.each(["admin","api"])` → rejected with path `["slug"]`; malformed rejected: `"Lettre-Pro"`,
  `"lettre_pro"`, `"-x"`, `"x-"`, `"a--b"`, `"sitemap.xml"`, one character; `"lettre-pro"` accepted.
- **Action**: `slugSchema = z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(s =>
  !RESERVED_SLUGS.includes(s))`. A comment says to add any extension-less `public/` entry to `RESERVED_SLUGS`.

### Task 7: remaining refinements from the docs/01 table
- **Test first**: duplicate input keys rejected (path `["inputs", i, "key"]`); `select` without options (or empty)
  rejected; duplicate pack ids rejected; `costPerGeneration: 0` and `packs: []` rejected; `seoTitle` of 61 characters
  rejected; `primaryColor: "blue"` rejected.
- **Action**: the remaining `superRefine` rules, each a small named helper.
- **Validate**: same file, then `pnpm exec knip`.

### Task 7b: input schemas (orchestrator decision 2)
- **Test first** (`lib/schemas/inputs.test.ts`): for each of the 6 schemas, one valid input parses and one invalid
  case is rejected (bad email, pack id with a space, unknown event type, note of 501 chars, rate 1.5, non-uuid key).
- **Action**: `lib/schemas/inputs.ts` as in decision 2.

### Task 8: credits signatures (bullet 2)
- **Test first**: `lib/dal/contract.test.ts` › `describe("credits")`:
  `expectTypeOf(debit).parameters.toEqualTypeOf<[Debit]>()`,
  `expectTypeOf(debit).returns.resolves.toEqualTypeOf<DebitResult>()`,
  `expectTypeOf<Extract<DebitResult, { ok: false }>>().toEqualTypeOf<{ ok: false; reason: "insufficient_balance" }>()`,
  the same for `getBalance`, `refund`, `grantSignupBonus`, `purchase`. `lib/dal/stubs.test.ts`: each of the 5
  functions `rejects.toThrow("not implemented")`.
- **Action**: `lib/dal/credits.ts`: `import "server-only";`, frozen-contract header, types, stubs written as **typed
  consts with a parameterless body**:
  `export const debit: (args: Debit) => Promise<DebitResult> = async () => { throw new Error("not implemented"); };`
- **Validate**: `pnpm vitest run lib/dal/contract.test.ts lib/dal/stubs.test.ts`, then `pnpm exec knip`.

### Task 9: generations and events signatures (bullet 2)
- Same two test files, `describe("generations")` and `describe("events")`: `recordGeneration` returns
  `Promise<{ id: string }>`, `saveGeneration(generationId, GenerationResult)`, `markGenerationFailed(generationId)`,
  `track(TrackEvent)` with `type: EventType`. Files `lib/dal/generations.ts`, `lib/dal/events.ts` (Task 8 pattern).

### Task 10: products, themes, product-editor, product-status, magic-link signatures (bullet 2)
- `listProducts` returns `Promise<Product[]>` and `Product` extends `ProductConfig` with `id`, `version`, `isSeed`;
  `getTheme(id)` returns `Promise<Theme | null>` with `Theme["tokens"]` = `ThemeTokens`;
  `createProduct(ProductConfig)`; `updateStatus(productId, ProductStatus, string | null)`;
  `getLatestMagicLink(email)`. Stub tests for the 5.
- Append `Product` and `listProducts` to `lib/dal/products.ts`; do not touch `getProduct` / `listProductSlugs` or
  `products.test.ts`. Create `themes.ts`, `product-editor.ts`, `product-status.ts`, `magic-link.ts`.
- **Validate**: `pnpm vitest run lib/dal/contract.test.ts lib/dal/stubs.test.ts lib/dal/products.test.ts`

### Task 11: metrics and thresholds signatures (bullet 2)
- `getPortfolioMetrics(MetricsRange)` → `PortfolioMetrics`; `getFunnel(productId, MetricsRange)` → `Funnel`;
  `FunnelStep["type"]` equals the 5 funnel steps; `getThresholds(productId)` → `Thresholds`. Stub tests.
- Units: money in cents, AI cost in micros (docs/07 `cost_micros`), rates `0..1` or `null` when the denominator is 0.

### Task 12: guards and guardRequest (bullet 2)
- `assertEditable: (row: Lockable) => void`, `isEditable: (row: Lockable) => boolean` (sync: they read
  `env.DEMO_MODE`); `guardRequest(kind: GuardKind) => Promise<GuardResult>` with exactly the 4 kinds cited by SA-02,
  SA-03, SA-05 and BO-05b. Stubs: `expect(() => isEditable({ isSeed: true })).toThrow("not implemented")`,
  `guardRequest("generate")` rejects.
- `lib/dal/guards.ts`, `lib/security.ts` (`import "server-only";`). Their tests go in `contract.test.ts` /
  `stubs.test.ts`: `lib/security.test.ts` belongs to SECURITY's Périmètre.

### Task 13: pin SETUP's real signatures (characterization, no red phase)
- In `contract.test.ts`: `expectTypeOf(requireAdmin).returns.resolves.toEqualTypeOf<Session>()`,
  `expectTypeOf(getSession).returns.resolves.toEqualTypeOf<Session | null>()`,
  `expectTypeOf(getProduct).parameters.toEqualTypeOf<[slug: string]>()`. Do not pin `getProduct`'s return type
  (CONTRACT-data widens it to `Product | null`). The commit message says it pins existing contracts.

### Task 14: full validation (bullet 3)
1. `pnpm typecheck` (queued; runs the `expectTypeOf` assertions).
2. `pnpm lint`, `pnpm format:check`, `pnpm knip`.
3. `pnpm test:coverage`: 80 % or more on `lib/**`.
4. `pnpm check`.
Fix any failure in the code, never in knip.json, tsconfig, eslint or vitest configs (protected).

## Validation

```bash
pnpm vitest run lib/schemas lib/dal/contract.test.ts lib/dal/stubs.test.ts lib/dal/products.test.ts lib/dal/session.test.ts
pnpm exec knip        # after each green step
pnpm typecheck        # queued: runs the expectTypeOf assertions
pnpm test             # queued
pnpm test:coverage    # queued, 80 %+ on lib/**
pnpm check
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| knip fails on unused exports (knip.json protected; `ignoreExportsUsedInFile: true`) | High | Every export is imported by a test file (knip's vitest plugin makes `*.test.ts` entries). Types go through `import type` + `expectTypeOf`. Run `pnpm exec knip` after every green step. No export added "for later" beyond the orchestrator decisions. |
| Coverage 80 % on `lib/**` with ~20 throwing stubs | High | `lib/dal/stubs.test.ts` calls each stub. It is the only temporary test; CONTRACT-data deletes it in one commit whose message says why. `contract.test.ts` stays valid after the implementation. |
| Magic-link read keyed by email lets whoever types an email log in as that user | Certain (by design) | Dossier's accepted demo design (docs/08); admin/owner emails never stored; `guardRequest("signup")` throttles. Stated in the stub's header comment and the PR body. |
| `getProduct(slug)` vs docs/04's no-arg `getProductConfig()` with `next/root-params` | Medium | Keep `getProduct(slug)` as the single frozen read: the only form callable from Server Actions and Route Handlers, where root-params are unavailable (installed docs, `next-root-params.md` › Restrictions). Server Components call `getProduct(await app())` and handle `undefined` → `notFound()`. Flagged in the PR as a deliberate divergence. |
| `getProduct` return type cannot be frozen yet (minimal row) | Certain | This PR defines `Product` (used by `listProducts`). CONTRACT-data annotates `getProduct(slug): Promise<Product \| null>` and updates the seed and `products.test.ts` in an explicit commit. Stated in the PR body. |
| Generation write flow vs the FK (`credit_transactions.generation_id` → `generations`) | High | Three functions: `recordGeneration` inserts `pending` before the debit and returns `{ id }` (idempotent on the key); `saveGeneration(id, result)` on finish (docs/05 name, † not in the table); `markGenerationFailed(id)` + `refund(id)` on error. SA-02 reads "recordGeneration" as the pending insert. |
| Names that differ from the dossier text (†) | Medium | Listed in the PR body: `Debit.key` → `idempotencyKey`; `track` takes `productId`, not `slug`; `refund(generationId)` follows docs/05; `getTheme(id)` follows docs/04; metrics shapes from BO-02 / BO-03; SA-05's `purchase(packId, idempotencyKey)` becomes `purchase({ userId, productId, packId, idempotencyKey })` (a pack id is only unique within a product). |
| `config.fields` (SA-02) vs `inputs` (docs/01) | Medium | Freeze `inputs` (docs/01 is the reference config); noted in the PR so SA-02 reads `config.inputs`. |
| Contract-table rows outside this Périmètre: `generate`, `resolveModel`, `renderPrompt`, `evaluate`, `<TrackVisit>` | Certain | Not created here. Owners: CONTRACT-data (`resolveModel`), SA-02 (`generate`, `renderPrompt`), BO-02 (`evaluate`), CONTRACT-ui (`<TrackVisit>`). Noted in the PR. |
| Stubs throw at runtime | Medium | Nothing in the running app calls a stub today (the layout uses `listProductSlugs` / `getProduct`, both real). |
| `themeTokens.fontKey` is a free string while the catalogue belongs to CONTRACT-ui | Low | `z.string().min(1)` now; CONTRACT-ui validates the key when it resolves the font. |
| `themeId` in the config is a uuid while docs/01 shows `"editorial"` | Low | Data model wins (`z.uuid()`). |
| Zod 4: `.pick/.omit/.extend` throw on refined objects | Medium | Unrefined base shape, refine last. Check against the installed zod typings. |
| Numbers not given by the dossier (SEO 60/160, slug 2-60, 1-10 inputs) | Low | Named constants in `product-config.ts`, listed in the PR. |
| `lib/schemas/**` is imported by client forms | Medium | Schema files import only `zod` and each other, never `server-only` or `lib/dal`. The DAL imports schema types only. |
| `assertEditable` error type not specified | Low | Freeze only "throws when not editable"; DEMO-mode decides the error type. |

## Acceptance

- [ ] Bullet 1: `lib/schemas/{pack,event-type,theme-tokens,product-config,inputs}.test.ts`; inferred types pinned
      with `expectTypeOf`; `{{x}}` without field x rejected; `admin` / `api` rejected.
- [ ] Bullet 2: `lib/dal/contract.test.ts` pins every signature (contract table + `assertEditable`, `isEditable`,
      `guardRequest`, `getLatestMagicLink`); `lib/dal/stubs.test.ts` proves each body throws `not implemented`.
- [ ] Bullet 3: `pnpm typecheck` green; `pnpm check` green, coverage 80 %+ on `lib/**`.
- [ ] SETUP tests unchanged and green. No protected config edited.
- [ ] PR body lists every † divergence and the orchestrator decisions.
- [ ] PR title: `feat(db): CONTRACT-types frozen Zod schemas and DAL signatures`.
