# Plan: TOOLING-test-transaction · Transactional isolation for DB tests

**Source spec**: specs/TOOLING-test-transaction.md (human decision, end of run v1)
**Reference**: castflow `packages/db-test-client/src/test-db.ts` (bun; we run Vitest forks)

## Summary

`db` keeps its type. Under `NODE_ENV=test` only, it is a Proxy that routes every access to the transaction held in a global `AsyncLocalStorage`, and to the base drizzle instance otherwise. `withTestTransaction(fn)` opens a transaction on the base instance, runs `fn` inside the ALS scope, and always rolls back. The test pool gets `max: 5` (the app gets an explicit 10), chosen from `env.NODE_ENV`. Four DAL test files move to the new pattern; tests that need several connections keep theirs.

## Orchestrator decisions (binding)

1. **NODE_ENV rather than a new variable.** Add `NODE_ENV` to `lib/env.ts` as `z.enum(["development","test","production"]).default("development")`, with tests kept outside `validSource`. `.env.test` and `vitest.config.mts` stay untouched. In `lib/db/index.ts`, replace the `process.env.NODE_ENV` read with `env.NODE_ENV`.
2. **Pool size.** `APP_POOL_MAX = 10` and `TEST_POOL_MAX = 5`, through `poolMaxFor(nodeEnv)`. A doc comment explains why 5: Vitest forks run one pool per file, and the widest real concurrency inside a file is 5 (the `Promise.all` × 5 lock tests). castflow's 5→10 bump came from about 74 files sharing one bun process, which is not our case.
3. **Routing `db`.** In production and development, `db === baseDb` (the same object as today). Under test, `db` is `createRoutingDb(baseDb, testTxStorage)`, where every trap (`get` with bound functions, `has`, `set`, `defineProperty`, `deleteProperty`, `getOwnPropertyDescriptor`) goes to `currentTarget()`. The storage and the base instance live on `globalThis` outside production, so they survive `vi.resetModules`. Each scope is `{ tx, open }`. Touching `db` after the scope closes throws « db used after withTestTransaction ended (floating promise?) ».
4. **`withTestTransaction`** lives in `lib/db/test-transaction.ts` (`import "server-only"`).
   - It rolls back by throwing a private sentinel `TestRollback`, not by swallowing `TransactionRollbackError`, so a `tx.rollback()` escaping from app code still surfaces.
   - A nested call throws.
5. **Migrations**, one refactor commit per file (« fixtures and cleanup only, assertions unchanged »):
   - `history.test.ts` and `activity.test.ts`: the spy guard tests stay outside.
   - `account.test.ts`: « newest first » relied on `setTimeout(5)`, and `now()` is frozen inside a transaction, so these tests now use explicit timestamps. That goes in its own explained commit, with assertions unchanged.
   - `generations.test.ts`: everything except the two `Promise.all` × 5 tests.
   - Every other file keeps its pattern, per the planner's migration table (concurrency, own client, doMock or resetModules, seeded rows, constraint errors).
6. **Skill.** Add the rule to `.claude/skills/tdd-workflow/SKILL.md`, replacing « Isolate tests by data, not by global cleanup », using the planner's text: fixtures of your own; never lock seeded rows; `now()` is frozen; failed statements need a savepoint; await everything including `after()` tasks; keep the old pattern for multi-connection tests; concurrency width ≤ `TEST_POOL_MAX`; spies go outside.
7. **Better Auth routing test (optional).** Include it only if it needs no mock outside the Périmètre.
8. **No wait loops.** Never write `until`/`while pgrep -f` wait loops. Run checks in the foreground.

## Tasks (red → green, commit + push each)

1. `NODE_ENV` in env.
2. Explicit pool max: `poolMaxFor`, and `db.$client.options.max === 5` under Vitest.
3. `dbFor` / `createRoutingDb`:
   - identity outside test;
   - base results with no scope;
   - `vi.spyOn(db, …)` works both outside and inside a scope;
   - the txid inside a scope equals the tx's txid;
   - using `db` after the scope closes throws.
4. `withTestTransaction` rolls back on success, using a `themes` row with a random slug.
5. It rolls back on failure and rethrows. A `TransactionRollbackError` thrown by `fn` is not swallowed.
6. Inside `fn`, every call uses the same txid, and `baseDb` cannot see the uncommitted rows.
7. A nested `db.transaction` becomes a savepoint, for both an inner failure and an inner success.
8. Guards:
   - nesting throws;
   - a DAL module re-imported after `resetModules` still writes into the tx;
   - two scopes run in `Promise.all` stay isolated from each other.
9. (Optional) Better Auth writes follow the tx.
10–13. Migrate history, activity, account (plus the explicit-timestamp commit) and generations.
14. Skill rule.
Final: `pnpm check`, `pnpm test:coverage`, `flock /tmp/msb-queue/build.lock pnpm build`.

## Acceptance

- [ ] Rollback on success and on failure: tasks 4 and 5
- [ ] Everything through `db` follows the tx; nested transactions become savepoints; no DAL signature change: tasks 3, 6–9 and the migrations
- [ ] Outside `withTestTransaction`, unchanged: task 3 and a green full suite
- [ ] Explicit, documented test pool max, with no `process.env` read in app code: tasks 1 and 2
- [ ] Migrated files and the skill rule: tasks 10–14
- [ ] PR title `feat(tooling): withTestTransaction and an explicit test pool size`
