import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, generations, productVersions, products, purchases, themes } from "../lib/db/schema";
import { users } from "../lib/db/auth-schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// BO-02 · Portefeuille (specs/BO-02-portefeuille.md), written now, run in
// the E2E phase against the webServer built by playwright.config.ts
// (migrated, seeded, AI_MODE=mock). Reproduces the dossier's story on top
// of the seeded LettrePro and two fresh products, so the badges are
// deterministic regardless of the seed's own numbers (specs/
// BO-02-portefeuille.md plan, orchestrator decision 5).

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { events, generations, productVersions, products, purchases, themes, users } });

async function signInAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** A throwaway product with a small funnel story, cleaned up by the caller. */
async function createStoryProduct(
  name: string,
  story: { visits: number; signups: number; buyers: number; succeededGenerations: number },
): Promise<{ id: string; slug: string; buyerIds: string[] }> {
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
  const id = randomUUID();
  const slug = `portfolio-e2e-${randomUUID()}`;
  await db.insert(products).values({
    id,
    slug,
    themeId: theme!.id,
    currentVersion: 1,
    locale: "fr",
    createdBy: owner!.id,
  });
  await db.insert(productVersions).values({
    productId: id,
    version: 1,
    createdBy: owner!.id,
    config: { name, pricing: { costPerGeneration: 1 } } as never,
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

test.describe("BO-02 · Portefeuille", () => {
  test("unauthenticated visitors are redirected to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("shows KPIs, kill/scale badges, conversion and a sortable table for the dossier's story", async ({ page }) => {
    const toScale = await createStoryProduct("E2E Scale", {
      visits: 1200,
      signups: 100,
      buyers: 7,
      succeededGenerations: 20,
    });
    const toKill = await createStoryProduct("E2E Kill", {
      visits: 1100,
      signups: 100,
      buyers: 1,
      succeededGenerations: 5,
    });

    try {
      await signInAsAdmin(page);

      await expect(page.getByText("Visites · 30 j")).toBeVisible();
      await expect(page.getByText("Revenu · 30 j")).toBeVisible();
      await expect(page.getByText("Coût IA · 30 j")).toBeVisible();
      await expect(page.getByText("Marge brute")).toBeVisible();

      const scaleRow = page.getByRole("row", { name: /E2E Scale/ });
      await expect(scaleRow.getByText("à scaler")).toBeVisible();
      await expect(scaleRow.getByText("7 %")).toBeVisible(); // 7 buyers / 100 signups

      const killRow = page.getByRole("row", { name: /E2E Kill/ });
      await expect(killRow.getByText("à couper")).toBeVisible();

      const visitsHeader = page.getByRole("columnheader", { name: /Visites/ });
      await visitsHeader.getByRole("button").click();
      await expect(visitsHeader).toHaveAttribute("aria-sort", /ascending|descending/);
    } finally {
      await cleanupStoryProduct(toScale);
      await cleanupStoryProduct(toKill);
    }
  });

  test("shows no badge for a product between the two thresholds, and links to the product sheet", async ({ page }) => {
    const between = await createStoryProduct("E2E Between", {
      visits: 1050,
      signups: 100,
      buyers: 3,
      succeededGenerations: 10,
    });

    try {
      await signInAsAdmin(page);
      const row = page.getByRole("row", { name: /E2E Between/ });
      await expect(row.getByText("à couper")).toHaveCount(0);
      await expect(row.getByText("à scaler")).toHaveCount(0);
      await expect(row.getByRole("link", { name: "E2E Between" })).toHaveAttribute(
        "href",
        `/admin/products/${between.slug}`,
      );
    } finally {
      await cleanupStoryProduct(between);
    }
  });
});

test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});
