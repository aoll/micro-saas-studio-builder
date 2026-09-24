import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { accounts, users } from "../lib/db/auth-schema";
import { SEED_ADMIN } from "../scripts/seed";

// Walking skeleton journeys (specs/SETUP-skeleton.md). Runs against the
// webServer built by playwright.config.ts: migrated, seeded, AI_MODE=mock.

test("/demo shows the product name", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.locator("h1")).toHaveText("demo");
});

test("/admin without a session ends on /admin/login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("the seeded admin can sign in and reach /admin", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(SEED_ADMIN.email)).toBeVisible();
});

test("a role=user account stays on /admin/login with an error", async ({ page }) => {
  const email = `plain-user-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { users, accounts } });
  try {
    const userId = randomUUID();
    await db.insert(users).values({ id: userId, name: "Plain user", email, role: "user" });
    await db.insert(accounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(password),
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("alert")).toBeVisible();
});
