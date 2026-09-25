import type { FontKey } from "@/lib/fonts";

// BO-08's font `<select>`: FONT_KEYS is the fixed catalogue
// (lib/fonts.ts › "a theme can only reference a key of this catalogue,
// never an arbitrary font"), each key carries a readable French label.
export const FONT_LABELS: Record<FontKey, string> = {
  serif: "Serif (éditorial)",
  grotesk: "Grotesque (néon)",
  sans: "Sans-serif (corporate)",
  rounded: "Arrondie (ludique)",
};
