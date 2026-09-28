import { expect, test } from "@playwright/test";

// The recruiter landing at `/`, added outside the original 17 screens
// (docs/02-ecrans.md) since it is about the demo itself, not one of its
// products. Not run yet (docs/11-implementation.md's E2E phase), same
// convention as the rest of e2e/*.spec.ts. Product names come from the seed
// fixtures (fixtures/lettre-pro.config.json's `name`), same as README.md's
// own quickstart example.
//
// I18N-MARKETING (own commit, see its message): `/` now goes through
// next-intl's locale detection (proxy.ts). Playwright's default context
// locale is "en-US", which would redirect every `page.goto("/")` below to
// `/en` and fail every French assertion in this file. Pinning `fr-FR` is a
// precondition change only — it makes explicit the French browser this
// suite always assumed, nothing here weakens an assertion.
test.describe("Home (/)", () => {
  test.use({ locale: "fr-FR" });

  test("shows the hero and a way into the backoffice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const adminLink = page.getByRole("link", { name: "Ouvrir le backoffice admin" });
    await expect(adminLink).toHaveAttribute("href", "/admin/login");
  });

  test("links out to a live product", async ({ page }) => {
    await page.goto("/");
    const productLink = page.getByRole("link", { name: "LettrePro" });
    await expect(productLink).toHaveAttribute("href", "/lettre-pro");
    await productLink.click();
    await expect(page).toHaveURL(/\/lettre-pro$/);
  });

  // Screenshots from scripts/backoffice-screenshots.ts, in public/landing/.
  test("shows three backoffice screens, every image loaded", async ({ page }) => {
    await page.goto("/");
    const screens = page.getByRole("region", { name: "Le backoffice en images" }).getByRole("img");
    await expect(screens).toHaveCount(3);
    for (const screen of await screens.all()) {
      await screen.scrollIntoViewIfNeeded();
      await expect(screen).toHaveJSProperty("complete", true);
      expect(await screen.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
  });

  // Each product card previews the product with its own Open Graph image
  // (app/(products)/[app]/opengraph-image.tsx): a wrong path or a failing
  // image route only shows up as a broken image in a real browser.
  test("previews each product with its Open Graph image", async ({ page }) => {
    await page.goto("/");
    const productCards = page.locator('#produits a:not([href="/admin/login"])');
    expect(await productCards.count()).toBeGreaterThan(0);
    for (const card of await productCards.all()) {
      const preview = card.locator("img");
      await preview.scrollIntoViewIfNeeded();
      await expect(preview).toHaveJSProperty("complete", true);
      expect(await preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
  });
});
