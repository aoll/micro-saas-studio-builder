import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { FONT_KEYS } from "../lib/fonts";
import { products, themes } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { themeTokensSchema } from "../lib/schemas/theme-tokens";

// CONTRACT-ui bullet 3 (specs/CONTRACT-ui.md): the 4 seeded themes render
// their `primary` colour on /lettre-pro, in light and dark.
//
// Not run yet (written now, run in the E2E phase, docs/11-implementation.md
// › V4 Package): playwright.config.ts's webServer does `pnpm build && pnpm
// start`, and the product layout's `getProduct()` is `'use cache'` +
// `cacheTag('product:lettre-pro')` with `cacheLife('max')`
// (docs/04-nextjs.md) — a raw UPDATE on `products.theme_id` below does not
// invalidate that cache, so the landing would keep serving the previous
// theme's tokens against a built+started server. The E2E phase picks one of:
//   1. change the theme through BO-05's product-save Server Action once it
//      exists (it calls `updateTag('product:lettre-pro')` per docs/04), or
//   2. run this spec against `next dev` instead (no persistent cache there).
// Either way, the assertions below (computed --primary, font key) don't
// change, only how the theme change is made visible.

test.describe("Theme rendering on /lettre-pro", () => {
  test("each seeded theme's primary colour and font are applied", async ({ page }) => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { products, themes } });

    try {
      const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
      if (!product) throw new Error("Seed missing: lettre-pro (run pnpm db:seed)");
      const originalThemeId = product.themeId;

      const seededThemes = await db.query.themes.findMany({ where: eq(themes.isSeed, true) });
      expect(seededThemes.length).toBe(4);

      try {
        for (const themeRow of seededThemes) {
          const tokens = themeTokensSchema.parse(themeRow.tokens);

          await db.update(products).set({ themeId: themeRow.id }).where(eq(products.id, product.id));

          await page.emulateMedia({ colorScheme: "light" });
          await page.goto("/lettre-pro");
          const lightPrimary = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
          );
          expect(lightPrimary).toBe(tokens.light.primary);

          await page.emulateMedia({ colorScheme: "dark" });
          await page.reload();
          const darkPrimary = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
          );
          expect(darkPrimary).toBe(tokens.dark.primary);

          expect(FONT_KEYS).toContain(tokens.fontKey);
        }
      } finally {
        await db.update(products).set({ themeId: originalThemeId }).where(eq(products.id, product.id));
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
