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
    },
    runtimeEnv: source,
    emptyStringAsUndefined: true,
  });

export const env = createAppEnv(process.env);
