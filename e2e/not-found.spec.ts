import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { productVersions, products, themes } from "../lib/db/schema";
import { productConfigSchema } from "../lib/schemas/product-config";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_OWNER } from "../scripts/seed";

// SA-08 journeys (specs/SA-08-introuvable.md). Runs against the webServer
// built by playwright.config.ts: migrated, seeded, AI_MODE=mock.
//
// Plan round 2 (task R5): the product-level 404s (unknown slug, `killed`
// product) are served by app/(products)/not-found.tsx, reached when the
// root layout's notFound() call bubbles to the parent segment (task 1's
// spike, outcome 3). Manually re-checked with a real Chromium browser on a
// production build (:3108, docs/11-implementation.md's real-check step):
// status 404, the SA-08 heading and the link to another active product all
// render — the server HTML for this path is an empty shell
// (`<html id="__next_error__">`), same as Next's own 404, and the content
// below hydrates client-side, which `toBeVisible()` waits for.

test("an unknown slug returns 404 with the SA-08 page", async ({ page }) => {
  const slug = `introuvable-${randomUUID()}`;
  const response = await page.goto(`/${slug}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Ce produit n'est plus disponible" })).toBeVisible();
  await expect(page.getByRole("link", { name: /LettrePro/ })).toBeVisible();
});

test("a killed product returns 404 with its name, and is not offered as a link", async ({ page }) => {
  const slug = `killed-${randomUUID()}`;
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, productVersions, themes, users } });
  try {
    const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
    const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
    if (!owner || !editorial) throw new Error("not-found.spec.ts: seed not applied (owner or editorial theme missing)");

    const rawConfig: unknown = JSON.parse(
      readFileSync(new URL("../fixtures/lettre-pro.config.json", import.meta.url), "utf8"),
    );
    const config = productConfigSchema.parse({
      ...(rawConfig as object),
      slug,
      name: "Produit fermé",
      status: "killed",
      themeId: editorial.id,
    });

    await db.insert(products).values({
      slug,
      status: "killed",
      themeId: editorial.id,
      currentVersion: 1,
      locale: config.locale,
      isSeed: false,
      createdBy: owner.id,
    });
    const product = await db.query.products.findFirst({ where: eq(products.slug, slug) });
    if (!product) throw new Error(`not-found.spec.ts: failed to insert product ${slug}`);
    await db.insert(productVersions).values({ productId: product.id, version: 1, config, createdBy: owner.id });

    try {
      const response = await page.goto(`/${slug}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText("« Produit fermé »", { exact: false })).toBeVisible();
      await expect(page.getByRole("link", { name: /LettrePro/ })).toBeVisible();
      await expect(page.getByRole("link", { name: "Produit fermé", exact: true })).toHaveCount(0);
    } finally {
      await db.delete(productVersions).where(eq(productVersions.productId, product.id));
      await db.delete(products).where(eq(products.id, product.id));
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
});

test("/lettre-pro (active, seeded) stays reachable", async ({ page }) => {
  const response = await page.goto("/lettre-pro");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("LettrePro");
});
