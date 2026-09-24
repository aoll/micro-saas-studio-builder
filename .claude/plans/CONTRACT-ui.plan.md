# Plan: CONTRACT-ui · Layouts, thèmes et composants partagés

**Source spec**: specs/CONTRACT-ui.md
**Complexity**: Large (2 root layouts, theme tokens → CSS variables, font catalogue, next-intl, ~15 shared components,
shadcn/ui set-up, jsdom test tooling). Part of the work waits for CONTRACT-data.

## Summary

The UI shell every V2 spec builds on: backoffice layout (shadcn shell, navigation Portefeuille / Thèmes / Réglages,
sign-out, `<Toaster/>`), product root layout (reads `[app]` with `next/root-params`, injects theme tokens as CSS
variables for light and dark, `@modal` slot), shared components in `components/**`, next-intl fed by one message file
per zone.

Two phases:
- **Phase A (now):** all logic testable against the frozen types (`ThemeTokens`, `Product`, `Theme`, `Pack`,
  `ProductStatus`, `getBalance`, `getSession`) with the DAL mocked.
- **Phase B (after CONTRACT-data is merged into `integration/v1`):** the product layout wiring and `i18n/request.ts`,
  which need `product.themeId`, `product.locale`, `product.branding` and a real `getTheme()`. Until then it is a
  dependency gap, never worked around with a stub or a type cast in app code.

## Orchestrator decisions (binding for this spec)

1. **Font keys are shared with CONTRACT-data's seed (already dispatched) and are semantic:**
   `FONT_KEYS = ["serif", "grotesk", "sans", "rounded"] as const`, mapped in `lib/fonts.ts` to Fraunces (serif),
   Space Grotesk (grotesk), Inter (sans) and Nunito (rounded). Unknown key → `sans`. The seed's themes use
   editorial → `serif`, neon → `grotesk`, corporate → `sans`, playful → `rounded`.
2. **Périmètre extensions accepted:** `package.json` + `pnpm-lock.yaml` (dependencies below), `components.json`,
   `next.config.ts` (+ one assertion in `next.config.test.ts`) for `createNextIntlPlugin` (Phase B), `lib/auth-client.ts`
   (+ test) for `signOut`, `e2e/themes.spec.ts` (bullet 3). Run rule: the colocated `*.test.ts` of a Périmètre file is in
   Périmètre. Each listed in the PR body.
3. `cn()` lives in `components/utils.ts` (`components.json` alias `utils: "@/components/utils"`), inside Périmètre;
   departure from docs/09 recorded in the PR body.
4. Derived components accepted: `RouteModal` (SA-03/04/05 need the shared modal, none has `components/**`) and
   `BalanceProvider` / `useBalanceDelta` (SA-05's optimistic header badge).
5. **Phase B trigger:** after Phase A, check `git log origin/$(git config msb.integration)` for the CONTRACT-data squash
   commit (`feat(db): CONTRACT-data …`). If merged: `git fetch && git merge origin/integration/v1` (never rebase), then
   Phase B. If not: stop and report Phase B under `Dependency gaps`; the orchestrator resumes you after the merge.
6. The lockfile will conflict with CONTRACT-data's (`ai`): on merge, regenerate it with `pnpm install`, never by hand.

## Current state of the branch

- `app/(products)/[app]/layout.tsx`: `generateStaticParams()` from `listProductSlugs()` (keep it: a Cache Components root
  param needs at least one value); `<html lang="fr">`, no theme, no slot.
- `app/(backoffice)/layout.tsx`: bare `<html>`; also wraps `/admin/login`.
- `app/globals.css`: only `@import "tailwindcss";`.
- Not installed: `next-intl`, `sonner`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`,
  `radix-ui`, `jsdom`, `@testing-library/*`; no `components.json`, `lib/auth-client.ts`.
- `vitest.config.mts` (protected): `environment: "node"`, no `globals` → component tests need
  `// @vitest-environment jsdom` and `afterEach(cleanup)`; coverage on `lib/**` (80 %); `server-only` mocked.
- `knip.json` (protected): `ignoreExportsUsedInFile: true`; test files are entries, so an export used only by its test
  counts as used.
- `eslint.config.mjs`: `no-restricted-imports` off for `e2e/**` (e2e may write to the DB directly).
- Installed Next docs: `next-root-params.md` (several root layouts → `app()` is `Promise<string | undefined>`; not in
  Server Actions / Route Handlers); `parallel-routes.md` › Modals (`default.tsx` and `[...catchAll]/page.tsx` return
  `null`); Turbopack and Vite support `import.meta.glob`; `typescript.md` (`as Route` for routes that do not exist yet).

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Style | `lib/dal/products.ts:1-15` | Double quotes, semicolons, kebab-case files, short comments that say why |
| Frozen-contract marker | `lib/dal/session.ts:7-9` | `// Frozen contract (specs/CONTRACT-ui.md): …` above each exported component later specs consume |
| Typed stub | `lib/dal/credits.ts:33-35` | `export const TrackVisit: (props: TrackVisitProps) => null = () => null;` |
| Client leaf | `app/(backoffice)/admin/login/_components/login-form.tsx:1` | `"use client"` only on interactive leaves |
| Tests | `lib/dal/products.test.ts:1-15` | Colocated; `vi.mock` of `next/*` and DAL modules; `await import()` when module state matters |
| Env in tests | `next.config.test.ts` | `vi.mock("@/lib/env", …)` / `vi.stubEnv` |
| Async Server Components | none yet | `const ui = await Component(props); render(ui)` with the DAL mocked; layouts covered by Playwright |

## Dependencies

- Production: `next-intl`, `sonner`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui`
  (or the `@radix-ui/*` packages the CLI pulls).
- Development: `jsdom`, `@testing-library/react`, `@testing-library/dom`.
- Not added: `tw-animate-css` (CSS-only import, invisible to knip), `next-themes` (removed from generated `sonner.tsx`,
  `theme="system"`), `recharts` (BO-03), `user-event`, `jest-dom`.

## Frozen UI contract (what later specs import)

```ts
// lib/fonts.ts
export const FONT_KEYS: readonly ["serif", "grotesk", "sans", "rounded"];
export type FontKey = (typeof FONT_KEYS)[number];
export function fontFor(key: string): { variable: string; className: string }; // unknown key -> "sans"

// components/product/theme-vars.ts
export function themeCssVars(tokens: ThemeTokens, branding: ProductConfig["branding"]): React.CSSProperties;

// components/product/*
ProductHeader({ slug, name, logoUrl?, balance: ReactNode })       // server, sync
HeaderBalance({ productId, slug })                                 // server, async (session + getBalance), under <Suspense>
BalanceProvider({ children }) / useBalanceDelta(): (delta: number) => void / BalanceBadge({ balance })  // client, useOptimistic
BalanceBadgeSkeleton()
ProductFooter({ name })
DemoBanner()                                                       // null unless env.DEMO_MODE
ResultCard({ output: { kind: "markdown"; text: string } | { kind: "image"; url: string; alt: string }, fileName, onRegenerate?, streaming? })  // client
PackCard({ pack: Pack, costPerGeneration: number, action: ReactNode })
DynamicField({ field: ProductConfig["inputs"][number], error?: string, defaultValue?: string })
RouteModal({ children, title })                                    // client; close -> router.back(); full screen below sm
// components/backoffice/*
KpiCard({ label, value: string, delta?: { text: string; trend: "up" | "down" | "flat" }, points?: number[] })
StatusBadge({ status: ProductStatus })
AdminSidebar() / NavLink({ href, children }) / SignOutButton()
// components/shared/*
EmptyState({ title, description?, action?: ReactNode })
// components/track-visit.tsx (TRACKING replaces the body)
export const TrackVisit: (props: { slug: string }) => null
// i18n/load-messages.ts
export function loadMessages(locale: ProductConfig["locale"]): Promise<Record<string, unknown>>; // namespace = zone file name
```

Message convention for later specs: `messages/<fr|en>/<zone>.json` is namespace `<zone>` (`useTranslations("tool")`),
keys without a wrapper object, identical keys in both languages, picked up automatically (no edit to `i18n/**`).

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json`, `pnpm-lock.yaml`, `components.json` | UPDATE / CREATE | Decision 2 |
| `components/utils.ts` | CREATE (shadcn) | `cn()` |
| `components/ui/{button,card,badge,input,textarea,label,skeleton,sonner,dialog}.tsx` | CREATE (shadcn add) | Base components; `sonner` without `next-themes` |
| `app/globals.css` | UPDATE | shadcn variables, light/dark mapping, `@theme inline`, font |
| `lib/fonts.ts` + test | CREATE | Font catalogue (decision 1) |
| `components/product/theme-vars.ts` + test | CREATE | Tokens → CSS variables |
| `i18n/load-messages.ts` + `load-messages.test.ts` | CREATE | Zone files merged (`i18n/messages.test.ts` belongs to I18N-SEO) |
| `messages/fr/common.json`, `messages/en/common.json` | CREATE | Shared texts |
| `components/backoffice/{status-badge,kpi-card,nav-link,sign-out-button,admin-sidebar}.tsx` + tests | CREATE | Backoffice |
| `components/shared/empty-state.tsx` + test | CREATE | Empty state |
| `components/product/{dynamic-field,pack-card,result-card,balance,header-balance,product-header,product-footer,demo-banner,route-modal}.tsx` + tests | CREATE | Product components |
| `components/track-visit.tsx` + test | CREATE | No-op stub |
| `lib/auth-client.ts` + test | CREATE | `signOut` |
| `app/(backoffice)/layout.tsx` | UPDATE | Shell + `<Toaster/>` |
| `app/(products)/[app]/@modal/default.tsx`, `@modal/[...catchAll]/page.tsx` | CREATE | Slot |
| `app/(products)/[app]/layout.tsx` | UPDATE (A: `{modal}`; B: full wiring) | Bullet 2 |
| `i18n/request.ts` + test, `next.config.ts` | CREATE / UPDATE (Phase B) | Bullet 5 |
| `e2e/themes.spec.ts` | CREATE (Phase B) | Bullet 3, run in the E2E phase |
| `app/(products)/[app]/page.tsx`, `lib/dal/**`, `lib/schemas/**` | UNCHANGED | SA-01's file / frozen contracts |

## Tasks

Each task: red → green, commit and push (`feat(app): …`, `feat(bo): …` for the backoffice). `pnpm vitest run <file>`
directly; `pnpm exec knip` after each green step. Every component test starts with `// @vitest-environment jsdom` and
has `afterEach(cleanup)`; `render` from `@testing-library/react`, `screen` / `within` / `fireEvent` from
`@testing-library/dom`. Components with text are wrapped in `<NextIntlClientProvider locale="fr" messages={{ common: fr }}>`
and a second assertion checks `en`.

### Phase 0: tooling (one commit `chore(tooling): …`)
1. `pnpm add` / `pnpm add -D` the dependencies.
2. Write `components.json` by hand: style `new-york`, `rsc: true`, `tailwind.css: "app/globals.css"`,
   `baseColor: "neutral"`, `cssVariables: true`, aliases `components: "@/components"`, `ui: "@/components/ui"`,
   `utils: "@/components/utils"`, `lib: "@/lib"`, `hooks: "@/hooks"`, `iconLibrary: "lucide"`.
3. `pnpm dlx shadcn@latest add button card badge input textarea label skeleton sonner dialog`; remove `next-themes` from
   `sonner.tsx` and any `@import "tw-animate-css"`. If the CLI cannot reach the registry, copy the components from the
   shadcn registry source.
4. `app/globals.css`: `:root { --background: var(--light-background, <neutral>); … }` for the 16 tokens;
   `@media (prefers-color-scheme: dark) { :root { --background: var(--dark-background, var(--light-background, <neutral>)); … } }`;
   `--radius` default `0.625rem`; `@theme inline { --color-*: var(--*); --radius-*; --font-sans: var(--font-theme, ui-sans-serif), system-ui, sans-serif; }`;
   `@keyframes badge-pop`.
5. `pnpm exec knip`: unused shadcn sub-exports → `/** @public */` if the installed knip honours it, otherwise delete
   them; `jsdom` reported unused → stop and report. Never edit `knip.json`.
6. `pnpm typecheck`, `pnpm exec knip`.

### Task 1: font catalogue (`lib/fonts.ts`)
- **Test first**: `vi.mock("next/font/google", …)` returns fake loaders recording options; `FONT_KEYS` has the 4 keys of
  decision 1; `fontFor("serif").variable` is Fraunces'; `fontFor("unknown")` returns the `sans` font; every loader called
  with `variable: "--font-theme"`, `display: "swap"`, `preload: false`.
- **Action**: 4 `next/font/google` calls at module scope, all `variable: "--font-theme"` (the class on `<html>` picks the
  active one); `preload: false` so only the active theme's font loads (docs/04).

### Task 2: theme tokens → CSS variables (`components/product/theme-vars.ts`)
- **Test first** (fixture typed and parsed with `themeTokensSchema`): `primary` → `--light-primary` and `--dark-primary`;
  `cardForeground` → `--light-card-foreground`; `radius` → `--radius`; `branding.primaryColor` overrides both
  primaries; exactly 16 × 2 + 1 keys.
- **Action**: pure camelCase → kebab-case mapping; values passed through (`themeTokensSchema` already rejects `;`, `}`,
  `url(`).

### Task 3: messages (`i18n/load-messages.ts`, `messages/*/common.json`)
- **Test first**: `loadMessages("fr").common.header.signIn === "Connexion"`; `en` → `"Sign in"`; identical key paths
  in fr and en `common`.
- **Action**: `import.meta.glob<Record<string, unknown>>("../messages/*/*.json", { import: "default" })`, filtered on
  `/${locale}/`, keyed by base name. `common.json`: `header`, `footer`, `demo`, `result`, `pack`, `modal`, `states`, ICU
  plural for credits.

### Task 4: `StatusBadge`
`it.each` over the 4 statuses → labels Test / Learn / Scale / Killed, `data-status`, 4 distinct colour classes. shadcn
`Badge` + colour map; the backoffice stays in French (docs/08).

### Task 5: `KpiCard`
Label and value rendered; `trend: "down"` → destructive colour; `points=[1,3,2]` → SVG `polyline` with 3 normalised
points; 0 or 1 point → no sparkline. `Card` + inline SVG, no chart dependency.

### Task 6: `EmptyState` + skeleton
Title, description and action rendered; `BalanceBadgeSkeleton` renders a `Skeleton` with `aria-hidden`.

### Task 7: `DynamicField`
text → `input[name][required]` with `maxLength`; textarea → `textarea`; select → native `select` with the options;
`error` → `aria-invalid="true"` and `aria-describedby`. No `"use client"` (works without JS, docs/04).

### Task 8: `PackCard`
`{ credits: 10, priceCents: 490 }` → "10 crédits", "4,90 €", "0,49 € / génération" in fr, "€4.90" in en; `recommended`
→ badge + primary border; `action` rendered. `useTranslations("common")` + `useFormatter().number(…, { style:
"currency", currency: "EUR" })`.

### Task 9: `ResultCard`
Clipboard and `URL.createObjectURL` stubbed, `vi.mock("sonner")`: copy → `writeText(text)` + label "Copié"; rejected
`writeText` → `toast.error` (never swallowed); download → `.md` Blob named `fileName`; regenerate → `onRegenerate`;
image → `img` with `alt`; `aria-live="polite"`. `"use client"`; markdown shown as `whitespace-pre-wrap` text (no HTML
rendering).

### Task 10: optimistic balance (`components/product/balance.tsx`)
`BalanceBadge balance={3}` in the provider → "3 crédits"; a child calling `addDelta(-1)` inside a pending transition →
"2 crédits", then "3 crédits" once settled; `useBalanceDelta()` outside the provider throws a clear error.
`useOptimistic(0, (d, n: number) => d + n)`; badge keyed by value to replay `badge-pop`.

### Task 11: `HeaderBalance` + `ProductHeader`
Session and credits mocked: no session → "Connexion" link to `/lettre-pro/signup`; session → `getBalance(session.user.id,
productId)` → `BalanceBadge`; `ProductHeader` renders name, logo `img` when `logoUrl`, and the `balance` node. Sign-in
href `` `/${slug}/signup` as Route `` with a comment to drop the cast once SA-03 lands; logos with `next/image`
`unoptimized`.

### Task 12: `ProductFooter` + `DemoBanner`
Footer: name + studio link, no `new Date()`. Banner: `null` when `DEMO_MODE` false, "Démo" text when true
(`vi.mock("@/lib/env")`).

### Task 13: `TrackVisit` stub
Renders nothing, never calls `navigator.sendBeacon`. `"use client"`, typed const returning `null`, frozen-contract
comment.

### Task 14: `RouteModal`
`vi.mock("next/navigation")`: `role="dialog"` with title and children; Escape or close button → `router.back()`. Always
open shadcn `Dialog`, full screen below `sm`.

### Task 15: backoffice shell
`NavLink` → `aria-current="page"` when `usePathname()` matches; `SignOutButton` → `authClient.signOut`, then
`router.push("/admin/login")` and `router.refresh()`; `await AdminSidebar()` → `null` without an admin session (uses
`getSession()` + role, never `requireAdmin`, which would loop on `/admin/login`); with an admin session, 3 links
(`/admin`, `/admin/themes`, `/admin/settings`) and the sign-out button; the sidebar does **not** print the email
(`e2e/skeleton.spec.ts` uses `getByText(email)`); `lib/auth-client.test.ts` checks `signOut` is a function.
`/admin/themes` and `/admin/settings` use `as Route` until BO-07 / BO-09 (flagged).

### Task 16: backoffice layout
`<html lang="fr"><body class="flex min-h-dvh"><Suspense fallback={null}><AdminSidebar/></Suspense><div className="flex-1">{children}</div><Toaster/></body></html>`;
`pnpm typecheck`.

### Task 17: `@modal` slot
`@modal/default.tsx` and `@modal/[...catchAll]/page.tsx` return `null`; the product layout renders `{modal}` after
`{children}`; keep `generateStaticParams`; `pnpm typecheck`.

---- **Phase B: only after CONTRACT-data is merged (decision 5)** ----

### Task 18: `i18n/request.ts` + next-intl plugin
- **Test first** (`i18n/request.test.ts`, `next/root-params` and `@/lib/dal/products` mocked): product `locale: "en"` →
  `en` and English `common`; `app()` → `undefined` or unknown product → `fr`.
- **Action**: `getRequestConfig(async () => { const slug = await app(); const product = slug ? await getProduct(slug) : null; const locale = product?.locale ?? "fr"; return { locale, messages: await loadMessages(locale) }; })`;
  `next.config.ts` wrapped with `createNextIntlPlugin("./i18n/request.ts")`; `next.config.test.ts` still checks the 4
  flags.

### Task 19: product layout wiring
`const slug = await app()`, `getProduct(slug)`, `if (!product) notFound()` (the `killed` check is SA-08's);
`const theme = await getTheme(product.themeId)`, missing theme throws; `<html lang={product.locale}
className={fontFor(theme.tokens.fontKey).variable} style={themeCssVars(theme.tokens, product.branding)}>`; body:
`NextIntlClientProvider` > `BalanceProvider` > `DemoBanner`, `ProductHeader` with
`balance={<Suspense fallback={<BalanceBadgeSkeleton/>}><HeaderBalance …/></Suspense>}`, `<main>{children}</main>`,
`ProductFooter`, `{modal}`, `<Toaster/>`. Validate with `pnpm typecheck` and `pnpm build` (`/lettre-pro` prerenders with
the Editorial theme; the session is only read under `<Suspense>`).

### Task 20: `e2e/themes.spec.ts` (written now, run in the E2E phase)
Read the 4 seeded themes (direct Drizzle, like `skeleton.spec.ts`); for each: set it as `lettre-pro`'s theme, make it
visible (the landing is prerendered and cached with `product:lettre-pro`: note in the file that the E2E phase decides
between saving through BO-05's action or running against `next dev`), check `--primary` equals `tokens.light.primary`
with `colorScheme: "light"` and `tokens.dark.primary` in dark, check `tokens.fontKey` is in `FONT_KEYS`; restore the
original theme in `finally`. Do not run Playwright.

### Task 21: full validation
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm test:coverage` (80 % on `lib/**`), `pnpm
check`, `pnpm build`. Fix in code, never in `knip.json`, `tsconfig*`, eslint, vitest config or `vitest.setup.ts`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phase B depends on CONTRACT-data | Certain | Phase A carries all logic; Phase B after merging the integration branch; gap reported, no cast, no stub |
| knip: unused shadcn sub-exports, `jsdom` via docblock only, `@testing-library/dom` as peer | High | `/** @public */` or trim exports; import from `@testing-library/dom`; escalate what code cannot fix |
| E2E: prerendered, cached landing hides a raw DB theme change | High | Decided in the E2E phase (BO-05 save with `updateTag`, or `next dev`); noted in the spec file |
| `typedRoutes` rejects links to pages that do not exist yet | Certain | `as Route` with a comment to drop it when BO-07 / BO-09 / SA-03 land; flagged in the PR |
| No `@modal/page.tsx`: a soft navigation from an open modal may leave the slot | Low | `RouteModal` closes with `router.back()`; noted for SA-05 |
| RTL does not auto-clean (no globals) | Certain | `afterEach(cleanup)` everywhere |
| `next/font`, `next/image`, `next/navigation` in Vitest | Medium | Mock `next/font/google` and `next/navigation`; `next/link` only if needed |
| `new Date()` or a session read outside `<Suspense>` makes the landing dynamic | Medium | No dates in the footer; session only in `HeaderBalance` and `AdminSidebar`, both under `<Suspense>` |
| Lockfile conflict with CONTRACT-data | High | Regenerate with `pnpm install` on merge |

## Acceptance

- [ ] Bullet 1: `admin-sidebar`, `nav-link`, `sign-out-button` tests; backoffice layout with shell and `<Toaster/>`.
- [ ] Bullet 2: `theme-vars` test; `@modal/default.tsx` and `[...catchAll]`; layout reads `app()`, injects light and dark
      variables and the font (Phase B).
- [ ] Bullet 3: `e2e/themes.spec.ts` written (E2E phase).
- [ ] Bullet 4: one test per component.
- [ ] Bullet 5: skeleton, empty state, toasts.
- [ ] Bullet 6: `load-messages` test (same fr/en keys); `i18n/request.ts` test (Phase B).
- [ ] Bullet 7: mockups already in `specs/mockups/` (17 PNGs).
- [ ] No frozen contract changed; no cast or stub for the CONTRACT-data gap; `pnpm check` green; coverage 80 %+ on `lib/**`.
- [ ] PR title: `feat(app): CONTRACT-ui layouts, themes and shared components`.
