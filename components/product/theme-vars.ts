import type { CSSProperties } from "react";
import type { ProductConfig } from "@/lib/schemas/product-config";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

// camelCase color token key -> kebab-case CSS variable suffix, e.g.
// `cardForeground` -> `card-foreground`.
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// Theme tokens as inline CSS variables on the product layout's `<html>`
// (docs/04-nextjs.md › Thèmes, polices et images): app/globals.css reads
// `--light-*` / `--dark-*` with a `prefers-color-scheme` media query and no
// theme JavaScript. `themeTokensSchema` already rejects values that could
// break out of a `style` attribute (`;`, `}`, `url(`…), so values are passed
// through verbatim.
export function themeCssVars(tokens: ThemeTokens, branding: ProductConfig["branding"]): CSSProperties {
  const vars: Record<string, string> = { "--radius": tokens.radius };

  for (const [key, value] of Object.entries(tokens.light)) {
    vars[`--light-${kebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.dark)) {
    vars[`--dark-${kebab(key)}`] = value;
  }

  if (branding.primaryColor) {
    vars["--light-primary"] = branding.primaryColor;
    vars["--dark-primary"] = branding.primaryColor;
  }

  return vars as CSSProperties;
}
