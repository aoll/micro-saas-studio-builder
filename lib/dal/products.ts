import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

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
