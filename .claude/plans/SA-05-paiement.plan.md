# Plan: SA-05 · Paiement simulé

**Source spec**: specs/SA-05-paiement.md
**Complexity**: Medium (one Server Action, one client flow with three small presentational parts, two routes, one
message zone, one e2e file; no frozen contract change, no dependency)

## Summary

SA-04's « Acheter » links to `/{slug}/checkout/{packId}`: intercepted as a modal by `@modal/(.)checkout/[packId]` on
client navigation (from `/tool` through the pricing paywall, or from `/pricing`), full page on direct access. Both
render `CheckoutFlow` (`'use client'`): pack summary, prefilled test card, « paiement simulé » notice, then a
confirmation with the new balance. « Payer » calls `purchase(slug, packId, idempotencyKey)`: session, shared Zod
schemas, `guardRequest("purchase")`, pack checked against the config, ledger `purchase()`, `after(track purchase)`,
`refresh()`, returns only `{ ok: true, balance }`.

## Orchestrator decisions (binding)

1. After confirmation, X / Escape / backdrop keep `RouteModal`'s `router.back()` for now; an optional `onClose` on
   `components/product/route-modal.tsx` is an orchestrator follow-up (outside Périmètre).
2. Replay → duplicate `purchase` event: client mitigation here (single dispatch, disabled while pending, key reused
   only after `failed`), AND put the idempotency key in the event metadata (`purchaseKey`) so the orchestrator's
   TRACKING follow-up can dedupe `purchase` events by that key in the body of `track()`. No contract change.
3. « Reprendre » = `router.replace(`/${slug}/tool`)`.
4. Follow-ups after merge (orchestrator): drop the checkout `as Route` cast in
   `app/(products)/[app]/pricing/_components/pricing-content.tsx`; un-fixme SA-04's journey 3 in
   `e2e/pricing.spec.ts`; the `/signup` casts stay until SA-03 merges.
5. Test-card holder name is a static placeholder from messages.

## Frozen inputs (consumed, never modified)

`purchase(args: Purchase) => Promise<{ balance }>` `lib/dal/credits.ts:29-34,257-297` (session-checked, throws on an
unknown pack, idempotent on the raw key, one transaction); `purchaseInputSchema` `lib/schemas/inputs.ts:39-43`;
`slugSchema`; `getProduct` (cached); `getSession()`; `guardRequest("purchase")` (stub); `track`
`lib/dal/events.ts:13-19,36-58`; `BalanceProvider` / `useBalanceDelta` / `BalanceBadge`
`components/product/balance.tsx:22-52`; `RouteModal`; `refresh()` from `next/cache` (docs/04: `purchase` →
`refresh()`).

## Patterns to Mirror

| Pattern | Source |
|---|---|
| Root param + `getProduct` + `notFound()` | `app/(products)/[app]/pricing/page.tsx:11-14` |
| Intercepted modal page + test mocks | `app/(products)/[app]/@modal/(.)pricing/page.tsx:13-24`, `page.test.tsx:12-39` |
| Server Action shape + tests | `app/(backoffice)/admin/themes/[id]/_actions.ts:25-66`, `_actions.test.ts:11-31` |
| `guardRequest` then error mapping | `app/(products)/[app]/api/generate/route.ts:77-78` |
| `after(async () => { await track(...) })` + collector mock | `api/generate/route.ts:151-173`, `route.test.ts:20-35` |
| Idempotency key at submit + `addDelta` in the transition | `app/(products)/[app]/tool/_components/tool-form.tsx:62-66` |
| Optimistic badge test | `components/product/balance.test.tsx:11-56` |
| Fresh user + schema-valid product + cleanup | `lib/dal/credits.test.ts:34-81,132-141,143-160` |
| Per-generation price | `components/product/pack-card.tsx:23-25` |
| fr/en parity | `messages/pricing.test.ts:8-16` |

## Design decisions

1. `PurchaseResult = { ok: true; balance: number } | { ok: false; error: "unauthenticated" | "invalid_request" |
   "unknown_pack" | "bot" | "rate_limited" | "failed" }`; `purchase(slug, packId, idempotencyKey)`: session (null →
   unauthenticated) → parse slug + `purchaseInputSchema` → `guardRequest("purchase")` → `getProduct` (null/killed →
   invalid_request) → pack in config (else unknown_pack, before any write) → ledger `purchase` (imported as
   `purchaseCredits`) → `after(track({ type: "purchase", …, metadata: { packId, credits, amountCents, purchaseKey }
   }))` with try/catch + `console.error` → `refresh()` → `{ ok: true, balance }`. DAL throw → `unstable_rethrow`,
   `console.error("[checkout] purchase failed")`, `failed`, no refresh, no track.
2. Client key: `keyRef.current ??= crypto.randomUUID()` in the action handler (never during render); kept after
   `failed`; button disabled while pending.
3. Optimistic badge: `addDelta(pack.credits)` first inside the action transition.
4. `CheckoutFlow` `variant: "modal" | "page"` (modal: `RouteModal` title « Paiement » / « Paiement confirmé »; page:
   `<section>` with `<h1>`); leaves `PackSummary`, `TestCardFields` (readOnly, labelled, no `name`),
   `PurchaseConfirmation`.
5. Pages do not read the session; `unauthenticated` → message + link to `/${slug}/signup` (`as Route` + comment naming
   SA-03).
6. Both pages export `generateStaticParams` from the product's packs; unknown `packId` → `notFound()`.

## Files to Change (all inside Périmètre)

`[app]/checkout/_actions.ts` + `_actions.test.ts` + `_actions.ledger.test.ts`; `[app]/checkout/_components/
{checkout-flow,pack-summary,test-card-fields,purchase-confirmation}.tsx` (+ tests for flow and summary);
`[app]/checkout/_components/messages.test.ts`; `[app]/checkout/[packId]/page.tsx` + test;
`[app]/@modal/(.)checkout/[packId]/page.tsx` + test; `messages/{fr,en}/checkout.json`; `e2e/checkout.spec.ts` (not
run).

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(credits)` action, `feat(app)` UI).

1. Messages + parity. 2. Auth first. 3. Input parsing. 4. Guard. 5. Pack checked before the DAL. 6. Happy path
(`refresh`, `after` → `track` with `purchaseKey`; `track` rejection logged, not thrown). 7. DAL failure.
8. Integration on the shared DB (one credit on sequential and parallel replay, balance = ledger, unknown pack → 0 rows,
one event with `packId`). 9. `PackSummary`. 10. Form state. 11. Submit, pending, optimistic badge, single dispatch, key
reuse after `failed`. 12. Confirmation + « Reprendre » → `replace`. 13. Errors (+ overlay rollback). 14. Full page
(+ `generateStaticParams`). 15. Intercepted modal. 16. `e2e/checkout.spec.ts` (written, not run; buyer `SEED_ADMIN`
until SA-03). 17. Real-page check (free port), `pnpm build`, `pnpm check`.

## Risks

| Risk | Mitigation |
|---|---|
| Replay tracks `purchase` twice | Decision 2 |
| X / Escape after confirmation reopens pricing | Decision 1 |
| Cached config vs DAL | DAL throws → `failed`, nothing written |
| Optimistic overlay lifetime | Pinned by task 11 |
| `params` under Cache Components | `generateStaticParams`; `pnpm build` |
| Interception from the intercepted pricing modal | Real-page check, e2e journey 4 |

## Acceptance

- [ ] Bullet 1 (modal over tool and pricing, full screen on mobile, direct page): Tasks 14, 15, 16
- [ ] Bullet 2 (summary, test card, notice): Tasks 9, 10, 16
- [ ] Bullet 3 (guard, pending, confirmation, optimistic badge, Reprendre): Tasks 4, 6, 11, 12, 16
- [ ] Bullet 4 (single credit on double click/replay, purchase event with the pack): Tasks 8, 11, 16
- [ ] fr/en parity; `pnpm build`, `pnpm check` green; PR title `feat(credits): SA-05 simulated checkout modal and purchase action`
