import type { LandingVariant } from "@/lib/schemas/theme-tokens";

// BO-07 (specs/BO-07-themes.md); reused by BO-08 (plan's task 3 note).
export const LANDING_VARIANT_LABELS: Record<LandingVariant, string> = {
  centered: "hero centré",
  split: "hero + exemple",
  minimal: "minimal",
};
