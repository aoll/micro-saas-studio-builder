import type { z } from "zod";

// BO-09 (specs/BO-09-seuils.md) + I18N-BACKOFFICE-STRINGS (lot 8):
// `thresholdsInputSchema`'s own English messages (its `.refine`, shared
// with the runtime) translated for the admin form via an injected
// translator, so this module stays framework-agnostic (no next-intl import,
// callable from both `getTranslations` server-side in `_actions.ts` and
// `useTranslations` client-side, though this file itself is only used
// server-side today). Mirrors product-form/validation.ts's message-mapping
// shape, one level up: values come from `messages/{fr,en}/backoffice-settings.json`
// instead of a hardcoded record.
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function toMessage(issue: z.core.$ZodIssue, t: Translate): string {
  if (issue.code === "too_small" && issue.origin === "number") {
    return t("errors.minVisitsTooSmall", { minimum: Number(issue.minimum) });
  }
  if (issue.code === "too_big" && issue.origin === "number") {
    return t("errors.tooBig", { maximum: Number(issue.maximum) });
  }
  if (issue.code === "invalid_type") return t("errors.invalidValue");
  if (issue.message === "scaleMinConversion must be greater than killMaxConversion") {
    return t("errors.scaleGreaterThanKill");
  }
  return issue.message;
}

// First message per dotted path, so the same field never shows two stacked
// errors (mirrors product-form/validation.ts's `issuesToErrors`).
export function issuesToErrors(issues: readonly z.core.$ZodIssue[], t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path in errors) continue;
    errors[path] = toMessage(issue, t);
  }
  return errors;
}
