import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { products, productVersions } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { productConfigSchema } from "../lib/schemas/product-config";

// SA-01 (specs/SA-01-landing.md). Not run yet (written now, run in the E2E
// phase, docs/11-implementation.md › V4 Package): `instant()` needs
// `@next/playwright`, out of this spec's scope (orchestrator decision R2,
// .claude/plans/SA-01-landing.plan.md) — bullet 3 (the shell renders
// without waiting) rests on `pnpm build` showing `/lettre-pro` prerendered
// plus the unit tests instead, here.
//
// Only lettre-pro is seeded with the "editorial" theme (landing_variant
// "centered" per docs/01-produit.md's seed table); the other two variants
// (split, minimal) are covered by app/(products)/[app]/_components/landing/
// landing.test.tsx's `it.each`, not duplicated here.

test.describe("Landing /lettre-pro (SA-01)", () => {
  test("shows hero, example result, how it works, pricing and FAQ from the config", async ({ page }) => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { products, productVersions } });
    let config: ReturnType<typeof productConfigSchema.parse>;
    try {
      const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
      if (!row) throw new Error("Seed missing: lettre-pro (run pnpm db:seed)");
      const version = await db.query.productVersions.findFirst({
        where: and(eq(productVersions.productId, row.id), eq(productVersions.version, row.currentVersion)),
      });
      if (!version) throw new Error("Seed missing: lettre-pro product_versions row");
      config = productConfigSchema.parse({
        ...(version.config as Record<string, unknown>),
        slug: row.slug,
        status: row.status,
        themeId: row.themeId,
        locale: row.locale,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }

    await page.goto("/lettre-pro");

    // Static shell content, all from the config.
    await expect(page.getByRole("heading", { level: 1, name: config.landing.headline })).toBeVisible();
    await expect(page.locator('[data-variant="centered"]')).toBeVisible();
    if (config.landing.exampleOutput) {
      await expect(page.getByText("Exemple de résultat")).toBeVisible();
    }
    await expect(page.getByText("Comment ça marche")).toBeVisible();
    await expect(page.getByText("Tarifs")).toBeVisible();

    // FAQ: native <details>, opens without JavaScript.
    const firstQuestion = page.locator("details summary").first();
    await firstQuestion.click();
    await expect(firstQuestion.locator("..")).toHaveAttribute("open", "");

    // The CTA points at the tool page; not clicked here, /tool is SA-02's.
    const cta = page.getByRole("link", { name: "Essayer gratuitement" }).first();
    await expect(cta).toHaveAttribute("href", "/lettre-pro/tool");

    // generateMetadata: title and description in the raw HTML.
    await expect(page).toHaveTitle(config.landing.seoTitle);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toBe(config.landing.seoDescription);
  });
});
