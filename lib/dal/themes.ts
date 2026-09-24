import "server-only";
import type { LandingVariant, ThemeTokens } from "@/lib/schemas/theme-tokens";

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

export const getTheme: (id: string) => Promise<Theme | null> = async () => {
  throw new Error("not implemented");
};
