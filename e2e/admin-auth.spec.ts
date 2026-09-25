import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { magicLinkOutbox, users } from "../lib/db/auth-schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// BO-01 · Connexion admin (specs/BO-01-connexion.md), written now, run in the
// E2E phase against the webServer built by playwright.config.ts (migrated,
// seeded, AI_MODE=mock).

test.describe("BO-01 · Connexion admin", () => {
  test("the login page shows empty fields, no seeded credentials, no demo-prefill button", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByLabel("Mot de passe")).toHaveValue("");
    await expect(page.getByRole("button", { name: /accès démo/i })).toHaveCount(0);

    const content = await page.content();
    expect(content).not.toContain(SEED_ADMIN.email);
    expect(content).not.toContain(SEED_ADMIN.password);
  });

  test("a wrong password and an unknown email show the exact same generic error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SEED_ADMIN.email);
    await page.getByLabel("Mot de passe").fill("not-the-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    const wrongPasswordError = await page.getByRole("alert").textContent();

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(`unknown-${randomUUID()}@example.test`);
    await page.getByLabel("Mot de passe").fill("whatever-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    const unknownEmailError = await page.getByRole("alert").textContent();

    expect(wrongPasswordError).toBeTruthy();
    expect(wrongPasswordError).toBe(unknownEmailError);
    expect(wrongPasswordError?.toLowerCase()).not.toMatch(/email|mot de passe|password/);
  });

  test("the seeded admin signs in, reaches /admin, then signs out back to /admin/login", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SEED_ADMIN.email);
    await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    // The session is really gone: /admin stays closed.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("a role=user account signed in through a magic link is redirected away from /admin", async ({
    page,
    baseURL,
  }) => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { users, magicLinkOutbox } });
    const email = `plain-user-${randomUUID()}@example.test`;
    const userId = randomUUID();

    try {
      await db.insert(users).values({ id: userId, name: "Plain user", email, role: "user" });

      const response = await page.request.post(`${baseURL}/api/auth/sign-in/magic-link`, {
        data: { email, callbackURL: "/admin" },
      });
      expect(response.ok()).toBe(true);

      const [outboxRow] = await db
        .select()
        .from(magicLinkOutbox)
        .where(eq(magicLinkOutbox.email, email))
        .orderBy(desc(magicLinkOutbox.createdAt))
        .limit(1);
      if (!outboxRow) throw new Error("No magic link recorded for the role=user account");

      await page.goto(outboxRow.url);
      await expect(page).toHaveURL(/\/admin\/login$/);

      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/login$/);
    } finally {
      await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
      await db.delete(users).where(eq(users.id, userId));
      await sql.end({ timeout: 5 });
    }
  });

  test("every static admin page without a session redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
