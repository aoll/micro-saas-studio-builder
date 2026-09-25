"use server";

import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { FONT_KEYS } from "@/lib/fonts";
import { requireAdmin } from "@/lib/dal/session";
import { updateTheme } from "@/lib/dal/themes";
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

const payloadSchema = z.object({ tokens: themeTokensSchema, landingVariant: landingVariantSchema });

export async function saveTheme(id: string, _prevState: SaveThemeState, formData: FormData): Promise<SaveThemeState> {
  await requireAdmin();

  if (!z.uuid().safeParse(id).success) {
    return { formError: "Thème introuvable" };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { formError: "Données illisibles" };
  }

  const parsed = payloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return { errors: toThemeErrors(parsed.error.issues) };
  }

  // FONT_KEYS is not part of the frozen `themeTokensSchema` (plan's risk
  // "Frozen schema accepts any fontKey"): checked here instead, so an
  // editor bug (or a tampered request) can never persist a font key
  // `fontFor()` would silently fall back on.
  if (!FONT_KEYS.includes(parsed.data.tokens.fontKey as (typeof FONT_KEYS)[number])) {
    return { errors: { "tokens.fontKey": "Police hors catalogue" } };
  }

  try {
    const result = await updateTheme(id, parsed.data);
    if (!result) return { formError: "Thème introuvable" };

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
