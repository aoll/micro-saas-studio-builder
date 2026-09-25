import "server-only";
import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { products, themes } from "@/lib/db/schema";
import {
  landingVariantSchema,
  themeTokensSchema,
  type LandingVariant,
  type ThemeTokens,
} from "@/lib/schemas/theme-tokens";
import { assertEditable } from "./guards";
import { requireAdmin } from "./session";

// † Frozen contract (specs/CONTRACT-types.md): not a row of the contract
// table (docs/11), but named by docs/04-nextjs.md's layout excerpt
// (`getTheme(product.themeId)`, `'use cache'` + `cacheTag(theme:{id})`).
export type Theme = {
  id: string;
  slug: string;
  name: string;
  tokens: ThemeTokens;
  landingVariant: LandingVariant;
  isSeed: boolean;
};

// The theme's tokens are public data (they drive the sub-app's layout), so
// no session check here, like getProduct (lib/dal/products.ts).
export const getTheme: (id: string) => Promise<Theme | null> = async (id) => {
  "use cache";
  cacheLife("max");
  cacheTag(`theme:${id}`);
  // A malformed id (e.g. a slug typed by mistake) is not a database error:
  // it is simply not found, without a round trip.
  if (!z.uuid().safeParse(id).success) return null;
  const row = await db.query.themes.findFirst({ where: eq(themes.id, id) });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tokens: themeTokensSchema.parse(row.tokens),
    landingVariant: row.landingVariant,
    isSeed: row.isSeed,
  };
};

// BO-08 (specs/BO-08-editeur-theme.md): additive next to `getTheme` (plan's
// frozen inputs), `getTheme`'s own contract untouched. `requireAdmin` first
// (a Server Action is a public POST endpoint, CLAUDE.md); a non-uuid `id`
// returns null without a round trip, same convention as `getTheme`. Inside
// the transaction: the row is locked with `SELECT … FOR UPDATE` so two
// concurrent saves serialize instead of racing, `assertEditable` blocks a
// demo-locked theme, then tokens / landingVariant / updatedAt are written
// and every product on the theme (including `killed` ones: they still
// reference it) is returned so the caller can invalidate their own tag too.
export async function updateTheme(
  id: string,
  input: { tokens: ThemeTokens; landingVariant: LandingVariant },
): Promise<{ id: string; productSlugs: string[] } | null> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const tokens = themeTokensSchema.parse(input.tokens);
  const landingVariant = landingVariantSchema.parse(input.landingVariant);

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(themes).where(eq(themes.id, id)).for("update");
    if (!row) return null;
    assertEditable(row);

    await tx.update(themes).set({ tokens, landingVariant, updatedAt: new Date() }).where(eq(themes.id, id));

    const productRows = await tx
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.themeId, id))
      .orderBy(asc(products.slug));

    return { id, productSlugs: productRows.map((product) => product.slug) };
  });
}
