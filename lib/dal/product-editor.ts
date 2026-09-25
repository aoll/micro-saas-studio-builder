import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVersions, products, themes } from "@/lib/db/schema";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";
import { themeTokensSchema } from "@/lib/schemas/theme-tokens";
import { assertEditable } from "./guards";
import { requireAdmin } from "./session";
import type { Theme } from "./themes";

// BO-05a (specs/BO-05a-formulaire.md): the real product-editor DAL. Its
// exports are additive next to `createProduct` (plan's orchestrator
// decision 2): the signature and return shape of `createProduct` stay
// byte-identical to the CONTRACT-data stub (pinned by
// lib/dal/contract.test.ts and contract-shape.test.ts), only its body now
// validates the config before writing.
export const createProduct: (config: ProductConfig) => Promise<{ id: string; slug: string; version: number }> = async (
  config,
) => {
  const session = await requireAdmin();
  const parsed = productConfigSchema.parse(config);
  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        slug: parsed.slug,
        status: parsed.status,
        themeId: parsed.themeId,
        currentVersion: 1,
        locale: parsed.locale,
        createdBy: session.user.id,
      })
      .returning({ id: products.id, slug: products.slug });
    await tx
      .insert(productVersions)
      .values({ productId: product!.id, version: 1, config: parsed, createdBy: session.user.id });
    return { id: product!.id, slug: product!.slug, version: 1 };
  });
};

// BO-05: a step-4 draft save, never a mutation in place
// (docs/07-modele-de-donnees.md › product_versions: "jamais de modification
// en place"). It never touches `products.current_version`: publishing (a
// separate action, BO-05b) is what moves the published version forward.
// The row is locked with `SELECT … FOR UPDATE` so two concurrent saves on
// the same product get distinct version numbers instead of racing on
// `coalesce(max(version), 0) + 1`.
export async function saveVersion(
  slug: string,
  config: ProductConfig,
): Promise<{ id: string; slug: string; version: number } | null> {
  const session = await requireAdmin();
  const parsed = productConfigSchema.parse(config);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(products).where(eq(products.slug, slug)).for("update");
    if (!row) return null;
    assertEditable(row);

    const [nextVersionRow] = await tx
      .select({ next: sql<number>`coalesce(max(${productVersions.version}), 0) + 1` })
      .from(productVersions)
      .where(eq(productVersions.productId, row.id));
    const version = Number(nextVersionRow!.next);

    // The catalogue row wins over the submitted config for the fields it
    // also owns (docs/07): a draft save never lets the client change slug
    // or status behind the row's back (both stay read-only in the BO-05
    // form for an existing product, but the DAL is the real guarantee).
    await tx.insert(productVersions).values({
      productId: row.id,
      version,
      config: { ...parsed, slug: row.slug, status: row.status },
      createdBy: session.user.id,
    });
    return { id: row.id, slug: row.slug, version };
  });
}

// BO-05's edit page: the latest draft (which may be ahead of the published
// version), next to the product's published version and lock state.
export async function getProductDraft(slug: string): Promise<{
  productId: string;
  isSeed: boolean;
  version: number;
  publishedVersion: number;
  config: ProductConfig;
} | null> {
  await requireAdmin();
  const row = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  if (!row) return null;
  const latest = await db.query.productVersions.findFirst({
    where: eq(productVersions.productId, row.id),
    orderBy: (version, { desc }) => [desc(version.version)],
  });
  if (!latest) throw new Error(`getProductDraft(${slug}): missing product_versions row`);
  const config = productConfigSchema.parse({
    ...(latest.config as Record<string, unknown>),
    slug: row.slug,
    status: row.status,
  });
  return {
    productId: row.id,
    isSeed: row.isSeed,
    version: latest.version,
    publishedVersion: row.currentVersion,
    config,
  };
}

// BO-05 step 1's live slug check (`checkSlug` Server Action).
export async function isSlugAvailable(slug: string): Promise<boolean> {
  await requireAdmin();
  const row = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  return !row;
}

// BO-05 step 2's theme thumbnails; BO-07 reuses it too (plan's orchestrator
// decision 1).
export async function listThemeOptions(): Promise<Theme[]> {
  await requireAdmin();
  const rows = await db.select().from(themes).orderBy(asc(themes.name));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tokens: themeTokensSchema.parse(row.tokens),
    landingVariant: row.landingVariant,
    isSeed: row.isSeed,
  }));
}
