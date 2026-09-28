import type { FontKey } from "@/lib/fonts";
import type { ThemesTranslator } from "../../_components/theme-usage";

// BO-08's font <select>: FONT_KEYS is the fixed catalogue
// (lib/fonts.ts › "a theme can only reference a key of this catalogue,
// never an arbitrary font"). I18N-BACKOFFICE-STRINGS (lot 7): the readable
// label comes from the "fontLabels" key of
// messages/{fr,en}/backoffice-themes.json instead of a static French
// Record.
export function fontLabel(key: FontKey, t: ThemesTranslator): string {
  return t(`fontLabels.${key}`);
}
