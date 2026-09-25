# Implementation Plan: QA1-P1-Q5 · Le funnel compte des personnes

## Overview
`getFunnel`'s SQL currently counts `events` rows per funnel step, so a retried
402 or a second purchase from the same person inflates a step's count and can
push its pass rate over 100% (QA report, Q5: "Crédits épuisés 2 · 200 %",
"Achat 3 · 150 %"). This plan switches each step's count to distinct persons
(`anonymous_id` before signup, `user_id` after), and adds a display-independent
clamp so no rate can ever render above 100%, without touching `getFunnel`'s
frozen signature or return type.

## Requirements (from specs/qa/QA1-P1-Q5-funnel-personnes.md)
- Each funnel step counts distinct persons (anonymous_id or user_id, linked by
  TRACKING), not events: two 402s or two purchases from the same person count 1
- Pass rates are computed on these person counts; the plan states how a person
  who skips a step is counted, and no displayed rate exceeds 100%
- The revenue, ARPU and AI-cost KPIs do not change

## Design decisions

**D1 — Identity per event type**, driven by what the write side actually
stores (verified in the routes above), not a new column or a join to signups:
- `visit` → `anonymous_id` (always present, never `user_id`)
- `first_generation` → `coalesce(user_id, anonymous_id)` (exactly one of the
  two is set, per `api/generate/route.ts`)
- `signup`, `credits_exhausted`, `purchase` → `user_id` (always present; these
  three actions require an authenticated session)

This needs no join and no change to `lib/dal/events.ts` (out of `Périmètre`):
it is a pure read-side aggregation fix in `lib/dal/metrics.ts`.

**D2 — How a person who skips a step is counted.** The funnel keeps its
current per-step independence: each step's count is "how many distinct
persons have at least one event of that type in the date range", regardless
of whether that same person also has an event for the previous step in the
same range. A person is never required to "pass through" earlier steps to be
counted at a later one — enforcing that would mean tracking real per-person
cohorts across the whole events history, which is a materially bigger change
than this QA fix and isn't what the current code (or the spec's examples,
both about *duplicates within one step*) asks for. The direct consequence:
`rateFromPrevious` can still be mathematically > 1 at the range boundary (a
person's earlier-step event falls just before `since`, their later-step event
falls just after) even after switching to person counts. That's handled by D3.

**D3 — Clamp the rate, not the count.** `count` stays the raw distinct-person
number (useful as-is, e.g. "3 crédits épuisés" is a true fact); only
`rateFromPrevious` is clamped to `[0, 1]` before it's used. Two independent
clamps, each with its own test, matching the two directories in `Périmètre`:
1. `lib/dal/metrics.ts`'s `buildSteps` — the authoritative fix, so any future
   consumer of `Funnel.steps` (not just the current BO-03 card) inherits the
   guarantee.
2. `sheet.ts`'s `toFunnelRows` — a second, independent clamp at the display
   boundary, so the UI's own acceptance bullet ("no rate shown above 100%")
   has a test that doesn't depend on the DAL's internals staying correct.
   `formatPercent` itself (`admin/_components/portfolio/format.ts`) is shared
   with the portfolio's conversion column and stays untouched (out of
   `Périmètre`, and its rate is already bounded by construction via
   `buyers / signups` from the `purchases` table).

**D4 — What stays untouched.** `revenueCents`, `aiCostMicros`, `signups`
(wait — `signups` *count* changes semantics too, see below), `marginPerGenerationMicros`
and `signupToPurchaseRate` are computed from the `pu` (purchases) and `gen`
(generations) subqueries in `selectProductRows`, never from the `ev` (events)
subquery this plan touches. `ARPU` (`sheet.ts`'s `toKpis`) is `revenueCents /
signups` where `signups` here is `metrics.signups` — this *does* flow through
the `ev` subquery, but switching `signup`'s count from `count(*)` to
`count(distinct user_id)` is a no-op in practice: `track()`'s own dedupe
(specs/TRACKING.md) already guarantees at most one `signup` row per
`(product_id, user_id)`, so `count(*)` and `count(distinct user_id)` already
agree for real data. The switch is still made, for the same defense-in-depth
reason as D3 (not relying on write-side dedupe alone) and because it's
required for the funnel's own "Inscription" step. No visible KPI changes.

## Architecture Changes
- `lib/dal/metrics.ts` — `selectProductRows`'s `ev` (events) subquery: each
  `count(*) filter (where type = 'x')` becomes `count(distinct <identity for
  x>) filter (where type = 'x')` (D1). `buildSteps`: clamp `rateFromPrevious`
  to `Math.min(1, …)` (D3.1).
- `lib/dal/metrics.test.ts` — update the two existing DB tests that seed
  `signup`/`credits_exhausted`/`purchase` rows with `anonymousId` only (now
  unrealistic vs. D1) to seed real `userId`s instead, in a commit that states
  why; add the new red→green tests below.
- `app/(backoffice)/admin/products/[slug]/_components/sheet.ts` — `toFunnelRows`:
  clamp the rate passed to `formatPercent` (D3.2).
- `app/(backoffice)/admin/products/[slug]/_components/sheet.test.ts` — add the
  clamp test.
- No change to `lib/dal/events.ts`, `lib/db/schema.ts`,
  `app/(products)/[app]/api/generate/route.ts`, `checkout/_actions.ts`,
  `admin/_components/portfolio/**`, or `Funnel`/`FunnelStep`'s shape.

## Implementation Steps

### Phase 1: Reproduce the bug (red)
1. **Red test: two 402s from the same person read as 1, not 2** (File:
   `lib/dal/metrics.test.ts`, new case in the `steps` describe block)
   - Action: seed one real `users` row (`buyerId`), one `signup` event with
     `userId: buyerId`, and two `credits_exhausted` events both with
     `userId: buyerId` (mirrors the QA repro: a retried 402). Call
     `getFunnel`, assert the `credits_exhausted` step's `count` is `1` and
     `rateFromPrevious` is `1` (100%), not `2` / `2.0`.
   - Why: this is the exact QA repro ("deux 402 … comptent 1") and the
     required first test of the loop — it fails against the current
     `count(*)` query (which returns `2` / `2.0`) before any production code
     changes.
   - Dependencies: none
   - Risk: Low — real DB test, uses the existing `withTestTransaction`-backed
     shared test DB and `createTempProduct`/`cleanupProduct` helpers already
     in the file.

### Phase 2: Count persons, not events (green)
2. **Switch the `ev` subquery to distinct-person counts** (File:
   `lib/dal/metrics.ts`, `selectProductRows`)
   - Action: replace the 5 `count(*) filter (...)` expressions with
     `count(distinct anonymous_id) filter (where type = 'visit')`,
     `count(distinct coalesce(user_id, anonymous_id)) filter (where type =
     'first_generation')`, and `count(distinct user_id) filter (...)` for
     `signup`, `credits_exhausted`, `purchase` (D1). Same subquery serves both
     `getPortfolioMetrics` and `getFunnel` (already shared), so this one edit
     fixes both.
   - Why: turns Step 1 green with the minimal, correct fix.
   - Dependencies: Step 1 (test exists and is red first)
   - Risk: Medium — must not regress the `visit`/`first_generation` counts,
     which already are (in practice) 1 row per person per existing dedupe;
     covered by Step 4's untouched assertions and Phase 4's tests below.

3. **Red→green: two purchases from the same buyer read as 1** (File:
   `lib/dal/metrics.test.ts`)
   - Action: seed one `users` row, one `signup` event, and two `purchase`
     events (distinct `purchaseKey` metadata, as a real double purchase would
     produce, both `userId` set to the same buyer). Assert the `purchase`
     step's `count` is `1`.
   - Why: the QA report's second named example ("deux achats … comptent 1");
     proves D1's `user_id`-based identity for `purchase` independently of
     Step 1's `credits_exhausted` case.
   - Dependencies: Step 2
   - Risk: Low

4. **Update the two existing tests that now seed unrealistic fixtures**
   (File: `lib/dal/metrics.test.ts`, `getPortfolioMetrics › SQL aggregation`
   and `getFunnel › steps` describe blocks)
   - Action: in "counts events and succeeded generations…" and "builds counts
     and pass rates from 12/5/4/2/1…", give every `signup`/`credits_exhausted`/
     `purchase` row a distinct real `userId` (insert throwaway `users` rows,
     cleaned up alongside the product) instead of `anonymousId` only, keeping
     the same expected counts (4/2/1) since each row is still a distinct
     person. Commit message states why: these fixtures never matched
     production's invariant (D1) and would silently read as 0 once the query
     counts `distinct user_id`.
   - Why: "un test commité est un contrat … toute modification signalée dans
     la PR" (CLAUDE.md) — these two are modified, not weakened, and the
     reason is explicit.
   - Dependencies: Step 2
   - Risk: Low — mechanical, same expected values

### Phase 3: A person who skips a step, and the rate clamp
5. **Red test: a step whose person count exceeds the previous step's, from a
   signup outside the range** (File: `lib/dal/metrics.test.ts`)
   - Action: seed 1 `signup` event inside the 30-day range for `buyerA`, and
     3 `credits_exhausted` events inside the range for 3 *different* users who
     each signed up (or whose `signup` event is) outside the range (or simply
     omit their `signup` event entirely — same effect for this test, and
     simpler to seed). Call `getFunnel`; assert `credits_exhausted.count` is
     `3` (the true fact) but `credits_exhausted.rateFromPrevious` is `1`
     (clamped), not `3`.
   - Why: this is D2's "skips a step" case made concrete, and the direct
     reproduction of a rate that would otherwise exceed 100% even after
     Step 2's person-counting fix (QA's residual risk at the range boundary).
     Fails against Step 2's code alone (no clamp yet) before Step 6.
   - Dependencies: Step 2
   - Risk: Low

6. **Clamp `rateFromPrevious` in `buildSteps`** (File: `lib/dal/metrics.ts`)
   - Action: change `counts[type] / previousCount` to
     `Math.min(1, counts[type] / previousCount)` in `buildSteps`, only inside
     the existing `previousCount && previousCount > 0` branch (the `null`
     branch is untouched).
   - Why: turns Step 5 green; D3.1.
   - Dependencies: Step 5
   - Risk: Low

7. **Red→green: the display layer clamps independently** (File:
   `app/(backoffice)/admin/products/[slug]/_components/sheet.test.ts`, then
   `sheet.ts`)
   - Action: add a `toFunnelRows` test that builds a `FunnelStep[]` by hand
     (no DB) with `rateFromPrevious: 1.5` (simulating a hypothetical future
     regression at the DAL layer) and asserts the resulting `FunnelRow.rate`
     is `"100 %"`, not `"150 %"`. Write it first (red against the current
     `toFunnelRows`, which calls `formatPercent(step.rateFromPrevious)`
     unclamped), then change `toFunnelRows` to
     `formatPercent(step.rateFromPrevious === null ? null : Math.min(1,
     step.rateFromPrevious))`.
   - Why: D3.2 — a second, independent guarantee for the exact acceptance
     wording ("aucun taux n'est affiché au-dessus de 100 %"), decoupled from
     whether the DAL's own clamp (Step 6) stays correct as the code evolves.
   - Dependencies: none (independent of Steps 1-6; can be done in parallel,
     ordered here for narrative flow)
   - Risk: Low

### Phase 4: Guard the unaffected counts and KPIs
8. **first_generation: two rows for the same identity still count 1** (File:
   `lib/dal/metrics.test.ts`)
   - Action: seed two `first_generation` events with the same `anonymousId`
     (simulating a residual write-side duplicate B5 might not fully cover, or
     simply a defensive read-side guarantee) and assert the step's `count` is
     `1`. A second case with the same `userId` twice (no `anonymousId`)
     equally asserts `1`.
   - Why: exercises the `coalesce(user_id, anonymous_id)` identity of D1
     directly, independent of B4/B5 (out of `Périmètre`, assumed merged but
     not relied upon for this guarantee).
   - Dependencies: Step 2
   - Risk: Low

9. **Revenue, ARPU and AI cost are unchanged** (File: `lib/dal/metrics.test.ts`)
   - Action: re-run (or extend) the existing `seedFunnelStory`-based tests
     (`getPortfolioMetrics › revenue, cost, conversion and margin`, `getFunnel
     › metrics`) after Step 2 and confirm `revenueCents`, `aiCostMicros`,
     `signupToPurchaseRate` and `marginPerGenerationMicros` are untouched —
     these already pass unmodified since they don't seed
     `signup`/`credits_exhausted`/`purchase` events at all (only `purchases`
     table rows). No new test strictly required; explicitly re-check them
     green as the closing step of the loop, and add one assertion in the
     Step 1 or Step 3 scenario that `metrics.revenueCents` and
     `metrics.aiCostMicros` still equal the values a hand-computed
     `purchases`/`generations` seed would give, to pin the "KPIs don't
     change" acceptance bullet with an explicit assertion rather than an
     implicit one.
   - Why: makes the third acceptance bullet a first-class assertion, not just
     "nothing broke".
   - Dependencies: Steps 1-6
   - Risk: Low

## Testing Strategy
- Unit tests: `lib/dal/metrics.test.ts` (real Postgres, `withTestTransaction`-
  style shared test DB via the existing `createTempProduct`/`cleanupProduct`/
  `seedFunnelStory` helpers) — every step above. `sheet.test.ts` for the
  display-layer clamp (pure function, no DB).
- Integration: none new — `getFunnel`'s existing "equals the portfolio row"
  test (Task 2 in the current file) continues to prove `getPortfolioMetrics`
  and `getFunnel` share the fixed aggregation.
- E2E: none required by this spec; the QA report's Q5 repro was found via the
  `full` scenario, not a dedicated E2E journey — no `e2e/*.spec.ts` in
  `Périmètre`.

## Risks & Mitigations
- **Risk**: `count(distinct …) filter (where …)` over `events` on a 30-day
  window could be slower than the current `count(*) filter`, at scale.
  - Mitigation: the existing index `events_product_id_type_created_at_idx`
    `(product_id, type, created_at)` (docs/07) already narrows the scanned
    rows to the product and range before any distinct aggregation; the extra
    work is an in-memory hash/sort bounded by the matched rows, not the whole
    table. At demo scale (seed: a few thousand events per product) this is
    negligible. No new index needed for this spec; docs/07's "Suivis de
    contrat" already tracks a possible future `events (product_id, type,
    user_id)` index if volume ever justifies it — out of `Périmètre` here.
- **Risk**: modifying two already-committed tests (Step 4) could look like
  "adapting tests to the code" (CLAUDE.md's named anti-pattern).
  - Mitigation: the commit for Step 4 explains explicitly that the old
    fixtures never matched production's own invariant (every `signup`/
    `credits_exhausted`/`purchase` event always carries a `userId`), and is a
    separate commit from Step 2's production-code change, so a reviewer can
    read the two independently.
- **Risk**: D2's "no cohort enforcement" reading could be seen as too
  permissive (a rate could still show, say, 87% from a boundary artifact that
  looks surprising even if ≤ 100%).
  - Mitigation: out of this spec's acceptance bullets, which only require "no
    rate above 100%" and a stated skip rule — both satisfied. A stricter
    cohort model is a larger change flagged for a future spec, not silently
    added here.

## Success Criteria
- [ ] Step 1's test is red before Step 2, green after (committed as such)
- [ ] Step 5's test is red before Step 6, green after
- [ ] Step 7's test is red before its `sheet.ts` change, green after
- [ ] No `FunnelStep.rateFromPrevious` or displayed `FunnelRow.rate` exceeds
      1 / "100 %" in any test, including the boundary scenario of Step 5
- [ ] `revenueCents`, `aiCostMicros`, `signupToPurchaseRate`,
      `marginPerGenerationMicros` unchanged by any step (Step 9)
- [ ] `getFunnel`'s signature and return type are untouched (diff of
      `lib/dal/metrics.ts`'s exported types is empty)
- [ ] Every touched file is inside `Périmètre`:
      `lib/dal/metrics.ts`, `lib/dal/metrics.test.ts`,
      `admin/products/[slug]/_components/sheet.ts`,
      `admin/products/[slug]/_components/sheet.test.ts`
- [ ] `pnpm check` passes, coverage 80%+ on `lib/**`
