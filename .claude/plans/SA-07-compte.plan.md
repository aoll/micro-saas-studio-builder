# Plan: SA-07 · Compte et crédits

**Source spec**: specs/SA-07-compte.md
**Complexity**: Medium (one route with a streamed async leaf, small components with two `'use client'` leaves, fr/en
messages, one e2e file)

## Summary

`/[app]/account` mirrors SA-06: static shell (`app()` → cached `getProduct` → `notFound()`, translated `<h1>` « Mon
compte »), and one `<Suspense>` around an async `AccountContent` leaf, the only place that reads the session. Signed
in: email, balance card (`getBalance`, « Recharger » → `/${slug}/pricing`), credit movements (date, reason, signed
delta), purchases (pack, date, amount), a link to `/${slug}/history` (closes SA-06's pending integration), « Se
déconnecter » (`authClient.signOut()`). Not signed in: a sign-up prompt plus a client leaf that `router.replace`s to
`/${slug}/signup` so SA-03's intercepted modal opens. Nothing cached, no Server Action.

## Orchestrator decisions (binding)

1. **Movements and purchases need a new DAL read module (`lib/dal/account.ts`) outside the spec's Périmètre.** This
   is a human decision (asked). Until it is answered, implement Phases 1 and 3 only; do NOT create any file under
   `lib/dal/`. Phase 2 starts only when the orchestrator relays the answer.
2. Sign-up gate: implement and unit-test the auto-open leaf now (`/${slug}/signup` `as Route` with a comment naming
   SA-03), mark the anonymous e2e journey `test.fixme` with a reason naming SA-03. The orchestrator holds SA-07's merge
   until SA-03 is merged, then drops the cast and un-fixmes the journey.
3. The header entry point to `/account` (CONTRACT-ui `header-balance.tsx`) is an orchestrator follow-up, not here.
4. Sign-out: a colocated `'use client'` leaf mirroring `components/backoffice/sign-out-button.tsx` with the same
   `authClient`; success → `router.replace('/${slug}')` then `router.refresh()`; errors → toast + `console.error`.
5. Mockup extra omitted: per-generation input summary in movement labels (plain « Génération »).

## Frozen inputs (consumed, never changed)

`getProduct`; `getSession()` `lib/dal/session.ts:13-16`; `getBalance` `lib/dal/credits.ts:107-113`; `authClient`
`lib/auth-client.ts`; `credit_transactions`, `purchases` `lib/db/schema.ts:151-195`; `EmptyState`, `Button`, `Card`,
`Skeleton`, Sonner; messages auto-loaded by `messages/manifest.ts`.

## Patterns to Mirror

| Category | Source |
|---|---|
| Page with root param + Suspense | `app/(products)/[app]/history/page.tsx:15-30` |
| Async session leaf | `app/(products)/[app]/history/_components/history-list.tsx:20-50` |
| Page test | `app/(products)/[app]/history/page.test.tsx:12-52,85-115` |
| Leaf test | `app/(products)/[app]/history/_components/history-list.test.tsx:13-40` |
| fr/en parity | same file `:286-295` |
| Sign-out leaf + test | `components/backoffice/sign-out-button.tsx:12-39`, `.test.tsx:7-50` |
| Currency / date format | `components/product/pack-card.tsx:22-25`, `history-list.tsx:78` |
| e2e DB + magic-link sign-in | `e2e/history.spec.ts:30-38,114-152`, `lib/auth.ts:18-22,55`, `lib/dal/magic-link.ts:19-27` |

## Design decisions

1. Page shell with no session/cookie/searchParams reads; `<Suspense fallback={<AccountSkeleton/>}><AccountContent
   slug productId/></Suspense>`; no `'use cache'` in `account/**`.
2. `AccountContent`: session → `getBalance(session.user.id, productId)` (+ the lists once Phase 2 is decided); no
   session → `<SignupPrompt slug/>`, no DAL call.
3. Balance card « Solde », number, plural « crédits », `<Button asChild><Link href={`/${slug}/pricing`}>Recharger`.
4. History link « Voir mes générations » → `/${slug}/history`.
5. `SignupPrompt` (server): `EmptyState` « Créez un compte pour voir vos crédits » + link + `<OpenSignupModal href/>`
   (`'use client'`, `null`, `router.replace(href)` once; never `push`, to avoid a reopen loop on modal close).
6. Messages `messages/{fr,en}/account.json`: `title`, `loading`, `balance.*`, `movements.*`, `movement.*`,
   `purchases.*`, `history.link`, `signOut.*`, `signup.*`.

## Tasks

Red → green, `pnpm vitest run <file>`, commit + push `feat(app): …` at each green.

**Phase 1** (now): 1 page shell; 2 messages + parity; 3 `AccountContent` signed in with balance (email, 12 / 0,
« Recharger » href); 4 history link; 5 sign-out leaf; 6 skeleton + Suspense.
**Phase 3** (now): 12 `SignupPrompt` / `OpenSignupModal` (no DAL call without session; `replace` exactly once).
**Phase 2** (only after the orchestrator relays the human decision): DAL reads for movements and purchases and their
lists (`MovementList`, `PurchaseList`), wired in `AccountContent`.
**Phase 4**: 13 `e2e/account.spec.ts` (written, not run; anonymous journey `test.fixme` until SA-03); 14 real-page
check on `next dev`; 15 `pnpm check`, `pnpm test:coverage`, `pnpm build`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| No DAL read for movements/purchases; `lib/dal` outside Périmètre | Certain | Decision 1 (asked to the human) |
| `/signup` not merged | Certain until SA-03 | Decision 2 (merge held) |
| Dynamic reads outside `<Suspense>` | Medium | Page test; real-page check |
| Modal reopen loop | Medium | `replace`, unit-tested |
| Shared DB | High | Fresh users, schema-valid configs, cleanup |

## Acceptance

- [ ] Balance, sign-out: Tasks 3, 5, 13
- [ ] Ledger movements, purchases: Phase 2 (pending the human decision)
- [ ] Not signed in → sign-up modal: Tasks 12, 13 (merge held until SA-03)
- [ ] History entry point: Task 4
- [ ] Never cached, streamed; fr/en; no frozen contract edited; `pnpm check`, `pnpm build` green; PR title `feat(app): SA-07 account and credits page`
