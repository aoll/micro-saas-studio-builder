import type { CSSProperties } from "react";
import { fontFor } from "@/lib/fonts";
import type { LandingVariant, ThemeTokens } from "@/lib/schemas/theme-tokens";
import { cn } from "@/components/utils";

// A real mini-render of a theme's landing (docs/04-nextjs.md › Thèmes,
// polices et images: "ce sont de vrais mini-rendus React avec les tokens du
// thème, pas des images"). Used by BO-05's step 2 (theme picker) and BO-07's
// library (docs/02-ecrans.md); shared here rather than colocated under
// product-form/ so both can import it without depending on each other.
//
// Only the theme's *light* tokens are used: unlike the product layout
// (components/product/theme-vars.ts), this thumbnail is not the product's
// own `<html>` root, so it cannot rely on `--light-*`/`--dark-*` variables
// resolving through `prefers-color-scheme`. Inline styles keep it a faithful
// preview regardless of the backoffice's own color scheme.
export function ThemeThumbnail({
  tokens,
  landingVariant,
  name,
}: {
  tokens: ThemeTokens;
  landingVariant: LandingVariant;
  name?: string;
}) {
  const { light } = tokens;
  const font = fontFor(tokens.fontKey);

  const rootStyle: CSSProperties = {
    backgroundColor: light.background,
    color: light.foreground,
    borderColor: light.border,
    borderRadius: tokens.radius,
  };

  return (
    <div
      data-testid="theme-thumbnail"
      data-variant={landingVariant}
      aria-hidden="true"
      className={cn(font.className, "flex flex-col gap-2 border p-3 text-left")}
      style={rootStyle}
    >
      <div
        data-testid="theme-thumbnail-accent"
        className="h-2 w-10 rounded-full"
        style={{ backgroundColor: light.primary, borderRadius: tokens.radius }}
      />
      <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: light.mutedForeground, opacity: 0.4 }} />
      <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: light.mutedForeground, opacity: 0.4 }} />
      {name ? <p className="mt-1 text-xs font-medium">{name}</p> : null}
    </div>
  );
}
