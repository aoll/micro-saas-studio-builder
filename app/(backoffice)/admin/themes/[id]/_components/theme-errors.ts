import type { z } from "zod";
import type { ProductConfig } from "@/lib/schemas/product-config";

type Locale = ProductConfig["locale"];

// BO-08 (specs/BO-08-editeur-theme.md): translates the frozen
// `themeTokensSchema` / `landingVariantSchema`'s own issues (English,
// shared with the runtime, plan's design decision) to the message shown
// next to a field of the editor. Mirrors
// admin/products/_components/product-form/validation.ts's
// `toFrenchMessage` / `issuesToErrors`, scoped to this schema's two custom
// regex messages; anything else (a Zod built-in, e.g. the enum message on
// `landingVariant`) falls back to the raw message rather than being
// silently dropped.
//
// I18N-BACKOFFICE-STRINGS (lot 7): a manual per-locale substitution table,
// not next-intl messages — these keys are Zod's own raw English issue
// messages, translated by hand like validation.ts elsewhere in the run,
// not application copy that belongs in messages/backoffice-themes.json.
const MESSAGES: Record<Locale, Record<string, string>> = {
  fr: {
    "must be a #hex color or a color function call (oklch, hsl, rgb…)":
      "Doit être une couleur CSS valide (#hex ou oklch/hsl/rgb…)",
    "must be a CSS length in rem or px": "Doit être une longueur CSS en rem ou px (ex. 0.5rem)",
  },
  en: {
    "must be a #hex color or a color function call (oklch, hsl, rgb…)":
      "Must be a valid CSS color (#hex or oklch/hsl/rgb…)",
    "must be a CSS length in rem or px": "Must be a CSS length in rem or px (e.g. 0.5rem)",
  },
};

// First message per dotted path (e.g. "tokens.light.background"), same
// convention as issuesToErrors. Defaults to "fr": every caller before this
// spec relied on the French translation, and _actions.ts always passes the
// admin's explicit locale now.
export function toThemeErrors(issues: readonly z.core.$ZodIssue[], locale: Locale = "fr"): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path in errors) continue;
    errors[path] = MESSAGES[locale][issue.message] ?? issue.message;
  }
  return errors;
}
