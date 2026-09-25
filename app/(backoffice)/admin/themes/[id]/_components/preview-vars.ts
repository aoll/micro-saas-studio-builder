import type { CSSProperties } from "react";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

// camelCase color token key -> kebab-case CSS variable suffix, same rule as
// components/product/theme-vars.ts (not imported from there: that module
// prefixes with `--light-` / `--dark-` for the product layout's
// `prefers-color-scheme` split, which this preview does not use — it
// renders one mode at a time, directly under its own scoped element).
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// BO-08's preview column (plan's design decision 6): the chosen mode's
// tokens as the *direct* shadcn variables (`--background`, `--primary`…)
// plus `--radius`, scoped to the preview's own root element rather than
// `<html>`. `themeTokensSchema` already rejects values that could break out
// of a `style` attribute, so values are passed through verbatim.
export function previewCssVars(tokens: ThemeTokens, mode: "light" | "dark"): CSSProperties {
  const vars: Record<string, string> = { "--radius": tokens.radius };
  for (const [key, value] of Object.entries(tokens[mode])) {
    vars[`--${kebab(key)}`] = value;
  }
  return vars as CSSProperties;
}
