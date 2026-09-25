# Plan: BO-06 · Changement de statut

**Source spec**: specs/BO-06-statut.md · mockup specs/mockups/BO-06.png
**Complexity**: Small–Medium (frozen DAL body, one Server Action, one `'use client'` modal leaf, one e2e file)

## Summary

A « Changer de statut » button on BO-03 opens a modal with:
- the current status, then « → », then the new status;
- the three justifying numbers;
- a decision note, stored in `products.status_note`.

Killed needs an explicit destructive confirmation. `setProductStatus` (Server Action) calls the real `updateStatus`
body (`requireAdmin` → row lock → `assertEditable` → update), then `updateTag('product:{slug}')` and
`updateTag('products')`. After that, `/{slug}` returns 404 through the SA-08 layout.

## Orchestrator decisions (binding)

1. **Test files.** Colocated tests are in scope: `lib/dal/product-status.test.ts` and `[slug]/_actions.test.ts`.
2. **Transitions.** There is no transition matrix: any status → any other, including leaving killed. The frozen
   `contract-shape.test.ts` calls scale → scale on LettrePro, so the DAL never rejects the same status. The UI alone
   disables the current status.
3. **Replaced test.** The BO-03 slot test « renders nothing » is replaced in its own commit, whose message explains
   that BO-06 supersedes it.
4. **Mount points.** `StatusChange` stays mounted where BO-03 put it (`sheet-header.tsx`, outside Périmètre).
   - A second mount in the decision panel and the top-right placement from the mockup are an orchestrator follow-up
     after merge.
   - Disabling the trigger for locked seeded products (`isEditable`) is recorded for DEMO-mode.
   - Do not touch `sheet-header.tsx`, `decision-panel.tsx` or `sheet.ts`.
5. **Errors.** A DAL error in the action goes through `unstable_rethrow`, then `console.error`, then returns
   `{ formError }` inside the modal, with no tags.
6. **Messages.** The backoffice is French-only and hardcoded, so there is no `messages/*` file.

## Frozen inputs (never changed)

`updateStatus(productId, status, note): Promise<void>` signature (`lib/dal/product-status.ts`,
`contract.test.ts:113-120`, `contract-shape.test.ts:207-211`); `statusChangeInputSchema`, `slugSchema`
(`lib/schemas/inputs.ts`); `assertEditable` (`lib/dal/guards.ts`); `getProduct` / `listProducts` cache tags
(`lib/dal/products.ts`).

## Design

- **DAL body.** `requireAdmin()`, then a transaction:
  1. `select … for update`; a missing row throws;
  2. `assertEditable(row)`;
  3. update `status`, `statusNote`, `updatedAt`.

  No `updateTag` in the DAL.
- **Action `setProductStatus(slug, _prev, formData)`.** Steps, in order:
  1. `requireAdmin`;
  2. `slugSchema`;
  3. `statusChangeInputSchema`, with the note trimmed and empty → null;
  4. `getProduct(slug)`, where null gives `formError`;
  5. `updateStatus(product.id, …)`;
  6. `updateTag('product:'+slug)` then `updateTag('products')`;
  7. return `{ ok: true }`.

  It never trusts a client-supplied `productId`. French errors: « Note trop longue (500 caractères max) »,
  « Le statut n'a pas pu être changé ».
- **UI (`status-change.tsx`, `'use client'`).**
  - Trigger « Changer de statut », which opens a controlled Dialog titled « Changer le statut de {name} ».
  - Current status badge, « → », then 4 native radios with the current one disabled.
  - Initial selection from `decision` (kill → killed, scale → scale, only when it differs from the current status).
  - Box « Ce que disent les chiffres » with the 3 justification values.
  - Textarea « Note de décision » (`maxLength` 500).
  - Selecting Killed shows the red warning and a destructive « Passer en Killed »; other targets show
    « Passer en {Label} ».
  - « Annuler » closes the dialog. The form lives in an inner component inside `DialogContent`, so its state resets
    on each open.
  - On `ok`: `toast.success`, then close. `formError` shows as `role="alert"`.

## Tasks (red → green, commit + push each)

1. DAL:
   - `assertEditable` is called with the row, and nothing is written when it throws;
   - an unknown uuid rejects;
   - the note is written, then cleared; killed is written; `updatedAt` moves forward.
2. Action:
   - admin first;
   - invalid slug, status and note, with no DAL call or tags;
   - happy path, with exactly 2 tags;
   - unknown product;
   - DAL failure, with `formError`, a log and no tags;
   - redirect rethrown.
3. UI:
   - slot test replaced (separate commit);
   - trigger;
   - modal content;
   - killed confirmation;
   - submit ok and error;
   - `sheet-header.test.tsx` and `product-sheet-view.test.tsx` still green, unchanged.
4. `e2e/status.spec.ts`, written, not run:
   - journey A: change to Learn with a note, then check the DB;
   - journey B: warm `/{slug}` (200), kill it, `/{slug}` is 404 and the SA-08 list no longer shows it;
   - fresh `status-e2e-{uuid}` products with schema-valid configs, cleaned up in `finally`.
5. `pnpm check`, `pnpm test:coverage`, then `flock /tmp/msb-queue/build.lock pnpm build`.

## Acceptance

- [ ] B1, modal with current → new status, metrics and note: tasks 1, 2, 3, 4A
- [ ] B2, killed confirmation, then the sub-app returns 404: tasks 1, 3, 4B
- [ ] B3, `updateTag` on `product:{slug}` and `products`: tasks 2, 4B
- [ ] Contract tests unchanged and green; `pnpm check` and build green
- [ ] PR title `feat(bo): BO-06 product status change with killed confirmation`
