import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

// Frozen contract (specs/CONTRACT-types.md): the shape of a stored product,
// its config plus the catalogue's own row fields. `getProduct(slug)` above
// stays untouched (SETUP-skeleton, real, reads the minimal seed row);
// CONTRACT-data widens its return type to `Product | null`.
export type Product = ProductConfig & { id: string; version: number; isSeed: boolean };

// Powers the portfolio (BO-02) and SA-08's "other products" list; cached
// and tagged `products` (docs/04-nextjs.md).
export const listProducts: () => Promise<Product[]> = async () => {
  throw new Error("not implemented");
};

// The product config is public data (it drives the public sub-app), so no
// session check here, unlike the rest of lib/dal/*.
export async function getProduct(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(`product:${slug}`);
  const row = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  return row ?? null;
}

// At least one slug is required by `generateStaticParams` under
// Cache Components (docs/04-nextjs.md): a root param needs at least one
// value at build time.
export async function listProductSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: products.slug }).from(products);
  return rows.map((row) => row.slug);
}
