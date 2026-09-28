import type { Theme } from "@/lib/dal/themes";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";
import { issuesToErrors } from "./validation";

// `formError` is a stable code, not a message: this is a plain function
// (no `t()`, no locale) called synchronously from ImportConfigPanel, which
// maps it to a translated string (I18N-BACKOFFICE-STRINGS lot 4).
export type ImportResult =
  | { ok: true; config: ProductConfig }
  | { ok: false; formError: "malformed_json" }
  | { ok: false; errors: Record<string, string> };

// QA1-P1-M1: "le thème se choisit par son nom si l'id ne correspond pas".
// A pasted `themeId` may be a real id (kept as-is), a theme's name (matched
// case-insensitively, trimmed — a human-written value, or a stale/foreign
// id from another environment retried as a name), or missing/unresolvable
// entirely (falls back silently to the draft's current theme: step 2 stays
// a deliberate, separate action).
export function resolveImportedThemeId(candidate: unknown, themes: Theme[], fallbackThemeId: string): string {
  if (typeof candidate === "string") {
    if (themes.some((theme) => theme.id === candidate)) return candidate;
    const trimmed = candidate.trim().toLowerCase();
    const byName = themes.find((theme) => theme.name.trim().toLowerCase() === trimmed);
    if (byName) return byName.id;
  }
  return fallbackThemeId;
}

// Pipeline: JSON.parse -> reject non-object candidates -> resolve themeId
// -> validate with the same shared schema the backoffice form and the
// `saveProduct` Server Action already use. Never throws.
export function parseImportedConfig(raw: string, themes: Theme[], fallbackThemeId: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, formError: "malformed_json" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, formError: "malformed_json" };
  }

  const candidate = parsed as Record<string, unknown>;
  const resolvedThemeId = resolveImportedThemeId(candidate.themeId, themes, fallbackThemeId);
  const withThemeId = { ...candidate, themeId: resolvedThemeId };

  const result = productConfigSchema.safeParse(withThemeId);
  if (!result.success) return { ok: false, errors: issuesToErrors(result.error.issues) };
  return { ok: true, config: result.data };
}
