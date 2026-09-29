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
  // BO-01, human decision of 2026-09-28: the fields are prefilled with the
  // owner's credentials when SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are set
  // (the demo deployment), empty otherwise; the admin's never appear.
  const OWNER_PREFILL =
    process.env.SEED_OWNER_EMAIL && process.env.SEED_OWNER_PASSWORD
      ? { email: process.env.SEED_OWNER_EMAIL, password: process.env.SEED_OWNER_PASSWORD }
      : undefined;

  test("the login page prefills the owner's credentials when set, never the admin's", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByLabel("Email")).toHaveValue(OWNER_PREFILL?.email ?? "");
    await expect(page.getByLabel("Mot de passe")).toHaveValue(OWNER_PREFILL?.password ?? "");
    await expect(page.getByRole("button", { name: /accès démo/i })).toHaveCount(0);

    const content = await page.content();
    expect(content).not.toContain(SEED_ADMIN.email);
    expect(content).not.toContain(SEED_ADMIN.password);
  });

  test("the prefilled owner credentials sign in with one click", async ({ page }) => {
    test.skip(!OWNER_PREFILL, "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are not set for this run");
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin$/);
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

    // Already signed in: going back to /admin/login sends the admin
    // straight to /admin instead of showing the form again.
    await page.goto("/admin/login");
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

      // A signed-in but non-admin session still sees the login form (no
      // loop): only an admin/owner session is redirected away from it.
      await page.goto("/admin/login");
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
