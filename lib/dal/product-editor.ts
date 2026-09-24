import "server-only";
import type { ProductConfig } from "@/lib/schemas/product-config";

// Frozen contract (specs/CONTRACT-types.md): V1 stub, insertion without
// business rules (docs/11's contract table); BO-05 replaces it with the
// real 7-step form logic (slug uniqueness, version bump). Called only from
// the `admin/products/_actions.ts` Server Action, after `requireAdmin()`.
export const createProduct: (
  config: ProductConfig,
) => Promise<{ id: string; slug: string; version: number }> = async () => {
  throw new Error("not implemented");
};
