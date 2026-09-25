import { expect, test } from "@playwright/test";

// SA-02 acceptance, played end to end against /lettre-pro/tool. Not run yet
// (written now, run in the E2E phase, docs/11-implementation.md › V4
// Package): a real Playwright browser against a built+started server is
// needed to exercise cookies, streaming fetch and navigation together.
//
// Notes for whoever runs this:
// - AI failure (mid-stream `error` chunk) is Vitest-only
//   (app/(products)/[app]/api/generate/route.test.ts and
//   lib/ai/generate.test.ts): Playwright has no supported way to make the
//   mock model fail mid-request without editing app code for the run.
// - Delete this spec's `generations` rows (by `ip_hash`) in a `beforeEach`,
//   the way e2e/themes.spec.ts resets its theme change, so repeated runs
//   don't exhaust the anonymous free-generation limit.
// - LEDGER, SA-03 (signup) and SA-04 (pricing) are merged: the `/pricing`
//   and `/signup` journeys below assert the real destination (the
//   intercepting-route modal, e2e/signup.spec.ts's own check), not just
//   the redirect.
// - The second and third scenarios still need a signed-in session and an
//   exhausted balance respectively; setting those up (magic-link sign-in,
//   a debited balance) is e2e/signup.spec.ts's and LEDGER's own territory,
//   left here as placeholder steps for whoever wires the E2E phase.

test.describe("Tool (/lettre-pro/tool)", () => {
  test("an anonymous visitor generates once for free, then is asked to sign up", async ({ page }) => {
    await page.goto("/lettre-pro/tool");
    await page.getByLabel("Poste visé").fill("Développeur Frontend");
    await page.getByLabel("Entreprise").fill("Dotworld");
    await page.getByLabel("Votre expérience").fill("3 ans en React et TypeScript");
    await page.getByLabel("Ton").selectOption("dynamique");
    await page.getByRole("button", { name: /Générer/ }).click();

    await expect(page.getByText(/Bonjour/)).toBeVisible();

    // Second attempt: the free try is used up, /signup opens as a modal
    // over the tool (intercepting route, docs/04-nextjs.md), same check as
    // e2e/signup.spec.ts's own first scenario.
    await page.getByRole("button", { name: "Régénérer" }).click();
    await expect(page).toHaveURL(/\/lettre-pro\/signup$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a signed-in user's balance badge decrements, then the result can be copied, downloaded and regenerated", async ({
    page,
  }) => {
    // Requires a signed-in session: sign in first via the real magic-link
    // flow (e2e/signup.spec.ts's second scenario), then reuse that
    // session here. Left as a placeholder step for the E2E phase.
    await page.goto("/lettre-pro/tool");

    await page.getByLabel("Poste visé").fill("Product Manager");
    await page.getByLabel("Entreprise").fill("Studio Nova");
    await page.getByLabel("Votre expérience").fill("5 ans en gestion produit SaaS B2B");
    await page.getByLabel("Ton").selectOption("formel");

    const balanceBefore = await page.getByText(/crédits?$/).textContent();
    await page.getByRole("button", { name: /Générer/ }).click();
    await expect(page.getByText(/crédits?$/)).not.toHaveText(balanceBefore ?? "");

    await page.getByRole("button", { name: "Copier" }).click();
    await expect(page.getByText("Copié")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Télécharger" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^lettre-pro-.+\.md$/);

    await page.getByRole("button", { name: "Régénérer" }).click();
    await expect(page.getByText(/Bonjour|Madame/)).toBeVisible();
  });

  test("a zero balance opens the paywall", async ({ page }) => {
    // Requires a signed-in user with an exhausted balance (debited via the
    // real ledger): left as a placeholder for the E2E phase.
    await page.goto("/lettre-pro/tool");
    await page.getByLabel("Poste visé").fill("Data Analyst");
    await page.getByLabel("Entreprise").fill("GreenMetrics");
    await page.getByLabel("Votre expérience").fill("2 ans en analyse de données");
    await page.getByLabel("Ton").selectOption("formel");
    await page.getByRole("button", { name: /Générer/ }).click();

    await expect(page).toHaveURL(/\/lettre-pro\/pricing$/);
  });
});
