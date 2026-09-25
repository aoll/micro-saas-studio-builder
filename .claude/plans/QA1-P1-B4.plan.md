# Implementation Plan: QA1-P1-B4 · A first visit counts one visit

**Source spec**: specs/qa/QA1-P1-B4-visite-double.md
**Réf**: .claude/qa/reports/2026-09-25-full.md › B4 · specs/TRACKING.md › Acceptation 2 · docs/07 › events
**Contract**: `track()`, `TrackEvent`, `trackEventInputSchema`, `lib/db/schema.ts` unchanged; `lib/dal/events.ts` not edited.

## Overview

A first page load writes two `visit` events with two `anonymous_id`s because the id is minted in the browser, once per beacon, and nothing sets a cookie before the beacons leave. Fix: `proxy.ts` sets the `anonymous_id` cookie on the first GET of a product page; `api/events` takes the identity only from that cookie, never from the body; `<TrackVisit>` stops calling `crypto.randomUUID()`. The existing per-day dedupe in `track()` then collapses the StrictMode double beacon and same-day reloads.

## Root cause (verified)

1. `components/track-visit.tsx:13` sends `{ type: "visit", anonymousId: crypto.randomUUID() }` on every effect run.
2. The cookie is set only in the response of `api/events` (`route.ts:86-101`: `existingCookie ?? parsed.data.anonymousId`, then Set-Cookie) and `api/generate`. The landing is static: its HTML sets nothing, so on a first load the beacons leave without cookie.
3. StrictMode runs the effect twice: two cookieless beacons, each route call falls back to its own body id; the DAL dedupe keyed on `anonymous_id` cannot merge two ids → two rows. Two tabs in prod reproduce it.
4. The DAL is correct; the defect is a missing server-issued identity before the first beacon.

## Decision

Option A — `proxy.ts` sets the cookie on the first GET of `/{slug}` and its sub-pages (no DB, no auth). Rejected: B (route mints idempotently: impossible without fingerprinting), C (client guard alone: still client-minted, two tabs), D (localStorage: violates "cookie serveur ou proxy"), E (cookie from the landing Server Component: not allowed in render, makes it dynamic).

Orchestrator note: docs/04 says `proxy.ts` only serves the subdomain rewrite. Setting a cookie is neither DB access nor authorization, so it stays within its stated limits, but the dossier must say so: update the `proxy.ts` line of docs/04 (› Routing / the tree) in this PR, in one sentence (the spec's Périmètre is extended to that line by the orchestrator).

## Implementation steps

### Phase 1: close the server-side race

1. **RED: reproduce B4 at the route** (`app/(products)/[app]/api/events/route.test.ts`): `two concurrent cookieless visit beacons never create two visitors (B4)` — `Promise.all` two POSTs without cookie, two different body ids; assert `new Set(ids passed to track).size <= 1` and neither body id reached `track`. Fails today. Commit red.
2. **GREEN: the route never uses the body id** (`route.ts`): after the product check, `const anonymousId = readAnonymousId(request.cookies.get(ANONYMOUS_ID_COOKIE)?.value)`; if null return 204 without `track()`; else `track({ ..., anonymousId })`, 204. Remove the Set-Cookie branch; keep the body parse (frozen schema validates `type`, `metadata`), ignore `parsed.data.anonymousId`, with a comment (B4). 204 because a beacon's response is never read.
3. **Rewrite the committed tests that encode the bug** — its own commit, message: "tests asserted body-id fallback and route-set cookie, which is the B4 race":
   - "sets a fresh anonymous_id cookie and tracks a visit when there is no cookie" → "without a cookie: 204, no track, no Set-Cookie";
   - "resets to the body id when the cookie is not a valid uuid" → "an invalid cookie reads as no cookie: 204, no track, no Set-Cookie";
   - "marks the cookie Secure on an https request" → moves to `proxy.test.ts` (step 5);
   - "forwards metadata to track", "propagates a track() rejection": add a valid cookie.
4. **A3 at the DB level** (`app/(products)/[app]/api/events/route.db.test.ts`): mock only `@/lib/dal/products`, real `track`. Case 1: 2 concurrent POSTs with the same fresh cookie, then a third (reload) → exactly 1 `visit` row. Case 2: 2 concurrent POSTs without cookie → 0 rows with either body id. Unique ids; clean up by `anonymous_id` in `finally` (concurrency test: separate connections, not `withTestTransaction`, see tdd-workflow).

### Phase 2: server-issued identity before the first beacon

5. **Proxy sets the cookie** (`proxy.test.ts`, then `proxy.ts`), one `it` per behavior, red then green:
   a. `GET /lettre-pro` without cookie → `Set-Cookie: anonymous_id=<uuid>` valid for `readAnonymousId`, HttpOnly, Path=/, SameSite=Lax, Max-Age=31536000;
   b. https → Secure;
   c. `GET /lettre-pro/tool` without cookie → set too;
   d. valid cookie → no Set-Cookie;
   e. `not-a-uuid` or nil UUID → replaced;
   f. non-GET → no Set-Cookie;
   g. matcher via `unstable_doesMiddlewareMatch` (`next/experimental/testing/server`; named *Middleware* in 16.3.6): true for `/lettre-pro`, `/lettre-pro/tool`; false for `/admin`, `/admin/products`, `/api/auth/session`, `/_next/static/x.js`, `/lettre-pro/api/events`, `/lettre-pro/api/generate`, `/robots.txt`, `/favicon.ico`, `/`.
   Implementation: `export function proxy(request: NextRequest)`: GET without valid cookie → `NextResponse.next()` with `res.cookies.set(anonymousIdCookie(randomUUID(), request.nextUrl.protocol === "https:"))`; else `NextResponse.next()`. `config.matcher` a constant regex like `'/((?!_next/|api/|admin(?:/|$)|[^/]+/api/|.*\\.[^/]+$).+)'`. Excluding `/{slug}/api/*` is required (a response cookie on the beacon itself would reopen the race). Reuse `anonymousIdCookie` / `readAnonymousId` from `api/events/anonymous-id.ts`; confirm the `server-only` import compiles in proxy (dev server hit or next-devtools MCP) — fallback: move the two pure helpers to a `server-only`-free module inside `api/events/` (no barrel).
6. **`readAnonymousId` refuses nil and max UUIDs** (`anonymous-id.test.ts` new, `anonymous-id.ts`): valid v4 returned; `undefined`, `""`, `not-a-uuid` → null; `00000000-…` and `ffffffff-…` → null (red today: zod `z.uuid()` accepts them).

### Phase 3: client

7. **`<TrackVisit>` never mints an id** (`components/track-visit.test.tsx`, `track-visit.tsx`): `crypto.randomUUID` not called on mount; body `anonymousId` is a fixed placeholder `00000000-0000-0000-0000-000000000000` that still passes the frozen schema; under `<StrictMode>` every beacon body is identical. Comment: the frozen schema requires a UUID; the server ignores it and reads the httpOnly cookie set by `proxy.ts`. Existing tests unchanged.

### Phase 4: browser check

8. `e2e/visit-once.spec.ts` (in this PR): fresh context, `goto('/lettre-pro')`, wait for the beacon; `events` for this context's cookie: 1 `visit`; exactly one `anonymous_id` cookie equal to the row's; `reload()` → still 1. Run with `pnpm test:e2e e2e/visit-once.spec.ts` (queued). The dev/StrictMode half is checked with a dev server on a free port (3300+, never 3000) and agent-browser: two `POST …/api/events` with the same Cookie, one row.

## Risks

- `api/generate` reuses the proxy cookie (better funnel link); its mint fallback stays. Re-run `api/generate/route.test.ts` unchanged.
- `signup/complete` reads the same cookie; nil/tampered reads as null (step 6); signup still succeeds.
- Proxy on a prerendered landing: no DB, no `cookies()` in render; verify on the prod build that a second fresh context gets a different id (no cached cookie).
- Matcher too wide reopens the race, too narrow loses visits: step 5g covers both.
- Residual: two tabs opened at the same instant on a cookieless browser can still give 2 visits; document in `proxy.ts`.
- Cookies blocked: no visit counted (intentional).
- Existing committed tests change in a separate commit (step 3).
- knip already treats `proxy.ts` as an entry.
- Consumers to re-run: `api/generate` route tests, `signup/complete` tests, `history-list` tests.

## Success criteria

- [ ] Step 1 committed red, then green; no `track()` call ever receives a body id.
- [ ] Cookieless concurrent beacons → 0 visitors; same cookie concurrent + reload → 1 row.
- [ ] Proxy sets the cookie on product pages only; matcher table green.
- [ ] `<TrackVisit>` never calls `crypto.randomUUID()`.
- [ ] `readAnonymousId` rejects nil and max UUIDs.
- [ ] e2e: a fresh context on `/lettre-pro` gives 1 visit and 1 `anonymous_id`.
- [ ] docs/04 `proxy.ts` line updated; `pnpm check` green; no frozen contract touched.
