# Implementation Plan: I18N-BACKOFFICE · Sélecteur de langue backoffice

**Source spec**: specs/I18N-BACKOFFICE.md
**Worktree**: /home/user/micro-saas-studio-builder-i18n-backoffice
**Complexity**: Medium. There are few files, but three points need care: the shared `i18n/request.ts` (a frozen contract, and I18N-MARKETING edits it in parallel), Cache Components rules when a cookie drives `<html lang>` in a root layout, and a gap between what the spec asks for and what its Périmètre allows (see R1).

## Overview
Add a third branch to `i18n/request.ts`. When a caller passes a locale explicitly (the Server Action path), that locale wins. When the `[app]` root param is present, the product branch runs exactly as today. Otherwise the locale comes from the `admin_locale` cookie, validated against `fr|en`, with `fr` as the default. `headers()` / Accept-Language are never read.
next-intl is wired into the backoffice for the first time: `app/(backoffice)/layout.tsx` resolves the locale through next-intl, sets `<html lang>` and puts a `NextIntlClientProvider` around the shell.
A client leaf, `LocaleSwitcher`, writes the cookie in the browser and calls `router.refresh()`. The URL does not change, the document does not reload and the session is untouched. No Server Action file is needed, which keeps the work inside Périmètre.

## What exists today (checked in the worktree)
- `i18n/request.ts` is 15 lines: `app()`, then `getProduct(slug)`, then `product?.locale ?? "fr"`, then `loadMessages(locale)`. It ignores the `locale` and `requestLocale` params of `getRequestConfig`.
- `i18n/request.test.ts` has 3 tests: product locale, no root param → fr, unknown slug → fr. It mocks `next-intl/server`, `next/root-params` and `@/lib/dal/products`, but not `next/headers`.
- `app/(backoffice)/layout.tsx` has no next-intl at all. `<html lang="fr">` is hardcoded, `AdminSidebar` sits under `<Suspense>` because it reads the session, and there is a `<Toaster/>`.
- No file under `app/(backoffice)` or `components/backoffice` uses `useTranslations` or `getTranslations`. Every admin string is hardcoded French: the sidebar, pages, and the errors returned by `login/_actions.ts`, `products/_actions.ts` and `ops/_actions.ts`.
- `messages/manifest.ts` globs `./*/*.json`, so `messages/{fr,en}/backoffice.json` are picked up with no extra wiring. `i18n/messages.test.ts` already checks fr/en parity for every zone file.
- `lib/schemas/product-config.ts` exports `localeSchema = z.enum(["fr","en"])`. This spec only reads it (frozen contract).
- Installed next-intl is 4.14.x. `GetRequestConfigParams` has `locale?: Locale`, which is set when a caller does `getTranslations({ locale })`. That is the documented override.
- `NextIntlClientProviderServer` always calls `getFormats()`, `getConfigNow()` and `getTimeZone()`, which run `i18n/request.ts`. So putting the provider in the layout necessarily runs the new backoffice branch.
- Next 16.3 docs (`node_modules/next/dist/docs/.../next-root-params.md`): `app()` throws inside Server Actions ("Not supported in Server Actions") and returns `undefined` under a root layout without `[app]`.
- `migrating-to-cache-components.md` says that when a cookie drives an attribute on `<html>` in the root layout, the whole subtree becomes request-bound and there is no child to wrap in `<Suspense>`. See R2.
- Sister worktree `/home/user/micro-saas-studio-builder-i18n-marketing`: its `i18n/request.ts` is still identical to ours (not started yet).

## Requirements (one success criterion per bullet)
1. A fr/en switcher in the backoffice shell changes the language of `/admin/**` without reloading the session or changing the URL (no `/en` prefix).
2. The choice sets the `admin_locale` cookie (`fr` | `en`). Without a cookie the backoffice stays French.
3. No automatic browser detection for the backoffice.
4. No column added to any table: `lib/db/schema.ts` and `drizzle/` are untouched.
5. Error messages returned by an `admin/**` Server Action follow the locale received as an argument. The cookie is not read again in a Server Action.

## Architecture Changes
- `i18n/request.ts` (frozen contract, additive change):
  1. explicit `locale` param → validated, returned, no `app()` and no `cookies()` call.
  2. root param present → product branch, unchanged.
  3. (the seam where I18N-MARKETING's `requestLocale` branch goes)
  4. `admin_locale` cookie → `localeSchema.safeParse`, `fr` on a missing or invalid value.
- `i18n/request.test.ts`: add a `next/headers` mock and a new `describe("backoffice branch")`.
- `messages/fr/backoffice.json` and `messages/en/backoffice.json` (new zone): `localeSwitcher.{label, fr, en}`.
- `app/(backoffice)/layout.tsx`:
  - `const locale = await getLocale()` and `getMessages()` from `next-intl/server`, so the locale comes from the single entry point `i18n/request.ts`.
  - `<html lang={locale}>`.
  - `<NextIntlClientProvider locale={locale} messages={{ backoffice: messages.backoffice }}>` around the body content. Only this namespace is sent to the client, not every product zone.
  - `<LocaleSwitcher/>` in a slim right-aligned bar at the top of the content column.
  - Possibly `export const instant = false`, depending on the spike in step 0.
- `app/(backoffice)/admin/_components/locale-switcher.tsx` (new, `'use client'`):
  - two toggle buttons FR / EN in `role="group"` with a translated `aria-label`, and `aria-pressed` on the active one;
  - `useLocale()` gives the active locale;
  - on click: `document.cookie = "admin_locale=<l>; path=/admin; max-age=31536000; SameSite=Lax" (+ "; Secure" on https)`, then `startTransition(() => router.refresh())`, with the buttons disabled while pending.
- `app/(backoffice)/admin/_components/locale-switcher.test.tsx` (new): the colocated test, covered by the run rule "the colocated test of a Périmètre file is in Périmètre".
- `e2e/backoffice-locale.spec.ts` (new).

Target shape of `i18n/request.ts` (the final shape both sister specs converge to, docs/08 › i18n):

```ts
export default getRequestConfig(async ({ locale: explicit, requestLocale }) => {
  const locale = explicit !== undefined ? toLocale(explicit) : await resolveLocale(requestLocale);
  return { locale, messages: await loadMessages(locale) };
});

async function resolveLocale(requestLocale: Promise<string | undefined>) {
  const slug = await app();
  if (slug) return (await getProduct(slug))?.locale ?? "fr"; // product: unchanged
  // I18N-MARKETING: `requestLocale` branch goes here, before the cookie
  return backofficeLocale();
}

async function backofficeLocale() {
  return toLocale((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
}

function toLocale(value: string | undefined) {
  return localeSchema.safeParse(value).data ?? "fr";
}
```

## Implementation Steps

### Phase 0: Spike (no commit, or a throwaway commit)
0. **Check the build with a cookie-driven root layout** (files: `app/(backoffice)/layout.tsx`, `i18n/request.ts`)
   - Action: draft steps 3 and 5 roughly, then run `pnpm build` once (it is not queued, so run it once only) and read the route table and the errors.
     - If Cache Components rejects `/admin*` ("uncached data accessed outside `<Suspense>`" or an empty static shell), add `export const instant = false` to `app/(backoffice)/layout.tsx`. That is the documented opt-out for the static-shell check and applies only to this root layout's subtree.
     - Check that `/[app]` landings are still prerendered (◐/●): the product branch must return before any `cookies()` call.
   - Why: R2. This choice decides how the layout is written, so it must be settled before the red/green loop.
   - Dependencies: none.
   - Risk: High.

### Phase 1: Locale resolution (`i18n/request.ts`), bullets 2, 3, 5, product regression
1. **Mock `next/headers` in the existing test file** (file: `i18n/request.test.ts`)
   - Action: add `vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n) => cookieJar.get(n) }), headers: headersSpy }))` next to the existing mocks, with the cookie jar empty by default.
   - Commit this alone, with a message saying the 3 existing tests are unchanged: the "no root param" case will reach `cookies()`, and `next/headers` throws outside a request scope.
   - Dependencies: none.
   - Risk: Low.
2. **Red → green: backoffice cookie branch** (files: `i18n/request.test.ts`, `i18n/request.ts`)
   - Tests, in a new top-level `describe("backoffice branch")`:
     - (a) no root param + `admin_locale=en` → `locale "en"`, and `messages.backoffice` is the English zone. This needs step 4's JSON, so write the JSON in the same green step, or assert on `common` until step 4.
     - (b) no root param, no cookie → `fr`.
     - (c) invalid values (`"de"`, `"EN"`, `""`) → `fr`.
     - (d) no cookie, and a `headers()` mock that returns `accept-language: en` → `fr`, and `headers` is never called (bullet 3).
     - (e) root param `bio-insta` (product `en`) with `admin_locale=fr` → `en`, and `cookies` is never called. This proves the product branch is unchanged and that product prerendering stays cookie-free.
     - (f) unknown slug + `admin_locale=en` → `fr`, `cookies` never called (current behavior kept).
   - Code: `backofficeLocale()` and `toLocale()` as in the target shape. `ADMIN_LOCALE_COOKIE = "admin_locale"` is a module constant.
   - Dependencies: step 1.
   - Risk: Medium.
3. **Red → green: explicit locale for Server Actions** (files: `i18n/request.test.ts`, `i18n/request.ts`)
   - Tests:
     - (g) `getRequestConfig({ locale: "en", requestLocale })` → `en` with English `backoffice` messages. Make `app` a mock that throws, like in a real Server Action, and assert that neither `app` nor `cookies` is called.
     - (h) explicit `"de"` → `fr`, still without calling `app` or `cookies`.
   - Code: the `explicit !== undefined` short-circuit. Add a 3-line comment: an admin action receives `locale` (bound from the client with `useLocale()` and `action.bind(null, locale)`) and calls `getTranslations({ locale, namespace: "backoffice" })`.
   - Why: bullet 5. Without this, `app()` throws in any action that calls `getTranslations`.
   - Dependencies: step 2.
   - Risk: Medium. The precedence change only applies to callers that pass `locale` explicitly, and none exist today.

### Phase 2: Messages zone
4. **Create `backoffice.json` in fr and en** (files: `messages/fr/backoffice.json`, `messages/en/backoffice.json`)
   - Action: `{ "localeSwitcher": { "label": "Langue du backoffice" | "Backoffice language", "fr": "Français", "en": "English" } }`. Language names are endonyms, identical in both files.
   - No dedicated test: the repo-wide parity test in `i18n/messages.test.ts` already covers the new zone, and a copy-coupled test is forbidden.
   - Dependencies: before 2(a) and 3(g) go green.
   - Risk: Low.

### Phase 3: Switcher and shell (bullets 1 and 2)
5. **Red → green: `LocaleSwitcher`** (files: `app/(backoffice)/admin/_components/locale-switcher.tsx`, `locale-switcher.test.tsx`)
   - Tests (jsdom; mock `next/navigation`'s `useRouter` to spy on `refresh`; wrap with `NextIntlClientProvider locale="fr"` and the real `backoffice.json`):
     - clicking EN writes `admin_locale=en` to `document.cookie` and calls `refresh` exactly once;
     - the active locale's button has `aria-pressed="true"`.
   - Code: `'use client'`, `useLocale`, `useTranslations("backoffice.localeSwitcher")`, `useRouter`, `useTransition`. Duplicate the cookie name as a literal, with a comment pointing to `i18n/request.ts`: a server module cannot import a value from a `'use client'` file, because it would get a client reference instead of the string. The E2E test catches any drift between the two.
   - Dependencies: step 4.
   - Risk: Low.
6. **Wire next-intl into the backoffice root layout** (file: `app/(backoffice)/layout.tsx`)
   - Action:
     - `getLocale()` + `getMessages()` → `<html lang={locale}>`;
     - `NextIntlClientProvider` around the sidebar `<Suspense>`, the content column and the `<Toaster/>`;
     - a slim `<div className="flex justify-end px-6 pt-4"><LocaleSwitcher/></div>` at the top of the `flex-1` column. It also shows on `/admin/login`, where the sidebar renders null; that is acceptable, since an admin can pick a language before signing in;
     - `instant = false` only if step 0 requires it, with a comment citing the Next doc.
   - No Vitest test: Vitest cannot render an async root layout (docs/09). This step is covered by E2E (step 7).
   - Dependencies: steps 2, 4, 5.
   - Risk: High (R2, R5).

### Phase 4: E2E (`e2e/backoffice-locale.spec.ts`)
7. **Playwright journeys** (sign in with `SEED_ADMIN` as in `e2e/admin-auth.spec.ts`)
   - J1 default: a fresh context with `locale: "en-US"` (Accept-Language en), on `/admin/login` and `/admin` → `html[lang=fr]`, FR pressed (bullets 2 and 3).
   - J2 switch:
     - on `/admin`, run `window.__noReload = 1`, click EN;
     - then `html[lang=en]`, the URL is still `/admin`, `__noReload` is still defined (no document reload), the sidebar is visible (session intact), and `context.cookies()` has `admin_locale=en` with `path=/admin`;
     - navigate to `/admin/settings` → still `en`; reload → still `en`; click FR → `fr` (bullets 1 and 2).
   - J3 isolation: with `admin_locale=en` set, `/lettre-pro` still has `html[lang]` equal to the product's locale (`fr`). The product branch is unaffected.
   - Regression pass: `e2e/admin-auth.spec.ts`, `admin-http-status.spec.ts`, `portfolio.spec.ts`, `product.spec.ts`, `landing.spec.ts`, `seo.spec.ts`, `not-found.spec.ts`.
   - Dependencies: step 6.
   - Risk: Medium (build time on the single E2E slot).

## Testing Strategy
- Unit: `i18n/request.test.ts` holds the 3 existing tests, unchanged, plus (a)–(h). `locale-switcher.test.tsx` holds 2 tests. `i18n/messages.test.ts` covers fr/en parity for free.
- Integration: none needed, since there is no database access. The build check in step 0 plays that role for Cache Components.
- E2E: J1–J3 plus the regression list above.
- Bullet 4 has no test on purpose: nothing in Périmètre can touch the schema. `/verify` checks `git diff --stat origin/$(git config msb.integration)...HEAD -- lib/db drizzle` is empty.

## Risks & Mitigations
- **R1 (decided by the orchestrator — see below).**
- **R2 (HIGH): Cache Components and a cookie-driven `<html lang>`.**
  - Reading the cookie at the top of a root layout makes the whole backoffice subtree request-bound, and the static-shell check may fail the build.
  - Mitigation: the step 0 spike. If needed, `export const instant = false` on `app/(backoffice)/layout.tsx` only; it is scoped to the backoffice because each group has its own root layout. Approved by the orchestrator (see below).
- **R3 (HIGH): conflict with I18N-MARKETING on `i18n/request.ts`, and probably on `i18n/request.test.ts`.** Resolved by the orchestrator's merge-order decision below.
- **R4 (MEDIUM): marketing pages falling through to the cookie branch.**
  - Mitigation: the cookie branch is strictly last, scoped to `path=/admin`. The post-merge `pnpm build` check in R3 catches any dynamic-render regression.
- **R5 (MEDIUM): existing admin E2E rely on French labels.** Each Playwright test starts with a fresh context (no cookie) so the default stays `fr`.
- **R6 (MEDIUM): future cached admin code calling `getTranslations()` would hit `cookies()`.** Mitigation: a comment in `request.ts` telling callers inside cached scopes to pass `locale` explicitly.
- **R7 (LOW, security): the cookie is set by JS, not HttpOnly.** Non-sensitive preference, strict `fr|en` whitelist server-side, `SameSite=Lax`, `Secure` on https, `path=/admin`. Call this out for security-reviewer in the PR.
- **R8 (LOW): frozen contract precedence.** An explicit `locale` takes priority (next-intl's documented semantics); the 3 original tests pass unmodified. State this in the PR body since `request.ts` is a contract SA-01 and I18N-SEO consume.
- **R9 (LOW): client payload.** Only the `backoffice` namespace goes to the client provider.

## Orchestrator decisions (replacing the planner's open questions)
1. **R1 — scope.** Accepted as "mechanism + switcher" for this spec: the acceptance bullets only require the locale/document context to switch and the mechanism to exist, not that every hardcoded French string in `admin/**` is translated (that would multiply the Périmètre across every BO-* screen and _actions.ts, well past this spec's cost). `tdd-guide` stays inside the current Périmètre. Full backoffice string translation is out of scope for this run; note it as a possible future spec, not blocking.
2. **R2 — Cache Components.** `export const instant = false` on `app/(backoffice)/layout.tsx` is acceptable if the step 0 spike requires it. Do not fall back to the inline-script/flash-prevention pattern unless the opt-out itself fails to build.
3. **R3 — merge order.** I18N-MARKETING merges first into the integration branch (broader surface: it also touches `proxy.ts`). I18N-BACKOFFICE then merges the integration branch into `feat/i18n-backoffice` (never rebases), resolves `i18n/request.ts` / `i18n/request.test.ts` by hand in the documented order (explicit → product → `requestLocale` → cookie), re-runs `pnpm vitest run i18n/` and one `pnpm build`, then re-runs `/verify` before its own merge. If I18N-BACKOFFICE happens to be READY first, the orchestrator merges it first instead and I18N-MARKETING does the equivalent resolution.
4. **CORRECTION (supersedes the "Target shape of `i18n/request.ts`" snippet above).** The sister spec's plan caught a real bug in that snippet: destructuring `{ locale: explicit, requestLocale }` together in the outer `getRequestConfig` signature reads the `requestLocale` getter eagerly, which calls `headers()` and taints *every* render — including every product landing (SA-01) — as dynamic, regardless of whether this branch is even reached. `i18n/request.ts` is the single `getRequestConfig` for the whole app, so this would have broken SA-01's static prerender.
   Corrected rule for this spec's own code: never destructure `requestLocale` anywhere. This spec only needs `params.locale` (a plain value, safe to read unconditionally — never derived from `headers()`) for the explicit-override branch, and `cookies()` in its own terminal fallback branch. It never reads `requestLocale` at all; that property belongs solely to I18N-MARKETING's branch, inserted between the product branch and this spec's cookie fallback. See `.claude/plans/I18N-MARKETING.plan.md` in the sister worktree for the full reconciled shape.
