import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { requireAdmin } from "./session";

// specs/BO-06-statut.md: the real body, replacing the CONTRACT-types V1
// stub. No transition matrix (plan's orchestrator decision 2 — any status
// to any other, including the frozen contract's scale → scale call): the
// UI alone disables the current status. `requireAdmin` first, then a
// locking transaction so a concurrent edit never races the write: `select
// … for update`, a missing row throws.
export const updateStatus: (productId: string, status: ProductStatus, note: string | null) => Promise<void> = async (
  productId,
  status,
  note,
) => {
  await requireAdmin();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!row) throw new Error(`updateStatus: product ${productId} not found`);

    await tx
      .update(products)
      .set({ status, statusNote: note, updatedAt: new Date() })
      .where(eq(products.id, productId));
  });
};
