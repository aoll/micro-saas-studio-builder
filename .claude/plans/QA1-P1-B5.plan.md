# Implementation Plan: QA1-P1-B5 · « 1re génération » une fois par visiteur

**Source spec**: specs/qa/QA1-P1-B5-premiere-generation.md
**Réf**: .claude/qa/reports/2026-09-25-full.md › B5 · docs/01 › Le funnel suivi par produit · specs/SA-02-outil.md › Acceptation 6 · specs/TRACKING.md › Acceptation 4
**Contract**: DAL signatures unchanged (frozen). No change to `lib/db/schema.ts` or `lib/schemas/**`, and no new export.
**Complexity**: Small. One line of the route, one query in the DAL, and tests.

## Root cause

1. **The route drops the anonymous identity once there is a session.** `route.ts:78`:
   `const existingAnonymousId = userId ? null : readAnonymousId(cookieStore.get(ANONYMOUS_ID_COOKIE)?.value);`
   For a signed-in caller the `anonymous_id` cookie is never read, although it is still in the browser (1 year, `path: "/"`).
2. **The first-generation check counts by `userId` only.** `route.ts:86` calls `countPriorGenerations({ productId, userId, anonymousId: null, ipHash: null })`. In `lib/dal/generations.ts` the `userId` branch returns early and only counts `generations.user_id = userId`. The free generation row has `user_id = NULL`, `anonymous_id = A`, so it is invisible: `priorCount === 0`, a second `first_generation` is tracked.
3. **Signup never links the anonymous generations to the user.** `signup/complete/route.ts` only tracks `signup { userId, anonymousId: A }`. The links anonymous id ↔ user are **the cookie** (same browser) and **the `signup` event** (`events.anonymous_id`, docs/07).

## Decision

Fix the check (route + `countPriorGenerations` query), not by deduplicating in `track()`.

- `countPriorGenerations(who)` keeps its signature `{ productId, userId, anonymousId, ipHash } → Promise<number>`. When `userId` is set it now counts, on this product and excluding `failed` rows, the user's own rows **plus** anonymous rows (`user_id IS NULL`) whose `anonymous_id` is `who.anonymousId` (the cookie) or an `anonymous_id` stored on this user's `signup` event for this product (Phase 2).
- The route passes the cookie to that count for a signed-in caller too; it never adds it to the tracked events (`generation` stays `anonymousId: null` for a signed-in caller).
- `ipHash` is never used for a signed-in caller (a shared IP must not hide another person's first generation).
- `failed` rows stay excluded: a failed free generation emitted no `first_generation`.

Rejected: dedupe `first_generation` in `track()`: contradicts a committed test (`events.test.ts` › "does not dedupe non-visit types"), adds a fourth deduped type while docs/07 lists three, and its key has two identities. `lib/dal/events.ts` stays unchanged.

## Implementation steps

### Phase 1: same browser (the QA repro)

1. **RED: reproduce B5 at the route** (`app/(products)/[app]/api/generate/route.test.ts`). New describe `POST [app]/api/generate — first_generation across signup (QA1-P1-B5)`, test `tracks a single first_generation when an anonymous visitor signs up then generates signed in`, inside `withTestTransaction`.
   - Arrange: fresh user row (`randomUUID()` id and email, like `freshUserId()` in `generations.test.ts`), `anonymousId = randomUUID()`, `cookieStore.get.mockReturnValue({ value: anonymousId })`, random `x-forwarded-for`.
   - Act 1: `getSession → null`, POST, drain; assert `track` called with `{ type: "first_generation", userId: null, anonymousId }`; `track.mockClear()`.
   - Act 2: same cookie, `getSession → { user: { id } }`, new key, POST, drain.
   - Assert: `track` not called with `type: "first_generation"`, called with `type: "generation"`.
   - Drain: `await readTextDeltas(res); await vi.waitFor(() => expect(afterCallbacks.length).toBeGreaterThanOrEqual(2)); await flushAfterCallbacks();` — every `after()` task awaited before `withTestTransaction` ends.
   - Must fail on the `first_generation` assertion. Commit red alone: `test(app): reproduce double first_generation after signup (QA1-P1-B5)`.
2. **The DAL counts the caller's anonymous generations** (`lib/dal/generations.ts`, `generations.test.ts`, `withTestTransaction`).
   - RED: `by userId: also counts an anonymous generation made with the given anonymousId on this product` → expects 1, today 0.
   - Edge guards (same step): another anonymousId → 0; same anonymousId on another product → 0; same anonymousId with a `failed` row → 0; anonymous row with same ipHash but other cookie, user passing `ipHash: "x"` → 0; `anonymousId: null` → only the user's own rows.
   - GREEN, `userId` branch: `const ownOrLinked = who.anonymousId ? or(eq(generations.userId, who.userId), and(isNull(generations.userId), eq(generations.anonymousId, who.anonymousId))) : eq(generations.userId, who.userId);` inside the existing `where(and(eq(productId), ne(status, "failed"), ownOrLinked))`. Update the doc comment.
   - Commit: `fix(app): count a visitor's anonymous generations for first_generation (QA1-P1-B5)`.
3. **The route passes the cookie for a signed-in caller** → step 1 green. `const existingAnonymousId = readAnonymousId(cookieStore.get(ANONYMOUS_ID_COOKIE)?.value);` (drop `userId ? null :`), then `countPriorGenerations({ productId: product.id, userId, anonymousId: existingAnonymousId, ipHash: null })` in the signed-in branch. Do **not** assign it to the `anonymousId` variable that feeds events. Cookie-set line unchanged (guarded by `!userId`). Rewrite the comment of lines 76-78. Whole route file green. Commit: `fix(app): link the anonymous cookie to the signed-in first_generation check (QA1-P1-B5)`.
4. **Acceptance 2 guards** (route.test.ts, `withTestTransaction`): first signed-in generation with a cookie that has only a visit → `first_generation` tracked; visitor whose only anonymous generation failed (`resolveModel` throws once → 502), then signed in with same cookie → `first_generation` tracked once. Green after step 3 (non-regression guards; say so in the commit). Commit: `test(app): first_generation still fires for a first signed-in generation (QA1-P1-B5)`.
5. **Acceptance 3**: assert the signed-in generation tracks exactly `{ type: "generation", productId, userId, anonymousId: null, metadata: { generationId } }`. `lib/dal/events.ts` and `events.test.ts` untouched. Commit: `test(app): signed-in generation events keep anonymousId null (QA1-P1-B5)`.

### Phase 2: link through the signup event (cookie lost, other device)

6. RED (`withTestTransaction`): `by userId: counts an anonymous generation whose anonymousId is on the user's signup event for this product, without a cookie` → insert a `signup` event (U, A, lettre-pro) and an anonymous row A; `countPriorGenerations({ productId, userId: U, anonymousId: null, ipHash: null })` → 1 (today 0). Guards: signup on another product → 0; signup with `anonymous_id NULL` → 0.
   GREEN: linked ids = `who.anonymousId` ∪ `select anonymous_id from events where product_id = P and type = 'signup' and user_id = U and anonymous_id is not null` (Drizzle `inArray(generations.anonymousId, subquery)` inside `and(isNull(generations.userId), …)`); uses index `events (product_id, type, created_at)`.
   Commit: `fix(app): link first_generation through the signup event's anonymous id (QA1-P1-B5)`.

## Testing strategy

- DAL: `lib/dal/generations.test.ts` (cookie, signup event, other product, failed row, IP, no linked id), `withTestTransaction` everywhere.
- Route: `app/(products)/[app]/api/generate/route.test.ts` (B5 repro, Acceptance 2, Acceptance 3); `track`, `debit`, `guardRequest`, `getSession` stay mocked as in the file.
- No E2E here; the next QA pass checks scenario full › 6.2 and 6.3.

## Risks

- Stream and `after()` inside `withTestTransaction`: drain the body and flush every `after` callback before leaving `fn`; if a test still leaks, fall back for that test only to the file's existing cleanup pattern and say why in the commit.
- Client-controlled cookie: a signed-in user can only suppress their own `first_generation` (−1 on the funnel). Accepted, LOW; note in the PR.
- Only caller of `countPriorGenerations` is `route.ts`; the call with `anonymousId: null` behaves as before.
- Pre-existing race (two concurrent first signed-in generations) not fixed: outside B5; report as a follow-up in the PR.
- B4 (two anonymous ids on first visit) is fixed in parallel; this fix reads the same cookie.
- QA1-P1-B7 later edits the same route: keep the change minimal and well commented.

## Success criteria

- [ ] Step 1 committed red, green after step 3.
- [ ] Acceptance 1, 2, 3 covered by tests.
- [ ] No DAL signature or export changed; only `route.ts`, `generations.ts` and their tests touched.
- [ ] `/verify` READY: `pnpm check` green, coverage 80%+ on `lib/**`.
