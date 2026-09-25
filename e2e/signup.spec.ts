import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { magicLinkOutbox, users } from "../lib/db/auth-schema";
import { requireDatabaseUrl } from "../lib/require-database-url";

// SA-03 acceptance, played end to end against /lettre-pro/signup. Not run
// yet (written now, run in the E2E phase, docs/11-implementation.md › V4
// Package): a real Playwright browser against a built+started server is
// needed for the modal (intercepting route), the redirect chain through
// Better Auth's own `/api/auth/magic-link/verify`, and the resulting
// session cookie.
//
// Notes for whoever runs this:
// - Cleans up the emails it creates (outbox rows and any user Better Auth
//   creates on first magic-link sign-in), the way e2e/admin-auth.spec.ts
//   does for its own throwaway users: never touch the seeded `lettre-pro`
//   product or its seeded users.
// - The first test needs an anonymous free generation to trigger the modal
//   (e2e/tool.spec.ts's first scenario does the same "generate once, get
//   redirected" dance) — delete this spec's `generations` rows by
//   `ip_hash` in a `beforeEach` too, so repeated runs don't exhaust the
//   anonymous limit.

test.describe("Signup (/lettre-pro/signup)", () => {
  test("the modal opens on the outil after the free generation; a direct visit shows the full page", async ({
    page,
  }) => {
    await page.goto("/lettre-pro/tool");
    await page.getByLabel("Poste visé").fill("Développeur Frontend");
    await page.getByLabel("Entreprise").fill("Dotworld");
    await page.getByLabel("Votre expérience").fill("3 ans en React et TypeScript");
    await page.getByLabel("Ton").selectOption("dynamique");
    await page.getByRole("button", { name: /Générer/ }).click();
    await expect(page.getByText(/Bonjour/)).toBeVisible();

    await page.getByRole("button", { name: "Régénérer" }).click();
    await expect(page).toHaveURL(/\/lettre-pro\/signup$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/crédits offerts/)).toBeVisible();

    // Direct navigation (refresh) to the same URL renders the full page,
    // not the modal (docs/04-nextjs.md's intercepting routes).
    await page.goto("/lettre-pro/signup");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("entering an email opens the simulated inbox, and 'Me connecter' signs in, grants +3 credits and returns to the tool", async ({
    page,
    baseURL,
  }) => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { users, magicLinkOutbox } });
    const email = `signup-e2e-${randomUUID()}@example.test`;

    try {
      await page.goto("/lettre-pro/signup");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();

      await expect(page.getByText(new RegExp(email))).toBeVisible();
      const connectLink = page.getByRole("link", { name: "Me connecter" });
      await expect(connectLink).toBeVisible();

      await connectLink.click();
      await expect(page).toHaveURL(/\/lettre-pro\/tool$/);
      await expect(page.getByText(/3 crédits/)).toBeVisible();

      const user = await db.query.users.findFirst({ where: eq(users.email, email) });
      expect(user).toBeTruthy();
    } finally {
      await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
      const user = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (user) await db.delete(users).where(eq(users.id, user.id));
      await sql.end({ timeout: 5 });
    }
  });

  test("an expired or already-used link shows a message and a resend button", async ({ page, baseURL }) => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { users } });

    // A syntactically plausible but unknown token: Better Auth's verify
    // endpoint redirects to errorCallbackURL with ?error=INVALID_TOKEN for
    // both an expired and an already-used token alike (SA-03's design
    // decision 5), so this single case covers both.
    await page.goto(
      `/api/auth/magic-link/verify?token=${randomUUID()}&callbackURL=/lettre-pro/signup/complete&errorCallbackURL=/lettre-pro/signup`,
    );

    await expect(page).toHaveURL(/\/lettre-pro\/signup\?error=INVALID_TOKEN$/);
    await expect(page.getByRole("alert")).toHaveText("Ce lien a expiré ou a déjà été utilisé.");
    await expect(page.getByRole("button", { name: "Recevoir un nouveau lien" })).toBeVisible();

    await sql.end({ timeout: 5 });
  });
});
