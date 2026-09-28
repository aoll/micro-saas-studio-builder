"use server";

import { getTranslations } from "next-intl/server";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal/session";
import { resetThresholds, saveThresholds } from "@/lib/dal/thresholds";
import { thresholdsInputSchema } from "@/lib/schemas/inputs";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { parsePercentInput, percentToRate } from "./_components/percent";
import { issuesToErrors } from "./_components/validation";

// BO-09 (specs/BO-09-seuils.md): one Server Action per form (CLAUDE.md's
// "une action par domaine"), both re-checking `requireAdmin()` even though
// `(backoffice)/layout.tsx` also gates the whole admin (mirrors every
// other admin action in this repo).
export type ThresholdsActionState = { ok?: boolean; errors?: Record<string, string>; formError?: string };

// I18N-BACKOFFICE-STRINGS lot 8: `next/root-params` isn't available in a
// Server Action (docs/08-stack.md › i18n), so the client component binds
// its own `useLocale()` to `.bind(null, productId, locale)` before handing
// the action to `useActionState` — the last explicit argument before the
// two `useActionState` appends (`prevState`, `formData`).
type Locale = ProductConfig["locale"];

const productIdSchema = z.uuid().nullable();

function candidateFromForm(formData: FormData) {
  return {
    minVisits: Number(formData.get("minVisits")),
    killMaxConversion: percentToRate(parsePercentInput(String(formData.get("killMaxConversion") ?? ""))),
    scaleMinConversion: percentToRate(parsePercentInput(String(formData.get("scaleMinConversion") ?? ""))),
    scaleRequiresPositiveMargin: formData.get("scaleRequiresPositiveMargin") === "on",
  };
}

// drizzle wraps the Postgres driver's error on `.cause` (lib/db/schema.test.ts,
// plan's orchestrator decision 6); `23514` is a CHECK violation —
// `decision_thresholds_kill_lt_scale`, the one this form can actually
// trigger past its own Zod `.refine` (a race with another admin's save).
function isCheckViolation(err: unknown): boolean {
  const cause = (err as { cause?: { code?: unknown } } | undefined)?.cause;
  const code = cause?.code ?? (err as { code?: unknown } | undefined)?.code;
  return code === "23514";
}

// BO-09 spec bullets 1, 2, 3, 5: saves the studio defaults (`productId ===
// null`) or a single product's override, from a form posting the % fields
// directly (no client-side JSON blob, unlike BO-05's product form: this
// form has 4 fields only).
export async function saveThresholdSettings(
  productId: string | null,
  locale: Locale,
  _prevState: ThresholdsActionState,
  formData: FormData,
): Promise<ThresholdsActionState> {
  await requireAdmin();
  const t = await getTranslations({ locale, namespace: "backoffice-settings" });

  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) return { formError: t("errors.invalidProduct") };

  const parsed = thresholdsInputSchema.safeParse(candidateFromForm(formData));
  if (!parsed.success) return { errors: issuesToErrors(parsed.error.issues, t) };

  try {
    const result = await saveThresholds(parsedId.data, parsed.data);
    if (!result.ok) return { formError: t("errors.productNotFound") };
    updateTag("thresholds");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (isCheckViolation(err)) return { errors: { scaleMinConversion: t("errors.scaleGreaterThanKill") } };
    console.error("[admin/settings] saveThresholdSettings failed", err);
    throw err;
  }
}

// BO-09 spec bullet 2's « Réinitialiser »: deletes the product's override.
export async function resetProductThresholds(
  productId: string,
  locale: Locale,
  _prevState: ThresholdsActionState,
  _formData: FormData,
): Promise<ThresholdsActionState> {
  await requireAdmin();
  const t = await getTranslations({ locale, namespace: "backoffice-settings" });

  const parsedId = z.uuid().safeParse(productId);
  if (!parsedId.success) return { formError: t("errors.invalidProduct") };

  try {
    const result = await resetThresholds(parsedId.data);
    if (!result.ok) return { formError: t("errors.productNotFound") };
    updateTag("thresholds");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[admin/settings] resetProductThresholds failed", err);
    throw err;
  }
}
