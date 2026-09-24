import { expect, test } from "@playwright/test";

// SA-04 (specs/SA-04-tarifs.md). Not run yet (written now, run in the E2E
// phase, docs/11-implementation.md › V4 Package): playwright.config.ts's
// webServer does `pnpm build && pnpm start` against the seeded lettre-pro
// product (pack-10: 10 credits / 4,90 €, pack-50: 50 credits / 14,90 €,
// recommended — fixtures/lettre-pro.config.json).

test.describe("Pricing page", () => {
  test("lists the packs, highlights the recommended one, no dialog on the full page", async ({ page }) => {
    await page.goto("/lettre-pro/pricing");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Recommandé")).toHaveCount(1);

    const links = page.getByRole("link", { name: /Acheter/ });
    await expect(links).toHaveCount(2);

    const recommendedLink = page.getByRole("link", { name: /Acheter 50 crédits/ });
    await expect(recommendedLink).toHaveAttribute("href", "/lettre-pro/checkout/pack-50");

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("clicking the recommended pack's buy link navigates to its checkout URL", async ({ page }) => {
    await page.goto("/lettre-pro/pricing");

    await page.getByRole("link", { name: /Acheter 50 crédits/ }).click();

    await expect(page).toHaveURL("/lettre-pro/checkout/pack-50");
  });

  // Needs SA-02 (the outil, to reach a 0 balance and trigger the paywall)
  // and LEDGER (a real debit() that actually exhausts the balance): marked
  // fixme until both are merged, so the file compiles and lists the
  // journey without failing the run.
  test.fixme("opens as a modal on top of the outil when the balance hits 0, and Escape returns to the outil", async ({
    page,
  }) => {
    await page.goto("/lettre-pro/tool");
    // … exhaust the free/anonymous generation and the signed-in balance
    // down to 0 here once SA-02 and LEDGER exist, then trigger the
    // paywall (e.g. attempting one more generation).

    await expect(page).toHaveURL("/lettre-pro/pricing");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Acheter/ })).toHaveCount(2);

    // The tool's form stays mounted behind the modal (intercepting route).
    await expect(page.locator("form")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL("/lettre-pro/tool");
  });
});
