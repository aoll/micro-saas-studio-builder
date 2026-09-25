import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// QA1-P1-M1 (specs/qa/QA1-P1-M1-config-complete.md): pasting
// fixtures/bio-instagram.config.json fills every step, and the published
// product's landing shows the example output and a "how it works" step —
// the two-minute demo moment (docs/01-produit.md) this fixture exists for.
test("QA1-P1-M1: pasting the bio-instagram fixture fills every step, and the published landing shows the example and how-it-works", async ({
  page,
}) => {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, productVersions } });
  const uniqueSlug = `bio-instagram-${randomUUID().slice(0, 8)}`;
  let createdProductId: string | undefined;

  try {
    const rawFixture = readFileSync(join(process.cwd(), "fixtures/bio-instagram.config.json"), "utf-8");
    const fixture = { ...JSON.parse(rawFixture), slug: uniqueSlug };

    await signIn(page);
    await page.goto("/admin/products/new");

    await page.getByLabel("Coller une configuration JSON").fill(JSON.stringify(fixture));
    await page.getByRole("button", { name: "Importer" }).click();
    await expect(page.getByText("Configuration importée")).toBeVisible();

    // Step 3: exampleOutput and a "how it works" step are populated.
    await page.getByRole("button", { name: /^3\./ }).click();
    await expect(page.getByLabel("Exemple de résultat")).toHaveValue(fixture.landing.exampleOutput);
    await expect(page.getByLabel("Titre de l'étape 1")).toHaveValue(fixture.landing.steps[0].title);

    // Step 5: systemPrompt is populated.
    await page.getByRole("button", { name: /^5\./ }).click();
    await expect(page.getByLabel("Prompt système")).toHaveValue(fixture.generation.systemPrompt);

    // Step 2: still a deliberate action (plan decision 2) — pick a theme.
    // ThemeThumbnail's content is aria-hidden (docs/04's "vrais mini-rendus
    // React", not text meant to be read by a screen reader), so the radio
    // carries no accessible name: locate it by its (aria-hidden) text
    // instead of `getByRole(..., { name })`.
    await page.getByRole("button", { name: /^2\./ }).click();
    await page.locator('[role="radio"]', { hasText: "Neon" }).click();

    // Walk to the recap and publish.
    await page.getByRole("button", { name: /^7\./ }).click();
    await page.getByRole("button", { name: "Publier" }).click();
    // Two elements match a loose /Produit publié/: SummaryStep's own inline
    // confirmation ("Produit publié · Voir /…") and the toast
    // (`product-form.tsx`'s `toast.success`, "Produit publié · version …"):
    // match the toast's exact wording to disambiguate.
    await expect(page.getByText(/Produit publié · version/)).toBeVisible();

    const productRow = await db.query.products.findFirst({ where: eq(products.slug, uniqueSlug) });
    createdProductId = productRow?.id;
    expect(productRow).toBeTruthy();

    await page.goto(`/${uniqueSlug}`);
    await expect(page.getByText(fixture.landing.exampleOutput)).toBeVisible();
    // Exact match: the fixture's subheadline ("Tell us your niche and
    // vibe, …") contains the first step's title as a substring, so a loose
    // match resolves to both and Playwright's strict mode rejects it.
    await expect(page.getByText(fixture.landing.steps[0].title, { exact: true })).toBeVisible();
  } finally {
    if (createdProductId) {
      await db.delete(productVersions).where(eq(productVersions.productId, createdProductId));
      await db.delete(products).where(eq(products.id, createdProductId));
    }
    await sql.end({ timeout: 5 });
  }
});
