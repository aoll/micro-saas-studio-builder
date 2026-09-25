"use server";

import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getProduct } from "@/lib/dal/products";
import { requireAdmin } from "@/lib/dal/session";
import { updateStatus } from "@/lib/dal/product-status";
import { slugSchema } from "@/lib/schemas/product-config";
import { statusChangeInputSchema } from "@/lib/schemas/inputs";

// BO-06 (specs/BO-06-statut.md): the modal's only Server Action, one per
// domain (CLAUDE.md), next to admin/products/_actions.ts's saveProduct
// family. Never trusts a client-supplied productId: the slug (bound via
// `.bind(null, slug)`, next/root-params isn't available in Server
// Actions) is re-resolved to the product's real id through getProduct.
export type SetProductStatusState = { ok?: boolean; formError?: string };

// Empty after trimming means "no note" (plan's design): the modal's
// textarea posts "" when the admin clears it, and statusNote is nullable.
function toNote(raw: FormDataEntryValue | null): string | null {
  const trimmed = String(raw ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export async function setProductStatus(
  slug: string,
  _prevState: SetProductStatusState,
  formData: FormData,
): Promise<SetProductStatusState> {
  await requireAdmin();

  if (!slugSchema.safeParse(slug).success) {
    return { formError: "Produit introuvable" };
  }

  const parsed = statusChangeInputSchema.safeParse({
    status: formData.get("status"),
    note: toNote(formData.get("note")),
  });
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.path[0] === "note");
    return { formError: tooLong ? "Note trop longue (500 caractères max)" : "Statut invalide" };
  }

  const product = await getProduct(slug);
  if (!product) return { formError: "Produit introuvable" };

  try {
    await updateStatus(product.id, parsed.data.status, parsed.data.note);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[admin/products/[slug]] setProductStatus failed", err);
    return { formError: "Le statut n'a pas pu être changé" };
  }

  updateTag(`product:${slug}`);
  updateTag("products");
  return { ok: true };
}
