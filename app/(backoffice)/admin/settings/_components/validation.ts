import type { z } from "zod";

// BO-09 (specs/BO-09-seuils.md): `thresholdsInputSchema`'s own English
// messages (its `.refine`, shared with the runtime), translated for the
// admin form. Mirrors product-form/validation.ts's `FRENCH_MESSAGES`.
const FRENCH_MESSAGES: Record<string, string> = {
  "scaleMinConversion must be greater than killMaxConversion":
    "Le seuil « à scaler » doit être supérieur au seuil « à couper »",
};

export function toFrenchMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === "too_small" && issue.origin === "number") {
    return issue.minimum === 1 ? "Doit être au moins 1" : `Doit être au moins ${issue.minimum}`;
  }
  if (issue.code === "too_big" && issue.origin === "number") return `Ne doit pas dépasser ${issue.maximum}`;
  if (issue.code === "invalid_type") return "Valeur invalide";
  return FRENCH_MESSAGES[issue.message] ?? issue.message;
}

// First French message per dotted path, so the same field never shows two
// stacked errors (mirrors product-form/validation.ts's `issuesToErrors`).
export function issuesToErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path in errors) continue;
    errors[path] = toFrenchMessage(issue);
  }
  return errors;
}
