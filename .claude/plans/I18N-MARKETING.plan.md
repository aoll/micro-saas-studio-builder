# Implementation Plan: I18N-MARKETING · Language switcher for the landing and making-of

**Source spec**: specs/I18N-MARKETING.md. Worktree: /home/user/micro-saas-studio-builder-i18n-marketing
**Complexity**: Medium overall. The `proxy.ts` and `i18n/request.ts` changes are High risk. The rest is mostly moving text into messages.
**Context read**: all 14 files of docs/, CLAUDE.md, the spec, the sister spec I18N-BACKOFFICE, specs/README.md, and the current code (proxy.ts and its test, i18n/*, messages/manifest.ts, app/(marketing)/**, e2e/home.spec.ts, e2e/making-of.spec.ts, playwright.config.ts). Also the installed sources of next-intl 4.14.7 and the Next 16.3.6 docs in node_modules.

## Overview

This plan adds next-intl i18n routing to the `(marketing)` group only: `fr` without a prefix, `en` under `/en`. The locale comes from Accept-Language on the first visit, then from the `NEXT_LOCALE` cookie. `i18n/request.ts` gets a marketing branch between the product branch and the backoffice fallback. `proxy.ts` sends `/`, `/making-of`, `/en…` and `/fr…` through `createMiddleware` before the admin guard and the anonymous_id cookie. Every text of the landing and the making-of (including `_data/run.ts`) moves into `messages/{fr,en}/marketing.json` and `making-of.json`.

## Five findings that shape the plan (checked in node_modules)

1. **There can be no `[locale]` segment.** `createMiddleware` always rewrites to an internal `/{locale}/…` path: `/` goes to `/fr`, `/making-of` to `/fr/making-of`, and `/en` stays `/en`.
   - A top-level `app/(marketing)/[locale]` would clash with `(products)/[app]`: Next refuses two different slug names at the same level. It is also outside the Périmètre.
   - Left as is, the rewrite to `/fr` or `/en` would land on `(products)/[app]` with `app="fr"` and give a 404 (SA-08).
   - **Decision:** `proxy.ts` keeps next-intl's decisions (redirects, cookie, `Link` header). When next-intl does not redirect, the proxy builds its own `NextResponse.rewrite`/`next` to the **unprefixed** path: `/en` goes to `/`, `/en/making-of` to `/making-of`, `/making-of` stays `/making-of`. It sets the request header `X-NEXT-INTL-LOCALE`, which is what `requestLocale` reads.
   - This holds because, when there is no redirect, the locale is `en` exactly when the path starts with `/en`, and `fr` otherwise. With `as-needed`, every unprefixed request resolved to `en` is redirected.
2. **`params.requestLocale` is a lazy getter over `headers()`.** Merely accessing it (even without awaiting) taints the render as dynamic, because Next's tracking fires on the call to `headers()` inside the getter, not on the `await`. Destructuring `async ({ requestLocale }) =>` in the outer function signature reads the getter immediately and breaks the static prerender of every product page (SA-01), since `i18n/request.ts` is the shared `getRequestConfig` for the whole app.
   - **The function must never destructure `requestLocale` (or bundle it with `locale`) in its outer signature.** It takes a single `params` object and reads `params.requestLocale` by property access, only inside the marketing branch, only after the product branch has already returned. See "Orchestrator decisions" below: this directly fixes a bug in the sister plan.
   - Tests pin this (step 2): a getter-spy proves the product branch never touches `requestLocale`.
3. **The marketing pages become dynamic.** The locale lives in a request header, and there is no segment to prerender per locale. The marketing root layout needs `<html lang>` outside any `<Suspense>`.
   - **Decision:** add `export const instant = false` in `app/(marketing)/layout.tsx`. This opts the group out of static-shell validation. It only covers `/` and `/making-of`, since it is that group's own root layout.
   - `listProducts` stays `'use cache'`, so the cost is low. Note this trade-off in the PR.
4. **Only a hard navigation switches the language reliably.** `/` and `/en` rewrite to the same internal route tree, so a soft `<Link>` navigation could reuse the root layout segment: stale `<html lang>`, stale provider and stale switcher.
   - The French link must be forced to `/fr/…` (`getPathname({ …, forcePrefix: true })`). Otherwise a `NEXT_LOCALE=en` cookie redirects `/` back to `/en` and you can never switch back to French.
   - **Decision:** the switcher is a **Server Component** with two plain `<a href>` (full page load, zero client JS). The cookie is set by the middleware's cookie sync on the document request: it sets it when the cookie is stale, or when the chosen locale differs from Accept-Language.
5. **The default cookie is a session cookie.** For "visites suivantes", set `localeCookie: { maxAge: 60 * 60 * 24 * 365 }` in `defineRouting`, the same one year as `anonymous_id`. The name stays `NEXT_LOCALE`.

## Requirements (acceptance bullets and their test)

- **R1.** First visit to `/` or `/making-of` without `NEXT_LOCALE`: browser language if it is fr or en, fr otherwise. Tested in `proxy.test.ts` and e2e.
- **R2.** The header switcher toggles `/…` and `/en/…`, sets `NEXT_LOCALE`, and that preference beats detection on later visits. Tested in `proxy.test.ts` (cookie precedence, `/fr…` redirect plus Set-Cookie with Max-Age) and e2e.
- **R3.** `/en` and `/en/making-of` return 200 and are entirely in English, including `_components/` and `_data/run.ts`; `/making-of` stays French. Tested in e2e, the `run.test.ts` message-coverage test, and the existing `i18n/messages.test.ts` parity test, which picks up the new zones automatically.
- **R4.** `/{slug}`, `/admin*` and `/api/*` never go through the marketing middleware; no regression on SA-01, I18N-SEO or BO-01. Tested in `proxy.test.ts` and `i18n/request.test.ts`; the existing e2e run in the E2E phase.
- **R5.** `proxy.ts` keeps a single `proxy` export, and the matcher comment is corrected. Tested by a module-shape assertion in `proxy.test.ts`; the comment is checked in review.

Note on R3 vs R1: "`/making-of` reste en français" only holds for a browser that is not in English, or that has a `NEXT_LOCALE=fr` cookie. An en-US browser without a cookie is redirected to `/en/making-of` by R1. The e2e checks R3 in a `fr-FR` context.

## Architecture changes

| File | Change |
|---|---|
| `i18n/marketing-routing.ts` (new) | `marketingRouting = defineRouting({ locales: ["fr","en"], defaultLocale: "fr", localePrefix: "as-needed", localeCookie: { maxAge: 31536000 } })`. Also exports a pure `marketingPath(pathname)` that returns `{ locale, pathname }`, or `null` when the path is not one of `/`, `/making-of` (optionally prefixed by `/fr` or `/en`, trailing slash normalized). |
| `i18n/marketing-navigation.ts` (new) | `export const { Link, getPathname } = createNavigation(marketingRouting)`. Export only what is used: knip is part of `pnpm check`. |
| `i18n/request.ts` | Reconciled shape below (explicit → product → marketing → backoffice cookie). Same default-export signature; product branch behaviour unchanged. |
| `proxy.ts` | Marketing branch first; `"/"` added to `config.matcher`; comment rewritten; the inbound `x-next-intl-locale` header is stripped on the `/admin` branch (R-H below). Admin guard and anonymous_id logic otherwise untouched. |
| `messages/{fr,en}/marketing.json`, `messages/{fr,en}/making-of.json` (new) | Same keys in both languages; ICU plurals with the same arguments. |
| `app/(marketing)/layout.tsx` | `lang={await getLocale()}`, `<NextIntlClientProvider>`, `export const instant = false`. |
| `app/(marketing)/page.tsx`, `making-of/page.tsx` | `generateMetadata` built from `getTranslations`; canonical `/` or `/en`; `alternates.languages` (fr, en, x-default). The landing gets a small `<header>` with the switcher. |
| `app/(marketing)/_components/*`, `making-of/_components/*` | Text from `useTranslations` (sync Server Components) or `getTranslations` (async ones); internal links to `/` and `/making-of` use the marketing `Link`. |
| `app/(marketing)/making-of/_data/run.ts` | Figures and stable ids only; human text moves to `making-of.json`. |
| `app/(marketing)/_components/locale-switcher.tsx` (new) | Server Component; two `<a>` links. |
| `e2e/marketing-locale.spec.ts` (new) | The user journeys. |
| `e2e/home.spec.ts`, `e2e/making-of.spec.ts` | Pin `test.use({ locale: "fr-FR" })` — now in Périmètre (R-F, orchestrator decision below). |

### Reconciled target `i18n/request.ts`

This is the single shape both sister specs converge to — it replaces the two independent sketches either plan wrote alone, and fixes a bug the backoffice plan's sketch had (see "Orchestrator decisions"):

```ts
export default getRequestConfig(async (params) => {
  // 0. Explicit override (I18N-BACKOFFICE: a Server Action passes its own locale,
  //    since next/root-params throws there). `params.locale` is a plain value set by
  //    the caller, never derived from headers() — safe to read unconditionally.
  if (params.locale !== undefined) {
    const locale = toLocale(params.locale);
    return { locale, messages: await loadMessages(locale) };
  }
  // 1. Product (unchanged): root param [app] → product locale, fr for an unknown slug.
  const slug = await app();
  if (slug) {
    const product = await getProduct(slug);
    const locale = product?.locale ?? "fr";
    return { locale, messages: await loadMessages(locale) };
  }
  // 2. Marketing: locale resolved by the next-intl middleware in proxy.ts.
  //    Read here and never earlier: `params.requestLocale` is a getter over headers(),
  //    and merely accessing it — even unawaited — taints the render as dynamic. Never
  //    destructure `requestLocale` (or bundle it with `locale`) in the outer signature.
  const marketingLocale = await params.requestLocale;
  if (hasLocale(marketingRouting.locales, marketingLocale)) {
    return { locale: marketingLocale, messages: await loadMessages(marketingLocale) };
  }
  // 3. Backoffice (I18N-BACKOFFICE: admin_locale cookie), fr by default.
  return backofficeLocale();
});
```

`hasLocale` is re-exported by `next-intl` from use-intl. If it turns out not to be, use a local `(marketingRouting.locales as readonly string[]).includes(x)` guard. `toLocale` and `backofficeLocale` belong to I18N-BACKOFFICE; this spec leaves branch 3 as the one-line `fr` fallback it already is today, so the sister spec's diff stays a clean append, not a rewrite of a line this spec also touches.

### Target `proxy()` shape

```ts
const handleMarketingI18n = createMiddleware(marketingRouting);

export function proxy(request: NextRequest): NextResponse {
  const marketing = marketingPath(request.nextUrl.pathname);
  if (marketing) return marketingI18n(request, marketing); // before the two existing rules
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const stripped = stripSpoofableLocaleHeader(request); // R-H
    return adminSessionGuard(stripped) ?? NextResponse.next({ request: { headers: stripped.headers } });
  }
  /* anonymous_id: unchanged */
}
```

`marketingI18n` works as follows:
- Call `handleMarketingI18n(request)`. If it redirects (`location` header), return that response unchanged: 307 to `/en`, or from `/fr…` to the unprefixed path, with Set-Cookie.
- Otherwise build `NextResponse.rewrite(unprefixedUrl, { request: { headers } })`, or `NextResponse.next({ request: { headers } })` when the path is already unprefixed, with `X-NEXT-INTL-LOCALE: <locale>`.
- Copy next-intl's cookies (`routed.cookies.getAll()`) and its `Link` header onto that response.
- Hard-code the header name as a named constant, with a comment pointing to next-intl's internals.

Marketing paths no longer receive `anonymous_id`. `/making-of` used to get one because it matched the product pattern; that cookie only matters for product beacons (QA1-P1-B4). The matcher only needs `"/"` added: `/en`, `/fr`, `/making-of` and `/en/making-of` already match the first pattern.

## Implementation steps

Each step is one red→green cycle, then commit and push. Scopes: `feat(app)` / `test(app)`.

### Phase 1: Routing core (proxy and request config)

1. **Routing config** (File: `i18n/marketing-routing.ts`)
   - Action: `defineRouting` as above, plus `marketingPath()`. No test of its own: it is exercised through the proxy tests in step 3, to avoid a mirror test of a config object.
   - Dependencies: none. Risk: Low.
2. **Marketing branch in request config** (Files: `i18n/request.ts`; tests in a new colocated `i18n/request-marketing.test.ts`, kept separate from `i18n/request.test.ts` so this spec's additions never land in the same file/hunks as the sister spec's)
   - Red tests:
     - (a) With no slug and `requestLocale` resolving to `"en"`: locale `en`, `messages.marketing` present once step 5 exists. Before that, check `common` in English.
     - (b) With a slug and a `requestLocale` **getter spy**: the product locale wins and the getter is **never read**. This guards finding 2 and product static rendering.
     - (c) With no slug and `requestLocale` `undefined`, `"de"` or garbage: falls through to the existing `fr` fallback (unchanged behaviour, not this spec's to re-test).
     - (d) With `params.locale` explicitly set to `"en"`: returns `en` without calling `app()` or reading `requestLocale` — proves the reconciled shape's branch 0 does not regress once I18N-BACKOFFICE also needs it.
   - The three existing tests in `i18n/request.test.ts` must stay green unchanged; this spec does not edit that file.
   - Dependencies: step 1. Risk: High, because it touches a frozen contract consumed by SA-01 and I18N-SEO.
3. **Chain next-intl in the proxy** (Files: `proxy.ts`, `proxy.test.ts`). Red tests in a new `describe("marketing i18n")`:
   - `/` with `Accept-Language: en-US` and no cookie: 307 to `/en`, no `NEXT_LOCALE` set.
   - `/` with `de-DE`, and `/` with `fr-FR`: no redirect, no rewrite to `/fr`, locale header `fr`.
   - `/` with `NEXT_LOCALE=en` and `fr-FR`: 307 to `/en` (the preference beats detection).
   - `/making-of` with `NEXT_LOCALE=fr` and `en-US`: no redirect, locale `fr`.
   - `/en`: rewrite to `/`. `/en/making-of`: rewrite to `/making-of`. Locale header `en` in both cases.
   - `/en` with `fr-FR` and no cookie: `NEXT_LOCALE=en; Max-Age=31536000; SameSite=Lax; Path=/`.
   - `/fr/making-of` with `NEXT_LOCALE=en`: 307 to `/making-of` plus `NEXT_LOCALE=fr`.
   - R4 regressions:
     - `/lettre-pro` and `/lettre-pro/tool` with `en-US` and a `NEXT_LOCALE=en` cookie: no redirect, no `NEXT_LOCALE` Set-Cookie, no locale header, and `anonymous_id` still minted.
     - `/en/lettre-pro` is not treated as marketing.
     - `/admin` with `en-US`: 307 to `/admin/login`, unchanged, and no locale header.
   - R-H: `/admin` with a forged `x-next-intl-locale: en` inbound request header: the header is not present on the forwarded request (spy on the downstream `headers`).
   - Matcher: `/`, `/en`, `/en/making-of`, `/fr` and `/making-of` match; the `/api/*` and static exclusions are unchanged.
   - **The existing assertion `does not match http://demo.example/` moves to "matches" in its own commit.** The message must explain that R5 makes `/` a real route. This is a committed test changed on purpose, not weakened.
   - R5: the module exports exactly `config` and `proxy`, so no `default` or `middleware` export can make Next pick another entry point.
   - Rewrite the matcher comment: `/` and `/making-of` are now real routes and go through next-intl; product pages and admin do not.
   - Dependencies: step 1. Risk: High.

### Phase 2: Messages, layout and navigation

4. **Navigation helpers** (File: `i18n/marketing-navigation.ts`). `Link` and `getPathname` only. Dependencies: step 1. Risk: Low (knip).
5. **Message zones** (Files: `messages/{fr,en}/marketing.json`, `messages/{fr,en}/making-of.json`)
   - Namespaces:
     - `marketing`: `metadata`, `localeSwitcher`, `hero`, `keyNumbers`, `backofficeScreens`, `whyThisDemo`, `productsShowcase`, `howItsBuilt`, `footer`.
     - `making-of`: `metadata`, `header`, `keyFigures.<id>`, `processSteps.<id>.{title,who}`, `timeline`, `cycles`, `agentRoles.jobs.<role>`, `qaLanes.<id>`, `footer`.
   - Plurals in ICU, e.g. `{count, plural, one {# constat} other {# constats}}` / `one {# finding} other {# findings}`.
   - `messages/manifest.ts` globs the new files automatically, and `i18n/messages.test.ts` checks fr/en parity for free. The red test is that parity test once one locale's file exists.
   - Dependencies: none. Risk: Low.
6. **Marketing root layout** (File: `app/(marketing)/layout.tsx`)
   - Async layout: `lang={await getLocale()}`, `<NextIntlClientProvider>` (needed by next-intl's `Link`, whose client component calls `useLocale`), and `export const instant = false`.
   - Client messages: none required today, since no client leaf translates. Do not ship all zones.
   - Covered by e2e (`html[lang]`). Dependencies: steps 2 and 3. Risk: Medium (finding 3).

### Phase 3: Translate the pages

7. **Landing** (Files: `page.tsx` and `_components/{hero,key-numbers,backoffice-screens,why-this-demo,products-showcase,how-its-built,site-footer}.tsx`)
   - Use `useTranslations("marketing")` in the sync components and `getTranslations` in `KeyNumbers` and `ProductsShowcase`.
   - Format figures with `useFormatter`/`getFormatter().number` (fr gives "1 833", en gives "1,833").
   - Sort with `localeCompare(…, locale)`.
   - `/making-of` links use the marketing `Link`. `/admin/login`, `/{slug}`, `#produits`, mailto and external links stay as they are.
   - `generateMetadata` replaces the static `metadata`.
   - `products-showcase.test.tsx` needs a `next-intl/server` mock (same pattern as `app/(products)/not-found.test.tsx`). Its assertions are unchanged, and the change goes in its own commit with the reason.
   - Screenshots in `public/landing/` stay French captures; their alt text is translated.
   - Dependencies: steps 4–6. Risk: Medium, mostly volume.
8. **Making-of data and components** (Files: `making-of/_data/run.ts`, `run.test.ts`, `making-of/_components/*`, `making-of/page.tsx`)
   - `AGENT_ROLES` becomes `{ role, count }`, `PROCESS_STEPS` becomes `{ id, humanGate }`, and `KEY_FIGURES` becomes `{ id, value: number }`.
   - QA lanes keep a unique `name` ("QA · P1-B3") plus a `labelId` whose text lives in messages. Implementation lane names are spec identifiers and stay as they are.
   - Red test in `run.test.ts`: every role, step id, figure id and QA `labelId` has a message in **both** `making-of.json` files. The parity test does not catch that drift between data and messages.
   - Translate the timeline texts: `title`s, `aria-label` "Worktrees du run", table headers, and "Cycle 1 · implémentation". The fr value of `aria-label` must stay exactly "Worktrees du run": `e2e/making-of.spec.ts` uses it.
   - Also translate the making-of footer and add `generateMetadata`.
   - Dependencies: steps 4–6. Risk: Medium.
9. **Language switcher** (File: `app/(marketing)/_components/locale-switcher.tsx`)
   - Async Server Component. Props: `pathname: "/" | "/making-of"`.
   - `getLocale()`, then `<nav aria-label>` with two `<a href={getPathname({ href: pathname, locale, forcePrefix: true })} hrefLang lang>`: "Français" and "English". The current one gets `aria-current="true"`.
   - Placement:
     - Landing: a new `<header>` at the top of `page.tsx`.
     - Making-of: the top row of `control-room-header.tsx`, next to "Retour à la démo".
   - The switcher is not in the layout: the layout cannot know the current path without a client `usePathname`, which the Next docs flag as a hydration risk behind proxy rewrites.
   - Covered by e2e: links are not unit-tested (CLAUDE.md). Dependencies: steps 4 and 5. Risk: Medium (finding 4).

### Phase 4: Journeys

10. **E2E** (File: `e2e/marketing-locale.spec.ts`). Write it now and run it in the E2E phase.
    - Detection by browser context: `en-US` lands on `/en`; `de-DE` and `fr-FR` stay on `/`.
    - `/en` and `/en/making-of`: status 200, `html[lang=en]`, English h1 and section headings, English figure labels, role jobs and QA lane labels. Add a short denylist of fr strings, as I18N-SEO did.
    - `/making-of` in `fr-FR` is French.
    - Switching with the `NEXT_LOCALE` cookie: fr-FR, click English, `/en` and cookie `en`, then a fresh `/` visit goes to `/en`. en-US on `/en/making-of`, click Français, `/making-of` and cookie `fr`, then reload `/` stays French.
    - Internal links keep the locale: from `/en`, the making-of link goes to `/en/making-of`.
    - No next-intl on product pages: `/lettre-pro` in `en-US` has no redirect, keeps its product `lang`, and gets no `NEXT_LOCALE` cookie.
11. **Pin the two existing marketing e2e suites** (Files: `e2e/home.spec.ts`, `e2e/making-of.spec.ts`) — R-F, now in Périmètre
    - Add `test.use({ locale: "fr-FR" })` to both, in a commit that explains why: Playwright defaults to `en-US`, which after step 3 redirects `/` and `/making-of` to `/en`, and their assertions are in French. This pins a precondition; it weakens nothing.
    - Dependencies: step 3.

## Testing strategy

- **Unit (TDD loop, `pnpm vitest run <file>`):** `proxy.test.ts`, `i18n/request-marketing.test.ts`, `making-of/_data/run.test.ts`, the adjusted `products-showcase.test.tsx`, and the automatic parity test `i18n/messages.test.ts`.
- **Integration:** none needed; there is no DAL or database change.
- **E2E:** `e2e/marketing-locale.spec.ts`, plus the existing SA-01, seo, admin-auth, home and making-of suites for regressions.
- **Build check:** run one `flock /tmp/msb-queue/build.lock pnpm build` before the PR, following the I18N-SEO precedent. `instant = false` and the dynamic root layout only fail at `next build` or in dev Instant Insights, not in `pnpm check`.

## Risks and mitigations

- **R-A. Textual conflict on `i18n/request.ts` with I18N-BACKOFFICE.** Expected and budgeted (see Orchestrator decisions): this spec writes branches 0–2 of the reconciled shape and leaves branch 3 as today's one-line `fr` fallback; I18N-BACKOFFICE replaces only that fallback. New tests live in a separate file (`i18n/request-marketing.test.ts`) so they never collide with the sister spec's additions to `request.test.ts`. Merge order: I18N-MARKETING first (see below).
- **R-B. `proxy.ts` conflict.** Low: I18N-BACKOFFICE's Périmètre does not include it, since the admin locale is cookie-only and needs no middleware.
- **R-C. `next/root-params` is not available in Server Actions.** `i18n/request.ts` calls `app()` first (well, now after the branch-0 explicit-locale check), and `app()` **throws** inside a Server Action. This spec adds no Server Action; the marketing group has none. Branch 0 of the reconciled shape is exactly what lets I18N-BACKOFFICE's actions call `getTranslations({ locale })` safely, without ever reaching `app()`.
- **R-D. Product landings losing static prerender** if `requestLocale` is read too early. Mitigation: the getter-spy test in step 2 and the `params` (not destructured) signature.
- **R-E. Soft navigation reusing a stale root layout** across `/` and `/en`, which share an internal route tree. Mitigation: plain `<a>` in the switcher, and a forced `/fr` prefix so the cookie is updated server-side.
- **R-F (resolved, see Orchestrator decisions). Existing e2e break outside the original Périmètre**, now folded in as step 11.
- **R-G. Product slugs `en` and `fr` become unreachable**, since the proxy claims `/en` and `/fr`. `RESERVED_SLUGS` in `lib/schemas/product-config.ts` is a frozen contract, so adding `"en"` and `"fr"` needs a follow-up CONTRACT PR — out of scope here, not touched (see Orchestrator decisions).
- **R-H (resolved, see Orchestrator decisions). The `X-NEXT-INTL-LOCALE` header can be spoofed** on `/admin` requests. Folded into step 3/the proxy shape above: the proxy strips any inbound `x-next-intl-locale` header on the `/admin` branch before forwarding.
- **R-I. Header name coupling.** `X-NEXT-INTL-LOCALE` is next-intl-internal. Mitigation: a named constant with a source comment, a unit test on the forwarded header, and the e2e English rendering.
- **R-J. Payload.** `(products)/[app]/layout.tsx` passes all zones to its client provider; out of Périmètre, a follow-up.
- **R-K. `app/sitemap.ts` has no `/en` or `/en/making-of`** and no hreflang. Out of Périmètre, a follow-up. The pages' own `alternates.languages` and next-intl's `Link` header cover hreflang meanwhile.
- **R-L (resolved, see Orchestrator decisions). Colocated tests are in scope** as the tests of Périmètre files: `proxy.test.ts`, `i18n/request-marketing.test.ts`, `run.test.ts`, `products-showcase.test.tsx`.
- **R-M. `instant = false` on the marketing root layout** turns off static-shell validation for `/` and `/making-of` only. Possible later optimization: a `'use cache'` inner shell keyed by locale.

## Orchestrator decisions (replacing the planner's open questions)

1. **Reconciled `i18n/request.ts` shape (fixes a real bug).** The sister plan's sketch destructured `{ locale: explicit, requestLocale }` together in the outer arrow signature. Per finding 2 above, merely accessing `requestLocale` — even via destructuring, even unawaited — taints every render as dynamic, including every product landing (SA-01). The reconciled shape above (explicit → product → marketing → backoffice) is now the single target both specs write to, and I18N-BACKOFFICE has been told to update its own plan and in-progress work to never destructure `requestLocale` in the outer signature, reading `params.requestLocale` only inside the marketing branch this spec owns.
2. **R-F — Périmètre widened.** `e2e/home.spec.ts` and `e2e/making-of.spec.ts` are added to this spec's Périmètre (specs/I18N-MARKETING.md updated on the integration branch): pinning `test.use({ locale: "fr-FR" })` is a mechanical, one-line, justified fix required by this spec's own change, not scope creep.
3. **R-G — deferred, not blocking.** No seeded product uses slug `en` or `fr` today, so the collision is latent. Do not touch `lib/schemas/product-config.ts` (frozen contract, CONTRACT-spec territory) in this spec. Flagged to the human at the end of the run as a follow-up CONTRACT spec (add `"en"`, `"fr"` to `RESERVED_SLUGS`), not a blocker for this run.
4. **R-H — accepted, folded into scope.** Strip the inbound `x-next-intl-locale` header on the `/admin` branch of `proxy.ts` before forwarding. Cheap, stays inside the file this spec already owns, closes a low-severity spoofing gap flagged by the planner. Ask security-reviewer to confirm during `/review`.
5. **R-L — confirmed.** Colocated tests of Périmètre files are in scope, consistent with the I18N-SEO precedent.
6. **Merge order.** I18N-MARKETING merges into the integration branch first (broader surface: also `proxy.ts`, and it introduces the reconciled `i18n/request.ts` shape). I18N-BACKOFFICE then merges the integration branch into its own branch (never rebases) and replaces only the terminal `fr` fallback with its cookie read, re-runs its unit tests and one `pnpm build`, then `/verify` before its own merge.

## Success criteria

- [ ] R1: detection tests (proxy unit and e2e) pass: en goes to `/en`, de and fr stay on `/`.
- [ ] R2: the cookie beats detection. The switcher sets `NEXT_LOCALE` (one year, SameSite=Lax), and switching back to French works with an `en` cookie.
- [ ] R3: `/en` and `/en/making-of` return 200 with `lang="en"` and no French strings, including `run.ts` labels. `/making-of` is French in fr-FR. The `run.ts`↔messages coverage and fr/en parity tests are green.
- [ ] R4: product, admin and api paths are untouched in proxy tests. The request-config product branch never reads `requestLocale`, and the existing `request.test.ts` stays green unchanged.
- [ ] R5: a single `proxy` export (plus `config`), and the matcher comment is corrected.
- [ ] R-H: `/admin` never forwards an inbound `x-next-intl-locale` header.
- [ ] `pnpm check` is green (typecheck, lint, format, knip, unit), one `pnpm build` passes, and `/verify` is READY.
- [ ] Only Périmètre files are touched (now including `e2e/home.spec.ts` and `e2e/making-of.spec.ts`), plus colocated tests.

## Relevant files

- /home/user/micro-saas-studio-builder-i18n-marketing/specs/I18N-MARKETING.md
- /home/user/micro-saas-studio-builder-i18n-marketing/specs/I18N-BACKOFFICE.md
- /home/user/micro-saas-studio-builder-i18n-marketing/proxy.ts and proxy.test.ts
- /home/user/micro-saas-studio-builder-i18n-marketing/i18n/request.ts and request.test.ts
- /home/user/micro-saas-studio-builder-i18n-marketing/app/(marketing)/layout.tsx, page.tsx, making-of/page.tsx, making-of/_data/run.ts
- /home/user/micro-saas-studio-builder-i18n-marketing/e2e/home.spec.ts and e2e/making-of.spec.ts (now in Périmètre, R-F)
- /home/user/micro-saas-studio-builder-i18n-marketing/lib/schemas/product-config.ts (R-G, frozen contract, not touched)
