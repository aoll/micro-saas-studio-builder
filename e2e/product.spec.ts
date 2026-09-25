import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, generations, productVersions, products, purchases, themes } from "../lib/db/schema";
import { users } from "../lib/db/auth-schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";
import type { ProductConfig } from "../lib/schemas/product-config";

// BO-03 · Fiche produit (specs/BO-03-fiche.md), written now, run in the E2E phase against the
// webServer built by playwright.config.ts (migrated, seeded, AI_MODE=mock). Reuses BO-02's
// story helpers (e2e/portfolio.spec.ts) but with a schema-valid config throughout — not the
// `as never` shortcut portfolio.spec.ts:50 takes — so getProduct() (which Zod-parses the
// config) never throws for a product this file creates.

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { events, generations, productVersions, products, purchases, themes, users } });

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

/** A throwaway product with a small funnel story, cleaned up by the caller. */
async function createStoryProduct(
  name: string,
  story: { visits: number; signups: number; buyers: number; succeededGenerations: number },
  opts: { status?: "test" | "learn" | "scale" | "killed" } = {},
): Promise<{ id: string; slug: string; buyerIds: string[] }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
  const id = randomUUID();
  const slug = `product-e2e-${randomUUID()}`;
  await db.insert(products).values({
    id,
    slug,
    themeId: theme!.id,
    currentVersion: 1,
    locale: "fr",
    createdBy: owner!.id,
    status: opts.status ?? "test",
  });
  await db.insert(productVersions).values({
    productId: id,
    version: 1,
    createdBy: owner!.id,
    config: buildValidConfig(slug, name, theme!.id),
  });

  if (story.visits > 0) {
    await db.insert(events).values(
      Array.from({ length: story.visits }, () => ({
        productId: id,
        type: "visit" as const,
        anonymousId: randomUUID(),
      })),
    );
  }
  if (story.signups > 0) {
    await db.insert(events).values(
      Array.from({ length: story.signups }, () => ({
        productId: id,
        type: "signup" as const,
        anonymousId: randomUUID(),
      })),
    );
  }
  const buyerIds: string[] = [];
  for (let index = 0; index < story.buyers; index += 1) {
    const buyerId = randomUUID();
    buyerIds.push(buyerId);
    await db.insert(users).values({ id: buyerId, name: `E2E buyer ${index}`, email: `${buyerId}@example.test` });
    await db.insert(purchases).values({
      userId: buyerId,
      productId: id,
      packId: "pack-10",
      credits: 10,
      amountCents: 490,
      idempotencyKey: randomUUID(),
    });
  }
  if (story.succeededGenerations > 0) {
    await db.insert(generations).values(
      Array.from({ length: story.succeededGenerations }, () => ({
        productId: id,
        productVersion: 1,
        ipHash: "e2e",
        input: {},
        status: "succeeded" as const,
        costMicros: 4000,
        idempotencyKey: randomUUID(),
      })),
    );
  }
  return { id, slug, buyerIds };
}

async function cleanupStoryProduct({ id, buyerIds }: { id: string; buyerIds: string[] }): Promise<void> {
  await db.delete(purchases).where(eq(purchases.productId, id));
  await db.delete(generations).where(eq(generations.productId, id));
  await db.delete(events).where(eq(events.productId, id));
  await db.delete(productVersions).where(eq(productVersions.productId, id));
  await db.delete(products).where(eq(products.id, id));
  if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
}

test.describe("BO-03 · Fiche produit", () => {
  test("unauthenticated visitors are redirected to /admin/login", async ({ page }) => {
    const product = await createStoryProduct("E2E Auth", { visits: 0, signups: 0, buyers: 0, succeededGenerations: 0 });
    try {
      await page.goto(`/admin/products/${product.slug}`);
      await expect(page).toHaveURL(/\/admin\/login$/);
    } finally {
      await cleanupStoryProduct(product);
    }
  });

  test("shows KPIs, the funnel, the trend chart and a scale suggestion for the dossier's story", async ({ page }) => {
    const product = await createStoryProduct("E2E Sheet Scale", {
      visits: 1200,
      signups: 100,
      buyers: 7,
      succeededGenerations: 20,
    });

    try {
      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}`);

      await expect(page.getByRole("heading", { name: "E2E Sheet Scale" })).toBeVisible();
      await expect(page.getByTestId("status-badge")).toBeVisible();
      await expect(page.getByText("à scaler")).toBeVisible();

      await expect(page.getByText("Revenu · 30 j")).toBeVisible();
      await expect(page.getByText("ARPU")).toBeVisible();
      await expect(page.getByText("Coût IA · 30 j")).toBeVisible();
      await expect(page.getByText("Marge / génération")).toBeVisible();

      await expect(page.getByText("Visites landing")).toBeVisible();
      await expect(page.getByText("1re génération")).toBeVisible();
      await expect(page.getByText("Achat")).toBeVisible();

      await expect(page.getByText("Achats")).toBeVisible(); // trend chart legend

      await expect(page.getByText("Statut et seuils de décision")).toBeVisible();
      await expect(page.getByText("Seuil de décision atteint")).toBeVisible();

      const subAppLink = page.getByRole("link", { name: new RegExp(product.slug) });
      await expect(subAppLink).toHaveAttribute("href", `/${product.slug}`);
      await expect(subAppLink).toHaveAttribute("target", "_blank");

      const editLink = page.getByRole("link", { name: "Modifier la config" });
      await expect(editLink).toHaveAttribute("href", `/admin/products/${product.slug}/edit`);
    } finally {
      await cleanupStoryProduct(product);
    }
  });

  test("shows an empty state instead of the funnel for a product with no data", async ({ page }) => {
    const product = await createStoryProduct("E2E Sheet Empty", {
      visits: 0,
      signups: 0,
      buyers: 0,
      succeededGenerations: 0,
    });

    try {
      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}`);

      await expect(page.getByText(/aucune donnée/i)).toBeVisible();
      await expect(page.getByText("Visites landing")).toHaveCount(0);
      // The KPIs and the decision panel still render.
      await expect(page.getByText("Revenu · 30 j")).toBeVisible();
      await expect(page.getByText("Statut et seuils de décision")).toBeVisible();
    } finally {
      await cleanupStoryProduct(product);
    }
  });

  test("shows a closed banner, no DecisionBadge, but keeps the data for a killed product", async ({ page }) => {
    const product = await createStoryProduct(
      "E2E Sheet Killed",
      { visits: 1100, signups: 100, buyers: 1, succeededGenerations: 5 },
      { status: "killed" },
    );

    try {
      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}`);

      await expect(page.getByText(/produit fermé/i)).toBeVisible();
      await expect(page.getByText(/SA-08/)).toBeVisible();
      await expect(page.getByText("à couper")).toHaveCount(0);
      await expect(page.getByText("Visites landing")).toBeVisible();

      const subAppLink = page.getByRole("link", { name: new RegExp(product.slug) });
      await expect(subAppLink).toHaveAttribute("href", `/${product.slug}`);
    } finally {
      await cleanupStoryProduct(product);
    }
  });

  test("returns a 404 for an unknown slug", async ({ page }) => {
    await signInAsAdmin(page);
    const response = await page.goto(`/admin/products/unknown-${randomUUID()}`);
    expect(response?.status()).toBe(404);
  });
});

test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});
