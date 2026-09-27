import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

// The making-of's "control room" look: a monospace face for the figures and
// labels, a plain sans for the prose. Scoped to this page through CSS
// variables set on its wrapper, so the landing and the products keep their own
// fonts (lib/fonts.ts is the products' theme catalogue, not reused here).
export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-mo-mono",
  display: "swap",
});

export const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mo-sans",
  display: "swap",
});
