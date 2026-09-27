# Implementation Plan: QA2-P1-B2 · OG image and icon 404 on live products

Worktree: `/home/user/micro-saas-studio-builder-qa2-p1-b2-og-icon-404`
Spec: `specs/qa/QA2-P1-B2-og-icon-404.md`

## Investigation summary (before any code change)

Read `docs/` in full, `CLAUDE.md`, the QA report (§B2), the original `specs/I18N-SEO.md`, and the current code for `[app]/opengraph-image.tsx`, `[app]/icon.tsx`, `[app]/layout.tsx`, `[app]/page.tsx`, `[app]/_lib/og-colors.ts`, `lib/dal/products.ts`, `lib/dal/themes.ts`, `e2e/seo.spec.ts`, and `.claude/plans/I18N-SEO.plan.md`. Also read the Next.js 16.3.6 docs shipped in `node_modules` for `next/root-params`, `generateStaticParams`, `opengraph-image`, `route.js`, `dynamic-routes.md`, and `layout.md`. No frozen contract (`lib/db/schema.ts`, `lib/schemas/**`, DAL signatures) is implicated by anything found.

No root cause could be pinned with high confidence — stated explicitly rather than forcing a diagnosis.

**What the comparison ruled out** (all match documented Next.js 16.3.6 behavior exactly):
- `next/root-params`'s `app()` getter is correctly *not* used in `opengraph-image.tsx`/`icon.tsx` — the docs state root-param getters are unsupported in Route Handlers (support "planned for a future release"), and opengraph-image/icon are documented as "specialized Route Handlers". Using the regular `params` prop instead, as the code does, is exactly the documented pattern (`app/shop/[slug]/opengraph-image.tsx` example in the official doc matches this file 1:1).
- `generateStaticParams` duplicated in `icon.tsx`/`opengraph-image.tsx` (mirroring `layout.tsx`'s) matches the documented pattern for dynamic Route Handlers and for per-file static params in a shared dynamic segment.
- `dynamicParams` is left at its default (`true`) everywhere — so an unlisted slug should still render dynamically per the docs, both for pages and Route Handlers ("Requests to other IDs will be handled dynamically at request time").
- `notFound()`/throw rules mirror `layout.tsx` exactly (unknown/killed → `notFound()`, missing theme row → throw), and `listProductSlugs()` is identical across all three files (no query differs).
- Runtime (`nodejs`, implicit default) is consistent across the whole route; no edge/nodejs mismatch, no `vercel.json` rewrite, no colliding `icon`/`opengraph-image` file elsewhere in `app/`.
- `og-colors.ts`'s `resolveOgColors`/`drawable()` access only fields that exist on the schema; a crash there would produce a 500, not the observed 404, so this isn't implicated either.

**The one asymmetry found between the working file (`layout.tsx`) and the failing ones**: `opengraph-image.tsx` and `icon.tsx` are the *only* files in this segment where `generateStaticParams` was added specifically to make them prerender per-slug (comment: "code review MEDIUM… without this, the OG image is served dynamically (ƒ) on every request"). That comment itself confirms these routes previously worked as fully dynamic Route Handlers before that optimization was added. Combined with the fact that `next/root-params` was introduced in **v16.3.0** (the exact minor this project pins) and that "root param segment colocated with a static-prerendered metadata Route Handler" is a very new, narrow combination, the best-supported hypothesis — not proven — is that build-time static generation for these two files under Cache Components, in a segment that is simultaneously the root-param/root-layout segment, doesn't reliably produce a working prerendered+fallback route on Vercel's build/deploy pipeline, even though the code matches every documented convention. This cannot be confirmed without executing a build (outside a planner's Read/Grep/Glob-only tool access).

**Important open question the plan flags rather than answers**: `e2e/seo.spec.ts` (already in the repo, from I18N-SEO) already contains a test that fetches `/lettre-pro/icon` and `/lettre-pro/opengraph-image` over HTTP and expects 200 — and `playwright.config.ts`'s `webServer` genuinely runs `pnpm build && pnpm start` (a real production build, not `next dev`). Per `.claude/plans/I18N-SEO.plan.md` task 7, this test was "written but not run" at the time. So it is currently unknown whether this bug reproduces locally with a real production build. That's why the plan's very first step is to establish this before touching any code.

## Requirements (from the spec's Acceptation)
- `/{slug}/opengraph-image` and `/{slug}/icon` return 200 with the right image for every live (non-killed) seeded product, in prod-equivalent conditions.
- A `killed` product and an unknown slug keep returning 404 on both routes (no regression).
- Proven by a test that fails before the fix and passes after; a Vitest test of the component alone is accepted only if it can actually fail for this bug — otherwise `e2e/seo.spec.ts` must hit the routes over HTTP against a real `next build && next start`.
- No frozen-contract change.

## Phase 0 — Reproduce locally, first, before any code change
1. **Confirm current status of the existing e2e assertion** (no file changes). Run `pnpm build && pnpm start` locally (or `pnpm test:e2e -- e2e/seo.spec.ts`, since `playwright.config.ts`'s `webServer` already does `db:migrate && db:seed && build && start`), then `curl -I http://localhost:<port>/lettre-pro/opengraph-image` and `/lettre-pro/icon`.
   - **If it reproduces locally** (404): this is the good case — a fully local, fast repro loop. Go to Phase 1.
   - **If it does not reproduce locally** (200, matching what the existing e2e test already expects): the bug is specific to the Vercel deployment/build pipeline, not to `next build` in general. Note this explicitly in the PR description — it changes what "the test that fails before, passes after" can mean (see Phase 2's fallback). Still proceed to Phase 1's bisection, since the safest fix (below) is worth applying regardless of where exactly it breaks.

## Phase 1 — Bisect while still read/diagnose only (small, throwaway edits, not committed until the cause is confirmed)
2. **Isolate whether `generateStaticParams` in `icon.tsx`/`opengraph-image.tsx` is the trigger.** Temporarily comment it out of just one of the two files, rebuild (`pnpm build`), check the Next.js build route table output (`▲`/`ƒ` markers per route) for `/[app]/icon` and `/[app]/opengraph-image`, and re-test with `curl`. Also inspect `.next/server/app/(products)/[app]/` in the build output to see whether the route is present as a static asset, a function, or missing entirely — this is hard evidence either way, more precise than curl alone.
3. **If removing `generateStaticParams` fixes it locally** (or, if not reproduced locally, at least confirms the route table difference between the two files clearly): this is the fix — see Phase 2.A.
4. **If it does not change anything locally**: the local repro (if any) has a different cause; re-examine with `NEXT_PRIVATE_DEBUG_CACHE=1 pnpm build` and the dev-time equivalent for cache-related warnings, and check whether Next's build log emits any silent warning specific to `opengraph-image`/`icon` under `cacheComponents`. Escalate findings in the PR description rather than guessing further; this scenario was anticipated by the QA2 spec itself ("if a Vitest test of the component alone isn't enough… add an e2e test") and by this plan's own uncertainty above.

## Phase 2 — Fix (pick the branch that Phase 1 supports)

**Phase 2.A — Leading candidate fix: drop `generateStaticParams` from `icon.tsx` and `opengraph-image.tsx`, keep it only on `layout.tsx`.**
- File: `app/(products)/[app]/opengraph-image.tsx` — remove the `generateStaticParams` export and its comment; add a short comment explaining why (this bug, referencing `specs/qa/QA2-P1-B2-og-icon-404.md`): these two files fall back to fully dynamic rendering (`ƒ`) on every request, same as before the earlier "code review MEDIUM" optimization, trading the per-slug prerendering for correctness. `layout.tsx`'s own `generateStaticParams` still satisfies Cache Components' "root param needs at least one static value" build requirement for the whole `[app]` segment, so the build should still succeed without it here.
- File: `app/(products)/[app]/icon.tsx` — same change.
- **Do not** touch `layout.tsx` unless Phase 1's evidence explicitly requires it (Périmètre allows it only if the root cause demands it — nothing found so far points there).
- Re-run Phase 0's repro to confirm 200 now, for a live product, in the same production-build conditions that showed 404 before (or, if never reproduced locally, confirm the build's route table now shows `ƒ` for both routes and that behavior is unchanged/correct for `killed`/unknown slugs).

**Phase 2.B — Fallback if Phase 1 points elsewhere**: don't guess a second speculative fix; the finding from Phase 1 (build-output inspection, cache debug logs) should drive the actual change, still confined to `opengraph-image.tsx`/`icon.tsx`/`og-colors.ts` (and `layout.tsx` only if proven necessary). If at that point the fix appears to require something outside the spec's Périmètre (e.g. `next.config.ts`, restructuring where the root layout lives), stop and flag it back to the orchestrator rather than expanding scope unilaterally — outside Périmètre changes the shared build config for the whole app.

## Phase 3 — Tests
5. **`app/(products)/[app]/opengraph-image.test.tsx` and `.../icon.test.tsx`** (neither exists yet, despite being in Périmètre and referenced by `.claude/plans/I18N-SEO.plan.md` task 5–6 — this QA fix is also the moment to add them). Mock `next/og`'s `ImageResponse` and the DAL (`getProduct`, `getTheme`); assert: `notFound()` for unknown/killed, throw for a missing theme row, correct colors via `og-colors.ts`, correct `size`/`contentType`. These are useful regression tests for the component logic but — per the spec's own instruction — are not sufficient alone to prove this specific bug is fixed, since it was invisible at the component-call level.
6. **`e2e/seo.spec.ts`**: the existing "the `<link>`/`<meta>` tags point at real images" test already fetches both routes for `lettre-pro` and expects 200 — keep it, and treat Phase 0's finding as the record of whether this test was previously red. If Phase 0 showed it passing locally even before the fix (Vercel-only repro), add a second assertion that's actually diagnostic of the mechanism fixed in Phase 2.A, and document in the PR's "How to test" that a manual post-deploy `curl` check against the preview URL is the actual proof for this specific PR.
7. Keep the two "already correct" regression tests: killed product → 404 on both routes, unknown slug → 404 on both routes (already present in `e2e/seo.spec.ts`).

## Testing strategy
- Unit: `opengraph-image.test.tsx`, `icon.test.tsx` (new), `og-colors.test.ts` (new, simple pure-function tests for `drawable()`/`resolveOgColors()`, also currently missing despite being in Périmètre).
- Integration/E2E: `e2e/seo.spec.ts`, run against a genuine `pnpm build && pnpm start` (already how `playwright.config.ts` is wired) — this is the only reliable local proxy for the prod behavior; a preview-URL `curl` check post-PR is the closest thing to a true repro of the original bug given it was only observed on a real Vercel deployment.

## Risks & mitigations
- **Risk**: the true root cause is Vercel-deployment-specific (build adapter behavior) and not reproducible in any local `next build`. Mitigation: Phase 2.A's fix (drop static prerendering for these two files) is a strict simplification — it removes the exact new, narrow mechanism (root-param segment + colocated static-prerendered metadata Route Handler under `next/root-params`, a v16.3.0 feature) that differs between the working file (`layout.tsx`, which still needs `generateStaticParams` for the build to pass at all) and the two failing ones — so it's a reasonable fix to ship even without a 100%-confirmed local red/green cycle, as long as the PR is explicit about this and the reviewer verifies on the next preview deployment before merging to `main`.
- **Risk**: dropping `generateStaticParams` reintroduces the "served dynamically on every request" behavior the earlier code review flagged as MEDIUM. Mitigation: this is an explicit, documented trade-off (correctness over a prerendering perf optimization), consistent with CLAUDE.md/`ponytail`'s priority order (approved spec > tests > readability > minimal code) — the spec's acceptance is "200 with the right image", not "prerendered".
- **Risk**: not being able to pin the cause with certainty means tdd-guide could spend a long time in Phase 1. Mitigation: cap Phase 1 at the two bisection experiments above; if inconclusive, ship Phase 2.A anyway (it's low-risk and well-motivated) and document the residual uncertainty in the PR rather than iterating indefinitely.
- **Risk**: `notFound()` inside a metadata Route Handler is an unusual pattern (Route Handlers don't have a React tree/`not-found.tsx` boundary the way pages do) — worth double-checking during Phase 1's build-output inspection that `notFound()` still produces a real 404 (not a 500 misrendered as something else) for the killed/unknown cases after the fix, since this is explicitly a "don't regress" acceptance bullet.

## Success criteria
- [ ] `/{slug}/opengraph-image` and `/{slug}/icon` return 200 with correct `content-type`/`content-length` for all 3 live seeded products, verified locally via `pnpm build && pnpm start` and (since local repro may be inconclusive) on the next Vercel preview URL before merge.
- [ ] Killed product and unknown slug still 404 on both routes (regression-tested).
- [ ] `opengraph-image.test.tsx`, `icon.test.tsx`, `og-colors.test.ts` added; `e2e/seo.spec.ts` extended/confirmed.
- [ ] No change to `lib/db/schema.ts`, `lib/schemas/**`, or any DAL signature.
- [ ] `pnpm check` green; PR explicitly documents whether the bug reproduced locally, and if not, that verification happened on the preview deployment.

## Nothing to escalate on the frozen-contract front

No frozen-contract issue found. One open item handed to `tdd-guide` rather than resolved here: the root cause could not be pinned with full confidence without executing a build, which is outside planning's tool access — Phase 0/1 above hands that execution to `tdd-guide` as the actual next step, with a concrete, bounded decision tree rather than open-ended exploration.
