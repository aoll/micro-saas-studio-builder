import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { productVersions, products } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// BO-05a's script of demo (specs/BO-05a-formulaire.md), steps 1 to 4 and
// the draft save. Not run by the tdd-guide loop (CLAUDE.md's E2E phase);
// kept here for the E2E phase to pick up. `logo upload not covered`
// per the plan's task 19 (a real Blob store is required).

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("creates a product through steps 1-4, then saves a second draft version", async ({ page }) => {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, productVersions } });
  const name = `Générateur de bio Instagram ${randomUUID().slice(0, 8)}`;
  let createdProductId: string | undefined;

  try {
    await signIn(page);
    await page.goto("/admin/products/new");

    // Step 1: name derives the slug, "lettre-pro" is taken, a unique slug works.
    await page.getByLabel("Nom").fill(name);
    await page.getByLabel("Slug").fill("lettre-pro");
    await page.getByRole("button", { name: "Suivant" }).click();
    // Still on step 1 until the slug check settles: retry once available.
    await expect(page.getByText("Ce slug est déjà utilisé")).toBeVisible();
    const uniqueSlug = `bio-instagram-${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Slug").fill(uniqueSlug);
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 2: pick the Neon theme.
    await page.getByRole("radio", { name: /Neon/ }).click();
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 3: landing, then a duplicate FAQ answer error fixed.
    await page.getByLabel("Titre").fill("Une bio qui donne envie de suivre");
    await page.getByLabel("Sous-titre").fill("Générée en 10 secondes");
    await page.getByLabel("Titre SEO").fill(name);
    await page.getByLabel("Description SEO").fill("Un générateur de bio Instagram qui capte l'attention en une ligne.");
    await page.getByRole("button", { name: "Ajouter une question" }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText("Ce champ est requis")).toBeVisible();
    await page.getByLabel("Question").fill("Combien de temps ça prend ?");
    await page.getByLabel("Réponse").fill("Moins de 10 secondes.");
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 4: a duplicate key, then a fix, then reorder.
    await page.getByRole("button", { name: "Ajouter un champ" }).click();
    const keys = page.getByLabel("Clé");
    await keys.nth(1).fill("champ_1");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Clé déjà utilisée")).toBeVisible();
    await keys.nth(1).fill("secondaire");
    await page.getByRole("button", { name: "Descendre" }).first().click();

    // Save → redirected to the edit URL with a success toast.
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/${uniqueSlug}/edit$`));
    await expect(page.getByText(/Brouillon enregistré · version 1/)).toBeVisible();

    // Save again from the edit page → a second draft version, current_version still 1.
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/Brouillon enregistré · version 2/)).toBeVisible();

    const productRow = await db.query.products.findFirst({ where: eq(products.slug, uniqueSlug) });
    createdProductId = productRow?.id;
    expect(productRow?.currentVersion).toBe(1);
    const versions = await db.query.productVersions.findMany({
      where: eq(productVersions.productId, productRow!.id),
    });
    expect(versions).toHaveLength(2);
  } finally {
    if (createdProductId) {
      await db.delete(productVersions).where(eq(productVersions.productId, createdProductId));
      await db.delete(products).where(eq(products.id, createdProductId));
    }
    await sql.end({ timeout: 5 });
  }
});

test("editing an unknown slug 404s", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/products/does-not-exist-${randomUUID().slice(0, 8)}/edit`);
  await expect(page.getByText(/introuvable|404/i)).toBeVisible();
});
