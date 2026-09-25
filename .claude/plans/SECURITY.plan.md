# Plan: SECURITY · BotID and rate limit

**Source spec**: specs/SECURITY.md
**Complexity**: Medium. The frozen `guardRequest` gets a real body: a BotID check followed by a Postgres rate limit, plus client and build wiring for BotID and a README section.

## Summary

`guardRequest(kind)` keeps its frozen signature (`(kind: GuardKind) => Promise<GuardResult>`). The new body works in two steps:
1. It calls `checkBotId()` for every kind. A bot gets `{ ok: false, reason: "bot" }`.
2. For `generate` only, it applies a Postgres rate limit: N generations per 60 s, per user (when signed in) and per `ip_hash`, where N comes from `lib/env.ts`. Over the limit it returns `{ ok: false, reason: "rate_limited" }`.

The four callers already map these results to 403/429 and to the fr/en « rate limited » messages. BotID is wired on the client with `initBotId` in `instrumentation-client.ts` and at build time with `withBotId` in `next.config.ts`. The README documents the AI Gateway budget cap.

## Orchestrator decisions (binding)

1. **Human decision (« OK SECURITY », 2026-09-25).** The Périmètre is extended to these files:
   - `package.json` and `pnpm-lock.yaml` (`pnpm add botid`);
   - `lib/env.ts`, `lib/env.test.ts` and `.env.example` (`GENERATION_RATE_LIMIT_PER_MINUTE`, optional, `z.coerce.number().int().positive().default(10)`). Do **not** add it to `validSource` in env.test.ts, because the "throws when missing" `it.each` would then fail. Write separate tests instead: the default applies, and `"0"` or `"abc"` is rejected. Add a commented line to `.env.example`;
   - `lib/dal/generations.ts` and `lib/dal/generations.test.ts`. The additive export is `countRecentGenerations({ userId: string | null; ipHash: string; windowSeconds: number }): Promise<{ byUser: number; byIp: number }>`. The window is computed in SQL with the database clock (`created_at > now() - make_interval(secs => $w)`). All statuses count. It throws when a non-null `userId` does not match the session, like its siblings. It uses the existing indexes;
   - `README.md`;
   - `lib/dal/contract-shape.test.ts`: add only `vi.mock("next/headers")` and `vi.mock("botid/server")`, in a separate commit that explains why. Its assertions stay unchanged.
2. **D1.** Only `generate` is rate-limited. `signup`, `purchase` and `test-prompt` go through BotID only. A test proves that the limiter is never called for them.
3. **D2.** A request is limited when `byUser >= N` (signed-in users only) or when `byIp >= N` (always).
4. **D3.** The count uses `>=`, and the guard runs before `recordGeneration`, so request N+1 is the first one refused.
5. **D4.** `clientIp(headers)` in `lib/rate-limit.ts` is a byte-for-byte copy of the private `clientIp` in `api/generate/route.ts`. A parity test uses the same fixtures. Making the route import the shared helper is an orchestrator follow-up (route.ts is outside the Périmètre).
6. **D5.** There is no try/catch in `guardRequest`. If BotID or the DAL throws, the error propagates: no fail-open and no fail-closed masking.
7. **Step 0.** Before writing any code, read `node_modules/botid` (README and types) and confirm:
   - the entry points: `botid/server` exports `checkBotId`, `botid/client/core` exports `initBotId`, `botid/next/config` exports `withBotId`;
   - the result shape;
   - whether `protect` supports wildcards;
   - **how `checkBotId()` behaves off Vercel**, under `next dev` and under `next start` with NODE_ENV=production.

   The setup is local only. E2E runs `next build` + `next start` locally, so BotID must not flag local users as bots. If botid has a documented dev or bypass mode, use it. Do not branch on `process.env` in `lib/security.ts`. Report what you find.
8. **`initBotId` protect list.** It must cover every POST origin:
   - `/*/api/generate`;
   - `/*/signup`;
   - `/*/checkout/*`;
   - `/admin/products/new` and `/admin/products/*/edit`.

   Grep every mount point of `requestMagicLink`, `purchase` and `testPrompt` to confirm the list, and test it with `botid/client/core` mocked.
9. **Stub test.** The `lib/security.test.ts` stub test « lets %s through » is replaced in its own commit, whose message says the stub contract is superseded by the real guard.
10. **No wait loops.** Never write `until`/`while pgrep -f` wait loops. Run everything in the foreground.
11. **Recorded follow-ups, not in this spec:**
    - `route.ts` should import `clientIp`;
    - the raw Better Auth magic-link endpoint;
    - the login timing side-channel in `lib/auth.ts`;
    - a Postgres limiter for test-prompt, signup, login and events (contract PR).

## Tasks (red → green, commit + push each)

0. Install botid, then do the Step 0 reading (decision 7).
1. Env var N (`lib/env.ts` and its test, `.env.example`).
2. `clientIp` and the parity test (`lib/rate-limit.ts` and its test).
3. `countRecentGenerations` against the worktree Postgres:
   - rows at now, now − 30 s and now − 61 s, across two products, for user U and ip_hash H, including a failed row;
   - check the window and the keys;
   - check that a session mismatch throws;
   - cleanup in `finally`.
4. `isGenerationRateLimited({ userId, ipHash })`:
   - with mocked counts: N−1 vs N at the boundary, byIp alone, null userId, windowSeconds 60, N read from env;
   - plus one real-DB integration test.
5. Bot step in `guardRequest`:
   - replace the stub test first (decision 9);
   - a bot gets `bot` for all 4 kinds, and the limiter is never called;
   - a rejection from BotID propagates.
6. Rate-limit step:
   - `generate` over the limit gets `rate_limited`; under the limit gets ok;
   - `userId` comes from the session and `ipHash` is `hashIp(clientIp(headers()))`;
   - the other kinds never call the limiter;
   - BotID is called before the limiter.
7. Contract-shape compatibility: run `lib/dal/contract-shape.test.ts` and `lib/dal/contract.test.ts`, then make the mock-only commit if needed (decision 1).
8. `instrumentation-client.ts` with `initBotId` and the protect list, tested.
9. `next.config.ts`: `withNextIntl(withBotId(nextConfig))`. Check it with typecheck and build, plus a light test of what withBotId adds.
10. README sections:
    - the AI Gateway budget cap: where to set it, its soft-cap limits, and why the Postgres limit stays;
    - `GENERATION_RATE_LIMIT_PER_MINUTE`;
    - BotID being Vercel-only, and how it behaves off Vercel;
    - self-hosting: strip inbound X-Forwarded-For at the proxy.
11. Final checks: `pnpm check` and `pnpm test:coverage`, then `flock /tmp/msb-queue/build.lock pnpm build`. Existing caller tests stay green and unchanged.

## Acceptance

- [ ] `guardRequest` calls `checkBotId()` then the rate limit, is called by the 4 callers, and `initBotId` is in `instrumentation-client.ts`: tasks 5, 6, 8, plus the existing caller tests
- [ ] Postgres limit of N per 60 s per user and per ip_hash, with N in `lib/env.ts`, answering 429 with a clear message: tasks 1–4 and 6, plus the existing route test and messages
- [ ] AI Gateway budget cap documented in the README: task 10
- [ ] Frozen signature unchanged, contract tests green, `pnpm check` and build green
- [ ] PR title `feat(tooling): SECURITY BotID guard and Postgres generation rate limit`
