import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { creditTransactions, generations, productVersions, products, purchases, themes } from "../lib/db/schema";
import { users } from "../lib/db/auth-schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";
import type { ProductConfig } from "../lib/schemas/product-config";

// BO-04 · Fiche produit : activité (specs/BO-04-activite.md), written now, run in the E2E phase
// against the webServer built by playwright.config.ts (migrated, seeded, AI_MODE=mock). Mirrors
// e2e/product.spec.ts's (BO-03) story-product pattern, extended with generations, purchases and
// credit-ledger movements, and with the extra tables cleaned up in FK order.

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, {
  schema: { creditTransactions, generations, productVersions, products, purchases, themes, users },
});

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
    inputs: [{ key: "sector", label: "Secteur", type: "text", required: true }],
    generation: {
      model: "anthropic/claude-haiku-4.5",
      promptTemplate: "Write about {{sector}}",
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

/** A throwaway product, cleaned up by the caller. */
async function createProduct(
  name: string,
  opts: { status?: "test" | "learn" | "scale" | "killed" } = {},
): Promise<{ id: string; slug: string }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
  const id = randomUUID();
  const slug = `activity-e2e-${randomUUID()}`;
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
  return { id, slug };
}

async function cleanupProduct(productId: string, buyerIds: string[] = []): Promise<void> {
  await db.delete(creditTransactions).where(eq(creditTransactions.productId, productId));
  await db.delete(purchases).where(eq(purchases.productId, productId));
  await db.delete(generations).where(eq(generations.productId, productId));
  await db.delete(productVersions).where(eq(productVersions.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
  if (buyerIds.length) await db.delete(users).where(inArray(users.id, buyerIds));
}

async function createBuyer(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name: "E2E buyer", email: `${id}@example.test` });
  return id;
}

test.describe("BO-04 · Fiche produit : activité", () => {
  test("unauthenticated visitors are redirected to /admin/login", async ({ page }) => {
    const product = await createProduct("E2E Auth");
    try {
      await page.goto(`/admin/products/${product.slug}/activity`);
      await expect(page).toHaveURL(/\/admin\/login$/);
    } finally {
      await cleanupProduct(product.id);
    }
  });

  test("shows generations, purchases and credit movements for the dossier's story", async ({ page }) => {
    const product = await createProduct("E2E Activity Story");
    const buyerId = await createBuyer();
    try {
      const succeededId = randomUUID();
      await db.insert(generations).values({
        id: succeededId,
        productId: product.id,
        productVersion: 1,
        userId: buyerId,
        ipHash: "e2e",
        input: { sector: "café" },
        output: ["Brewtiful", "Grain Gang", "Moka"],
        model: "anthropic/claude-haiku-4.5",
        costMicros: 4_000,
        status: "succeeded",
        idempotencyKey: randomUUID(),
      });
      const failedId = randomUUID();
      await db.insert(generations).values({
        id: failedId,
        productId: product.id,
        productVersion: 1,
        userId: buyerId,
        ipHash: "e2e",
        input: { sector: "yoga" },
        status: "failed",
        idempotencyKey: randomUUID(),
      });

      const purchase = await db
        .insert(purchases)
        .values({
          userId: buyerId,
          productId: product.id,
          packId: "pack-10",
          credits: 10,
          amountCents: 490,
          idempotencyKey: randomUUID(),
        })
        .returning({ id: purchases.id });

      await db.insert(creditTransactions).values([
        { userId: buyerId, productId: product.id, delta: 3, reason: "signup_bonus", idempotencyKey: randomUUID() },
        {
          userId: buyerId,
          productId: product.id,
          delta: 10,
          reason: "purchase",
          purchaseId: purchase[0]!.id,
          idempotencyKey: randomUUID(),
        },
        {
          userId: buyerId,
          productId: product.id,
          delta: -1,
          reason: "generation",
          generationId: failedId,
          idempotencyKey: randomUUID(),
        },
        {
          userId: buyerId,
          productId: product.id,
          delta: 1,
          reason: "refund",
          generationId: failedId,
          idempotencyKey: randomUUID(),
        },
      ]);

      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}/activity`);

      await expect(page.getByRole("heading", { name: "E2E Activity Story" })).toBeVisible();
      await expect(page.getByText("Dernières générations")).toBeVisible();
      await expect(page.getByText("Brewtiful, Grain Gang, Moka")).toBeVisible();
      await expect(page.getByRole("cell", { name: "anthropic/claude-haiku-4.5" })).toBeVisible();
      await expect(page.getByText("Erreur · remboursé")).toBeVisible();

      await expect(page.getByText("Mouvements de crédits")).toBeVisible();
      await expect(page.getByText("Achat pack 10")).toBeVisible();
      await expect(page.getByText("Bonus inscription")).toBeVisible();
      await expect(page.getByText("Remboursement")).toBeVisible();

      await expect(page.getByText("Achats · 30 j")).toBeVisible();
      await expect(page.getByText(/1 achat/)).toBeVisible();
    } finally {
      await cleanupProduct(product.id, [buyerId]);
    }
  });

  test("paginates generations, 20 per page, Suivant then Précédent", async ({ page }) => {
    const product = await createProduct("E2E Activity Pagination");
    const buyerId = await createBuyer();
    try {
      await db.insert(generations).values(
        Array.from({ length: 21 }, (_, index) => ({
          productId: product.id,
          productVersion: 1,
          userId: buyerId,
          ipHash: "e2e",
          input: { sector: `sector-${index}` },
          output: "Output",
          status: "succeeded" as const,
          costMicros: 4_000,
          idempotencyKey: randomUUID(),
        })),
      );

      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}/activity`);

      await expect(page.getByRole("link", { name: "Suivant" }).first()).toBeVisible();
      await page.getByRole("link", { name: "Suivant" }).first().click();
      await expect(page).toHaveURL(/genPage=2/);
      await expect(page.getByRole("link", { name: "Précédent" }).first()).toBeVisible();

      await page.getByRole("link", { name: "Précédent" }).first().click();
      await expect(page).not.toHaveURL(/genPage=/);
    } finally {
      await cleanupProduct(product.id, [buyerId]);
    }
  });

  test("shows each list's own empty state for a product with no activity", async ({ page }) => {
    const product = await createProduct("E2E Activity Empty");
    try {
      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}/activity`);

      await expect(page.getByText("Aucune génération pour l'instant")).toBeVisible();
      await expect(page.getByText("Aucun mouvement pour l'instant")).toBeVisible();
      await expect(page.getByText("Aucun achat pour l'instant")).toBeVisible();
    } finally {
      await cleanupProduct(product.id);
    }
  });

  test("still shows the activity of a killed product", async ({ page }) => {
    const product = await createProduct("E2E Activity Killed", { status: "killed" });
    const buyerId = await createBuyer();
    try {
      await db.insert(generations).values({
        productId: product.id,
        productVersion: 1,
        userId: buyerId,
        ipHash: "e2e",
        input: { sector: "bijoux" },
        output: "Orélie",
        status: "succeeded",
        costMicros: 4_000,
        idempotencyKey: randomUUID(),
      });

      await signInAsAdmin(page);
      await page.goto(`/admin/products/${product.slug}/activity`);

      await expect(page.getByRole("heading", { name: "E2E Activity Killed" })).toBeVisible();
      await expect(page.getByText("Orélie")).toBeVisible();
    } finally {
      await cleanupProduct(product.id, [buyerId]);
    }
  });

  test("returns a 404 for an unknown slug", async ({ page }) => {
    await signInAsAdmin(page);
    const response = await page.goto(`/admin/products/unknown-${randomUUID()}/activity`);
    expect(response?.status()).toBe(404);
  });
});

test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});
