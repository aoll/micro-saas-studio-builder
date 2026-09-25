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
//
// The anonymous visitor's requests (no session cookie at all) get a real
// HTTP status from proxy.ts's optimistic guard: fully covered below. A
// signed-in session with the wrong role does not — see the comment on
// "QA1-P1-B12 · signed-in visitors" for why, verified against a real
// production build.

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
  // Adjusted from a real-404 expectation (own commit; see its message for
  // why): verified against a production build (pnpm build + pnpm start,
  // two distinct real sessions) that a signed-in non-owner still gets HTTP
  // 200 here, not 404. Next's own docs say so directly (`not-found.md` ›
  // "Calling notFound() after streaming has started": "With Cache
  // Components, every dynamic route streams a static shell first, so run
  // that check in proxy instead") — and proxy.ts's optimistic guard
  // (phase 1) cannot do that role check (specs/qa/QA1-P1-B12-statut-http.md,
  // docs/04-nextjs.md: cookie presence only, never the role). What phase 2
  // still fixes: the content is French ("Page introuvable"), not the
  // framework's English default, and the ops page's own content (heading,
  // reset button) never renders for a non-owner.
  test("the seeded admin (not owner) never sees the ops content; the response body is French", async ({ page }) => {
    await signInAs(page.request, SEED_ADMIN);
    const response = await page.request.get("/admin/ops", { maxRedirects: 0 });
    const body = await response.text();
    expect(body).not.toContain("Réinitialiser la démo");
    expect(body).not.toContain("Supprime les produits créés par les visiteurs");
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

  // Same adjustment as the seeded-admin test above, same reason.
  test("a role=user session (signed in through a magic link) also never sees the ops content", async ({
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
      const body = await response.text();
      expect(body).not.toContain("Réinitialiser la démo");
      expect(body).not.toContain("Supprime les produits créés par les visiteurs");
      expect(body).toContain("Page introuvable");
    } finally {
      await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
      await db.delete(users).where(eq(users.id, userId));
      await sql.end({ timeout: 5 });
    }
  });
});
