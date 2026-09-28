import { expect, test } from "@playwright/test";

// I18N-MARKETING (specs/I18N-MARKETING.md). Not run yet
// (docs/11-implementation.md's E2E phase): playwright.config.ts's webServer
// builds and starts against the seeded database (lettre-pro, fr — used
// below as a product page that must never go through the marketing
// middleware, R4). Real next-intl behaviour (Accept-Language detection,
// the NEXT_LOCALE cookie, next-intl's own redirect and cookie-sync logic)
// only runs through a real, built Next.js server here: proxy.test.ts's
// next-intl/middleware mock (its own commit explains why) exercises
// proxy.ts's own logic against a faithful reimplementation of that
// contract, not the real one.

// A representative sample of French marketing copy (messages/fr/marketing.json
// and making-of.json): none of it may appear on the equivalent English page.
// Same pattern as e2e/seo.spec.ts's FR_DENYLIST for product pages. Split by
// page since the two pages don't share content (a making-of-only string
// would never appear on the landing, and checking it there would be
// meaningless — not a stronger assertion).
const FR_LANDING_DENYLIST = [
  "démo",
  "backoffice",
  "Voir un produit en direct",
  "Ouvrir le backoffice admin",
  "Découvrir le making-of",
  "Le backoffice en images",
  "Pourquoi ce projet",
  "Les produits du studio",
];

const FR_MAKING_OF_DENYLIST = [
  "Retour à la démo",
  "Le process",
  "Implémente une spec, test d'abord",
  "agents lancés",
  "constat restant",
];

test.describe("Marketing locale detection", () => {
  test.describe("en-US lands on /en", () => {
    test.use({ locale: "en-US" });

    test("/ redirects to /en", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/en$/);
    });

    test("/making-of redirects to /en/making-of", async ({ page }) => {
      await page.goto("/making-of");
      await expect(page).toHaveURL(/\/en\/making-of$/);
    });
  });

  test.describe("de-DE (unsupported) stays on the French default", () => {
    test.use({ locale: "de-DE" });

    test("/ is not redirected", async ({ page }) => {
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    });
  });

  test.describe("fr-FR stays on the French default", () => {
    test.use({ locale: "fr-FR" });

    test("/ is not redirected", async ({ page }) => {
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/$/);
    });

    test("/making-of stays French", async ({ page }) => {
      await page.goto("/making-of");
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("258 agents IA");
      const body = await page.locator("body").innerText();
      for (const fr of FR_MAKING_OF_DENYLIST) expect(body).toContain(fr);
    });
  });
});

test.describe("English pages (/en, /en/making-of)", () => {
  test.use({ locale: "en-US" });

  test("/en responds 200, entirely in English", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A back-office to generate and run AI micro-SaaS products in minutes",
    );
    const body = await page.locator("body").innerText();
    for (const fr of FR_LANDING_DENYLIST) expect(body).not.toContain(fr);
  });

  test("/en/making-of responds 200, entirely in English (including run.ts labels)", async ({ page }) => {
    const response = await page.goto("/en/making-of");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("258 AI agents, 30 hours");
    // Figure labels (KEY_FIGURES ids), a process step's who, a role's job,
    // and a QA lane's translated suffix: run.ts's own data, translated.
    await expect(page.getByText("agents launched")).toBeVisible();
    await expect(page.getByText("tdd-guide, red then green")).toBeVisible();
    await expect(page.getByText("Implements a spec, test-first")).toBeVisible();
    await expect(page.getByTitle(/QA · P1-B3 Payment/)).toHaveCount(1);
    const body = await page.locator("body").innerText();
    for (const fr of FR_MAKING_OF_DENYLIST) expect(body).not.toContain(fr);
  });
});

test.describe("Switching locale persists across visits", () => {
  test.describe("starting French (fr-FR)", () => {
    test.use({ locale: "fr-FR" });

    test("click English, lands on /en with a NEXT_LOCALE=en cookie; a fresh / visit stays on /en", async ({
      page,
      context,
    }) => {
      await page.goto("/");
      await page.getByRole("link", { name: "English" }).click();
      await expect(page).toHaveURL(/\/en$/);
      const cookies = await context.cookies();
      expect(cookies.find((cookie) => cookie.name === "NEXT_LOCALE")?.value).toBe("en");

      await page.goto("/");
      await expect(page).toHaveURL(/\/en$/);
    });
  });

  test.describe("starting English (en-US)", () => {
    test.use({ locale: "en-US" });

    test("on /en/making-of, click Français, lands on /making-of with NEXT_LOCALE=fr; reload / stays French", async ({
      page,
      context,
    }) => {
      await page.goto("/en/making-of");
      await page.getByRole("link", { name: "Français" }).click();
      await expect(page).toHaveURL(/\/making-of$/);
      const cookies = await context.cookies();
      expect(cookies.find((cookie) => cookie.name === "NEXT_LOCALE")?.value).toBe("fr");

      await page.goto("/");
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    });

    test("internal links keep the locale: from /en, the making-of link goes to /en/making-of", async ({ page }) => {
      await page.goto("/en");
      await page.getByRole("link", { name: "Discover the making-of" }).click();
      await expect(page).toHaveURL(/\/en\/making-of$/);
    });
  });
});

test.describe("R4: product pages never go through the marketing middleware", () => {
  test.use({ locale: "en-US" });

  test("/lettre-pro is not redirected, keeps its own product locale, no NEXT_LOCALE cookie", async ({
    page,
    context,
  }) => {
    const response = await page.goto("/lettre-pro");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/lettre-pro$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === "NEXT_LOCALE")).toBeUndefined();
  });
});
