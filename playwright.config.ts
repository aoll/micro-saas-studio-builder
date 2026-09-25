import { defineConfig, devices } from "@playwright/test";
// Namespace import: see the comment in drizzle.config.ts.
import * as nextEnvNs from "@next/env";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;

// The test files open their own Postgres client (seeding, cleanup) from
// DATABASE_URL: load .env.local the way Next.js does, like drizzle.config.ts.
loadEnvConfig(process.cwd());

const PORT = process.env.E2E_PORT ?? "3100";
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm db:migrate && pnpm db:seed && pnpm build && pnpm start --port ${PORT}`,
    // Readiness probe: Playwright waits for a 2xx/3xx; `/` has no route in this
    // app (404), so probe a route that always exists.
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      AI_MODE: "mock",
      BETTER_AUTH_URL: baseURL,
    },
  },
});
