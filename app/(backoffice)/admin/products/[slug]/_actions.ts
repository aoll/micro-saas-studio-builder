"use server";

import { getTranslations } from "next-intl/server";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getProduct } from "@/lib/dal/products";
import { requireAdmin } from "@/lib/dal/session";
import { updateStatus } from "@/lib/dal/product-status";
import { localeSchema, slugSchema, type ProductConfig } from "@/lib/schemas/product-config";
import { statusChangeInputSchema } from "@/lib/schemas/inputs";

// BO-06 (specs/BO-06-statut.md): the modal's only Server Action, one per
// domain (CLAUDE.md), next to admin/products/_actions.ts's saveProduct
// family. Never trusts a client-supplied productId: the slug (bound via
// `.bind(null, slug, locale)`, next/root-params isn't available in Server
// Actions) is re-resolved to the product's real id through getProduct.
export type SetProductStatusState = { ok?: boolean; formError?: string };

// Empty after trimming means "no note" (plan's design): the modal's
// textarea posts "" when the admin clears it, and statusNote is nullable.
function toNote(raw: FormDataEntryValue | null): string | null {
  const trimmed = String(raw ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

// I18N-BACKOFFICE-STRINGS (lot 3, Contract): `locale` is the last
// client-bound argument (after `slug`, before the two React-supplied
// prevState/formData — status-change.tsx binds `.bind(null, slug, locale)`
// from useLocale()). `requireAdmin()` stays the very first call, unchanged
// (Contract's "l'ajout de getTranslations() se fait après cette garde,
// jamais avant") — getTranslations() only runs once the admin check has
// passed.
export async function setProductStatus(
  slug: string,
  locale: ProductConfig["locale"],
  _prevState: SetProductStatusState,
  formData: FormData,
): Promise<SetProductStatusState> {
  await requireAdmin();
  // A Server Action is a public POST endpoint (CLAUDE.md): `locale` is
  // client-bound (useLocale()), not trusted as-is — falls back to "fr"
  // instead of throwing on a tampered value, the same default
  // i18n/request.ts's own backoffice branch uses.
  const t = await getTranslations({
    locale: localeSchema.safeParse(locale).data ?? "fr",
    namespace: "backoffice-decision",
  });

  if (!slugSchema.safeParse(slug).success) {
    return { formError: t("errors.productNotFound") };
  }

  const parsed = statusChangeInputSchema.safeParse({
    status: formData.get("status"),
    note: toNote(formData.get("note")),
  });
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.path[0] === "note");
    return { formError: tooLong ? t("errors.noteTooLong") : t("errors.invalidStatus") };
  }

  const product = await getProduct(slug);
  if (!product) return { formError: t("errors.productNotFound") };

  try {
    await updateStatus(product.id, parsed.data.status, parsed.data.note);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[admin/products/[slug]] setProductStatus failed", err);
    return { formError: t("errors.updateFailed") };
  }

  updateTag(`product:${slug}`);
  updateTag("products");
  return { ok: true };
}
