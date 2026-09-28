// Validated environment variables, imported by `next.config.ts`: the build
// fails if any of the 8 variables is missing or invalid. Application code
// reads `env.*`, never `process.env` directly (docs/10-tooling-dev.md).
//
// No `import "server-only"` here: `next.config.ts` (which runs outside a
// request) imports this module too.
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const createAppEnv = (source: Record<string, string | undefined>) =>
  createEnv({
    server: {
      DATABASE_URL: z.url(),
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url(),
      AI_MODE: z.enum(["mock", "live"]),
      DEMO_MODE: z.enum(["true", "false"]).transform((value) => value === "true"),
      AI_GATEWAY_API_KEY: z.string().min(1),
      BLOB_READ_WRITE_TOKEN: z.string().min(1),
      CRON_SECRET: z.string().min(1),
      // SECURITY (specs/SECURITY.md): the Postgres generation rate limit, N
      // generations per 60 s per user and per ip_hash. Optional: most local
      // and preview setups never set it.
      GENERATION_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
      // SECURITY follow-up: Vercel sets this to "1" automatically at build
      // time and at runtime; absent everywhere else. lib/security.ts reads
      // it to tell a real Vercel deployment from a local `next start` (or
      // any other non-Vercel host), since it must never branch on
      // `process.env` directly.
      VERCEL: z.string().optional(),
      // QA bypass (human decision, 2026-09-27): unset in every environment
      // by default. Set only for the duration of a QA pass against
      // `preview`/`prod` so an authorized caller can skip BotID
      // (lib/security.ts's `guardRequest`) without disabling it for anyone
      // else.
      QA_BYPASS_SECRET: z.string().optional(),
      // BO-01 (human decision, 2026-09-28): the owner account the seed
      // creates (scripts/seed.ts reads them too). When both are set,
      // /admin/login is prefilled with them to ease the demo.
      SEED_OWNER_EMAIL: z.email().optional(),
      SEED_OWNER_PASSWORD: z.string().optional(),
      // TOOLING-test-transaction: read once here instead of `process.env`
      // scattered in application code. `lib/db/index.ts` uses it to pick the
      // Postgres pool size and to decide whether `db` routes through the
      // per-test transaction; Vitest sets `NODE_ENV=test` itself (see
      // `.env.test` and `vitest.config.mts`, both untouched by this spec).
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    },
    runtimeEnv: source,
    emptyStringAsUndefined: true,
  });

export const env = createAppEnv(process.env);
