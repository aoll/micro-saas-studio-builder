import type { z } from "zod";

// BO-08 (specs/BO-08-editeur-theme.md): translates the frozen
// `themeTokensSchema` / `landingVariantSchema`'s own issues (English,
// shared with the runtime, plan's design decision) to the message shown
// next to a field of the editor. Mirrors
// admin/products/_components/product-form/validation.ts's
// `toFrenchMessage` / `issuesToErrors`, scoped to this schema's two custom
// regex messages; anything else (a Zod built-in, e.g. the enum message on
// `landingVariant`) falls back to the raw message rather than being
// silently dropped.
const FRENCH_MESSAGES: Record<string, string> = {
  "must be a #hex color or a color function call (oklch, hsl, rgb…)":
    "Doit être une couleur CSS valide (#hex ou oklch/hsl/rgb…)",
  "must be a CSS length in rem or px": "Doit être une longueur CSS en rem ou px (ex. 0.5rem)",
};

// First message per dotted path (e.g. "tokens.light.background"), same
// convention as issuesToErrors.
export function toThemeErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path in errors) continue;
    errors[path] = FRENCH_MESSAGES[issue.message] ?? issue.message;
  }
  return errors;
}
