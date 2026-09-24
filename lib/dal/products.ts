import "server-only";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { productVersions, products } from "@/lib/db/schema";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";

// Frozen contract (specs/CONTRACT-types.md): the shape of a stored product,
// its config plus the catalogue's own row fields. `getProduct(slug)` above
// stays untouched (SETUP-skeleton, real, reads the minimal seed row);
// CONTRACT-data widens its return type to `Product | null`.
export type Product = ProductConfig & { id: string; version: number; isSeed: boolean };

type ProductRow = typeof products.$inferSelect;
type ProductVersionRow = typeof productVersions.$inferSelect;

// The catalogue row wins over whatever the stored config says for the
// fields it also owns (slug, status, theme, locale): an admin action can
// change those without bumping the version (specs/CONTRACT-data plan,
// task 4). A corrupt config throws instead of silently serving bad data.
function toProduct(row: ProductRow, version: ProductVersionRow): Product {
  const config = productConfigSchema.parse({
    ...(version.config as Record<string, unknown>),
    slug: row.slug,
    status: row.status,
    themeId: row.themeId,
    locale: row.locale,
  });
  return { ...config, id: row.id, version: version.version, isSeed: row.isSeed };
}

// Powers the portfolio (BO-02) and SA-08's "other products" list; cached
// and tagged `products` (docs/04-nextjs.md).
export async function listProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("max");
  cacheTag("products");
  const rows = await db
    .select({ product: products, version: productVersions })
    .from(products)
    .innerJoin(
      productVersions,
      and(eq(productVersions.productId, products.id), eq(productVersions.version, products.currentVersion)),
    );
  return rows.map(({ product, version }) => toProduct(product, version));
}

// The product config is public data (it drives the public sub-app), so no
// session check here, unlike the rest of lib/dal/*.
export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`product:${slug}`);
  const row = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  if (!row) return null;
  const version = await db.query.productVersions.findFirst({
    where: and(eq(productVersions.productId, row.id), eq(productVersions.version, row.currentVersion)),
  });
  if (!version) throw new Error(`getProduct(${slug}): missing product_versions row for current_version`);
  return toProduct(row, version);
}

// At least one slug is required by `generateStaticParams` under
// Cache Components (docs/04-nextjs.md): a root param needs at least one
// value at build time.
export async function listProductSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: products.slug }).from(products);
  return rows.map((row) => row.slug);
}
