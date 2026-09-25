import type { Product } from "@/lib/dal/products";

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

// Plan's design decision 2.
export function formatUsage(names: string[]): string {
  if (names.length === 0) return "Aucun produit";
  const noun = names.length === 1 ? "produit" : "produits";
  return `Utilisé par ${names.length} ${noun} · ${names.join(", ")}`;
}
