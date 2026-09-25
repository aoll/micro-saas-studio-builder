import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { decisionThresholds, productVersions, products, themes } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// BO-09 · Réglages des seuils (specs/BO-09-seuils.md), written now, run in
// the E2E phase against the webServer built by playwright.config.ts
// (migrated, seeded, AI_MODE=mock). Never changes the seeded default
// thresholds themselves — round-tripped back to the seeded values in a
// `finally`, mirroring the shared-DB rule this spec's DAL tests already
// follow (lib/dal/thresholds.test.ts).

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { decisionThresholds, productVersions, products, themes, users } });

const SEEDED_DEFAULTS = { minVisits: "1000", kill: "2", scale: "5" };

async function signInAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** A throwaway product, schema-valid, cleaned up by the caller. */
async function createFreshProduct(name: string): Promise<{ id: string; slug: string }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
  const id = randomUUID();
  const slug = `settings-e2e-${randomUUID()}`;
  await db
    .insert(products)
    .values({ id, slug, themeId: theme!.id, currentVersion: 1, locale: "fr", createdBy: owner!.id });
  await db.insert(productVersions).values({
    productId: id,
    version: 1,
    createdBy: owner!.id,
    config: {
      slug,
      name,
      status: "test",
      themeId: theme!.id,
      locale: "fr",
      branding: {},
      landing: { headline: "H", subheadline: "S", faq: [], seoTitle: "T", seoDescription: "D" },
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
    } as never,
  });
  return { id, slug };
}

async function cleanupFreshProduct({ id }: { id: string }): Promise<void> {
  await db.delete(decisionThresholds).where(eq(decisionThresholds.productId, id));
  await db.delete(productVersions).where(eq(productVersions.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

async function restoreSeededDefaults(): Promise<void> {
  await db
    .update(decisionThresholds)
    .set({
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
      updatedBy: null,
    })
    .where(isNull(decisionThresholds.productId));
}

test.describe("BO-09 · Réglages des seuils", () => {
  test("unauthenticated visitors are redirected to /admin/login", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("shows the seeded studio defaults", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/settings");
    await expect(page.getByLabel("Visites minimales")).toHaveValue(SEEDED_DEFAULTS.minVisits);
    await expect(page.getByLabel(/Conversion « à couper »/)).toHaveValue(SEEDED_DEFAULTS.kill);
    await expect(page.getByLabel(/Conversion « à scaler »/)).toHaveValue(SEEDED_DEFAULTS.scale);
  });

  test("re-saving the exact seeded defaults succeeds and shows a toast", async ({ page }) => {
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/settings");
      await page.getByRole("button", { name: "Enregistrer" }).first().click();
      await expect(page.getByText("Seuils par défaut enregistrés")).toBeVisible();
    } finally {
      await restoreSeededDefaults();
    }
  });

  test("kill >= scale shows a validation error and saves nothing", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/settings");
    await page.getByLabel(/Conversion « à couper »/).fill("6");
    await page.getByLabel(/Conversion « à scaler »/).fill("5");
    await page.getByRole("button", { name: "Enregistrer" }).first().click();
    await expect(page.getByText("Le seuil « à scaler » doit être supérieur au seuil « à couper »")).toBeVisible();
  });

  test("overrides a fresh product's thresholds, previews the badge change, then resets it", async ({ page }) => {
    const product = await createFreshProduct("E2E Settings Override");
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/settings");
      await page.getByLabel("Produit à surcharger").selectOption({ label: "E2E Settings Override" });
      await page.getByLabel("Visites minimales (produit)").fill("1");
      await page.getByRole("button", { name: "Enregistrer la surcharge" }).click();
      await expect(page.getByText("Surcharge enregistrée")).toBeVisible();

      await page.reload();
      await page.getByLabel("Produit à surcharger").selectOption({ label: /E2E Settings Override \(surchargé\)/ });
      await expect(page.getByLabel("Visites minimales (produit)")).toHaveValue("1");

      await page.getByRole("button", { name: "Réinitialiser" }).click();
      await expect(page.getByText("Surcharge réinitialisée")).toBeVisible();
    } finally {
      await cleanupFreshProduct(product);
    }
  });
});

test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});
