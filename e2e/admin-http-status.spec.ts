import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { magicLinkOutbox, users } from "../lib/db/auth-schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN, SEED_OWNER } from "../scripts/seed";

// QA1-P1-B12 (.claude/qa/reports/2026-09-25-full.md, specs/qa/QA1-P1-B12-statut-http.md).
// Runs against the webServer built by playwright.config.ts: migrated,
// seeded, AI_MODE=mock. `page.request` is used with `maxRedirects: 0` so the
// real HTTP status is observed instead of the one Playwright's `page.goto`
// reports after following the redirect (or the streamed-200 the app was
// serving under the HTTP contract's Suspense fallback, docs/04-nextjs.md).

test.describe("QA1-P1-B12 · anonymous visitor", () => {
  test("GET /admin/ops responds 404 in French, not a 200 with NEXT_HTTP_ERROR_FALLBACK", async ({ page }) => {
    const response = await page.request.get("/admin/ops", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    const body = await response.text();
    expect(body).not.toContain("NEXT_HTTP_ERROR_FALLBACK");
    expect(body).toContain("Page introuvable");
  });

  test("GET /admin responds a real redirect (307/308) to /admin/login, without the portfolio shell", async ({
    page,
  }) => {
    const response = await page.request.get("/admin", { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toMatch(/\/admin\/login$/);
    const body = await response.text();
    expect(body).not.toContain("Portefeuille");
    expect(body).not.toContain("Nouveau produit");
  });
});

async function signInAs(
  request: import("@playwright/test").APIRequestContext,
  credential: { email: string; password: string },
): Promise<void> {
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email: credential.email, password: credential.password },
  });
  expect(response.ok()).toBe(true);
}

test.describe("QA1-P1-B12 · signed-in visitors", () => {
  test("the seeded admin (not owner) gets a real 404 on /admin/ops, in French", async ({ page }) => {
    await signInAs(page.request, SEED_ADMIN);
    const response = await page.request.get("/admin/ops", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    const body = await response.text();
    expect(body).not.toContain("NEXT_HTTP_ERROR_FALLBACK");
    expect(body).not.toContain("This page could not be found");
    expect(body).toContain("Page introuvable");
  });

  test("the owner gets a real 200 on /admin/ops with the ops heading", async ({ page }) => {
    await signInAs(page.request, SEED_OWNER);
    const response = await page.request.get("/admin/ops", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Opérations");
  });

  test("a signed-in admin gets a real 200 on /admin", async ({ page }) => {
    await signInAs(page.request, SEED_ADMIN);
    const response = await page.request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });

  test("a role=user session (signed in through a magic link) also gets a real 404 on /admin/ops", async ({
    page,
    baseURL,
  }) => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { users, magicLinkOutbox } });
    const email = `plain-user-b12-${randomUUID()}@example.test`;
    const userId = randomUUID();

    try {
      await db.insert(users).values({ id: userId, name: "Plain user", email, role: "user" });

      const signInResponse = await page.request.post(`${baseURL}/api/auth/sign-in/magic-link`, {
        data: { email, callbackURL: "/admin" },
      });
      expect(signInResponse.ok()).toBe(true);

      const [outboxRow] = await db
        .select()
        .from(magicLinkOutbox)
        .where(eq(magicLinkOutbox.email, email))
        .orderBy(desc(magicLinkOutbox.createdAt))
        .limit(1);
      if (!outboxRow) throw new Error("No magic link recorded for the role=user account");
      await page.request.get(outboxRow.url);

      const response = await page.request.get("/admin/ops", { maxRedirects: 0 });
      expect(response.status()).toBe(404);
      const body = await response.text();
      expect(body).not.toContain("NEXT_HTTP_ERROR_FALLBACK");
      expect(body).not.toContain("This page could not be found");
      expect(body).toContain("Page introuvable");
    } finally {
      await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
      await db.delete(users).where(eq(users.id, userId));
      await sql.end({ timeout: 5 });
    }
  });
});
