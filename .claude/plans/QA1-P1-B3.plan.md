# Implementation Plan: QA1-P1-B3 · Paiement ouvert depuis /pricing : la confirmation reste

**Source spec**: specs/qa/QA1-P1-B3-paiement-pricing.md
**Réf**: .claude/qa/reports/2026-09-25-full.md › B3 (repro 5.7, `s57b.out.txt`) · specs/SA-05-paiement.md › Acceptation 1, 3 · docs/02 › SA-05 · docs/04 › Routing (modales en intercepting routes), Mutations (`purchase` → `refresh()`)
**Complexity**: Low-Medium (one Server Action line removed, one client component gains a refresh strategy, one data attribute, tests and e2e; no frozen contract touched)

## Overview

Paying in the checkout modal opened from the full `/{slug}/pricing` page shows the confirmation for about 0.5 s, then the page reloads fully on `/checkout/[packId]` with a fresh payment form. The trigger is the `refresh()` inside the `purchase` Server Action. Next's router refreshes the page kept behind the modal (`/pricing`) by re-requesting its URL, and `/pricing` is itself intercepted by `@modal/(.)pricing`. The fix moves the router refresh to the client (`CheckoutFlow`). The refresh stays immediate when the background page can be refreshed safely: the tool paywall and direct access, which keep their current behaviour. When the background is the pricing page, the refresh waits until the modal has closed, and « Reprendre » goes back to `/pricing` without a reload.

## Root cause (verified in code, Next 16.3.6)

1. **Opening the modal from `/pricing` (page).** The initial router state has `nextUrl = "/bio-instagram/pricing"`. « Acheter » soft-navigates to `/bio-instagram/checkout/pack-10`, which the server intercepts with `@modal/(.)checkout/[packId]`. In that intercepted route the `children` slot is a *default* slot. The client therefore reuses the already-mounted pricing page and records where it came from, as the refresh URL `refreshState = "/bio-instagram/pricing"` (`node_modules/next/dist/esm/client/components/router-reducer/ppr-navigations.js:233-243, 481-511`). After this navigation, `previousNextUrl = "/bio-instagram/pricing"` (`segment-cache/navigation.js:336-351`).
2. **`purchase()` calls `refresh()`** (`app/(products)/[app]/checkout/_actions.ts:73`). The action response is flagged as revalidated, so the client runs a `FreshnessPolicy.RefreshAll` navigation to the current URL with `nextUrl = previousNextUrl` (`router-reducer/reducers/server-action-reducer.js:206-211, 292, 315, 325`).
3. **Refreshing the reused pricing page.** In a RefreshAll pass, a reused default-slot segment is fetched from its own refresh URL through a second request: `GET /bio-instagram/pricing` (`ppr-navigations.js:181-189, 888-925`). That request is sent with the current Next-Url, `/bio-instagram/pricing`. Next itself flags this with a TODO: "this should actually be the Next-Url at the time the refresh URL was set … if a refresh fails due to a mismatch, it will trigger a hard refresh" (`ppr-navigations.js:918-923`).
4. **The server intercepts that GET.** The generated rewrite for `@modal/(.)pricing` matches any `Next-Url` under `/[app]`: `header = /(?<app>[^/]+?)(?:/.*)?`, from `lib/generate-interception-routes-rewrites.js:12-24`. The server returns the modal version of `/pricing` (`@modal/(.)pricing`, children = default) instead of the pricing page the client asked for.
5. **Mismatch, soft retry, then hard reload.** The response doesn't fit the requested tree, so some tasks stay pending and the navigation exits with status 1. Next dispatches a soft retry (`ACTION_SERVER_PATCH`, RefreshAll). The retry carries the same second request and mismatches again. `previousNavigationDidMismatch` then forces an MPA reload of the canonical URL, `/checkout/pack-10` (`ppr-navigations.js:934-999, 1075-1078`). A full load of that URL renders the page variant: a new `CheckoutFlow`, `status = "idle"`, a new idempotency key, and the pay button again.
6. **Matches the QA evidence.** The report's network trace shows `POST … 200`, then `GET /bio-instagram/pricing` (step 3). In `s57b.out.txt`, the confirmation is visible at t+0.5 s. At t+1 s the frame navigates, the dialog is gone and the form is back (soft retry). At t+2 s a `LOAD` event fires (hard reload). The console error `Route "/[app]/checkout/[packId]": … URL data` comes from the full-page render during the retry or reload; the error itself is B14, out of scope.
7. **Why the tool paywall works.** Tool → `(.)pricing` → `(.)checkout`. The reused children segment is the tool page, whose refresh URL is `/bio-instagram/tool`. No route intercepts `/tool`, so the second request returns the tool page and there is no mismatch. The landing is the only other background candidate, and it has no checkout link (`_components/landing/landing-pricing.tsx:37`).

Consequence: any router refresh (server `refresh()`, `revalidatePath`, or client `router.refresh()`) while the checkout modal sits over the full `/pricing` page reproduces B3. The fix must not refresh in that state. It refreshes once the modal is gone, when the tree has no interception route, the header `Next-Url` is not sent, and `/pricing` renders as a page.

## Requirements (acceptance, one success criterion each)

- **A1.** A signed-in buyer on `/{slug}/pricing`: « Acheter » → checkout modal → « Payer … (simulé) ». The confirmation (+N crédits, new balance, « Reprendre ») stays on screen, with no full-page navigation to `/checkout/[packId]`. The CTA closes the modal and returns to `/pricing` without a reload.
- **A2.** The same payment from the tool paywall keeps its current behaviour: confirmation, header badge updated (SA-05 A3), « Reprendre » → `/tool` without a reload.
- **A3.** After confirmation no payment form reappears, so no second payment is possible through a remount: exactly one `purchases` row.

## Constraints

- **Périmètre only**: `[app]/checkout/_actions.ts`, `[app]/checkout/_components/**`, `[app]/@modal/(.)checkout/**`, `[app]/checkout/[packId]/page.tsx`, `[app]/pricing/_components/**`, their tests, `e2e/checkout*.spec.ts`.
- **Not touched**: `components/product/route-modal.tsx`, `components/product/balance.tsx`, `@modal/(.)pricing/**`, `pricing/page.tsx`, `messages/**`, `lib/**`.
- **Contract `purchase()` unchanged**: signature `(slug, packId, idempotencyKey)`, return `PurchaseResult`, order of checks, `after(track)`. Only the side effect `refresh()` leaves the action.
- **Out of scope**: B14 (Cache Components error in `checkout/[packId]/page.tsx`).

## Architecture Changes

- `app/(products)/[app]/checkout/_actions.ts`: drop `refresh()` and its import, and update the header comment. The router refresh becomes the caller's job (see Root cause).
- `app/(products)/[app]/checkout/_components/checkout-flow.tsx`: add the refresh strategy.
  - **Immediate `router.refresh()`** inside the purchase transition after `result.ok`, unless the modal sits over the pricing page.
  - **Over the pricing page** (modal variant, detected when « Payer » is clicked): no refresh while mounted, set a `refreshOnLeaveRef` flag, and « Reprendre » calls `router.back()`.
  - **On unmount** (`useEffect` cleanup): if the flag is set, `router.refresh()`. This covers « Reprendre », X / Escape / backdrop (`RouteModal`'s own `router.back()`) and the browser's back button.
- `app/(products)/[app]/pricing/_components/pricing-content.tsx`: root element gets `data-slot="pricing-content"`, the marker `CheckoutFlow` looks for. `PricingContent` stays a Server Component.
- Tests: `checkout/_components/checkout-flow.test.tsx`, `checkout/_actions.test.ts`, `pricing/_components/pricing-content.test.tsx`, `@modal/(.)checkout/[packId]/page.test.tsx` (router mock gains `refresh`), `e2e/checkout.spec.ts`.

## Design decisions

1. **Refresh moves from server to client.** A server-side `refresh()` can't depend on where the modal was opened from, and the contract forbids a new parameter. `CheckoutFlow` is the only code that knows the purchase succeeded and which page is behind the modal.
2. **How the background is detected.** When « Payer » is clicked in the `"modal"` variant, `CheckoutFlow` checks `document.querySelector('main [data-slot="pricing-content"]') !== null`.
   - Over the full `/pricing` page, `PricingContent` is mounted in the layout's `<main>`.
   - In the tool flow, the pricing modal lived in the `@modal` slot, outside `<main>`, and the checkout modal replaced it, so the check is false.
   - In the `"page"` variant the check is skipped, since a direct load has no interception.
   - Rejected alternatives: a `?from=pricing` search param (changes the URL that e2e/checkout.spec.ts asserts and makes the modal page read `searchParams`); a prop from `pricing/page.tsx` (outside Périmètre); a module-level store set by a client `BuyLink` (shared mutable state across route folders).
   - The marker's contract is guarded by a `PricingContent` test and commented on both sides.
3. **Refresh on leave, not on Resume.** `router.back()` is a popstate-driven history traversal. Calling `router.refresh()` right after it would still run against the intercepted tree. The unmount cleanup of `CheckoutFlow` runs after the router's action queue holds the restored `/pricing` tree (modal slot = default, no interception route). The refresh then sends no `Next-Url`, and `/pricing` renders as a page.
4. **« Reprendre » from the pricing page = `router.back()`.** History is `[/pricing, /checkout/pack-N]` and the purchase pushes nothing, so back lands on `/pricing`, the same way as `RouteModal`'s close. In the tool flow and the page variant, `router.replace(`/${slug}/tool`)` is unchanged (SA-05 plan, orchestrator decision 3).
5. **No idempotency-key persistence across remounts.** Once the remount is gone, A3 holds without extra code (ponytail). E2E asserts one `purchases` row.

## Implementation Steps

Each task is one red → green cycle for `tdd-guide`, committed and pushed at green. Run a single test file with `pnpm vitest run <file>`.

### Phase 1: Reproduce the bug

1. **E2E regression journey for B3** (File: `e2e/checkout.spec.ts`, acceptance A1 + A3)
   - Action: new test « pays from the pricing page: the confirmation stays, no reload, Reprendre returns to /pricing ». It mirrors the QA script `s57b.mjs` and reuses `resetAdminLedgerOnLettrePro` and `signInAsAdmin`. Steps:
     1. `page.goto("/lettre-pro/pricing")`.
     2. Count `load` events with `page.on("load")` after that first load.
     3. Click `/Acheter 10 crédits/`, expect URL `/lettre-pro/checkout/pack-10` and a visible dialog.
     4. Click `/Payer/`, expect « +10 crédits » inside the dialog.
     5. `await page.waitForTimeout(2000)`. Re-assert: « +10 crédits » and « Nouveau solde » still visible, `getByRole("button", { name: /Payer/ })` count 0, dialog visible, URL unchanged, `load` count 0.
     6. Click « Reprendre ma génération → ». Expect URL `/lettre-pro/pricing`, dialog count 0, `load` count still 0, and header text `10 crédits` (refresh on leave).
     7. Query the DB: `purchases` rows for admin on lettre-pro = 1.
   - Why: the only test that reproduces the symptom. Next's router behaviour can't be simulated in jsdom.
   - Run: it is red by construction (QA 5.7). `pnpm test:e2e` is reserved for the E2E phase (CLAUDE.md), so commit it as the red repro ("test(e2e): reproduce B3 …, red until the fix") — the orchestrator grants it for QA fix specs: run it with `pnpm test:e2e e2e/checkout.spec.ts` (queued, never wrapped).
   - Optional spike, in the main checkout with a dev server only, not in a worktree: `curl -s -H 'RSC: 1' -H 'Next-Url: /lettre-pro/pricing' localhost:3000/lettre-pro/pricing | grep -c '(.)pricing'` > 0 confirms step 4 of the root cause.
   - Dependencies: none. Risk: Medium. E2E needs `pnpm build`, which B14 may affect (see Risks).

### Phase 2: Tool paywall keeps its behaviour after the refresh moves client-side

2. **`CheckoutFlow` refreshes the router after a successful purchase (tool paywall, page variant)** (File: `checkout/_components/checkout-flow.test.tsx`, then `checkout-flow.tsx`, acceptance A2)
   - Red: add `refresh` to the `next/navigation` mock (`useRouter: () => ({ replace, back, refresh })`; adding a method weakens nothing). New tests:
     - `"modal"` variant, no pricing marker in the DOM: after `+50 crédits`, `refresh` called once. On Resume, `replace("/bio-insta/tool")` is called and `back` is not.
     - Same for the `"page"` variant.
     - `purchase` resolving `{ ok: false }`: `refresh` not called.
   - Green: in `handlePay`'s transition, after `setStatus("confirmed")`, call `router.refresh()`. It sits inside the same async transition, so the optimistic `+N` delta and the fresh header balance commit together, as they do today with the server refresh.
   - Also add `refresh: vi.fn()` to the router mock in `@modal/(.)checkout/[packId]/page.test.tsx`.
   - Dependencies: none. Risk: Low.

3. **The `purchase` action no longer refreshes** (File: `checkout/_actions.test.ts`, then `_actions.ts`, acceptance A1 root cause)
   - Red, in its own commit because it changes a committed test: the happy-path test asserts `expect(refresh).toHaveBeenCalledOnce()`. Change it to `.not.toHaveBeenCalled()` and rename it to "…tracks a purchase event, and leaves the router refresh to the caller". Commit message: "test(app): purchase no longer calls refresh() — a server refresh re-fetches the intercepted /pricing background (B3); CheckoutFlow refreshes instead". Keep the ledger-throws test (`refresh` not called), and keep the `next/cache` mock so a regression shows up.
   - Green: remove `refresh()` and the `refresh` import. Update the header comment ("… after(track) → { ok: true, balance }; the router refresh is CheckoutFlow's, see QA1-P1-B3").
   - Dependencies: Step 2, so the tool flow never loses its header update between commits. Risk: Medium (deviation from docs/04 › Mutations, see Risks).

### Phase 3: Checkout over the pricing page

4. **`PricingContent` exposes its marker** (File: `pricing/_components/pricing-content.test.tsx`, then `pricing-content.tsx`)
   - Red: `container.querySelector('[data-slot="pricing-content"]')` is the root and contains the buy links.
   - Green: `data-slot="pricing-content"` on the root `<div>`, with a comment pointing to `CheckoutFlow`.
   - Dependencies: none. Risk: Low.

5. **No refresh while the modal sits over the pricing page; Reprendre goes back** (File: `checkout-flow.test.tsx`, then `checkout-flow.tsx`, acceptance A1 + A3)
   - Red: render `<main><div data-slot="pricing-content" /></main>` next to `CheckoutFlow` (`"modal"` variant) inside the same providers, then pay with `{ ok: true, balance: 10 }`. Assert:
     - `+10 crédits` and `Nouveau solde` are visible and the pay button is gone.
     - `refresh` is not called.
     - Clicking « Reprendre ma génération → » calls `back` once and never `replace`.
   - Green:
     - In `handlePay`, `variant === "modal"` only, compute `overPricingPage` from the marker. Keep it in a ref (`backgroundRef`) so `handleResume` reads it.
     - On success: if `overPricingPage`, set `refreshOnLeaveRef.current = true`; else `router.refresh()` (Step 2).
     - `handleResume`: `overPricingPage ? router.back() : router.replace(...)`.
     - Keep the detection in one small named helper in the same file, with a comment that cites the root cause.
   - Dependencies: Steps 2 and 4. Risk: Medium (DOM marker coupling).

6. **Refresh once the modal has left** (File: `checkout-flow.test.tsx`, then `checkout-flow.tsx`, acceptance A1 header, A3)
   - Red:
     - Step 5's scenario, then `unmount()`: `refresh` called exactly once.
     - `unmount()` without paying: `refresh` not called.
     - `unmount()` after a `{ ok: false, error: "failed" }`: `refresh` not called.
     - Tool scenario (no marker) then `unmount()`: `refresh` called once in total (the immediate one, none on leave).
   - Green: `useEffect(() => () => { if (refreshOnLeaveRef.current) router.refresh(); }, [router])`. `useRouter()` is stable, and the comment states the cleanup must only run on unmount. StrictMode's mount → cleanup → mount happens before any purchase, while the flag is still false.
   - Dependencies: Step 5. Risk: Medium (a purchase still in flight when the modal is closed, see Risks).

### Phase 4: Tool paywall journey end to end

7. **Un-fixme the tool-paywall checkout journey** (File: `e2e/checkout.spec.ts`, acceptance A2)
   - Action: replace the `test.fixme` « opens as a nested modal from the tool's paywall » with a real test. Promoting a fixme is a strengthening. Steps:
     1. Reset the ledger, sign in as admin (no `balances` row → balance 0, `debit()` refuses → 402).
     2. `goto /lettre-pro/tool`, fill « Poste visé », « Entreprise », « Votre expérience », « Ton » (`e2e/tool.spec.ts:28-31`), click « Générer ».
     3. Expect URL `/lettre-pro/pricing` with a dialog, then click `/Acheter 10 crédits/` and expect the checkout dialog.
     4. Click `Payer`. Expect « +10 crédits » and the header `10 crédits` while the confirmation is displayed (today's behaviour), and 0 `load` events.
     5. Click « Reprendre ma génération → ». Expect `/lettre-pro/tool`, the form visible, no dialog, still 0 `load` events.
   - Dependencies: Steps 2 and 3. Risk: Medium. If the admin account can't reach the paywall that way, keep the fixme and say so in the PR.

## Testing Strategy

- **Unit (Vitest, jsdom)**:
  - `checkout-flow.test.tsx`: immediate refresh vs deferred refresh, Resume target, unmount refresh, and no refresh on failure.
  - `_actions.test.ts`: no server `refresh()`; the rest of the contract is unchanged.
  - `pricing-content.test.tsx`: the marker.
  - `(.)checkout/[packId]/page.test.tsx`: stays green with the extended router mock.
- **Integration**: `_actions.ledger.test.ts` is unchanged and must stay green (one ledger row per key).
- **E2E (E2E phase)**: `e2e/checkout.spec.ts` (Step 1 repro for A1 + A3; Step 7 for A2). The existing journeys (full page, unauthenticated, Escape → `/pricing`, direct-access purchase → `/tool`, double click) must stay green.
- **Gate**: `pnpm check` before `/verify`.

## Risks & Mitigations

- **Risk**: dropping `refresh()` from `purchase` departs from docs/04 › Mutations (`purchase` → après : `refresh()`), and a committed test assertion changes.
  - Mitigation: signature and return are unchanged (the spec's Contrat). The docs/04 goal, "solde et header à jour", is still met by `router.refresh()` in `CheckoutFlow`. The test change sits in its own commit with the reason. Flag it in the PR body for the human reviewer.
- **Risk**: the DOM marker couples `CheckoutFlow` to `PricingContent` and to the layout's `<main>`.
  - Mitigation: a `PricingContent` test guards the attribute, both files carry a comment, and the helper is one named function.
- **Risk (known limitation)**: over the pricing page, the header badge shows `+N` while paying, then the old balance during the confirmation (`useOptimistic` reverts when the transition ends). It updates when the modal closes. The confirmation itself shows the new balance, and A1–A3 don't require the badge.
  - Why not fixed: keeping the overlay would need a pending transition across the close. That entangles with the router's back navigation and can deadlock, or it needs `components/product/balance.tsx`, which is outside Périmètre.
  - Mitigation: mention it in the PR as a possible follow-up.
- **Risk**: over the pricing page, closing the modal while `purchase()` is still pending means the unmount refresh doesn't fire, because the flag is set only on success.
  - Mitigation: the pay button is disabled while pending and `RouteModal` stays open. The header catches up on the next navigation. Accept and document; no extra code.
- **Risk**: client `router.refresh()` in the tool flow adds one RSC GET compared with the server refresh folded into the POST response, which could make the badge flicker.
  - Mitigation: the refresh is dispatched inside the same async transition, so React commits the refreshed header and the reverted optimistic delta in one pass. Step 7's e2e asserts the header while the confirmation is displayed.
- **Risk**: E2E needs `pnpm build`. B14 (URL data outside `<Suspense>` in `checkout/[packId]/page.tsx`) is only a dev error per QA, but could affect prerendering.
  - Mitigation: out of scope here. If the build fails for B14, report it to the orchestrator instead of fixing `page.tsx`.
- **Risk**: browser Forward after closing reopens a fresh checkout modal. That is a new checkout by user choice, not a remount of the confirmed one.
  - Mitigation: out of A3's scope; note it in the PR.
- **Risk**: Next internals (default-slot refresh URL, TODO at `ppr-navigations.js:918-923`) may change in a future patch.
  - Mitigation: the fix only relies on public APIs (`router.refresh`, `router.back`, unmount timing). Step 1's e2e guards the behaviour.

## Success Criteria

- [ ] A1: Step 1's e2e passes: confirmation still visible after 2 s, 0 `load` events, Resume → `/pricing` without reload, header `10 crédits`.
- [ ] A2: Step 2 unit tests plus Step 7's e2e pass: tool paywall → confirmation with header updated → `/tool` without reload.
- [ ] A3: no pay button after confirmation (unit + e2e), exactly one `purchases` row (e2e).
- [ ] `purchase()` signature and return unchanged, no file outside Périmètre modified, `_actions.ledger.test.ts` green.
- [ ] `pnpm check` green, `/verify` READY.

