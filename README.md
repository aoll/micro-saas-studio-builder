# micro-saas-studio-builder

## Run locally

```bash
pnpm install
pnpm tsx scripts/worktree-db.ts ensure --seed
pnpm dev
```

Runs in `AI_MODE=mock` by default: no AI Gateway key is needed. Open
`http://localhost:3000/lettre-pro` for the seeded product (LettrePro) and
`http://localhost:3000/admin/login` for the backoffice (seeded admin account,
see `scripts/seed.ts`).

## Security: BotID and the generation rate limit

Every generation, signup, purchase and "Tester le prompt" request goes
through `guardRequest(kind)` (`lib/security.ts`): a BotID check first, then
— for `generate` only — a Postgres rate limit.

**BotID.** `checkBotId()` (server) pairs with `initBotId()`
(`instrumentation-client.ts`, run on every page). BotID is a Vercel product
(docs/06-vercel.md): the Basic tier is free on every plan, no extra setup
beyond `withBotId` in `next.config.ts` and the protect list in
`instrumentation-client.ts`. **Off Vercel** — a self-hosted deployment, or
`next build && next start` run locally (as `pnpm test:e2e`'s `webServer`
does) — `checkBotId()` behaves differently depending on `NODE_ENV`:

- `next dev` sets `NODE_ENV=development`: BotID's own dev-mode bypass kicks
  in (`developmentOptions.isDevelopment` defaults to
  `NODE_ENV !== 'production'`), logs a `[Dev Only]` warning, and returns
  "human" without calling any network endpoint. Local development is
  unaffected.
- `next build` / `next start` set `NODE_ENV=production` (Next.js enforces
  this unless `NODE_ENV` is already set): BotID then takes its real path,
  which calls Vercel's bot-protection API and requires a
  `VERCEL_OIDC_TOKEN` — only present when actually deployed on Vercel (or
  linked locally via `vercel dev`/`vercel env pull`). Without it,
  `checkBotId()` throws. `guardRequest` has no try/catch by design (it
  neither fails open nor fails closed — see `lib/security.ts`), so that
  error propagates.

This is a known gap for a fully local, production-mode run (notably
`pnpm test:e2e`, which builds and starts the app on `localhost` without a
Vercel OIDC token): a real BotID check cannot succeed there. Fixing it (for
example, always forcing `developmentOptions.isDevelopment` for that one
local scenario) needs a decision on where that flag comes from without
`lib/security.ts` branching on `process.env` itself, left as a follow-up.
Deployed previews and production, and local `next dev`, are not affected.

**Postgres rate limit.** `GENERATION_RATE_LIMIT_PER_MINUTE` (`lib/env.ts`,
default `10`) caps `generate` requests per signed-in user and per hashed IP
(`ip_hash`), counted over a rolling 60 s window anchored on the database
clock (`lib/dal/generations.ts`'s `countRecentGenerations`). Over the limit,
`guardRequest` returns `{ ok: false, reason: "rate_limited" }` and the route
answers `429`. Set it in `.env.local` (or the deployment's environment) to
change it; no restart-free way to change it, unlike `decision_thresholds`.

**AI Gateway budget cap.** The Postgres rate limit only slows down abuse
against *this* app; it does not cap what a determined attacker could still
spend in tokens before hitting it, or spending outside the app entirely with
a leaked key. Set a spending limit on the AI Gateway itself: Vercel
dashboard → **AI Gateway** → **Settings** → **Budgets**, one per team,
project, API key or member (docs/05-ia.md). This is a soft cap — it stops
new spend once crossed, it does not guarantee the exact dollar amount never
gets exceeded — and it only covers spend billed *through* the Gateway, not
calls made with your own provider keys (BYOK). That is why the Postgres
limit stays even with a budget configured: they cover different failure
modes (an abusive client vs. a runaway bill).

**Self-hosting (Fly.io or another non-Vercel host, docs/06-vercel.md).**
`X-Forwarded-For` is only as trustworthy as whatever sits in front of Node.
On Vercel, the edge network sets/overwrites this header itself, so a client
cannot spoof it — `clientIp()` (`lib/rate-limit.ts`, mirrored by
`api/generate/route.ts`'s private copy) trusts its first hop. Off Vercel,
your own reverse proxy **must strip any inbound `X-Forwarded-For` before
appending the real peer address**, or a client can simply set that header
itself to dodge the per-IP rate limit (the per-user part is unaffected,
since it comes from the session).
