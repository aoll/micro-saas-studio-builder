import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/dal/products";
import { env } from "@/lib/env";

// I18N-SEO (specs/I18N-SEO.md): one entry per landing of every product that
// is not `killed` (test, learn, scale). `listProducts` is already
// `'use cache'`-tagged `products` (lib/dal/products.ts), so this stays cheap
// and up to date with the backoffice's own invalidation.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const products = await listProducts();
  return products
    .filter((product) => product.status !== "killed")
    .map((product) => ({ url: `${baseUrl}/${product.slug}` }));
}
