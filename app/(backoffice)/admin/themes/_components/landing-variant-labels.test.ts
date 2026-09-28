import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en/backoffice-themes.json";
import fr from "@/messages/fr/backoffice-themes.json";
import { landingVariantLabel } from "./landing-variant-labels";
import type { ThemesTranslator } from "./theme-usage";

// I18N-BACKOFFICE-STRINGS (lot 7): BO-07's "Variante « … »" and BO-08's
// landing variant <select> both need this label translated (reused by
// theme-editor.tsx too, plan's design decision).
const t = createTranslator({
  locale: "fr",
  messages: { "backoffice-themes": fr },
  namespace: "backoffice-themes",
}) as unknown as ThemesTranslator;
const tEn = createTranslator({
  locale: "en",
  messages: { "backoffice-themes": en },
  namespace: "backoffice-themes",
}) as unknown as ThemesTranslator;

describe("landingVariantLabel", () => {
  it.each([
    ["centered", "hero centré"],
    ["split", "hero + exemple"],
    ["minimal", "minimal"],
  ] as const)("labels %s in French", (variant, label) => {
    expect(landingVariantLabel(variant, t)).toBe(label);
  });

  it.each([
    ["centered", "centered hero"],
    ["split", "hero + example"],
    ["minimal", "minimal"],
  ] as const)("labels %s in English", (variant, label) => {
    expect(landingVariantLabel(variant, tEn)).toBe(label);
  });
});
