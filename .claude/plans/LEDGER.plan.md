# Plan: LEDGER · Ledger de crédits

**Source spec**: specs/LEDGER.md
**Complexity**: Medium (2 files, but the whole credits invariant rests on them: concurrency, idempotency, session binding)

## Summary

Replace the V1 stubs in `lib/dal/credits.ts` with the real ledger of docs/07: `credit_transactions` only gets inserts
keyed by `onConflictDoNothing(idempotency_key)`; `balances` is updated in the same transaction (conditional
`UPDATE … WHERE balance >= cost` for debits, upsert `credit()` for incoming credits). `debit` returns
`{ ok: false, reason: "insufficient_balance" }` through a private `InsufficientBalance` error that rolls the
transaction back, never throwing for that. Every function taking a `userId` checks it against the session (CONTRACT-data
security watch item). The five typed-const signatures stay byte-identical. `credits.test.ts` is rewritten, in a commit
that says why, into real-Postgres behaviour tests covering every acceptance bullet, concurrency included.

## Orchestrator decisions (binding)

1. **`lib/dal/contract-shape.test.ts:63` fix accepted.** Its debit passes `generationId: "g1"` (not a uuid, no FK row),
   which no honest ledger can accept. One-line change in its own commit (`test(credits): contract-shape debit uses a real
   generation (FK)`, message says why): create a generation with `recordGeneration` (owner session already mocked) and
   pass its id. Shape assertions unchanged; `refund("g1")` stays (a no-op, decision 4 below).
2. No other file outside `lib/dal/credits.ts` / `credits.test.ts`.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Frozen typed consts | `lib/dal/credits.ts:36-62` | Declared type text byte-identical; header and † comments kept; stub comments updated to the real behaviour |
| Session check | `lib/dal/generations.ts:41-45` | `const session = await getSession(); if (… !== session?.user.id) throw new Error("<fn>: userId does not match the caller's session")` |
| Idempotent insert | `lib/dal/generations.ts:47-66` | `.onConflictDoNothing({ target: <table>.idempotencyKey }).returning({ id })`; empty = replay |
| Errors as values | `docs/07-modele-de-donnees.md:214-236` | Private `class InsufficientBalance extends Error {}` thrown in `db.transaction`, caught outside; other errors rethrown |
| Upsert credit | `docs/07-modele-de-donnees.md:239-246` | `insert(balances)….onConflictDoUpdate({ target: [userId, productId], set: { balance: sql\`${balances.balance} + ${delta}\`, updatedAt: new Date() } }).returning({ balance })` |
| Transaction type | `scripts/seed.ts:230-231` | `type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];` |
| Admin roles | `lib/dal/session.ts:11` | Private copy `new Set(["admin", "owner"])` with a comment pointing there |
| Test session mock | `lib/dal/generations.test.ts:7-12` | `const getSession = vi.fn(); vi.mock("./session", () => ({ getSession: () => getSession() }))`, set per test |

## Design decisions

1. **`debit`**: guards first (session match; `cost` a positive integer, else throw). One transaction: insert the
   `generation` ledger row (`delta: -cost`, `generationId`, raw `idempotencyKey`) with `onConflictDoNothing` → no row =
   `{ ok: true, replay: true }`; then `UPDATE balances SET balance = balance - cost WHERE user AND product AND balance >= cost RETURNING balance`
   → no row = `throw new InsufficientBalance()` (rolls back the ledger row) → `{ ok: false, reason: "insufficient_balance" }`.
   Insert-first so a retry of a paid debit says replay even at balance 0. Concurrency: Postgres row locking under READ
   COMMITTED; same key twice: the second insert waits on the unique index.
2. **Derived keys**: `refund:${generationId}`, `signup_bonus:${userId}:${productId}`, `purchase:${purchaseId}`.
3. **`credit(tx, { userId, productId, delta })`**: private upsert returning the new balance, called only after its ledger
   row was inserted; the first credit creates the `balances` row.
4. **`refund(generationId)`**: non-uuid → resolve with no effect. Otherwise one transaction: find the `reason =
   'generation'` row for this id (none → return); insert `+(-delta)`, reason `refund`, key `refund:${generationId}`,
   `onConflictDoNothing`; `credit()` only if inserted. No session check (amount and target come from the ledger; runs in
   SA-02's `onError`/`after()` where an expired session must not lose a refund) — comment and PR body.
5. **`grantSignupBonus`**: session must match; read the current config (`products` ⋈ `product_versions` at
   `current_version`, inside the transaction) → `pricing.freeCreditsOnSignup`; derived key; `credit()`. Replay or bonus
   0 → current balance.
6. **`purchase`**: session must match; one transaction: current config, find the pack (unknown → throw, nothing
   written); insert `purchases` (credits, amountCents from the pack, currency default EUR, client key)
   `onConflictDoNothing` → replay returns the current balance; else `+credits` ledger row with `purchaseId` and key
   `purchase:${purchase.id}`, `credit()`, `{ balance }`. Config read with `db` directly (no `'use cache'` in a write
   transaction).
7. **`getBalance`**: session user equals `userId`, or is admin/owner (BO-04 exception in the frozen comment); no row → 0;
   not cached.
8. Private helpers only: `Tx`, `InsufficientBalance`, `ADMIN_ROLES`, `assertCaller`, `readBalance`, `readConfig`,
   `credit` (knip).

## Tasks

Red → green, commit the red test then commit and push when green (`feat(credits): …`). Every test ends with
`expectLedgerMatchesBalance(userId, productId)`.

- **Task 0 — scaffold (explicit commit)**: rewrite `credits.test.ts` with the `getSession` mock, `asUser`, `createUser`
  (random uuid, `${id}@ledger.test`), `lettreProId`, `createGeneration(userId)` (direct insert, productVersion 1, for
  the FK), `giveCredits` (ledger row + upsert, test setup only), `expectLedgerMatchesBalance`
  (`coalesce(sum(delta),0)::int` vs `balances`), `createProduct` (copy of lettre-pro under `ledger-test-<uuid>`),
  `afterAll` cleanup of everything created. Commit `test(credits): replace V1 stub-value tests with ledger scaffolding`,
  body: stub constants dropped because LEDGER replaces the stub; shape tests stay in `contract-shape.test.ts`.
- **Task 1 — `getBalance`**: no row → 0; after +4 → 4; admin reading another user → value; mismatched user rejects; no
  session rejects.
- **Task 2 — `grantSignupBonus` + first credit**: fresh user → `{ balance: 3 }` and the row exists; second call → 3,
  one `signup_bonus` row; per product (test product gets its own +3, lettre-pro unchanged); mismatched session rejects,
  writes nothing.
- **Task 3 — `debit` happy path + replay**: balance 3, cost 1 → `{ ok: true, balance: 2 }`; same key → `{ ok: true,
  replay: true }`, balance 2, one row (`delta -1`, reason `generation`, `generationId`).
- **Task 4 — refused**: balance 0 → `{ ok: false, reason: "insufficient_balance" }`, no ledger row for its key; no
  `balances` row → same refusal, `getBalance` 0.
- **Task 5 — concurrency**: balance 1 + two parallel debits → exactly one passes, balance 0, ledger sum 0; balance 2 + 5
  parallel → exactly 2; same key twice in `Promise.all` → one `balance: 2`, one replay, one row. If green at once, the
  commit says it pins behaviour.
- **Task 6 — guards**: other user's session / no session reject and write nothing; cost 0, -1, 1.5 reject.
- **Task 7 — `refund`**: debit then refund twice (sequential and parallel) → one `refund` row, key
  `refund:${gen}`, `+1`, balance restored; never-debited generation → no-op; `refund("g1")` → `undefined`.
- **Task 8 — `purchase`**: fresh user `pack-10` → `{ balance: 10 }`, row created; `purchases` row credits 10,
  amountCents 490, EUR, packId; ledger `+10`, reason `purchase`, `purchaseId`; same key twice (sequential and parallel)
  → one purchase, balance 10; unknown pack rejects, nothing written; mismatched session rejects.
- **Task 9 — decision 1 + full checks**: the one-line `contract-shape.test.ts` fix, then `pnpm vitest run
  lib/dal/contract-shape.test.ts lib/dal/contract.test.ts`, `pnpm typecheck`, `pnpm test:coverage` (80 %+ on `lib/**`),
  `pnpm check`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| SA-02 (parallel) must call `recordGeneration` before `debit` with a real generation id, and never debit the free anonymous generation | Medium | CONTRACT-types decision; flagged in the PR |
| SA-03: `grantSignupBonus` needs the request session (a Better Auth hook without session would throw) | Medium | Relayed to SA-03: call it from the post-login request |
| SA-05: `purchase` throws on an unknown pack | Low | SA-05 validates `packId` with `purchaseInputSchema` first; PR note |
| Shared worktree DB with parallel test files | Medium | Fresh user and test product per scenario, cleanup; never touch owner/admin |
| `refund` without session check | Low | Decision 4; called out for security-reviewer |
| `ADMIN_ROLES` duplicated | Low | Private copy with a pointer comment |
| No new dependency | — | — |

## Acceptance

- [ ] debit 3 → 2 at cost 1; same key → replay, balance unchanged
- [ ] debit at 0 → insufficient without throwing, no ledger row; no `balances` row → same, `getBalance` 0
- [ ] Balance 1 + two parallel debits → one passes; same key twice in parallel → debited once
- [ ] refund keyed `refund:${generationId}` refunds once (sequential and parallel)
- [ ] grantSignupBonus +3 once per user and product; first credit creates the `balances` row
- [ ] purchase: purchase + ledger row in one transaction, credits/price from the pack, double click → one purchase
- [ ] Balance equals ledger sum after every scenario; `userId` checked against the session
- [ ] Signatures byte-identical; `contract.test.ts` and `contract-shape.test.ts` green; `pnpm check`, coverage 80 %+
- [ ] PR title: `feat(credits): LEDGER real insert-only credit ledger`
