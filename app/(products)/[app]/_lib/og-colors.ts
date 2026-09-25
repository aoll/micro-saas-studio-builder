import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import type { ProductConfig } from "@/lib/schemas/product-config";

// I18N-SEO (specs/I18N-SEO.md): shared by icon.tsx and opengraph-image.tsx
// (orchestrator decision, 2026-09-25 — replaces plan decision B2's
// duplicated helper). Satori (the renderer behind next/og's
// `ImageResponse`) only understands a subset of CSS color syntax: `#hex`
// and the classic functional notations (`rgb()`/`rgba()`,
// `hsl()`/`hsla()`). Newer syntaxes such as `oklch()` — which
// `lib/schemas/theme-tokens.ts` otherwise allows for the live UI — are not
// guaranteed to render, so they fall back to a safe default instead of
// risking a blank or broken image.
export function drawable(value: string, fallback: string): string {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  const isRgbOrHsl = /^(rgb|rgba|hsl|hsla)\([0-9.%\s/,]+\)$/.test(value);
  return isHex || isRgbOrHsl ? value : fallback;
}

export type OgColors = {
  primary: string;
  onPrimary: string;
  background: string;
  foreground: string;
  mutedForeground: string;
};

// Light tokens only (orchestrator decision 5): the generated icon and OG
// image are single static assets, not theme-aware at request time. The
// branding's `primaryColor` override (docs/01-produit.md › Thèmes) wins
// over the theme's own `primary`, same precedence as `theme-vars.ts`'s
// `themeCssVars` for the live UI.
export function resolveOgColors(light: ThemeTokens["light"], branding: ProductConfig["branding"]): OgColors {
  const primarySource = branding.primaryColor ?? light.primary;
  return {
    primary: drawable(primarySource, "#000000"),
    onPrimary: drawable(light.primaryForeground, "#ffffff"),
    background: drawable(light.background, "#ffffff"),
    foreground: drawable(light.foreground, "#000000"),
    mutedForeground: drawable(light.mutedForeground, "#666666"),
  };
}
