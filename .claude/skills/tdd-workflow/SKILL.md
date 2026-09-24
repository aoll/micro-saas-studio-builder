---
name: tdd-workflow
description: Test-first playbook for this stack (Vitest, Playwright with instant(), real Postgres per worktree, AI mock mode). Use when writing or reviewing tests for a spec, deciding where a test belongs, or implementing a feature with RED -> GREEN -> REFACTOR.
---

# TDD workflow

The spec's `Acceptation` list is the test plan. Every bullet maps to at least one test, written before
the code that makes it pass. An acceptance bullet without a test is a defect. Coverage on `lib/**` must
reach 80% (branches, functions, lines, statements).

## Cycle

One behavior at a time, without stopping between behaviors:

1. **RED.** Write the test for the behavior. Run it. It must fail because the behavior is missing, not
   because of a typo, a wrong import path or a broken fixture.
2. **GREEN.** Write the smallest code that makes it pass. Run it.
3. **Commit.** Test and code together, then push. Move to the next behavior.
4. **REFACTOR.** Clean names and duplication with every test green. No new behavior.
5. **Verify.** Once every behavior is green: coverage, then the `verification-loop` skill.

A committed test is part of the contract with the reviewer. Changing one later is allowed only in its
own commit, whose message says why.

## Where each test goes

| What | Runner | Location |
|------|--------|----------|
| Pure logic (`lib/decision.ts`, formatters, pricing) | Vitest | colocated `*.test.ts` |
| Zod schemas (`lib/schemas/*`) | Vitest | colocated `*.test.ts` |
| DAL (`lib/dal/*`) | Vitest against the worktree Postgres | colocated `*.test.ts` |
| Server Action logic | Vitest, calling the action function with a test session | colocated `*.test.ts` |
| Client components (forms, modals, optimistic badge) | Vitest + Testing Library | colocated `*.test.tsx` |
| Pages, layouts, async Server Components, streaming | Playwright (E2E phase) | `e2e/<name>.spec.ts` |
| Intercepting routes, modal vs full page, mobile layout | Playwright (E2E phase) | `e2e/<name>.spec.ts` |
| Instant navigation (what shows before network data) | Playwright + `instant()` (E2E phase) | `e2e/<name>.spec.ts` |

Async Server Components are not rendered in Vitest. Test their data through the DAL in Vitest during
the feature; their rendered output is covered by Playwright in the E2E phase, once the features are done.

## Naming

- `describe('<unit or route>')`, then `it('<observable behavior>')` in plain English, present tense:
  `it('credits the pack once when called twice with the same idempotency key')`.
- Playwright: `test('<REF>: <acceptance bullet in short>')` so a failing test points back to the spec.
- One behavior per test. Arrange, act, assert; no logic in assertions.

## Commands

```bash
pnpm vitest run lib/dal/credits.test.ts   # one file, direct: the TDD loop
pnpm test                                 # full Vitest suite, queued (2 slots)
pnpm test:coverage                        # coverage, 80%+ on lib/**, queued (2 slots)
pnpm typecheck                            # full typecheck, queued (2 slots)
pnpm test:e2e                             # Playwright, E2E phase only, queued (1 slot)
```

## Database tests

- Each worktree has its own Postgres database, migrated and seeded at creation (`worktrees` skill).
  After pulling a new migration, run `pnpm db:migrate`.
- DAL tests hit the real database. Do not mock `db`, Drizzle or the `postgres` driver: constraints,
  transactions and unique indexes are what these tests verify.
- Isolate tests by data, not by global cleanup: create a fresh user or product per test with a unique
  id, so tests can run in any order.
- After every ledger scenario, assert that `balances.balance` equals the sum of that user's
  `credit_transactions`.

## Ledger and credits

Write these before the implementation of any spec that moves credits:

- **Insufficient balance.** `debit()` with too few credits returns
  `{ ok: false, reason: 'insufficient_balance' }`, writes no ledger row, and does not throw.
- **No balance row.** A user with no `balances` row has balance 0; the first credit creates the row.
- **Non-negative.** No sequence of calls leaves `balances.balance < 0`.
- **Refund on AI failure.** Debit happens before the AI call; a failed call writes a refund row and the
  balance returns to its previous value.
- **Concurrency.** Fire N debits in parallel (`Promise.all`) on a balance of N-1: exactly N-1 succeed,
  one returns `insufficient_balance`, the final balance is 0.
- **Insert-only.** No test path updates or deletes a `credit_transactions` row.

## Idempotency

For every write keyed by `idempotency_key` (purchase, signup bonus, generation debit):

- Same key twice, sequentially: one row, same result returned both times.
- Same key twice, in parallel: one row, no unhandled unique-violation error.
- Different keys: two rows.
- In Playwright, a double click on the submit button produces a single credit (assert the displayed
  balance and, if exposed through a test helper, the ledger row count).

## Server Actions

- Unauthenticated call is rejected; wrong role is rejected (admin actions with a user session).
- Invalid input returns the Zod error shape consumed by `useActionState`, and writes nothing.
- Client-supplied values the server must own (price, amount, user id) are ignored or rejected.
- Mutations of cached data call `updateTag()` with the right tag; check the effect in Playwright (the
  next request shows the new value) rather than spying on the framework.

## AI

- Tests run with `AI_MODE=mock`. The model is `MockLanguageModelV4` fed from fixtures; never call a live
  provider in tests.
- Cover success, provider error (refund written, "credit refunded" message shown) and aborted stream.
- Assert on the recorded generation (tokens, cost, status) rather than on exact generated prose.

## Playwright and instant() (E2E phase)

- Use `instant()` from `@next/playwright` for bullets about what is visible immediately on navigation:
  landing content, product sheet name and status, payment modal opening from the tool.
- Assert user-specific parts (balance badge, account button) appear after streaming, not in the shell.
- Test both entry paths of an intercepting route: client navigation opens the modal over the page;
  direct load or reload renders the full page.
- Mobile checks use a phone viewport (e.g. 390 x 844) project or `page.setViewportSize`.
- Sign in through the auth test helpers, not through the magic-link UI, except in the auth specs.
- Locate by role and accessible name; avoid CSS selectors tied to styling.

## Anti-patterns

- Testing implementation details (internal state, private helpers, call counts on framework APIs).
- Mocking the database in DAL tests, or mocking the unit under test.
- Tests that depend on execution order or on data left by another test.
- Assertions that cannot fail (`expect(result).toBeDefined()` as the only check).
- Rewriting a committed test to match the implementation without saying why in its commit.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
