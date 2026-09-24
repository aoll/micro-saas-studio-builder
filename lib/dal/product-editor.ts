import "server-only";
import { db } from "@/lib/db";
import { productVersions, products } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { requireAdmin } from "./session";

// Frozen contract (specs/CONTRACT-types.md): V1 stub, insertion without
// business rules (docs/11's contract table): no slug-uniqueness check
// beyond the database's own unique constraint, no version bump logic.
// BO-05 replaces it with the real 7-step form logic. Called only from the
// `admin/products/_actions.ts` Server Action, after `requireAdmin()` (also
// checked here: a Server Action is a public POST endpoint, CLAUDE.md).
export const createProduct: (config: ProductConfig) => Promise<{ id: string; slug: string; version: number }> = async (
  config,
) => {
  const session = await requireAdmin();
  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        slug: config.slug,
        status: config.status,
        themeId: config.themeId,
        currentVersion: 1,
        locale: config.locale,
        createdBy: session.user.id,
      })
      .returning({ id: products.id, slug: products.slug });
    await tx.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: session.user.id });
    return { id: product!.id, slug: product!.slug, version: 1 };
  });
};
