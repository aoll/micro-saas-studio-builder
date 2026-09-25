# Implementation Plan: QA1-P1-Q2 · Première venue connectée sur un autre produit

## Overview
When a user with an active session (e.g. signed up on product A) navigates to a different product B where they've never received the signup bonus, automatically grant B's `+3` bonus once and record B's `signup` event, using the existing idempotent `grantSignupBonus`/`track` calls — reusing the logic already in `signup/complete/route.ts`, triggered from a new, small, Suspense-isolated leaf in `[app]/layout.tsx` so the trigger fires on any page of product B without touching the static shell.

## Requirements (spec's Acceptation)
- A connected account arriving on product B, where it never had a bonus, receives `+3` credits on B exactly once (idempotency key per user and product) and one `signup` event for B.
- Returning, reconnecting, or reloading never regrants the bonus nor re-emits the signup event.
- Product A's balance never moves.

## Constraints carried from the spec and CLAUDE.md
- **Frozen contract**: no new DAL function, no signature change to `lib/dal/credits.ts` / `lib/dal/events.ts`. Confirmed feasible: `grantSignupBonus({ userId, productId })` and `track({ type: 'signup', ... })` are exactly what's needed, unchanged.
- **No write in a cached render**: `[app]/layout.tsx`'s default export is not `'use cache'`, but it wraps every page including the statically pre-rendered landing (`generateStaticParams`). Anything that reads the session or writes must stay inside its own `<Suspense>`, exactly like `HeaderBalance` already does (docs/04-nextjs.md, "isoler ce qui lit la session"). A top-level, unguarded `getSession()` call in the layout would force the whole shell dynamic and break the landing's pre-render — ruled out.
- **User data never cached**: nothing here uses `'use cache'`; the new gate is a Suspense-streamed Server Component, same pattern as `HeaderBalance`.
- **Périmètre**: `[app]/signup/complete/**`, `[app]/signup/_components/**`, `[app]/layout.tsx` (or `[app]/tool/**`), `lib/dal/credits.ts` / `lib/dal/events.ts` (implementation only — not touched at all in this plan), and tests. `components/product/header-balance.tsx` and `[app]/signup/_actions.ts` are **out of scope** (owned by SA-03) and are not modified.

## Two options considered

**Option A — Grant inline, unconditionally, on every render of a new session-reading Suspense component (no client gating).**
A new async Server Component in the Suspense tree calls `getSession()`, and if a session exists, calls `grantSignupBonus` + `track` directly (mirroring `route.ts`'s body) on every render.
- Pros: no client JS, no localStorage, simplest code.
- Cons: runs a DB write (an `INSERT ... ON CONFLICT DO NOTHING` transaction for the bonus, plus an advisory-locked dedupe transaction for the event) on **every single page view** of every authenticated user, forever — not just the first time on a new product. This also breaks the codebase's consistent convention that every mutation lives in a Server Action or Route Handler, never in a rendered Server Component (purchase, signup, generate all follow this; `TrackVisit` even routes through a `sendBeacon` → Route Handler specifically to avoid a write during render). It's a deviation from that pattern for no benefit, and adds a small but real recurring DB load.

**Option B — Reuse `signup/complete`'s logic via a Server Action, called once per browser per product from a Suspense-isolated client leaf (localStorage-gated).**
Extract the ~6-line "resolve product → resolve session → grant bonus → track signup" logic from `route.ts` into a tiny shared `server-only` helper, used by both the existing `route.ts` (magic-link redirect target, unchanged behavior) and a new Server Action `claimSignupBonus(slug)`. A client leaf, rendered only when a session exists (Suspense-gated, so it never mounts for anonymous visitors or in the pre-rendered landing shell), calls that action once via `startTransition`, matching the exact calling convention already used by `CheckoutFlow`'s `purchase()` call. A `localStorage` flag skips the call on subsequent mounts in the same browser — a pure optimization, not the correctness mechanism (correctness is already guaranteed by `grantSignupBonus`'s and `track`'s own idempotency keys, which are unaffected by localStorage).
- Pros: fits the established Server Action convention; one real write attempt per browser per product (not per page view); reuses `route.ts`'s logic instead of duplicating it; the Server Action's own `refresh()` call (same idiom as `purchase()`) is what actually updates the header balance badge, with no extra `router.refresh()` needed.
- Cons: a few more files (one shared helper, one action, two small components) than Option A.

**Recommendation: Option B.** It matches the project's own architecture rule (mutations only in Server Actions/Route Handlers), avoids a permanent per-page-view DB write, and reuses — rather than duplicates — the already-reviewed, already-tested logic in `signup/complete/route.ts`. Option A's simplicity doesn't offset its recurring cost and its departure from the codebase's own convention.

## Architecture Changes
- `app/(products)/[app]/signup/complete/_lib/claim.ts` (new): `server-only` helper `claimSignupBonus(slug): Promise<ClaimResult>` where `ClaimResult = { status: 'not_found' } | { status: 'no_session' } | { status: 'granted'; balance: number }`. Resolves the product (not_found if missing/killed), resolves the session (no_session if absent), calls `grantSignupBonus({ userId, productId })`, and `after(() => track({ type: 'signup', ... }))` with the anonymous-id cookie read the same way `route.ts` already does. No new DAL export — only existing `grantSignupBonus`, `track`, `getProduct`, `getSession`.
- `app/(products)/[app]/signup/complete/route.ts` (refactor, behavior-preserving): delegates to `claimSignupBonus`, keeping its existing `notFound()` / `redirect('/signup')` / `grant → redirect('/tool')` branching exactly as today. Existing `route.test.ts` should pass unmodified — it's the regression guard for this refactor.
- `app/(products)/[app]/signup/complete/_actions.ts` (new, `'use server'`): `claimSignupBonus(slug: string): Promise<{ ok: true; balance: number } | { ok: false }>`. Validates `slug` with the shared `slugSchema`, calls the helper, calls `refresh()` (from `next/cache`) only on `granted` (mirrors `checkout/_actions.ts`'s `purchase()`).
- `app/(products)/[app]/signup/_components/claim-cross-product-bonus.tsx` (new, `'use client'`): on mount, checks `localStorage['msb:signup-claimed:' + slug]`; if unset, calls `claimSignupBonus(slug)` inside `startTransition` (same idiom as `CheckoutFlow.handlePay`), then sets the flag. Renders nothing. A failed/rejected call is swallowed — it simply retries on the next real page load.
- `app/(products)/[app]/signup/_components/cross-product-signup-bonus.tsx` (new, async Server Component): calls `getSession()` (already `React.cache()`-memoized, so this second call is free within the same request already paid for by `HeaderBalance`); renders `null` if absent, else `<ClaimCrossProductBonus slug={slug} />`.
- `app/(products)/[app]/layout.tsx` (edit): add `<Suspense fallback={null}><CrossProductSignupBonus slug={product.slug} /></Suspense>` in the body, alongside the existing `HeaderBalance` Suspense. Because this is its own dynamic hole, it never runs during `partialPrefetching`'s shell prefetch (only on a real navigation/render), and never runs for anonymous visitors (the gate returns `null` before the client leaf ever mounts), so the statically pre-rendered landing and SEO shell are unaffected.

## Implementation Steps (test-first)

1. **`_lib/claim.ts` + `_lib/claim.test.ts`** (File: `app/(products)/[app]/signup/complete/_lib/`)
   - Tests: `not_found` for missing/killed product; `no_session` when `getSession()` resolves null; `granted` calls `grantSignupBonus({ userId, productId })` and returns its balance; `track` is called via `after()` with `type: 'signup'` and the anonymous-id cookie when present, `null` otherwise (mirror `route.test.ts`'s existing unit-test mocking style).
   - Real-DB test (mirrors `route.test.ts`'s "GET twice" suite): calling `claimSignupBonus` twice for the same user/product writes one `signup_bonus` ledger row and one `signup` event.
   - New: a real-DB test seeding a prior balance on product A, then claiming product B, asserting A's `balances` row is untouched (covers "le solde de A ne bouge pas" directly, not just by inference).
   - Risk: Medium — this is the correctness-critical file; get the branching exactly right before touching `route.ts`.

2. **Refactor `route.ts` to call `claimSignupBonus`** (File: `app/(products)/[app]/signup/complete/route.ts`)
   - Action: replace the inline body with a call to the helper and the same three branches as today.
   - Why: single source of truth for the grant+track logic, reused by the new Server Action.
   - Dependencies: step 1. Run the existing `route.test.ts` unmodified — it must stay green (no test committed for this file needs to change; if it doesn't, the refactor preserved behavior).
   - Risk: Low if the helper's contract matches exactly what the inline code did.

3. **`_actions.ts` + `_actions.test.ts`** (File: `app/(products)/[app]/signup/complete/_actions.ts`)
   - Tests: invalid slug → `{ ok: false }` without calling the helper; `no_session`/`not_found` → `{ ok: false }`, no `refresh()`; `granted` → `{ ok: true, balance }`, `refresh()` called once.
   - Dependencies: step 1.
   - Risk: Low.

4. **`claim-cross-product-bonus.tsx` + `.test.tsx`** (File: `app/(products)/[app]/signup/_components/`)
   - Tests (jsdom/RTL, mirroring `signup-flow.test.tsx`'s Server-Action-mocking style): on mount, calls `claimSignupBonus(slug)` once; sets the `localStorage` flag after settling; a second mount with the flag already set does not call the action again; a rejected call doesn't throw and doesn't set the flag (so it's retried on the next real page load — deliberate, not a bug).
   - Dependencies: step 3.
   - Risk: Medium — this is the only place with a client-side gating decision; the acceptance criteria's correctness must not depend on this file being right (it's covered independently by step 1's idempotency tests), only its no-duplicate-call behavior per mount is tested here.

5. **`cross-product-signup-bonus.tsx` + `.test.tsx`** (File: `app/(products)/[app]/signup/_components/`)
   - Tests (mirrors `header-balance.test.tsx`'s "call the async component directly" pattern): no session → returns `null`; session present → renders `<ClaimCrossProductBonus slug={...} />` (mock the child component module and assert it's the one referenced in the returned element, or assert on its `type`/`props`).
   - Dependencies: step 4.
   - Risk: Low.

6. **Wire into `[app]/layout.tsx`** (File: `app/(products)/[app]/layout.tsx`, extend `layout.test.tsx`)
   - Action: add the `<Suspense fallback={null}>` block described above.
   - Test: extend the existing "resolves an active product" case in `layout.test.tsx` to assert the returned element tree contains the new Suspense boundary wrapping `CrossProductSignupBonus` with `slug: 'lettre-pro'` (walk `ui.props.children`, same style already used there for other assertions) — an addition to an existing test, not a weakening of it.
   - Dependencies: step 5.
   - Risk: Low, but get the tree-walk assertion right; `layout.test.tsx` doesn't use RTL `render()`, it inspects the raw React element tree returned by calling the layout function directly.

## Testing Strategy
- Unit tests: `_lib/claim.test.ts` (branching + after()-flushed track), `_actions.test.ts` (validation + refresh gating), `claim-cross-product-bonus.test.tsx` (client gating), `cross-product-signup-bonus.test.tsx` (server gate), extended `layout.test.tsx`.
- Integration (real DB, mirroring `credits.test.ts`/`route.test.ts`'s private-product pattern): claim twice → one bonus row, one signup event; claim on product B after a prior balance on product A → A's balance row unchanged.
- No new E2E required by this spec's Périmètre, but this is exactly QA scenario 5.10.4 in `.claude/qa/reports/2026-09-25-full.md`; the orchestrator/E2E phase should re-run that scenario (second product, same session, no explicit signup) to confirm the balance shows `+3` without any click.

## Risks & Mitigations
- **Double bonus / race (two tabs, concurrent claims)**: already guarded at the DAL level (`signup_bonus:{userId}:{productId}` unique idempotency key on `credit_transactions`, and `track`'s advisory-locked dedupe on `(product, user)` for `signup`) — this plan adds a new *caller*, never a new write path, so LEDGER's and TRACKING's existing concurrency tests remain the source of truth. The new integration test in step 1 double-checks the caller-level path specifically.
- **Reloads**: correctness doesn't depend on `localStorage`; clearing it or using a second device just costs one harmless extra idempotent call, never a second bonus. Call this out explicitly as a design note and cover it with a step-1 test that bypasses the client leaf entirely.
- **Redundant call right after a real signup**: after a normal SA-03 signup on product A, the layout's new gate will also fire once more for product A itself (session now exists) — a single harmless no-op call. Not worth suppressing given the complexity it would add; noted here so it isn't mistaken for a bug later.
- **Admin/owner sessions**: `signup/complete/route.ts`'s existing comment already accepts that *any* signed-in user reaching that URL gets the bonus, including an admin browsing a sub-app while logged into the backoffice (shared Better Auth session). This plan extends that already-accepted behavior automatically rather than introducing it — flagged here for visibility, not a new risk.
- **Périmètre discipline**: `components/product/header-balance.tsx` and `[app]/signup/_actions.ts` are intentionally untouched (owned by SA-03, not in this spec's Périmètre); the new gate is a sibling Suspense boundary, not a change to `HeaderBalance`.
- **No DAL/contract change needed**: confirmed throughout — nothing in this plan requires a new DAL function or a signature change, so there is nothing to escalate to the human/orchestrator on that front.

## Success Criteria
- [ ] A session connected on product A, visiting product B for the first time, sees B's balance become `3` without any click, and product B gets exactly one `signup_bonus` ledger row and one `signup` event for that user.
- [ ] Repeating the visit, reconnecting, or reloading on product B never adds a second bonus row or a second signup event (proven independently of the client-side localStorage gate).
- [ ] Product A's balance is bit-for-bit unchanged after claiming B.
- [ ] `route.test.ts` passes unmodified (behavior-preserving refactor).
- [ ] `pnpm check` passes; no new DAL export, no signature change to `lib/dal/credits.ts` or `lib/dal/events.ts`.
