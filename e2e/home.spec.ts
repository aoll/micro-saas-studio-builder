import { expect, test } from "@playwright/test";

// The recruiter landing at `/`, added outside the original 17 screens
// (docs/02-ecrans.md) since it is about the demo itself, not one of its
// products. Not run yet (docs/11-implementation.md's E2E phase), same
// convention as the rest of e2e/*.spec.ts. Product names come from the seed
// fixtures (fixtures/lettre-pro.config.json's `name`), same as README.md's
// own quickstart example.
test.describe("Home (/)", () => {
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
