import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { productVersions, products, themes } from "../lib/db/schema";
import type { ProductConfig } from "../lib/schemas/product-config";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN, SEED_OWNER } from "../scripts/seed";

// DEMO-mode (specs/DEMO-mode.md), written now, run in the E2E phase against
// the webServer built by playwright.config.ts (migrated, seeded,
// AI_MODE=mock). Not run by the tdd-guide loop (CLAUDE.md's E2E phase).
//
// No demo-mode lock in this run (human decision, 2026-09-25): seeded
// products stay fully editable regardless of DEMO_MODE, and a dedicated
// CONTRACT PR removes lib/dal/guards.ts entirely. This file only covers
// what DEMO-mode still owns: the seeded story, and /admin/ops's owner-only
// reset. Must be run alone (`pnpm test:e2e -- demo-mode.spec.ts`): the
// reset test wipes every visitor row and every non-owner/admin user on the
// server it runs against, which would break every other spec file's fixtures
// if run in the same shared webServer session.

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { products, productVersions, themes, users } });

async function signInAs(page: Page, credential: { email: string; password: string }): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(credential.email);
  await page.getByLabel("Mot de passe").fill(credential.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

function buildValidConfig(slug: string, name: string, themeId: string): ProductConfig {
  return {
    slug,
    name,
    status: "test",
    themeId,
    locale: "fr",
    branding: {},
    landing: {
      headline: "Headline",
      subheadline: "Subheadline",
      faq: [],
      seoTitle: "Title",
      seoDescription: "Description",
    },
    inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
    generation: {
      model: "anthropic/claude-haiku-4.5",
      promptTemplate: "Write about {{topic}}",
      outputType: "markdown",
    },
    pricing: {
      freeCreditsOnSignup: 3,
      anonymousFreeGenerations: 1,
      costPerGeneration: 1,
      packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
    },
  };
}

/** A throwaway visitor-created product, exactly what a reset is meant to wipe. */
async function createVisitorProduct(): Promise<{ id: string; slug: string }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  if (!theme || !owner) throw new Error("demo-mode.spec.ts: seed not applied (editorial theme or owner missing)");

  const id = randomUUID();
  const slug = `demo-mode-e2e-${randomUUID()}`;
  await db.insert(products).values({
    id,
    slug,
    themeId: theme.id,
    currentVersion: 1,
    locale: "fr",
    isSeed: false,
    createdBy: owner.id,
  });
  await db.insert(productVersions).values({
    productId: id,
    version: 1,
    createdBy: owner.id,
    config: buildValidConfig(slug, "E2E visitor product", theme.id),
  });
  return { id, slug };
}

test.describe("BO-01 sidebar · /admin/ops stays unlisted", () => {
  test("no link to /admin/ops anywhere in the admin sidebar", async ({ page }) => {
    await signInAs(page, SEED_ADMIN);
    const opsLink = page.getByRole("link", { name: /ops|réinitialiser/i });
    await expect(opsLink).toHaveCount(0);
  });
});

test.describe("DEMO-mode · /admin/ops is owner-only", () => {
  test("the seeded admin (not owner) gets a 404, not the reset page", async ({ page }) => {
    await signInAs(page, SEED_ADMIN);
    const response = await page.goto("/admin/ops");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("button", { name: "Réinitialiser la démo" })).toHaveCount(0);
  });

  test("a signed-out visitor is redirected to /admin/login, not shown a 404 or the page", async ({ page }) => {
    await page.goto("/admin/ops");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("the owner reaches the page, with a two-step destructive confirm", async ({ page }) => {
    await signInAs(page, SEED_OWNER);
    await page.goto("/admin/ops");

    await expect(page.getByRole("heading", { name: "Opérations" })).toBeVisible();
    const resetButton = page.getByRole("button", { name: "Réinitialiser la démo" });
    await expect(resetButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmer la réinitialisation" })).toHaveCount(0);

    await resetButton.click();
    await expect(page.getByRole("button", { name: "Confirmer la réinitialisation" })).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();

    // Annuler collapses back without submitting: the button reappears.
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(resetButton).toBeVisible();
  });
});

// Serial and skipped by default: a full reset wipes every visitor row and
// every non-admin/owner user on the server it runs against. Only meant to
// run alone, deliberately.
test.describe.serial("DEMO-mode · a full reset wipes visitor data and keeps the seeded story", () => {
  test.skip(true, "run explicitly and alone: pnpm test:e2e -- demo-mode.spec.ts --grep 'full reset'");

  test("full reset: a visitor product disappears, the 3 locked products survive", async ({ page }) => {
    const visitor = await createVisitorProduct();

    await signInAs(page, SEED_OWNER);
    await page.goto("/admin/ops");
    await page.getByRole("button", { name: "Réinitialiser la démo" }).click();
    await page.getByRole("button", { name: "Confirmer la réinitialisation" }).click();

    await expect(page.getByText("Démo réinitialisée")).toBeVisible();

    const visitorRow = await db.query.products.findFirst({ where: eq(products.id, visitor.id) });
    expect(visitorRow).toBeUndefined();

    for (const slug of ["lettre-pro", "descri-pro", "nom-de-marque"]) {
      const row = await db.query.products.findFirst({ where: eq(products.slug, slug) });
      expect(row?.isSeed).toBe(true);
    }

    // The visitor product's landing is gone too.
    const goneResponse = await page.goto(`/${visitor.slug}`);
    expect(goneResponse?.status()).toBe(404);
  });
});
