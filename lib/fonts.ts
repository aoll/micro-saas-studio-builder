// The fixed font catalogue `next/font` requires (docs/04-nextjs.md ›
// Thèmes, polices et images): fonts are downloaded and self-hosted at
// build time, so a theme can only reference a key of this catalogue, never
// an arbitrary font. The 4 keys are semantic and shared with CONTRACT-data's
// seed (plan decision 1): editorial -> serif, neon -> grotesk,
// corporate -> sans, playful -> rounded.
import { Fraunces, Inter, Nunito, Space_Grotesk } from "next/font/google";

export const FONT_KEYS = ["serif", "grotesk", "sans", "rounded"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

// Every loader shares the same `variable`: the theme applies its font by
// putting the matching `className` on `<html>`, and `--font-theme` is read
// by `@theme inline` in app/globals.css. `preload: false` so only the
// active theme's font is preloaded by the browser, not all 4. The options
// object is repeated (not shared through a constant): `next/font`'s
// compiler statically analyzes each call and requires an inline literal.
const serif = Fraunces({ variable: "--font-theme", display: "swap", preload: false });
const grotesk = Space_Grotesk({ variable: "--font-theme", display: "swap", preload: false });
const sans = Inter({ variable: "--font-theme", display: "swap", preload: false });
const rounded = Nunito({ variable: "--font-theme", display: "swap", preload: false });

const FONTS: Record<FontKey, { variable: string; className: string }> = { serif, grotesk, sans, rounded };

// Unknown key (a theme edited outside the catalogue) falls back to `sans`
// rather than throwing: the layout still renders with a readable font.
export function fontFor(key: string): { variable: string; className: string } {
  return FONTS[key as FontKey] ?? FONTS.sans;
}
