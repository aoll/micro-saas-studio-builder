# Plan: BO-01 · Connexion admin

**Source spec**: specs/BO-01-connexion.md
**Complexity**: Small. SETUP built the working flow and CONTRACT-ui the sign-out button. BO-01 adds the mockup UI,
tests locking each acceptance bullet, a guard-coverage test for every admin page, and the E2E journey.

## Summary

SETUP shipped a working, unstyled `/admin/login`: a `login` Server Action parsing with `adminLoginSchema`, one generic
error, infrastructure errors logged, the admin-only password hook in `lib/auth.ts`. `getSession()` / `requireAdmin()`
are frozen; CONTRACT-ui's `SignOutButton` is tested. BO-01 adds, without changing any contract: the page and form
restyled to `specs/mockups/BO-01.png` with shadcn `Card` / `Input` / `Label` / `Button`; tests proving the error never
names the faulty field and no credentials appear; a test failing as soon as an `/admin` page does not call
`requireAdmin()`; `e2e/admin-auth.spec.ts` (written now, run in the E2E phase).

## Orchestrator decisions (binding)

1. The demo-prefill button of the mockup and docs/02 is **not built**: spec bullet 2 (empty fields, credentials never
   shown) wins. Record the departure in the PR body.
2. The guard-coverage test goes to `app/(backoffice)/admin/require-admin-coverage.test.ts` (accepted extension: it
   checks all of `admin/**`, so it lives at that level). The orchestrator tells every spec adding an admin page to call
   `await requireAdmin()` in its `page.tsx`.

## Requirements (acceptance bullets → success criteria)

1. Wrong credentials → the exact same message for a wrong password, an unknown email and a role=user account; it names
   neither field.
2. Both inputs render empty; no "Accès démo" button; the page contains no seeded email or password.
3. Every `admin/**/page.tsx` except `login/` imports and calls `requireAdmin()`; `login/page.tsx` never does; a real
   role=user session opening `/admin` lands on `/admin/login` (guard already covered by `lib/dal/session.test.ts:106-119`).
4. Sign-out returns to `/admin/login` (unit: `components/backoffice/sign-out-button.test.tsx`; BO-01 adds the E2E).

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Form | `app/(backoffice)/admin/login/_components/login-form.tsx:1-27` | `"use client"` only on the form leaf, `useActionState(login, {})`, `pending` disables the button |
| Errors | `app/(backoffice)/admin/login/_actions.ts:11-38` | One `GENERIC_ERROR = "Identifiants invalides"`; `console.error` for non-`APIError`; `redirect("/admin")` outside the try |
| Integration tests | `app/(backoffice)/admin/login/_actions.test.ts:11-52` | `RedirectMarker`, mocked `next/headers`, unique `randomUUID()` emails cleaned in `afterAll`, `SEED_ADMIN` from `@/scripts/seed` |
| Component tests | `components/backoffice/sign-out-button.test.tsx:1-24` | jsdom docblock, `vi.hoisted` mocks, `render` from RTL, `screen` / `fireEvent` from `@testing-library/dom`, `afterEach(cleanup)`; implementations set inside each test (Vitest 5 resets mocks) |
| Guarded page | `app/(backoffice)/admin/page.tsx:1-18` | `await requireAdmin()` inside a component under `<Suspense>` in the page file |
| E2E | `e2e/skeleton.spec.ts:33-59` | Direct Drizzle client via `requireDatabaseUrl()`, `getByLabel("Email")`, `getByLabel("Mot de passe")`, `getByRole("button", { name: "Se connecter" })`, `getByRole("alert")` |

## Files to Change

| File | Action | Why |
|---|---|---|
| `app/(backoffice)/admin/login/_actions.test.ts` | UPDATE (tests added only) | Bullet 1 |
| `app/(backoffice)/admin/login/_actions.ts` | UNCHANGED (expected) | Touched only if Task 1 turns red |
| `app/(backoffice)/admin/login/_components/login-form.tsx` + `login-form.test.tsx` | UPDATE / CREATE | Bullets 1–2 |
| `app/(backoffice)/admin/login/page.tsx` + `page.test.tsx` | UPDATE / CREATE | Bullet 2 + mockup |
| `app/(backoffice)/admin/require-admin-coverage.test.ts` | CREATE (decision 2) | Bullet 3 |
| `e2e/admin-auth.spec.ts` | CREATE | Bullets 1–4 end to end (E2E phase) |

Unchanged: `lib/dal/session.ts`, `lib/auth.ts`, `lib/schemas/admin-login.ts`, `components/backoffice/**`,
`app/(backoffice)/layout.tsx`, `app/(backoffice)/admin/page.tsx`, `e2e/skeleton.spec.ts`.

## Tasks

Each task: red → green, `pnpm vitest run "<file>"`, commit and push (`feat(bo): …` / `test(bo): …`), `pnpm exec knip`.

### Task 1: the error never names the field (bullet 1, action level)
Append to `_actions.test.ts` (no existing case changed): `"returns the same generic error for an unknown email"`;
`"never names the faulty field"` — errors for a wrong password, an unknown email and invalid input (`"not-an-email"`)
are strictly equal and do not match `/email|mot de passe|password/i`. Characterization tests: if green at once, commit
`test(bo): lock BO-01 generic login error (already satisfied by SETUP)` saying so. Worktree DB must be migrated and seeded.

### Task 2: login form (bullets 1–2)
`login-form.test.tsx` (jsdom; `vi.mock("../_actions", () => ({ login }))` with `vi.hoisted`): Email is `type="email"`,
`name="email"`, `autocomplete="email"`, `required`, `value === ""`, no placeholder; Mot de passe `type="password"`,
`autocomplete="current-password"`, `required`, empty; exactly one button "Se connecter", no `/accès démo/i`; a resolved
`{ error }` shows `role="alert"` with the text and `login` received the typed values; a pending action disables the
button. Rewrite with `Label` / `Input` / `Button` (`w-full`), `<form className="grid gap-4">`, error
`<p role="alert" className="text-sm text-destructive">`; keep the exact labels (skeleton E2E relies on them). Fallback if
jsdom does not run the action on click: `fireEvent.submit(form)`.

### Task 3: login page (bullet 2)
`page.test.tsx` (jsdom, `vi.mock("./_actions")`): `h1` contains "SaaS Studio", "Connexion au backoffice" present,
`innerHTML` contains none of `SEED_ADMIN` / `SEED_OWNER` email or password, every input empty. Page:
`<main className="grid min-h-dvh place-items-center bg-muted p-4">`, `<Card className="w-full max-w-md">`, header with
`<h1><span aria-hidden="true">◆</span> SaaS Studio</h1>` and the subtitle, `<CardContent><LoginForm/></CardContent>`.
Server Component, no session read (stays static, never loops). If importing `@/scripts/seed` fails in jsdom, use node
env and `renderToStaticMarkup`. Then `pnpm build`.

### Task 4: guard coverage (bullet 3)
`app/(backoffice)/admin/require-admin-coverage.test.ts` (node): list `admin/**/page.tsx` with
`fs.readdirSync(dir, { recursive: true })` (no glob: parentheses in the path); `guarded` = pages not under `login/`;
`it("finds the admin pages")` (non-vacuous); `it.each(guarded)` asserts the `requireAdmin` import from
`@/lib/dal/session` and `await requireAdmin()`; `login/page.tsx` never mentions `requireAdmin`. Commit
`test(bo): every /admin page must call requireAdmin() (BO-01 bullet 3)`.

### Task 5: `e2e/admin-auth.spec.ts` (written, not run)
Journeys: (1) fields empty, no credentials in `page.content()`, no "Accès démo"; (2) wrong password and unknown email
give the same alert; (3) admin sign-in → `/admin`, "Se déconnecter" → `/admin/login`, `/admin` stays closed; (4)
role=user redirected: POST `/api/auth/sign-in/magic-link` from the page context (same origin), read the newest
`magic_link_outbox.url` for that email, `goto(url)`, expect `/admin/login`; cleanup user and outbox rows in `finally`;
(5) every static admin page without a session → `/admin/login`.

### Task 6: full validation
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm test`, `pnpm build`, `pnpm check`. Fix in
code, never in protected configs.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mockup shows a demo-prefill button the spec forbids | Certain | Decision 1 |
| Parallel specs add admin pages that rely on a layout for the guard | Medium | Decision 2; the coverage test catches it on merge |
| Regex check is text-based | Low | No barrels; failures name the page |
| React 19 form actions in jsdom | Medium | `findByRole` / `vi.waitFor`; fallback `fireEvent.submit` |
| React 19 resets the uncontrolled form after an error | Certain | Accepted (spec does not ask to keep the value) |
| Magic-link E2E assumptions (origin check, auto sign-up) | Medium | Same-origin POST; fallback insert a role=user user first; E2E phase only |
| Label/button text change breaks `e2e/skeleton.spec.ts` | Low | Keep exact texts |
| Brute force on the login form | Low | SECURITY spec (`guardRequest`); noted in the PR |

## Acceptance

- [ ] Bullet 1: `_actions.test.ts`, `login-form.test.tsx`, E2E journey 2
- [ ] Bullet 2: `login-form.test.tsx`, `page.test.tsx`, E2E journey 1
- [ ] Bullet 3: `require-admin-coverage.test.ts`, `lib/dal/session.test.ts`, E2E journeys 4 and 5
- [ ] Bullet 4: `sign-out-button.test.tsx`, E2E journey 3
- [ ] No SETUP test weakened; `pnpm check` and `pnpm build` green; no frozen contract or protected config changed
- [ ] PR title: `feat(bo): BO-01 admin sign-in screen`
