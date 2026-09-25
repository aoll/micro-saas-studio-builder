# Plan: SA-01 · Landing

**Source spec**: specs/SA-01-landing.md
**Complexity**: Medium (one page, six small server components, one message zone, one e2e file)

## Summary

Replace the placeholder `/[app]` page with the product landing: hero (title, promise, CTA to `/{slug}/tool`), example
result, "comment ça marche", pricing, FAQ, all read from the config through the frozen, cached `getProduct(slug)`. The
layout comes from the theme's `landingVariant` (`centered | split | minimal`) via the cached `getTheme(themeId)`. The page
renders the `<TrackVisit>` stub and a `'use cache'` `generateMetadata` (seoTitle, seoDescription). `generateStaticParams`
already lives in the `[app]` layout; the session badge is already under `<Suspense>`, so the page stays in the static
shell as long as it only awaits cached data.

## Orchestrator decisions (binding)

1. **R1 accepted**: `messages/fr/landing.json` and `messages/en/landing.json` (CLAUDE.md: each spec ships its zone).
2. **R2 deferred**: no `@next/playwright`, no `next.config.ts` change. The `instant()` check belongs to the E2E phase
   (E2E-demo). Bullet 3 rests here on `pnpm build` (`/lettre-pro` prerendered, no blocking-route error) plus unit tests;
   say so in the PR body. `e2e/landing.spec.ts` has no `instant()` block.
3. **R3 accepted**: one-line edit of `e2e/skeleton.spec.ts` (`h1` "LettrePro" → `getByRole("banner")` contains
   "LettrePro"), in its own commit that says why.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Root param | `app/(products)/[app]/layout.tsx:29-35` | `const slug = await app(); const product = slug ? await getProduct(slug) : null; if (!product) notFound();`; missing theme throws |
| Cache + tag | `lib/dal/products.ts:50-53`, docs/04 SEO | `"use cache"; cacheLife("max"); cacheTag(\`product:${slug}\`)` |
| Pricing card | `components/product/pack-card.tsx:12-40` | Reuse `PackCard({ pack, costPerGeneration, action })` |
| Link to a page not built yet | `components/product/header-balance.tsx:22` | `as Route` + comment naming the spec |
| Messages | `messages/fr/common.json` | Namespace = zone, no wrapper, ICU plurals, same keys fr/en |
| Component tests | `components/product/pack-card.test.tsx:1-23` | jsdom, `afterEach(cleanup)`, `NextIntlClientProvider` |
| Async Server Component tests | `components/product/header-balance.test.tsx:24-33` | `const ui = await Component(props); render(ui)` |
| Mocks | `i18n/request.test.ts:9-13`, `lib/dal/products.test.ts:5-12` | `next/root-params`, `next/cache`; Vitest 5 resets mocks → set values per test |
| E2E seed read | `e2e/themes.spec.ts:28-36` | Direct Drizzle + `requireDatabaseUrl()`, frozen Zod parse, `sql.end()` in `finally` |

## Design decisions

1. Slug from `app()` (not `params`), like the layout and `i18n/request.ts`.
2. No second `generateStaticParams` (the layout's covers `[app]`).
3. Sections are sync Server Components with `useTranslations("landing")`, no `"use client"` (only `PackCard` and the
   `TrackVisit` stub are client).
4. Content mapping: eyebrow `landing.seoTitle`; `h1` `headline`; promise `subheadline`; CTA generic `hero.cta`; free hint
   only when `anonymousFreeGenerations > 0`; pack action = link to the tool ("Commencer").
5. Empty data (blank `exampleOutput`, missing/empty `steps`, empty `faq`) renders nothing for that section.
6. All three variants render all five sections, differing only in layout (`centered`: centred hero, stacked; `split`:
   hero and example side by side from `md`; `minimal`: left-aligned, no card chrome), via a
   `satisfies Record<LandingVariant, …>` map.
7. Killed products: SA-08's (layout). The page only handles `null`.

## Files to Change

| File | Action |
|---|---|
| `app/(products)/[app]/page.tsx` + `page.test.tsx` | UPDATE / CREATE |
| `app/(products)/[app]/_components/landing/{landing,hero,example-result,how-it-works,landing-pricing,faq}.tsx` + tests | CREATE |
| `messages/fr/landing.json`, `messages/en/landing.json` | CREATE (decision 1) |
| `e2e/landing.spec.ts` | CREATE (not run) |
| `e2e/skeleton.spec.ts` | UPDATE, one line (decision 3) |

Unchanged: `[app]/layout.tsx` (SA-08), `lib/**`, `components/**`.

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(app): …`), `pnpm exec knip`. Component tests: jsdom +
`afterEach(cleanup)`. Fixture: a typed `Product` from `fixtures/lettre-pro.config.json` parsed with
`productConfigSchema` plus `id` / `version` / `isSeed`; messages `{ common, landing }`.

1. **Message zone** — test: fr and en `landing.json` have identical key paths. Keys (fr): `hero.cta` "Essayer
   gratuitement"; `hero.freeHint` "{count, plural, one {1re génération offerte} other {# générations offertes}} · sans
   inscription"; `example.title` "Exemple de résultat"; `steps.title` "Comment ça marche"; `pricing.title` "Tarifs";
   `pricing.signupBonus` "{count, plural, one {# crédit offert} other {# crédits offerts}} à l'inscription";
   `pricing.cta` "Commencer"; `faq.title` "Questions fréquentes". English equivalents ("Try it free", …).
2. **`Hero`** — `h1` = headline, subheadline and eyebrow shown; link "Essayer gratuitement" → `/lettre-pro/tool`; free
   hint for 1, absent for 0; en CTA "Try it free". `<Button asChild size="lg"><Link href={`/${slug}/tool` as Route}>`
   with "drop the cast once SA-02 ships `[app]/tool/page.tsx`".
3. **`ExampleResult`** — label + text with line breaks kept (`whitespace-pre-line`, plain text); undefined or blank →
   renders nothing. `Card`, or bare `<blockquote>` for minimal.
4. **`HowItWorks`** — heading, `<ol>` one item per step in order; undefined/empty → nothing. Numbered circles in
   `bg-primary text-primary-foreground`.
5. **`LandingPricing`** — heading "Tarifs"; one `PackCard` per pack ("10 crédits", "4,90 €", "Recommandé" on pack-50);
   actions link to `/lettre-pro/tool`; signup bonus line for 3, absent for 0.
6. **`Faq`** — heading; one `<details>` per entry (`<summary>` = question); empty → nothing. Native, no JS.
7. **`Landing`** — `it.each` over the 3 variants: `data-variant`, h1, example, steps, pricing and FAQ headings present;
   `split`: example inside `landing-hero` test id; `centered`: example outside, `data-align="center"`; `minimal`: bare
   blockquote, `data-align="start"`. One short function per variant.
8. **`page.tsx`** — mocks `next/root-params`, `@/lib/dal/products`, `@/lib/dal/themes`, `next/cache`,
   `next/navigation` (`notFound` throws `NEXT_NOT_FOUND`): lettre-pro + `split` theme → headline and
   `data-variant="split"`, `getProduct("lettre-pro")` called; `getProduct` null or `app()` undefined → `NEXT_NOT_FOUND`;
   `getTheme` null → error naming the slug. Page: `app()` → `getProduct` → `notFound()` → `getTheme` →
   `<><TrackVisit slug/><Landing product variant/></>`.
9. **`generateMetadata`** — lettre-pro → `{ title: seoTitle, description: seoDescription }`, `cacheLife("max")`,
   `cacheTag("product:lettre-pro")`; unknown → `{}`. `"use cache"` inside; no `metadataBase`/canonical (I18N-SEO).
10. **`e2e/landing.spec.ts`** (written, not run, no `instant()`) — read lettre-pro's config via Drizzle; content and
    `[data-variant="centered"]`, `<details>` opens, CTA href (do not click: `/tool` is SA-02's); raw HTML contains
    `<title>` and meta description, `toHaveTitle`. Comment: only editorial is seeded; the other variants are covered by
    unit tests.
11. **Decision 3** — the `e2e/skeleton.spec.ts` one-liner, own commit.
12. **Real page + full validation** — `AI_MODE=mock pnpm exec next dev --port 3217`, `curl -s localhost:3217/lettre-pro`
    contains "Comment ça marche", the headline and the `<title>`; stop the server. `pnpm build` (`/lettre-pro`
    prerendered, no blocking-route error), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`,
    `pnpm test`, `pnpm check`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `/${slug}/tool` not a route until SA-02 | Certain | `as Route` + comment; PR note |
| `generateStaticParams` lives in the layout | Low | Proven by `pnpm build`; PR note |
| `generateMetadata` in the page, not the layout | Low | Page metadata merges over the layout's |
| Parallel specs: SA-08 edits `layout.tsx`, TRACKING the `TrackVisit` body, SA-04 reuses `PackCard` | Medium | This spec writes only `page.tsx` and `_components/landing/**` |
| next-intl in sync RSC vs Vitest | Low | Real-page check; fallback `getTranslations` in the page |
| Only editorial seeded | Medium | Unit tests cover the 3 variants |
| Copy differs from the mockup | Low | Mockups fix structure, not copy |

## Acceptance

- [ ] Bullet 1: section tests + `page.test.tsx`; CTA `/lettre-pro/tool`; e2e written
- [ ] Bullet 2: `landing.test.tsx` covers the 3 variants; variant from `getTheme(...).landingVariant`
- [ ] Bullet 3: cached `getProduct` asserted; `pnpm build` shows `/lettre-pro` prerendered (instant() deferred)
- [ ] Bullet 4: `generateMetadata` test; `<title>` and description in real HTML
- [ ] fr/en keys identical; real page checked in `next dev`
- [ ] `pnpm check` green; PR title `feat(app): SA-01 product landing`
