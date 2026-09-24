# Plan: SA-08 · Produit introuvable

**Source spec**: specs/SA-08-introuvable.md
**Complexity**: Medium. Little code (one check, one page, two message files, one e2e file); the risk is in the framework:
a `notFound()` thrown by the root layout `[app]/layout.tsx` may not be caught by the `not-found.tsx` of the same segment.

## Summary

The product root layout calls `notFound()` when `app()` is `undefined`, the slug is unknown, or the product is `killed`,
before any `<Suspense>` (real HTTP 404). `[app]/not-found.tsx` renders the SA-08 mockup as a Server Component: neutral
studio header "◆ SaaS Studio", a large muted "404", "Ce produit n'est plus disponible", « {name} » when the product exists
but is killed, and "Nos autres outils" linking the active products from the cached `listProducts()`. Texts in a new
`messages/{fr,en}/not-found.json` zone.

## Orchestrator decisions (binding)

1. `messages/fr/not-found.json` and `messages/en/not-found.json` accepted (each spec ships its zone).
2. Task 1 spike first. Outcome C (neither the plain throw nor the fallback-pass shell yields 404 + the SA-08 UI): stop
   and report it as blocking, with the options; deliver Tasks 2, 4, 5 and 7 anyway.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Root param + guard | `app/(products)/[app]/layout.tsx:24-35` | `const slug = await app(); const product = slug ? await getProduct(slug) : null;`; missing product → `notFound()`; missing theme → `throw` |
| Cached public reads | `lib/dal/products.ts:32-46` | `listProducts()` (`'use cache'`, tag `products`, no session check) |
| Async Server Component tests | `components/product/header-balance.test.tsx:1-44` | jsdom, `afterEach(cleanup)`, DAL mocks, `const ui = await Component(props); render(ui)` |
| Messages | `messages/manifest.ts`, `i18n/load-messages.ts` | Namespace = zone, same keys fr/en |
| E2E with DB writes | `e2e/skeleton.spec.ts:33-50` | `postgres(requireDatabaseUrl(), { max: 1 })` + drizzle, `try`/`finally` |
| Neutral colours | `app/globals.css` | No injected theme variable → neutral shadcn look |

## Files to Change

| File | Action |
|---|---|
| `app/(products)/[app]/layout.tsx` + `layout.test.tsx` | UPDATE / CREATE |
| `app/(products)/[app]/not-found.tsx` + `not-found.test.tsx` | CREATE |
| `messages/fr/not-found.json`, `messages/en/not-found.json` | CREATE (decision 1) |
| `e2e/not-found.spec.ts` | CREATE (not run) |

Unchanged: `lib/**`, `i18n/**`, `next.config.ts`, `[app]/page.tsx` (SA-01).

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(app): …`), `pnpm exec knip`. Vitest 5 resets mocks: set
values per test.

### Task 1: spike — how a root-layout `notFound()` renders (~1 h, nothing committed)
Why: `not-found.tsx` renders inside its segment's layout; when the `[app]` layout throws, the only boundary left is the
root-layout-with-slots fallback (`node_modules/next/dist/server/app-render/create-component-tree.js:689-700`), which
re-renders the layout with `not-found.tsx` as children and without the `modal` prop. On throwaway code: add
`if (!product || product.status === "killed") notFound();` and a `not-found.tsx` returning
`<h1 data-testid="sa08">SA-08</h1>`; insert a temporary killed product (`spike-killed`, copy of LettrePro's version row);
`pnpm build` (also checks a killed slug in `generateStaticParams`); `pnpm start --port 3108`; `curl -s -o … -w "%{http_code}"`
on `/zz-unknown` and `/spike-killed`: status 404 and the marker in the HTML; stop the server, delete the row.
Outcomes: **A** 404 + marker → plain throw, skip Task 3. **B** 404 without the marker → Task 3's fallback-pass shell,
re-check. **C** → decision 2. Record the finding in Task 2's commit message and the layout comment.

### Task 2: killed product → `notFound()` in the layout
`layout.test.tsx` (node): mocks `next/root-params`, `@/lib/dal/products`, `@/lib/dal/themes`, `@/i18n/load-messages`,
`@/lib/fonts` (`fontFor` → `{ variable: "font-v", className: "font-c" }`), `@/lib/dal/session`, `@/lib/dal/credits`,
`@/app/globals.css` → `{}`, `next/navigation` (`notFound` throws `NEXT_NOT_FOUND`). Cases: unknown slug rejects; `app()`
undefined rejects without calling `getProduct`; `killed` rejects without calling `getTheme` (red today); active product
resolves with `props.lang` = its locale and `getTheme(themeId)` called. Action:
`if (!product || product.status === "killed") notFound();` before `getTheme`; update the comment (killed check is SA-08's
+ Task 1 finding).

### Task 3 (outcome B only): neutral shell on the fallback pass
Test: killed with `modal: undefined` and `children: <p>nf</p>` → `<html lang={product.locale}>` without `style` or theme
class, children rendered, `ProductHeader` / `getTheme` not called; unknown slug with `modal: undefined` → `lang="fr"`;
with `modal` set → still rejects. Action: inside the guard, `if (modal !== undefined) notFound();` then
`return <html lang={product?.locale ?? "fr"}><body className="flex min-h-dvh flex-col">{children}</body></html>;`, with a
comment citing `create-component-tree.js` and the e2e guard.

### Task 4: message zone `not-found`
Same keys fr/en: `studio` (SaaS Studio), `title` (Ce produit n'est plus disponible / This product is no longer
available), `closed` (« {name} » a fermé ou n'existe pas. / “{name}” has closed or does not exist.), `unknown` (Ce produit
a fermé ou n'existe pas. / This product has closed or does not exist.), `dataOnRequest` (Vos données restent accessibles
sur demande. / Your data remains available on request.), `pageTitle` (Page introuvable / Page not found), `pageMissing`
(Cette page n'existe pas sur {name}. / This page does not exist on {name}.), `backTo` (Retour à {name} / Back to
{name}), `otherTools` (Nos autres outils / Our other tools). Committed with Task 5's first green step.

### Task 5: `[app]/not-found.tsx`
Test (jsdom; mocks `next/root-params`, `@/lib/dal/products`, `next-intl/server` → `getTranslations` via `createTranslator`
from `next-intl`): (1) killed `NomDeMarque` → "404", title, « NomDeMarque », data sentence; (2) unknown slug → generic
sentence, the requested slug never appears; (3) `app()` undefined → generic, `getProduct` not called; (4) `listProducts`
[LettrePro scale, DescriPro learn, NomDeMarque killed] → links in name order `/descri-pro`, `/lettre-pro` with their
`landing.seoTitle`, no killed link; (5) no active product → no "Nos autres outils"; (6) active product, missing sub-page
→ "Page introuvable", "Retour à LettrePro" → `/lettre-pro`, current product left out of the list; (7) `en`.
Action: `async function NotFound()`: `app()` → `getProduct` → `listProducts()` filtered (not killed, not current), sorted
with `localeCompare(…, locale)` → `getTranslations("not-found")`; map to `{ slug, name, tagline }` before rendering; header
"◆ {studio}", centred "404" (`text-muted-foreground/40`), `<h1>`, `<p>`, `<ul>` of `next/link` cards (`/${slug}`). shadcn
tokens only; no `'use client'`, `cookies()` or `new Date()`.

### Task 6: real page in `next dev` (not committed)
`pnpm exec next dev --port 3108`: `/zz-unknown` shows resolved French texts, studio header and LettrePro listed;
`/lettre-pro` still themed. Stop the server.

### Task 7: `e2e/not-found.spec.ts` (written, not run)
Unknown `/introuvable-${randomUUID()}` → 404, heading, "LettrePro" link. Killed: insert a `killed` product (fresh slug,
name "Produit fermé", editorial theme, `SEED_OWNER`, LettrePro config with slug/name replaced) → 404, « Produit fermé »,
no link to it, LettrePro listed; cleanup in `finally`. Regression: `/lettre-pro` → 200. Note: BO-06 status changes must
`updateTag("product:<slug>")` and `updateTag("products")`.

### Task 8: full validation
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm test`, `pnpm build`, Task 1's curl check on
the final build (404 + SA-08 UI for unknown and killed), `pnpm check`. Code fixes only.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Root-layout `notFound()` never shows `[app]/not-found.tsx` | High | Task 1 spike; branch B relies on a Next internal (commented, e2e-guarded); branch C blocking (options: `app/global-not-found.tsx` + `experimental.globalNotFound`, or `app/(products)/not-found.tsx`, both outside Périmètre) |
| Status becomes 200 if the check moves under `<Suspense>` | Low | Check stays first, asserted by curl and e2e |
| Killed slug in `generateStaticParams` | Low | Checked in the spike; if the build fails, filter killed slugs in the layout's `generateStaticParams` (same file) |
| Nested 404 under an active product | Certain | "Page introuvable" state (case 6) |
| Echo of the requested slug | Medium | Never rendered (case 2) |
| `listProducts()` returns full configs | Low | Mapped to `{ slug, name, tagline }` in the Server Component |
| `getProduct(unknown)` caches `null`; BO-06 status changes | Medium | BO-05/BO-06 must `updateTag`; PR note |
| Hyphenated namespace `not-found` | Low | Tested; fallback zone name `unavailable` |

## Acceptance

- [ ] Bullet 1: `layout.test.tsx` (unknown, undefined, killed, active); e2e 404 status; manual curl 404 on a build
- [ ] Bullet 2: `not-found.test.tsx` (killed with name, unknown, nested page, active links only, empty list, English)
- [ ] Task 1 outcome recorded in the layout comment and PR body; outcome C reported as blocking
- [ ] fr/en keys identical, checked in `next dev`
- [ ] No frozen contract changed; `pnpm check` and `pnpm build` green; PR title `feat(app): SA-08 product not found page`
