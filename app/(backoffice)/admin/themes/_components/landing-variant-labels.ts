import { landingVariantSchema, type LandingVariant } from "@/lib/schemas/theme-tokens";
import type { ThemesTranslator } from "./theme-usage";

// BO-07 (specs/BO-07-themes.md); reused by BO-08 (plan's task 3 note).
// I18N-BACKOFFICE-STRINGS (lot 7): the label itself now lives in the
// "landingVariant" key of messages/{fr,en}/backoffice-themes.json — a
// direct translation, no ICU needed (docs/09-arborescence.md's landing
// variant is a closed enum, `landingVariantSchema.options` is its own
// source of truth for iteration).
export const LANDING_VARIANTS = landingVariantSchema.options;

export function landingVariantLabel(variant: LandingVariant, t: ThemesTranslator): string {
  return t(`landingVariant.${variant}`);
}
