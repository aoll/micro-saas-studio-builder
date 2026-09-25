# Plan: SA-03 · Inscription par lien magique

**Source spec**: specs/SA-03-inscription.md
**Complexity**: Medium (one Server Action, one GET Route Handler for the post-login step, one client flow component,
a full page, an intercepted modal, one message zone, one e2e file; no contract change, no dependency)

## Summary

1. `requestMagicLink(slug, prev, formData)` in `[app]/signup/_actions.ts`: `slugSchema`, `signupInputSchema`,
   `guardRequest("signup")`, `getProduct`, `auth.api.signInMagicLink` with `callbackURL: /${slug}/signup/complete` and
   `errorCallbackURL: /${slug}/signup`, then `getLatestMagicLink` with the email of THIS request only → `{ status:
   "sent", email, magicLinkUrl }` (relative URL).
2. Client `SignupFlow` shows a simulated inbox in the product's colours; « Me connecter » is a plain `<a>` to the
   real verify URL.
3. Better Auth verifies, sets the session cookie and redirects to GET `[app]/signup/complete/route.ts`, which reads
   the session, `grantSignupBonus`, `after(track({ type: "signup", userId, anonymousId }))`, redirects to
   `/${slug}/tool` (fresh load: balance up to date).
4. Expired or reused link → `/${slug}/signup?error=INVALID_TOKEN` → message + « Recevoir un nouveau lien ».

## Orchestrator decisions (binding)

1. Track `signup` on every completed sign-in through this flow; deduping `signup` per (product, user) is done by the
   orchestrator as a TRACKING follow-up in the body of `track()` (signature unchanged), not here.
2. Resend: the expired page asks for the email again (no email in URLs or cookies).
3. Follow-ups after merge are the orchestrator's: drop the `/signup` `as Route` casts in `tool-form.tsx` and
   `header-balance.tsx`; update `e2e/tool.spec.ts` notes; relay the raw Better Auth endpoint bypassing
   `guardRequest` to SECURITY; SA-07's anonymous journey un-fixme.
4. Neither page checks `killed` (SA-08's layout does).

## Frozen inputs (consumed, never modified)

`signupInputSchema` `lib/schemas/inputs.ts:32-35`; `slugSchema`; `guardRequest` `lib/security.ts:9-13` (stub);
`getLatestMagicLink` `lib/dal/magic-link.ts:19-27`; `grantSignupBonus` `lib/dal/credits.ts:228-251` (session-checked,
idempotent `signup_bonus:${user}:${product}`); `track` `lib/dal/events.ts:36-58`; `ANONYMOUS_ID_COOKIE`,
`readAnonymousId`; `getSession`; `getProduct`; `auth` `lib/auth.ts:18-58`; `RouteModal`. Better Auth 1.7.6
magic-link: expired and reused tokens both give `error=INVALID_TOKEN`; links expire after 300 s; built-in 5/60 s limit.

## Patterns to Mirror

| Category | Source |
|---|---|
| Intercepted modal page + test | `app/(products)/[app]/@modal/(.)pricing/page.tsx:13-25`, `page.test.tsx:12-39,65-93` |
| Full page | `app/(products)/[app]/pricing/page.tsx:11-26` |
| `searchParams` under Cache Components | `app/(products)/[app]/history/page.tsx:15-29` |
| Server Action + Better Auth + test | `app/(backoffice)/admin/login/_actions.ts:13-39`, `_actions.test.ts:11-52` |
| `useActionState` form + test | `admin/login/_components/login-form.tsx:11-33`, `.test.tsx:7-80` |
| Anonymous cookie + `after(track)` + test mocks | `app/(products)/[app]/api/generate/route.ts:21,86-89,156-173`, `route.test.ts:9-61,101-104` |
| Fresh user + private product | `lib/dal/credits.test.ts:23-80` |
| Magic link on the real DB | `lib/auth.test.ts:88-103`, `e2e/admin-auth.spec.ts:61-96` |
| fr/en parity | `messages/pricing.test.ts:8-16` |

## Design decisions

1. Bonus and event only in `complete/route.ts`, after `getSession()` (both check the session).
2. `SignupState = { status: "idle" } | { status: "error"; error: "invalid_email" | "rate_limited" | "bot" |
   "unexpected" } | { status: "sent"; email: string; magicLinkUrl: string | null }`; errors are message keys
   translated on the client.
3. `magicLinkUrl` relative (`pathname + search`).
4. Admin/owner email → no outbox row → `magicLinkUrl: null` → empty inbox, same response otherwise.
5. Any `error` search param → one « lien expiré ou déjà utilisé » message, never Better Auth's text.
6. `SignupFlow` (`'use client'`) shared by page and modal: form, error alert, inbox, empty inbox, expired.
7. Complete handler: slug + product (missing/killed → 404) → session (none → redirect to `/signup`) →
   `await grantSignupBonus` (errors propagate) → anonymous id → `after(async () => { await track(...) })` → redirect
   `/tool`.
8. `signup/page.tsx`: static shell + `<Suspense>` around `SignupPanel` (awaits `searchParams`);
   `@modal/(.)signup/page.tsx`: `<RouteModal>` + `SignupFlow`.
9. fr/en parity test at `app/(products)/[app]/signup/auth-messages.test.ts`.

## Files to Change (all inside Périmètre)

`messages/{fr,en}/auth.json`; `[app]/signup/auth-messages.test.ts`; `[app]/signup/_actions.ts` + test;
`[app]/signup/complete/route.ts` + test; `[app]/signup/_components/signup-flow.tsx` + test;
`[app]/signup/_components/signup-panel.tsx` + test; `[app]/signup/page.tsx` + test; `[app]/@modal/(.)signup/page.tsx`
+ test; `e2e/signup.spec.ts` (not run).

## Tasks

Red → green, `pnpm vitest run <file>`, commit and push `feat(auth): …`. Shared DB: fresh emails, private product
copied from lettre-pro's schema-valid config, full cleanup (outbox, verifications, users, balances, credit_transactions,
events, product_versions, products); never mutate seeded users.

1. `auth.json` fr/en + parity.
2. Invalid email / slug → error before the guard, nothing sent.
3. Guard refusal → its key, nothing sent; guard called once with "signup" before `signInMagicLink`.
4. Happy path: relative verify URL, callback URLs, `getLatestMagicLink` once with the parsed email; admin email →
   `null`; generic send failure → logged `[signup]`, `unexpected`.
5. Complete handler (unit: no session, with session, cookie present/tampered, track after grant, unknown/killed slug;
   integration: GET twice → balance 3, one `signup_bonus` row, one `signup` event with the anonymous id).
6. `SignupFlow` form → inbox (fr and en).
7. `SignupFlow` expired state and resend.
8. Full page + `SignupPanel`; typecheck.
9. Intercepted modal.
10. `e2e/signup.spec.ts` (written, not run).
11. Real-page check on `next dev` (free port), `pnpm build`, `pnpm check`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bonus/track before the session exists | Certain if done wrong | Only in `complete/route.ts`; no-session test |
| Duplicate `signup` events on re-login | High | Decision 1 (TRACKING follow-up) |
| Raw Better Auth endpoint not behind `guardRequest` | Medium | Outbox only; built-in limit; relayed to SECURITY |
| `BETTER_AUTH_URL` ≠ serving origin | Medium | Relative URL |
| Expired and reused links identical | Certain | One message |
| `searchParams` outside `<Suspense>` | Medium | `SignupPanel`; `pnpm build` |

## Acceptance

- [ ] Bullet 1 (modal on the tool, full page direct): Tasks 8, 9, 10
- [ ] Bullet 2 (email → guard → inbox → « Me connecter »): Tasks 2, 3, 4, 6, 10
- [ ] Bullet 3 (+3 once, signup linked to anonymous_id, back to the tool): Tasks 5, 10
- [ ] Bullet 4 (expired → message and resend): Tasks 7, 8, 10
- [ ] fr/en parity; `pnpm build`, `pnpm check` green; no frozen contract touched; PR title `feat(auth): SA-03 magic-link signup with simulated inbox`
