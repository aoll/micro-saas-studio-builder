import { defineConfig } from "drizzle-kit";
import { requireDatabaseUrl } from "./lib/require-database-url";
// Namespace import: @next/env's CJS bundle defines its exports with
// Object.defineProperty getters, which different loaders (drizzle-kit's
// esbuild, tsx, Vite) unwrap inconsistently between `default` and named
// exports. A namespace import plus this fallback works under all three.
import * as nextEnvNs from "@next/env";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;

// Loads .env.local the same way Next.js does, without overriding a
// DATABASE_URL already set in the environment (worktree-db.ts sets it
// before calling `pnpm db:migrate`).
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: ["./lib/db/schema.ts", "./lib/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
});
