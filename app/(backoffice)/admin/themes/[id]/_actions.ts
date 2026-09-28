"use server";

import { getTranslations } from "next-intl/server";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { FONT_KEYS } from "@/lib/fonts";
import { requireAdmin } from "@/lib/dal/session";
import { updateTheme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { landingVariantSchema, themeTokensSchema } from "@/lib/schemas/theme-tokens";
import { toThemeErrors } from "./_components/theme-errors";

// BO-08 (specs/BO-08-editeur-theme.md): the editor's only Server Action,
// posting the client's already-validated draft as a single JSON field, same
// shape as admin/products/_actions.ts's `saveProduct` (a Server Action is a
// public POST endpoint, CLAUDE.md: everything is re-validated here). Admin
// checked first, before even looking at `id` or the payload.
export type SaveThemeState = {
  ok?: boolean;
  errors?: Record<string, string>;
  formError?: string;
};

type Locale = ProductConfig["locale"];

const payloadSchema = z.object({ tokens: themeTokensSchema, landingVariant: landingVariantSchema });

// I18N-BACKOFFICE-STRINGS (lot 7): `locale` is bound by the client
// (theme-editor.tsx's `saveTheme.bind(null, theme.id, locale)`, `locale`
// from useLocale()) right before useActionState's own (prevState, formData)
// pair — next/root-params's app() and cookies() both throw in a Server
// Action, so this is the only way to know the admin's language here.
// getTranslations() is only called after requireAdmin(): the guard must
// run first no matter what, even for a malformed locale.
export async function saveTheme(
  id: string,
  locale: Locale,
  _prevState: SaveThemeState,
  formData: FormData,
): Promise<SaveThemeState> {
  await requireAdmin();
  const t = await getTranslations({ locale, namespace: "backoffice-themes" });

  if (!z.uuid().safeParse(id).success) {
    return { formError: t("errors.notFound") };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { formError: t("errors.unreadable") };
  }

  const parsed = payloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return { errors: toThemeErrors(parsed.error.issues, locale) };
  }

  // FONT_KEYS is not part of the frozen `themeTokensSchema` (plan's risk
  // "Frozen schema accepts any fontKey"): checked here instead, so an
  // editor bug (or a tampered request) can never persist a font key
  // `fontFor()` would silently fall back on.
  if (!FONT_KEYS.includes(parsed.data.tokens.fontKey as (typeof FONT_KEYS)[number])) {
    return { errors: { "tokens.fontKey": t("errors.fontOutOfCatalogue") } };
  }

  try {
    const result = await updateTheme(id, parsed.data);
    if (!result) return { formError: t("errors.notFound") };

    updateTag(`theme:${id}`);
    for (const slug of result.productSlugs) {
      updateTag(`product:${slug}`);
    }
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[admin/themes] saveTheme failed", err);
    throw err;
  }
}
