import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { productVersions, products } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// BO-05b's script of demo (specs/BO-05b-generation-publication.md), steps 5
// to 7: generation, « Tester le prompt », pricing with its margin panel,
// and publication. Not run by the tdd-guide loop (CLAUDE.md's E2E phase);
// kept here for the E2E phase to pick up.

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("creates a product through all 7 steps, tests the prompt, and publishes it", async ({ page }) => {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, productVersions } });
  const name = `Générateur de bio Instagram ${randomUUID().slice(0, 8)}`;
  const slug = `bio-instagram-${randomUUID().slice(0, 8)}`;
  let createdProductId: string | undefined;

  try {
    await signIn(page);
    await page.goto("/admin/products/new");

    // Step 1: identity.
    await page.getByLabel("Nom").fill(name);
    await page.getByLabel("Slug").fill(slug);
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 2: theme.
    await page.getByRole("radio", { name: /Neon/ }).click();
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 3: landing & SEO.
    await page.getByLabel("Titre").fill("Une bio qui donne envie de suivre");
    await page.getByLabel("Sous-titre").fill("Générée en 10 secondes");
    await page.getByLabel("Titre SEO").fill(name);
    await page.getByLabel("Description SEO").fill("Un générateur de bio Instagram qui capte l'attention en une ligne.");
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 4: the tool's one field.
    await page.getByLabel("Clé").first().fill("sujet");
    await page.getByLabel("Libellé").first().fill("Sujet");
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 5: generation, a prompt referencing {{sujet}}, and a live test.
    await page.getByLabel("Template de prompt").fill("Rédige une bio Instagram sur {{sujet}}.");
    await page.getByLabel("Sujet").fill("le café et le code");
    await page.getByRole("button", { name: "Tester le prompt" }).click();
    await expect(page.getByText(/entrée \/ .* sortie/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 6: pricing, with the margin panel now showing a measured cost.
    await expect(page.getByText(/mesuré/i)).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 7: recap and publish.
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(slug)).toBeVisible();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText(/Produit publié/)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`/${slug}`) })).toBeVisible();

    const productRow = await db.query.products.findFirst({ where: eq(products.slug, slug) });
    createdProductId = productRow?.id;
    expect(productRow?.currentVersion).toBe(1);

    // The published product is now reachable at /{slug} (updateTag having
    // invalidated the cache the sub-app's landing reads from).
    await page.goto(`/${slug}`);
    await expect(page.getByText("Une bio qui donne envie de suivre")).toBeVisible();
  } finally {
    if (createdProductId) {
      await db.delete(productVersions).where(eq(productVersions.productId, createdProductId));
      await db.delete(products).where(eq(products.id, createdProductId));
    }
    await sql.end({ timeout: 5 });
  }
});
