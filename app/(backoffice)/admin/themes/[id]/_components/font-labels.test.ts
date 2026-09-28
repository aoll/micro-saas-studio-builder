import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en/backoffice-themes.json";
import fr from "@/messages/fr/backoffice-themes.json";
import { fontLabel } from "./font-labels";
import type { ThemesTranslator } from "../../_components/theme-usage";

// I18N-BACKOFFICE-STRINGS (lot 7): BO-08's font <select> options, moved
// from a static French Record to a lookup into "fontLabels", keyed by the
// fixed font catalogue (lib/fonts.ts).
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

describe("fontLabel", () => {
  it.each([
    ["serif", "Serif (éditorial)"],
    ["grotesk", "Grotesque (néon)"],
    ["sans", "Sans-serif (corporate)"],
    ["rounded", "Arrondie (ludique)"],
  ] as const)("labels %s in French", (key, label) => {
    expect(fontLabel(key, t)).toBe(label);
  });

  it.each([
    ["serif", "Serif (editorial)"],
    ["grotesk", "Grotesque (neon)"],
    ["sans", "Sans-serif (corporate)"],
    ["rounded", "Rounded (playful)"],
  ] as const)("labels %s in English", (key, label) => {
    expect(fontLabel(key, tEn)).toBe(label);
  });
});
