import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listProducts } from "@/lib/dal/products";
import { env } from "@/lib/env";

// I18N-SEO (specs/I18N-SEO.md): the recruiter landing at `/` and its
// making-of at `/making-of`, plus one entry
// per landing of every product that is not `killed` (test, learn, scale).
// `listProducts` is already `'use cache'`-tagged `products`
// (lib/dal/products.ts), so this stays cheap and up to date with the
// backoffice's own invalidation.
//
// QA 2026-09-29 (B2): as a prerendered route the sitemap was served from the
// build's output and never refreshed by `updateTag("products")`, so a product
// published live stayed out of it. `connection()` renders it per request;
// the product list itself stays cached.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const products = await listProducts();
  return [
    { url: baseUrl },
    { url: `${baseUrl}/making-of` },
    ...products
      .filter((product) => product.status !== "killed")
      .map((product) => ({ url: `${baseUrl}/${product.slug}` })),
  ];
}
