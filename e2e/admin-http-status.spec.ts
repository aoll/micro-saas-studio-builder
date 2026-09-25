import { expect, test } from "@playwright/test";
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
});
