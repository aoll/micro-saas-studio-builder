import type { Product } from "@/lib/dal/products";

// The shape both `getTranslations()` (server) and `useTranslations()`
// (client) return, scoped to the "backoffice-themes" namespace: enough to
// call it with a key and ICU values, nothing this module doesn't use.
export type ThemesTranslator = (key: string, values?: Record<string, string | number>) => string;

// BO-07 (specs/BO-07-themes.md): how many products use each theme, and
// their names, computed from the catalogue's `listProducts()` rather than
// a DAL change (plan's design decision 1). Killed products are counted
// (plan's orchestrator decision 3): they still reference the theme.
export function productsByTheme(products: Product[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const product of products) {
    const names = grouped.get(product.themeId) ?? [];
    names.push(product.name);
    grouped.set(product.themeId, names);
  }
  for (const names of grouped.values()) {
    names.sort((a, b) => a.localeCompare(b, "fr"));
  }
  return grouped;
}

// Plan's design decision 2. I18N-BACKOFFICE-STRINGS (lot 7): the count/noun
// agreement moves into the "usage.summary" ICU plural of
// messages/{fr,en}/backoffice-themes.json, so the caller's locale (not a
// hand-picked French noun) decides one vs. other.
export function formatUsage(names: string[], t: ThemesTranslator): string {
  if (names.length === 0) return t("usage.none");
  return t("usage.summary", { count: names.length, names: names.join(", ") });
}
