# Plan: SA-06 · Historique

**Source spec**: specs/SA-06-historique.md
**Complexity**: Medium (one new DAL module, one route with a streamed list, one pure helper module, fr/en messages,
one e2e file; no contract edit, no dependency)

## Summary

`/[app]/history`: a static shell (`<h1>` from the cached `getProduct` and the translated title), and under
`<Suspense>` an async Server Component that reads the session (or the `anonymous_id` cookie when there is none) and
`?page=` (Zod, fallback 1), then calls the new `listGenerations(userOrAnonId, productId, page)` in
`lib/dal/history.ts`. Each entry: date, input summary, start of the result; "Ouvrir" is a native `<details>` showing
the full result in the existing `ResultCard` (copy, download). Empty state links to `/[slug]/tool`. No `'use cache'`.

`lib/dal/history.ts` does not exist yet (no stub, no contract test): SA-06 creates it with the spec's literal
signature (it is in the spec's Périmètre); the type is pinned in `lib/dal/history.test.ts`; `contract.test.ts` and
`generations.ts` stay untouched.

## Orchestrator decisions (binding)

1. Literal signature `listGenerations(userOrAnonId: string, productId: string, page: number)`; the DAL decides user vs
   anonymous from session presence.
2. Anonymous history: yes, via the shared `anonymous_id` cookie (uuid-validated `readAnonymousId`).
3. No entry-point link to `/history` here (header/tool are other specs' files): the orchestrator records it as a
   pending integration.
4. Mockup extras omitted and listed in the PR body: search box, « Aujourd'hui / Hier » relative dates, « Copier » in
   the collapsed row (copy is in `ResultCard` once opened), regenerate.
5. « Charger plus » = link to the next page (page N only) plus a « Plus récentes » link back.
6. Colocated tests (`lib/dal/history.test.ts`, `[app]/history/**/*.test.ts(x)`) are in scope; the fr/en key parity
   test lives in `history-list.test.tsx`.

## Frozen inputs (consumed, never changed)

`getProduct(slug)` `lib/dal/products.ts` (cached); `getSession()` `lib/dal/session.ts:13-16`; `readAnonymousId`,
`ANONYMOUS_ID_COOKIE` `app/(products)/[app]/api/events/anonymous-id.ts:8,14-17`; `generations` `lib/db/schema.ts:117-149`
(`output` jsonb, string for markdown; index `(product_id, created_at)`); `ResultCard`
`components/product/result-card.tsx:15-25`; `EmptyState`, `Skeleton`; messages auto-loaded by `messages/manifest.ts`.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| DAL header + session check | `lib/dal/generations.ts:1-7,43-47,119-129` | `import "server-only"`, typed const, throw when `userId` ≠ session user |
| Anonymous filter | `lib/dal/generations.ts:141-155` | `isNull(userId)` + `eq(anonymousId)` + `productId` |
| DAL test | `lib/dal/generations.test.ts:9-14,33-66` | `vi.mock("./session")`, direct inserts, cleanup |
| Page with root param | `app/(products)/[app]/pricing/page.tsx:11-26` | `app()` → `getProduct` → `notFound()`; `getTranslations` |
| Page test | `app/(products)/[app]/pricing/page.test.tsx:12-39` | mocks root-params, products, navigation, next-intl/server |
| Session under Suspense | `components/product/header-balance.tsx:11-17` | async leaf in `<Suspense fallback={<Skeleton/>}>` |
| Cookie read | `app/(products)/[app]/api/generate/route.ts:86-89` | `readAnonymousId((await cookies()).get(ANONYMOUS_ID_COOKIE)?.value)` only without session |
| `as Route` precedent | `components/product/header-balance.tsx:21-22` | template href cast with a comment |
| i18n parity | `app/(products)/[app]/tool/_components/tool-form.test.tsx:296` | `keyPaths()` fr = en |
| e2e DB | `e2e/themes.spec.ts:1-8,32-62`, notes `e2e/tool.spec.ts:8-18` | drizzle + `requireDatabaseUrl`, cleanup by `ip_hash` |

## Design decisions

1. `lib/dal/history.ts`: `HISTORY_PAGE_SIZE = 20`; `HistoryEntry = { id; createdAt: Date; input: Record<string,string>;
   output: string }`; `HistoryPage = { entries; page; total; hasMore }`.
2. With a session: `userOrAnonId` must equal `session.user.id` else throw; filter `user_id = id`. Without: filter
   `anonymous_id = id AND user_id IS NULL`. The page takes the anonymous id only from the httpOnly cookie.
3. Only `status = 'succeeded'` rows (entries and total).
4. `ORDER BY created_at DESC, id DESC`, `LIMIT 20 OFFSET (page-1)*20`, `total` by `count(*)` same where,
   `hasMore = page*20 < total`.
5. DAL: non-positive-integer `page` → `RangeError` before any query. UI: `z.coerce.number().int().min(1).catch(1)`
   locally (search param, not an action input).
6. Output normalized in the DAL: string as is, other jsonb → `JSON.stringify(value, null, 2)`; no tokens, cost,
   ip_hash or model returned.
7. `_lib/summarize.ts`: `summarizeInput(input, fields, max = 80)` in config field order, unknown keys appended, blanks
   skipped, code-point truncation with `…`; `excerpt(text, max = 120)` collapses whitespace.
8. Pagination links `?page=N±1` (`as Route` cast with comment).
9. `<details>`: `<summary>` = summary, date, excerpt, « Ouvrir »; body `<ResultCard output={{ kind: "markdown", text }}
   fileName={`${slug}-${id}`} />`, no `onRegenerate`. No new `'use client'` file.
10. Dates via next-intl `getFormatter()` on the server (`dateStyle: "medium", timeStyle: "short"`).
11. Empty cases: no session and no valid cookie → empty state, DAL not called; `total 0` → empty state + tool link;
    page past the end → « page vide » + link to page 1.
12. Never cached: session, cookies and `searchParams` awaited only inside the `<Suspense>` child.

## Files to Change

| File | Action |
|---|---|
| `lib/dal/history.ts` + `lib/dal/history.test.ts` | CREATE |
| `app/(products)/[app]/history/_lib/summarize.ts` + test | CREATE |
| `app/(products)/[app]/history/_components/history-list.tsx` + test | CREATE |
| `app/(products)/[app]/history/_components/history-skeleton.tsx` | CREATE |
| `app/(products)/[app]/history/page.tsx` + test | CREATE |
| `messages/fr/history.json`, `messages/en/history.json` | CREATE (`title`, `count`, `open`, `empty.title`, `empty.cta`, `pagination.more`, `pagination.newer`, `pageEmpty`, `backToFirst`, `loading`) |
| `e2e/history.spec.ts` | CREATE (not run) |

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push `feat(app): …`.

1. **Type pin** (`expectTypeOf`) + empty user → `{ entries: [], page: 1, total: 0, hasMore: false }`. Fresh users per
   test (seeded users carry other suites' rows); cleanup by id.
2. **Order and size**: 21 succeeded rows → page 1 has 20 newest-first, total 21, hasMore; page 2 has 1; equal
   `createdAt` across the boundary: no duplicate, no gap.
3. **Status filter**: pending and failed excluded from entries and total.
4. **Isolation**: session A sees only A's rows on this product; A with B's id → throws; no session + anon X → only
   `anonymous_id = X AND user_id IS NULL` (a user-B row with anon X excluded); unknown uuid → empty.
5. **Normalization and validation**: jsonb object → pretty JSON string; page 0, -1, 1.5, NaN → `RangeError`, no query.
6. **`summarizeInput` / `excerpt`** with LettrePro fields.
7. **Identity resolution** in `HistoryList`: session → user id, cookie not read; cookie → uuid; none or tampered →
   empty state, DAL not called.
8. **Page param**: "2" → 2; "abc", "0", "-3", undefined → 1.
9. **Rendering**: count label, per entry summary/date/excerpt in DAL order, `<details>` body holds the full output.
10. **Reopen and copy**: `<details>` open shows the full text; `ResultCard` copy writes the full output; file name
    `lettre-pro-<id>`.
11. **Empty state and pagination links** (page 1 with hasMore, page 2 without, past the end) + fr/en key parity.
12. **Page**: `<h1>`, list inside `<Suspense>`, `getSession`/`cookies` not called by the page, `notFound` cases,
    `searchParams` passed through unawaited.
13. **Real-page check** on `next dev` (empty state, one anonymous generation then one entry, no blocking-route error).
14. **`e2e/history.spec.ts`** (written, not run), cleanup by `ip_hash`/`anonymous_id`.
15. **Full validation**: typecheck, lint, format:check, knip, test:coverage (80 %+ on `lib/**`), check, build.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `listGenerations` never declared as a contract | Certain | Created per spec, type pinned in its test, stated in the PR |
| Seeded users carry rows from other suites | High | Fresh users per test |
| Dynamic reads outside `<Suspense>` make the route blocking | Medium | Only in `HistoryList`; Tasks 12-13 |
| next-intl time zone not set globally | Medium | Server formatting; explicit zone in tests; noted for I18N-SEO |
| jsdom `<details>` toggle | Medium | Assert content + `open`; real toggle in e2e |
| No entry point to `/history` | Certain | Decision 3 |
| Anonymous history does not follow signup | Certain | Out of scope, noted in the PR |

## Acceptance

- [ ] Paginated list 20/page newest first, date, summary, excerpt: Tasks 2, 6, 9, 11
- [ ] Reopen full result, copy: Tasks 5, 10
- [ ] Empty state with tool link; never cached, streamed under `<Suspense>`: Tasks 11, 12, 13
- [ ] A user never sees another's generations: Tasks 4, 7
- [ ] No frozen contract edited; `pnpm check`, `pnpm build` green; PR title `feat(app): SA-06 generation history`
