import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { productVersions, products, themes } from "../lib/db/schema";
import type { ProductConfig } from "../lib/schemas/product-config";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN, SEED_OWNER } from "../scripts/seed";

// BO-06 · Changement de statut (specs/BO-06-statut.md), written now, run in the E2E phase
// against the webServer built by playwright.config.ts (migrated, seeded, AI_MODE=mock).
// Not run by the tdd-guide loop (CLAUDE.md's E2E phase).

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { products, productVersions, themes, users } });

async function signInAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
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

/** A throwaway, schema-valid product, cleaned up by the caller. */
async function createTestProduct(name: string): Promise<{ id: string; slug: string }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  if (!theme || !owner) throw new Error("status.spec.ts: seed not applied (editorial theme or owner missing)");

  const id = randomUUID();
  const slug = `status-e2e-${randomUUID()}`;
  await db
    .insert(products)
    .values({ id, slug, themeId: theme.id, currentVersion: 1, locale: "fr", createdBy: owner.id });
  await db.insert(productVersions).values({
    productId: id,
    version: 1,
    createdBy: owner.id,
    config: buildValidConfig(slug, name, theme.id),
  });
  return { id, slug };
}

async function cleanupTestProduct(id: string): Promise<void> {
  await db.delete(productVersions).where(eq(productVersions.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

test.describe("BO-06 · Changement de statut", () => {
  test("changes the status to Learn with a note, and it is written to the database", async ({ page }) => {
    const product = await createTestProduct("E2E Status Learn");
    try {
      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}`);

      await page.getByRole("button", { name: "Changer de statut" }).click();
      await expect(
        page.getByRole("dialog", { name: `Changer le statut de ${product.slug}`, exact: false }),
      ).toBeVisible();

      await page.getByRole("radio", { name: "Learn" }).click();
      await page.getByLabel("Note de décision").fill("Conversion improving, keep observing");
      await page.getByRole("button", { name: "Passer en Learn" }).click();

      await expect(page.getByText("Statut mis à jour")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("status-badge")).toHaveText("Learn");

      const row = await db.query.products.findFirst({ where: eq(products.id, product.id) });
      expect(row?.status).toBe("learn");
      expect(row?.statusNote).toBe("Conversion improving, keep observing");
    } finally {
      await cleanupTestProduct(product.id);
    }
  });

  test("killing a product with the destructive confirmation makes /{slug} 404, and it drops from the SA-08 list", async ({
    page,
  }) => {
    const product = await createTestProduct("E2E Status Killed");
    try {
      // The sub-app is reachable before the kill.
      const warm = await page.goto(`/${product.slug}`);
      expect(warm?.status()).toBe(200);

      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}`);

      await page.getByRole("button", { name: "Changer de statut" }).click();
      await page.getByRole("radio", { name: "Killed" }).click();
      await expect(page.getByText(/ferme le produit/)).toBeVisible();
      await page.getByRole("button", { name: "Passer en Killed" }).click();

      await expect(page.getByText("Statut mis à jour")).toBeVisible();
      await expect(page.getByTestId("status-badge")).toHaveText("Killed");
      await expect(page.getByText(/produit fermé/i)).toBeVisible();

      const response = await page.goto(`/${product.slug}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("link", { name: new RegExp(product.slug) })).toHaveCount(0);
    } finally {
      await cleanupTestProduct(product.id);
    }
  });
});

test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});
