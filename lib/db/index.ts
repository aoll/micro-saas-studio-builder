import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";

// Explicit pool sizes (docs/10-tooling-dev.md: no `process.env` read in
// application code — `lib/env.ts` is the only place that does). The app
// pool is generous; the test pool is capped low on purpose: Vitest forks
// run one Postgres pool per test *file* (not one shared process across the
// whole run), so the widest real concurrency inside a single file is 5 (the
// `Promise.all` x 5 lock tests in lib/dal/generations.test.ts and
// lib/dal/credits.test.ts). castflow's own pool was raised from 5 to 10
// because ~74 files shared ONE `bun test` process without `--isolate`; that
// scale never applies here, so we keep the lower number.
export const APP_POOL_MAX = 10;
export const TEST_POOL_MAX = 5;

export function poolMaxFor(nodeEnv: typeof env.NODE_ENV): number {
  return nodeEnv === "test" ? TEST_POOL_MAX : APP_POOL_MAX;
}

const createDb = () =>
  drizzle(postgres(env.DATABASE_URL, { max: poolMaxFor(env.NODE_ENV) }), {
    schema: { ...schema, ...authSchema },
  });

// Module-level singletons, cached on `globalThis` (outside production) so
// that both Next.js's dev server (re-evaluates modules on every edit) and
// Vitest's `vi.resetModules()` (used across lib/dal/*.test.ts to re-import a
// DAL module after mocking one of its dependencies) reuse the same pool and
// the same transaction storage, instead of opening a fresh one each time.
type BaseDb = ReturnType<typeof createDb>;
type Tx = Parameters<Parameters<BaseDb["transaction"]>[0]>[0];
export type TestTxScope = { tx: Tx; open: boolean };

const globalForDb = globalThis as unknown as {
  msbDb?: BaseDb;
  msbTestTxStorage?: AsyncLocalStorage<TestTxScope>;
};

export const baseDb: BaseDb = globalForDb.msbDb ?? createDb();
if (env.NODE_ENV !== "production") globalForDb.msbDb = baseDb;

export const testTxStorage: AsyncLocalStorage<TestTxScope> =
  globalForDb.msbTestTxStorage ?? new AsyncLocalStorage<TestTxScope>();
if (env.NODE_ENV !== "production") globalForDb.msbTestTxStorage = testTxStorage;

// Outside `withTestTransaction` (no open scope): the base instance, exactly
// today's behaviour. Inside one: the transaction `withTestTransaction`
// opened. `lib/db/test-transaction.ts` is the only other reader of
// `testTxStorage`/`baseDb`; nothing else should import them.
function currentTarget(): BaseDb {
  const scope = testTxStorage.getStore();
  if (!scope) return baseDb;
  if (!scope.open) {
    throw new Error("db used after withTestTransaction ended (floating promise?)");
  }
  return scope.tx as unknown as BaseDb;
}

// A Proxy so `db` keeps the exact static type of the base Drizzle instance
// (no DAL signature or call site changes) while every access — property
// reads, `in`, assignment, `Object.defineProperty` (what `vi.spyOn` uses),
// `delete`, `Object.getOwnPropertyDescriptor`, `Object.getPrototypeOf` — is
// resolved against whichever instance is current *at the time of the
// call*, not once at import time.
function createRoutingDb(): BaseDb {
  return new Proxy({} as BaseDb, {
    get(_target, prop) {
      const target = currentTarget();
      const value = Reflect.get(target as object, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_target, prop) {
      return Reflect.has(currentTarget() as object, prop);
    },
    set(_target, prop, value) {
      return Reflect.set(currentTarget() as object, prop, value);
    },
    defineProperty(_target, prop, descriptor) {
      return Reflect.defineProperty(currentTarget() as object, prop, descriptor);
    },
    deleteProperty(_target, prop) {
      return Reflect.deleteProperty(currentTarget() as object, prop);
    },
    // Without this trap the Proxy's own prototype stays that of its literal
    // `{}` target: `db instanceof PgDatabase` and drizzle-orm's `is(db, …)`
    // both return false, and any method that lives on the prototype
    // (instead of an own property) resolves through *this* — routed —
    // prototype, so a `vi.spyOn` placed on the real class's prototype still
    // takes effect through `db`.
    getPrototypeOf() {
      return Reflect.getPrototypeOf(currentTarget() as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const target = currentTarget();
      const descriptor = Reflect.getOwnPropertyDescriptor(target as object, prop);
      // `db` swaps targets over time, but a Proxy must keep reporting
      // non-configurable for any *own* property that was already
      // non-configurable on a *previous* target it reported through this
      // same trap — an invariant the engine enforces regardless of the
      // `getPrototypeOf` trap above. Forcing every own data property
      // configurable sidesteps that invariant; methods themselves live on
      // the prototype (routed by `getPrototypeOf`, not by this trap) and
      // are what `vi.spyOn(db, "someMethod")` actually patches.
      return descriptor ? { ...descriptor, configurable: true } : descriptor;
    },
  });
}

// In production and development, `db` is `baseDb` itself: identical to the
// pre-TOOLING-test-transaction behaviour. Only under test does it route
// through the AsyncLocalStorage scope.
export const db: BaseDb = env.NODE_ENV === "test" ? createRoutingDb() : baseDb;
