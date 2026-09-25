# Plan: TRACKING · Events

**Source spec**: specs/TRACKING.md
**Complexity**: Medium (one DAL body with a per-day dedupe, one public Route Handler, one cookie helper, one client leaf;
no schema change, no UI text)

## Summary

Replace two V1 no-ops: `track(event)` in `lib/dal/events.ts` becomes a real insert-only write to `events`, a `visit`
written at most once per `anonymous_id`, product and UTC day; `<TrackVisit slug>` sends one `navigator.sendBeacon` on
mount to a new public route `POST /[app]/api/events`. The route parses with the frozen `trackEventInputSchema`, accepts
only `visit`, takes the product from `[app]`, and sets a long-lived HttpOnly `anonymous_id` cookie when missing. The
landing stays static (no server cookie read for the visit). SA-03 later passes the same cookie to
`track({ type: "signup", userId, anonymousId })` to link visit and signup.

## Orchestrator decisions (binding)

1. No `guardRequest` on the beacon (`GuardKind` is frozen without a visit kind); per-day dedupe, same-origin check, 2 KB
   cap and bounded metadata instead. Adding a kind is a later contract question, not blocking.
2. The cookie helper lives in `app/(products)/[app]/api/events/anonymous-id.ts` (Périmètre); SA-02 and SA-03 import it.
   The orchestrator relays this.

## Frozen inputs (read, never changed)

`lib/dal/events.ts` (`TrackEvent`, `track` type — body only changes); `lib/dal/contract.test.ts:71-78` and
`lib/dal/contract-shape.test.ts:116-123` pass unchanged; `lib/schemas/inputs.ts:49-58` `trackEventInputSchema`;
`lib/schemas/product-config.ts:21` `slugSchema`; `lib/db/schema.ts:215-230` `events` (no FK on `user_id`, no unique index:
dedupe in the DAL under an advisory lock); `components/track-visit.tsx` type; `lib/security.ts`.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| DAL header / typed const | `lib/dal/events.ts:1-15`, `lib/dal/generations.ts:41` | `import "server-only";`, frozen comment kept, declared type byte-identical |
| Session check | `lib/dal/generations.ts:41-45` | non-null `userId` must equal `getSession()?.user.id` |
| Route reading a cached product | `lib/dal/products.ts:48-61` | `getProduct(slug)`; `params` from `RouteContext<"/[app]/api/events">`, never `next/root-params` in a Route Handler |
| Cookies in a Route Handler | installed `01-getting-started/15-route-handlers.md` | `request.cookies.get`, `NextResponse` `response.cookies.set` |
| DAL test with session | `lib/dal/contract-shape.test.ts:18-29` | `vi.mock("./session")` reading a module-level variable |
| DB tests | `lib/dal/generations.test.ts` | real Postgres, `randomUUID()`, cleanup in `afterAll` |
| Component tests | `components/track-visit.test.tsx` | jsdom, `afterEach(cleanup)` |

## Design decisions

1. **Cookie** `anonymous_id`: uuid, HttpOnly, SameSite=Lax, Path=/, Max-Age 1 year, Secure when
   `request.nextUrl.protocol === "https:"`. Server-authoritative: a valid uuid cookie wins over the body's `anonymousId`;
   otherwise the body id is used and set as the cookie on the 204.
2. **Helper** `anonymous-id.ts`: `ANONYMOUS_ID_COOKIE`, `readAnonymousId(value)` (uuid-validated),
   `anonymousIdCookie(value, secure)`. Only what `route.ts` uses is exported.
3. **Dedupe in `track()`**: one transaction, `pg_advisory_xact_lock(hashtextextended('visit:' || productId || ':' || anonymousId, 0))`,
   existence check on `product_id`, `type = 'visit'`, `anonymous_id`, `created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
   insert only if none. UTC calendar day.
4. **Identity rules**: neither `userId` nor `anonymousId` → throw; `visit` without `anonymousId` → throw; non-null
   `userId` ≠ session user → throw (`getSession()` only called when `userId` is non-null); `metadata ?? null`.
5. **Route order** (early returns, `track` not called): body > 2048 → 413; `Origin` present and ≠
   `request.nextUrl.origin` → 403; `slugSchema` fails → 404 without `getProduct`; invalid JSON → 400; schema fails → 400;
   `type !== "visit"` → 403; product null or `killed` → 404; then `await track(…)` → 204. A `track` rejection propagates.
6. **`<TrackVisit>`**: client leaf, `useEffect` sends
   `navigator.sendBeacon?.(`/${slug}/api/events`, new Blob([JSON.stringify({ type: "visit", anonymousId: crypto.randomUUID() })], { type: "application/json" }))`
   on `[slug]`, returns `null`, no metadata.

## Files to Change

| File | Action |
|---|---|
| `lib/dal/events.ts` + `events.test.ts` | UPDATE body / REWRITE (explicit commit) |
| `app/(products)/[app]/api/events/route.ts` + `route.test.ts` | CREATE |
| `app/(products)/[app]/api/events/anonymous-id.ts` | CREATE |
| `components/track-visit.tsx` + `track-visit.test.tsx` | UPDATE body / REWRITE (explicit commit) |

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push (`feat(db)` DAL, `feat(app)` route/component, `test(…)` test-only),
`pnpm exec knip`.

- **Task 0 — retire the stub test**: `test(db): replace TRACKING stub test — track() is no longer a no-op (specs/TRACKING.md bullet 3); the "writes nothing" assertion described the V1 stub only`.
- **Task 1 — all 6 types inserted with an anonymous id** (`it.each(eventTypeSchema.options)`, fresh anon per case, one
  row each with metadata, cleanup).
- **Task 2 — userId events + visit → signup link**: visit with A, then signup with session U and anonymousId A → the
  signup row has both, self-join returns U; `purchase` userId-only inserts; mismatched or no session rejects
  `/does not match the caller's session/`; neither id rejects `/needs a userId or an anonymousId/`.
- **Task 3 — one visit per anonymous_id, product, UTC day**: two visits → 1 row; 5 concurrent → 1; same anon on a
  temporary second product → separate row (cleanup); a direct row at `now - 25 h` then a visit → 2 rows; visit without
  anonymousId rejects `/visit needs an anonymousId/`; non-visit types not deduped. `contract-shape` still green.
- **Task 4 — cookie helper + happy path** (`route.test.ts`, `getProduct` and `track` mocked, values set in `beforeEach`,
  `POST(new NextRequest(…), { params: Promise.resolve({ app: "lettre-pro" }) })`): no cookie → 204, `track` called with
  the body id, `set-cookie` `anonymous_id=X; HttpOnly; Path=/; SameSite=lax; Max-Age=31536000`; valid cookie Y → `track`
  gets Y, no `set-cookie`; tampered cookie → reset to X; https → `Secure`; metadata forwarded.
- **Task 5 — rejections, `track` never called**: invalid JSON 400; non-uuid id 400; 11 metadata keys 400; 201-char value
  400; each non-visit type 403; foreign `Origin` 403 (same origin or none accepted); `Bad Slug` / `admin` 404 without
  `getProduct`; null product 404; killed 404; 3 KB body 413.
- **Task 6 — failures not swallowed**: `track` rejects `db down` → `POST` rejects with it.
- **Task 7 — retire the TrackVisit stub test**: `test(app): replace TrackVisit stub test — the component now sends the visit beacon (specs/TRACKING.md bullet 1); "never calls sendBeacon" described the V1 stub only`.
- **Task 8 — beacon on mount**: `sendBeacon` installed via `Object.defineProperty` in `beforeEach`; empty container;
  called once with `/lettre-pro/api/events` and a JSON Blob parsing with `trackEventInputSchema`, `type === "visit"`;
  same-slug rerender → still 1; new slug → 2nd call; no `sendBeacon` → no throw.
- **Task 9 — full checks**: `pnpm exec knip`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`
  (80 %+ on `lib/**`, all `events.ts` branches), `pnpm build` (`/[app]/api/events` dynamic, `/[app]` still prerendered),
  `pnpm check`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| No rate limit on the public beacon | Medium | Decision 1 |
| `<TrackVisit>` only useful once SA-01 renders it | Certain | SA-01 renders it (orchestrator) |
| SA-02 / SA-03 must share the cookie | High | Decision 2; SA-03 tracks signup after the session exists |
| `track()` throws on userId/session mismatch | Medium | Deliberate (same rule as `recordGeneration`); relayed |
| Dedupe without unique index | Certain | Advisory lock + concurrency test |
| "Day" undefined in the dossier | Medium | UTC; relayed to BO-02 / BO-03 |
| `contract-shape.test.ts` now inserts a visit per run | Certain | Harmless (random anon, worktree DB); metric tests use relative counts |
| `crypto.randomUUID()` needs a secure context | Low | localhost / https only; noted in the component comment |

## Acceptance

- [ ] Bullet 1: `track-visit.test.tsx`; route accepts only `visit`; `pnpm build` keeps `/[app]` prerendered
- [ ] Bullet 2: cookie tests; dedupe same day / new day / other product / concurrency
- [ ] Bullet 3: 6 types inserted; identity and session rules
- [ ] Bullet 4: signup row keeps `anonymous_id` and joins the visit; long-lived cookie, Path=/
- [ ] `contract.test.ts` and `contract-shape.test.ts` unchanged and green; stub tests replaced in explained commits
- [ ] `pnpm check`, coverage 80 %+, `pnpm build` green; PR title `feat(app): TRACKING events, visit beacon and anonymous_id cookie`
