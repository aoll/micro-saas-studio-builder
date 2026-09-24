import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { requireAdmin } from "./session";

// Frozen contract (specs/CONTRACT-types.md): V1 stub, a plain update with
// no transition rules (docs/11's contract table). BO-06 replaces it with
// the real transition logic. Called only from the
// `admin/products/[slug]/_actions.ts` Server Action, after `requireAdmin()`
// (also checked here, CLAUDE.md); `note` records the decision (BO-06
// mockup).
export const updateStatus: (productId: string, status: ProductStatus, note: string | null) => Promise<void> = async (
  productId,
  status,
  note,
) => {
  await requireAdmin();
  await db.update(products).set({ status, statusNote: note, updatedAt: new Date() }).where(eq(products.id, productId));
};
