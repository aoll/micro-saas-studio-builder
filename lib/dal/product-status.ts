import "server-only";
import type { ProductStatus } from "@/lib/schemas/product-config";

// Frozen contract (specs/CONTRACT-types.md): V1 stub. BO-06 replaces it
// with the real transition logic. Called only from the
// `admin/products/[slug]/_actions.ts` Server Action, after
// `requireAdmin()`; `note` records the decision (BO-06 mockup).
export const updateStatus: (
  productId: string,
  status: ProductStatus,
  note: string | null,
) => Promise<void> = async () => {
  throw new Error("not implemented");
};
