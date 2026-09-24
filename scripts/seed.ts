// Idempotent local seed: the `demo` product and the admin account used by
// the login screen (`/admin/login`). This script never imports
// `lib/db/index.ts` (`import "server-only"`) or `lib/env.ts` (which requires
// all 8 variables): it builds its own client from `DATABASE_URL` alone, like
// scripts/worktree-db.ts.
//
// Usage: pnpm tsx scripts/seed.ts (wired to `pnpm db:seed`)
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Namespace import: see the comment in drizzle.config.ts.
import * as nextEnvNs from "@next/env";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { accounts, users } from "../lib/db/auth-schema";
import { products } from "../lib/db/schema";

loadEnvConfig(process.cwd());

// Dev-only constant: the demo runs entirely locally in this spec (no
// deployment, no Neon, no Vercel). A public deployment needs a real secret;
// noted in the PR (DEMO-mode will own that).
export const SEED_ADMIN = { email: "admin@msb.local", password: "dev-admin-password-msb" };

export async function seed(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, users, accounts } });
  try {
    await db.insert(products).values({ slug: "demo", name: "demo" }).onConflictDoNothing({ target: products.slug });

    const existingAdmin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
    if (!existingAdmin) {
      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Admin",
        email: SEED_ADMIN.email,
        emailVerified: true,
        role: "admin",
      });
      await db.insert(accounts).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: await hashPassword(SEED_ADMIN.password),
      });
    }
    console.log("Seed complete: product `demo`, admin account ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Only run when executed directly (mirrors scripts/worktree-db.ts), so tests
// can import `seed()` without triggering it.
const isEntry = (): boolean => {
  try {
    return !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};
if (isEntry()) {
  seed()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
