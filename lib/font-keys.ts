// Split out of lib/fonts.ts: this file has no `next/font/google` import, so
// a consumer that only needs the key catalogue (not the loaders themselves)
// stays safe to import under plain Node — e2e specs run outside Next's
// compiler, and `next/font/google` only resolves inside it (the package
// ships an intentionally empty font/google/index.js; Next's SWC plugin
// statically rewrites the call, it never runs as plain JS).
export const FONT_KEYS = ["serif", "grotesk", "sans", "rounded"] as const;
export type FontKey = (typeof FONT_KEYS)[number];
