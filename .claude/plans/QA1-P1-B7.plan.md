# Implementation Plan: QA1-P1-B7 · Un refus 402 n'est pas une génération

**Source spec**: specs/qa/QA1-P1-B7-refus-402-activite.md
**Starts after QA1-P1-B5 and QA1-P1-L1 are merged**: merge the integration branch into this worktree first and re-read `route.ts` / `generations.ts` (line numbers will have moved).

## Overview

A `generate` call refused for insufficient balance still leaves a `generations` row (`recordGeneration` runs before `debit`), which `markGenerationFailed` then marks `failed` — indistinguishable in BO-04 from a real AI failure that was refunded. Fix: on `insufficient_balance`, delete the pending row instead of marking it failed. `credits_exhausted` tracking, debit-before-AI-call and refund-on-failure are unchanged.

## Why not debit before the write

`debit()` (`lib/dal/credits.ts`, frozen) looks up the `generations` row by `generationId` and checks it belongs to `userId`/`productId` before touching the balance: the row must exist when `debit()` runs. Moving the write after the debit would change `debit()` (forbidden) or break the FK/ownership check. Chosen: keep `recordGeneration` → `debit`, delete the row when `debit` refuses. End state: no row persists for that attempt.

## Architecture changes

- `lib/dal/generations.ts`: additive export `deleteGeneration(generationId: string): Promise<void>` (same style as the other additive exports; no existing signature changes), deleting **only** a row still `pending` (never a `succeeded` or genuinely `failed` one); no-op otherwise.
- `app/(products)/[app]/api/generate/route.ts`: in the `if (!debitResult.ok)` branch, replace `await markGenerationFailed(generationId)` with `await deleteGeneration(generationId)`. The `credits_exhausted` track in `after()` and the 402 response stay. The AI-failure branches keep `markGenerationFailed` + `refund`.
- `lib/dal/activity.ts`, `generations-table.tsx`: no code change expected (a deleted row is absent from `listProductGenerations`); they stay in scope for tests.

## Implementation steps

### Phase 1: DAL
1. RED (`lib/dal/generations.test.ts`, `withTestTransaction`): `deleteGeneration` deletes a pending row.
2. RED: `deleteGeneration` is a no-op on a `succeeded` or `failed` row (audit trail protected).
3. GREEN: `await db.delete(generations).where(and(eq(generations.id, generationId), eq(generations.status, "pending")))`, with a comment (QA1-P1-B7, why the pending-only guard).

### Phase 2: route
4. The committed test "402s, records credits_exhausted and leaves the row failed, without refund" asserts the bug. In its own commit whose message cites QA1-P1-B7 (a 402 must not leave a `generations` row): assert the row no longer exists (`findFirst` by idempotency key → `undefined`), rename to "402s, records credits_exhausted and deletes the row, without refund", drop the now-dead cleanup. Red against the current route.
5. GREEN: wire `deleteGeneration` in the insufficient-balance branch only.
6. RED/GREEN: a retry with the same idempotency key after a 402 (debit now succeeds) → 200, not a 409 `duplicate_request` (nothing was debited on the refused attempt; docs/01 « un retry ne débite pas deux fois » still holds). Flag it in the PR.

### Phase 3: activity
7. RED/GREEN (route.test.ts, reusing its setup): after the 402, `listProductGenerations(productId, 1)` (mock `requireAdmin` as `activity.test.ts` does) contains no row for that attempt and `total` did not grow.

### Phase 4: UI check
8. Confirm `generations-table.tsx` needs no change (it renders the entries it gets).

## Testing strategy

- DAL: `lib/dal/generations.test.ts` (delete pending, no-op otherwise).
- Route: `app/(products)/[app]/api/generate/route.test.ts` (updated 402 test, same-key retry, activity read).
- No new E2E (`e2e/activity.spec.ts` seeds rows by SQL and is unaffected).

## Risks

- The committed 402 test changes: its own commit, explicit message, reviewer reads it first.
- B5 lands first near this code: disjoint branches of the same functions; re-read after merging.
- `deleteGeneration` silently no-ops if called too late: keep the call right after `debit()` returns `insufficient_balance`; step 2 covers it.
- Same-key retry after a 402 is a behavior change (previously a 409): flag in the PR and at `/review`.

## Success criteria

- [ ] Every acceptance bullet has a passing test.
- [ ] A 402 leaves zero `generations` rows for that key; `credits_exhausted` still tracked.
- [ ] `listProductGenerations` never lists a 402 refusal.
- [ ] `debit()` unchanged; no change to `lib/dal/credits.ts`; no existing DAL signature changed.
- [ ] `pnpm check` green, coverage 80%+ on `lib/**`.
