# Plan: SA-04 · Tarifs et paywall

**Source spec**: specs/SA-04-tarifs.md
**Complexity**: Small (a full page, an intercepted modal, one shared server component, one message zone, one E2E file;
no contract change, no new dependency)

## Summary

`/[app]/pricing` lists `config.pricing.packs` (frozen `getProduct(slug)`), each through the frozen `PackCard`
(credits, price, price per generation, recommended variant) with an "Acheter" link to `/[app]/checkout/[packId]` in its
`action` slot. The same `PricingContent` renders in the page (under an `<h1>`) and inside the shared `RouteModal` from
the intercepting route `@modal/(.)pricing`. SA-02 opens that route on a refused debit (402); SA-05 owns checkout.

## Decisions

1. **CTA link**: `<Button asChild variant={pack.recommended ? "default" : "outline"}><Link href={`/${slug}/checkout/${pack.id}` as Route} aria-label={t("buyLabel", { count, price })}>{t("buy")}</Link></Button>`
   with `// SA-05 (checkout) has not landed yet: cast dropped once it does.` (mirrors `components/product/header-balance.tsx:21-22`).
2. **One buy link per card** (the frozen `PackCard` takes one `action`); the mockup's select-then-buy flow is replaced;
   the recommended card gets the primary button plus PackCard's badge and border. Footnote and generic benefits kept;
   BioInsta-specific "3 propositions par crédit" dropped. Record in the PR body.
3. **`PricingContent`** (sync server component, `useTranslations("pricing")` + `useFormatter()`, no title): subtitle,
   pack list, footnote, benefits. The page renders the `<h1>`; the modal passes the title to `RouteModal`.
4. **Both pages** are async: `app()` → `getProduct` → `notFound()` → `getTranslations("pricing")` → `PricingContent`.
5. Out of scope: opening the modal at 0 balance (SA-02), checkout (SA-05), `killed` check (SA-08).

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Product pages | `app/(products)/[app]/layout.tsx:29-32` | `app()` from `next/root-params`, `getProduct(slug)`, `notFound()` |
| Link to a route not built yet | `components/product/header-balance.tsx:21-22` | `as Route` + comment |
| Shared modal | `components/product/route-modal.tsx:14` | `<RouteModal title>{children}</RouteModal>` |
| Pack card | `components/product/pack-card.tsx:12-20` | `PackCard({ pack, costPerGeneration, action })`, namespace `common` |
| Button as link | `components/ui/button.tsx:38-48` | `Button asChild` + `Link` |
| Messages | `i18n/load-messages.ts`, `messages/manifest.ts` | `messages/<fr\|en>/pricing.json` = namespace `pricing`, same keys |
| Client leaf tests | `components/product/pack-card.test.tsx:1-23` | jsdom, `afterEach(cleanup)`, `NextIntlClientProvider` with `{ common, pricing }`, fr + en |
| Async page tests | `components/product/header-balance.test.tsx:24-33` | `const ui = await Page(); render(ui)` |
| next-intl server / root params in tests | `i18n/request.test.ts:3-13` | mock `next-intl/server` (`getTranslations` via `createTranslator`), `next/root-params`, `@/lib/dal/products` |
| Seed | `fixtures/lettre-pro.config.json:49-50` | `pack-10` (10, 4,90 €), `pack-50` (50, 14,90 €, recommended) |

## Files to Change

| File | Action |
|---|---|
| `app/(products)/[app]/pricing/_components/pricing-content.tsx` + `.test.tsx` | CREATE |
| `app/(products)/[app]/pricing/page.tsx` + `page.test.tsx` | CREATE |
| `app/(products)/[app]/@modal/(.)pricing/page.tsx` + `page.test.tsx` | CREATE |
| `messages/fr/pricing.json`, `messages/en/pricing.json` | CREATE |
| `e2e/pricing.spec.ts` | CREATE (not run) |

Unchanged: `components/**`, `lib/**`, `i18n/**`, `[app]/layout.tsx`, `@modal/default.tsx`.

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(app): …`), `pnpm exec knip`. Component/page tests: jsdom
docblock + `afterEach(cleanup)`; Vitest 5 resets mocks (set values per test); `notFound` mocked as a plain throwing
function (`throw new Error("NEXT_NOT_FOUND")`).

### Task 1: `pricing.json` (fr + en)
Keys: `title` ("Plus de crédits ?" / "Need more credits?"), `titleAccent` ("Rechargez." / "Top up."), `subtitle`
("Paiement unique, pas d'abonnement. Vos crédits n'expirent pas." / "One-time payment, no subscription. Your credits
never expire."), `buy` ("Acheter" / "Buy"), `buyLabel` ("Acheter {count, plural, one {# crédit} other {# crédits}} ·
{price}" / "Buy {count, plural, one {# credit} other {# credits}} · {price}"), `note` ("Paiement unique · crédits
ajoutés immédiatement" / "One-time payment · credits added instantly"), `benefits.history` ("Historique illimité" /
"Unlimited history"), `benefits.refund` ("Remboursé si la génération échoue" / "Refunded if a generation fails").
Test first: key paths of fr equal en (inline `keyPaths` helper, copied from `i18n/load-messages.test.ts:4-7`).

### Task 2: `PricingContent` lists the packs (bullet 1)
Render with `{ freeCreditsOnSignup: 3, anonymousFreeGenerations: 1, costPerGeneration: 1, packs: [pack-10, pack-50
recommended] }`: "10 crédits", "4,90 €", "0,49 € / génération", "50 crédits", "14,90 €", "0,30 € / génération";
subtitle, note, both benefits; 2 links; `en` shows "€4.90" and "Buy 50 credits · €14.90"; `costPerGeneration: 2`
doubles the per-generation price. Mobile-first `grid gap-4`.

### Task 3: recommended highlighted, CTA to checkout (bullets 1, 3)
"Acheter 50 crédits · 14,90 €" → `href="/lettre-pro/checkout/pack-50"`, `data-variant="default"`; pack-10 →
`/lettre-pro/checkout/pack-10`, `outline`; "Recommandé" exactly once; no recommended pack → both outline, no badge.
Price via `format.number(pack.priceCents / 100, { style: "currency", currency: "EUR" })`. `pnpm typecheck`.

### Task 4: page `/[app]/pricing` (bullet 1)
Test: `app()` "lettre-pro" + product → `h1` contains "Plus de crédits ?" and "Rechargez.", 2 buy links; `getProduct` null
→ rejects `NEXT_NOT_FOUND`; `app()` undefined → rejects and `getProduct` not called. Page:
`<section className="mx-auto grid max-w-md gap-6 px-4 py-8"><h1 className="text-3xl font-bold">{t("title")} <span className="text-primary">{t("titleAccent")}</span></h1><PricingContent slug pricing/></section>`.

### Task 5: intercepted modal `@modal/(.)pricing` (bullet 2)
Test (plus `useRouter: () => ({ back })`): `getByRole("dialog")` titled "Plus de crédits ?", same 2 links inside,
unknown product → `NEXT_NOT_FOUND`. Page returns `<RouteModal title={`${t("title")} ${t("titleAccent")}`}><PricingContent …/></RouteModal>`,
importing `PricingContent` from `@/app/(products)/[app]/pricing/_components/pricing-content`; comment that `(.)` matches
because `@modal` is a slot, not a segment.

### Task 6: `e2e/pricing.spec.ts` (written, not run)
(1) `/lettre-pro/pricing`: `h1`, 2 cards, "Recommandé" once, recommended href `/lettre-pro/checkout/pack-50`, no dialog;
(2) click the pack-50 link → URL `/lettre-pro/checkout/pack-50`; (3) modal from `/lettre-pro/tool` at 0 balance (needs
SA-02 and LEDGER; `test.fixme` if not merged when written): URL `/lettre-pro/pricing`, dialog with the packs, tool form
still behind, Escape back to `/lettre-pro/tool`.

### Task 7: real-page check + full validation
`AI_MODE=mock pnpm exec next dev --port 3147` in the worktree, `curl -s localhost:3147/lettre-pro/pricing` contains
"Plus de crédits ?" and "14,90 €", stop the server. `pnpm build` (no "uncached data outside Suspense"), then
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm test`, `pnpm check`. Fix code only.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Checkout route missing until SA-05 | Certain | `as Route` + comment; click lands on 404 until then (PR body) |
| `getTranslations` in a page under Cache Components | Low | `pnpm build` proves it; fallback: title in a sync component with `useTranslations` |
| `next-intl/server` in Vitest | Certain | Mock with `createTranslator` |
| Modal trigger belongs to SA-02 | Certain | E2E journey 3 waits for SA-02 and LEDGER |
| SA-05's "Reprendre" with `router.back()` returns to the pricing modal | Medium | SA-05's concern; relayed by the orchestrator |
| Per-card CTA departs from the mockup | Low | Decision 2, PR body |
| Duplicate accessible names | Medium | `aria-label` from `buyLabel` |

## Acceptance

- [ ] Bullet 1: `pricing-content.test.tsx`, `pricing/page.test.tsx`
- [ ] Bullet 2: `@modal/(.)pricing/page.test.tsx`; E2E journey 3 written
- [ ] Bullet 3: href unit test; E2E journey 2
- [ ] fr/en key parity; zone checked on a real page in `next dev`
- [ ] `pnpm build` and `pnpm check` green; no frozen contract, no file outside Périmètre
- [ ] PR title: `feat(app): SA-04 pricing page and paywall modal`
