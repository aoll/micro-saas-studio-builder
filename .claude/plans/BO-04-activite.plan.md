# Plan: BO-04 · Fiche produit : activité

**Source spec**: specs/BO-04-activite.md · mockup specs/mockups/BO-04.png
**Complexity**: Medium. It adds a new admin read DAL, one read-only page, pure view helpers, small server components and one e2e file.

## Summary

`/admin/products/[slug]/activity` is read-only. It shows three lists for one product, each with its own pagination and empty state:
- the latest generations: date, input, output, model, AI cost and status (with the refunded flag);
- the purchases: a 30-day summary plus a paginated list;
- the credit movements of all users.

The page follows the BO-03 pattern: a static shell, then a `<Suspense>` child that calls `await requireAdmin()` first, then `params` → `getProduct` → `notFound()` → `searchParams` → the DAL. It writes nothing: no Server Action, no `'use cache'`, no `updateTag`.

## Orchestrator decisions (binding)

1. **Colocated tests are in scope.** That covers `lib/dal/activity.test.ts` and the `activity/_components/*.test.*` files.
2. **`lib/dal/activity.ts` is new code.** It is inside the Périmètre and is not a frozen contract. Its signatures below are pinned with `expectTypeOf`.
3. **The « Vue d'ensemble / Activité » tabs live in `activity/_components/activity-header.tsx` (`ProductTabs`).** A link from the BO-03 sheet to the activity screen is an orchestrator follow-up after merge, because BO-03 files are outside the Périmètre.
4. **Read-only imports from other routes' private helpers are accepted.**
   - `summarizeInput` and `excerpt` from `app/(products)/[app]/history/_lib/summarize.ts`.
   - `formatEuroCents` from `admin/_components/portfolio/format.ts`.
   - Do not modify those files.
   - The AI cost needs 3 decimals, so it gets a local `formatCostMicros` (« 0,004 € »).
5. **Purchases show the mockup's 30-day summary and a paginated list.**
6. **Returned fields.** Never return user ids, emails, IP hashes, anonymous ids or idempotency keys. Tests assert the exact keys of each entry.
7. **No new index.** The product-wide ledger query has no matching index. That is fine at demo volume; the orchestrator records it for the contract PR.
8. **`now` comes after `requireAdmin()`.** `new Date()` is created inside the Suspense child, after `requireAdmin()` (a request-time API), and passed down to the pure helpers.
9. **Waiting.** Never wait with `until/while pgrep -f` loops. Run `pnpm check`, `pnpm test:coverage` and `flock /tmp/msb-queue/build.lock pnpm build` in the foreground.

## DAL (`lib/dal/activity.ts`, `import 'server-only'`)

```ts
export const ACTIVITY_PAGE_SIZE = 20;
export const PURCHASE_SUMMARY_DAYS = 30;
export type ActivityPage<T> = { entries: T[]; page: number; total: number; hasMore: boolean };
export type ActivityGeneration = { id: string; createdAt: Date; input: Record<string, string>; output: unknown;
  model: string | null; costMicros: number | null; status: "pending" | "succeeded" | "failed"; refunded: boolean };
export type ActivityPurchase = { id: string; createdAt: Date; credits: number; amountCents: number; currency: string };
export type ActivityMovement = { id: string; createdAt: Date; delta: number;
  reason: "signup_bonus" | "purchase" | "generation" | "refund"; packCredits: number | null };
export type PurchaseSummary = { count: number; revenueCents: number; byPack: { credits: number; count: number }[] };
listProductGenerations(productId, page) / listProductPurchases(productId, page) /
listProductCreditMovements(productId, page) / getPurchaseSummary(productId)
```

Rules for every function:
- **Guard order:** `requireAdmin()` first. Then `page` must be a positive integer, else `RangeError`. Then `z.uuid()` on the product id, else « unknown product ». No SQL runs before these checks.
- **Order:** `created_at desc, id desc`.
- **Paging:** `limit/offset` plus `count(*)` in `Promise.all`.
- **`refunded`:** `exists` a `refund` ledger row for that generation.
- **`packCredits`:** read with a left join to `purchases`.
- **Summary window:** 00:00 UTC, 29 days ago (the same window as BO-02/03).

## Tasks (red → green; commit and push at each green; `feat(db)` for the DAL, `feat(bo)` for the UI)

1. **DAL tests** (`lib/dal/activity.test.ts`):
   - Cover signatures, guards, empty lists, content and paging (21 rows with tied timestamps), the refunded flag, movements, purchases and the summary with its day boundary, plus coverage of 80 % or more.
   - Use temp products with schema-valid `buildValidConfig`.
   - Wrap every test body in `try/finally`, cleaning up in FK order: `credit_transactions` → `purchases` → `generations` → `product_versions` → `products` → `users`.
   - Insert ledger rows directly, without calling `credits.*`.
2. **Pure helpers:**
   - `activity-format.ts`: `formatCostMicros`, `formatRelative(date, now)`, `formatDelta` (U+2212), `movementLabel`, `generationStatus`, `summarizeOutput`, `purchaseSummaryLines`.
   - `pagination.ts`: `parsePageParam`, `activityHref`, which keeps each list's page param.
3. **Components:**
   - `activity-header.tsx` with `ProductTabs`.
   - `generations-table.tsx`, `movements-card.tsx` and `purchases-card.tsx`, each with its empty state, a « page vide » state and Précédent/Suivant links.
   - `activity-view.tsx` and `activity-skeleton.tsx`.
4. **`page.tsx`:** it is checked by `require-admin-coverage.test.ts`, typecheck and build.
5. **`e2e/activity.spec.ts`:** written, not run. Journeys: unauthenticated user, a story product, pagination, empty product, killed product, unknown slug.
6. **Final checks:** `pnpm check`, `pnpm test:coverage`, then `flock /tmp/msb-queue/build.lock pnpm build`.

## Acceptance

- [ ] Generations (input, output, model, cost): tasks 1, 2, 3, 5
- [ ] Purchases: tasks 1, 2, 3, 5
- [ ] Credit movements: tasks 1, 2, 3, 5
- [ ] Pagination: tasks 1, 2, 3, 5
- [ ] Empty state: tasks 1, 3, 5
- [ ] Admin only, 404 on an unknown slug, killed product still shows its history
- [ ] `pnpm check` and build green
- [ ] PR title `feat(bo): BO-04 product activity screen`
