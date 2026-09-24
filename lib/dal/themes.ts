import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { themeTokensSchema, type LandingVariant, type ThemeTokens } from "@/lib/schemas/theme-tokens";

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
