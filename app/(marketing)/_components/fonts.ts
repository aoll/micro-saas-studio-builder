import { Archivo, IBM_Plex_Mono, Manrope } from "next/font/google";

// The `(marketing)` look, shared by the landing and the making-of: Archivo
// for headings, Manrope for the prose, IBM Plex Mono for URLs and data
// labels. Set as CSS variables on the marketing root layout, so the products
// keep their own theme fonts (lib/fonts.ts).
// Archivo is loaded as its variable font: listing static weights makes
// Turbopack fail to resolve the font files (its CSS carries `font-stretch`).
export const display = Archivo({
  subsets: ["latin"],
  variable: "--font-mk-display",
  display: "swap",
});

export const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mk-sans",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mk-mono",
  display: "swap",
});
