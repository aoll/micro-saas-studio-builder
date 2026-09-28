import { expect, test } from "@playwright/test";
import { SEED_ADMIN } from "../scripts/seed";

// I18N-BACKOFFICE (specs/I18N-BACKOFFICE.md), run in the E2E phase against
// the webServer built by playwright.config.ts (migrated, seeded,
// AI_MODE=mock). A fr/en switcher in the backoffice shell, no automatic
// detection (bullet 3), no /en URL prefix, and the product branch of
// i18n/request.ts stays unaffected (bullet's "sans changer la branche
// produit").

async function signInAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("I18N-BACKOFFICE · sélecteur de langue", () => {
  test("default: a browser set to English still gets the French backoffice, no cookie", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    try {
      await page.goto("/admin/login");
      expect(await page.locator("html").getAttribute("lang")).toBe("fr");
      expect(await page.getByRole("button", { name: "Français" }).getAttribute("aria-pressed")).toBe("true");

      await signInAsAdmin(page);
      expect(await page.locator("html").getAttribute("lang")).toBe("fr");
      expect(await page.getByRole("button", { name: "Français" }).getAttribute("aria-pressed")).toBe("true");
    } finally {
      await context.close();
    }
  });

  test("switching to EN sets the cookie, no reload, no URL change, session stays intact", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await signInAsAdmin(page);
      await page.evaluate(() => {
        (window as unknown as { __noReload?: number }).__noReload = 1;
      });

      await page.getByRole("button", { name: "English" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveURL(/\/admin$/);
      expect(await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1);
      // The session is intact: the sidebar (session-gated) is still there.
      await expect(page.getByRole("link", { name: "Portefeuille" })).toBeVisible();

      const cookies = await context.cookies();
      const adminLocale = cookies.find((cookie) => cookie.name === "admin_locale");
      expect(adminLocale?.value).toBe("en");
      expect(adminLocale?.path).toBe("/admin");

      await page.goto("/admin/settings");
      expect(await page.locator("html").getAttribute("lang")).toBe("en");

      await page.reload();
      expect(await page.locator("html").getAttribute("lang")).toBe("en");

      await page.getByRole("button", { name: "Français" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    } finally {
      await context.close();
    }
  });

  test("the admin_locale cookie never changes a product landing's own locale", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await signInAsAdmin(page);
      await page.getByRole("button", { name: "English" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");

      await page.goto("/lettre-pro");
      expect(await page.locator("html").getAttribute("lang")).toBe("fr");
    } finally {
      await context.close();
    }
  });
});
