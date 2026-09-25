"use client";

import type { CSSProperties } from "react";
import type { Theme } from "@/lib/dal/themes";
import { fontFor } from "@/lib/fonts";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { cn } from "@/components/utils";
import { formatEur } from "./margin";

// BO-05's third column (docs/03-maquettes.md › BO-05, docs/02-ecrans.md):
// a real mini-render of the landing being edited, updated on every
// keystroke — the same principle as ThemeThumbnail (docs/04-nextjs.md's
// "ce sont de vrais mini-rendus React avec les tokens du thème"), but of
// the *product's own* draft rather than a theme sample. Only the chosen
// theme's light tokens are used, for the same reason ThemeThumbnail does:
// this preview is not the sub-app's own `<html>` root, so it cannot rely
// on `prefers-color-scheme` resolving `--light-*`/`--dark-*` variables.
export function LandingPreview({
  slug,
  landing,
  pricing,
  theme,
  branding,
}: {
  slug: string;
  landing: ProductConfig["landing"];
  pricing: ProductConfig["pricing"];
  theme: Theme;
  branding: ProductConfig["branding"];
}) {
  const { light } = theme.tokens;
  const font = fontFor(theme.tokens.fontKey);
  const primary = branding.primaryColor ?? light.primary;

  const rootStyle: CSSProperties = {
    backgroundColor: light.background,
    color: light.foreground,
    borderColor: light.border,
    borderRadius: theme.tokens.radius,
  };

  return (
    <div
      aria-label="Aperçu de la landing"
      className={cn(font.className, "grid gap-4 border p-4 text-left")}
      style={rootStyle}
    >
      <p className="text-xs font-medium" style={{ color: light.mutedForeground }}>
        {`Aperçu · /${slug}`}
      </p>

      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">{landing.headline || "Votre titre apparaîtra ici"}</h2>
        <p style={{ color: light.mutedForeground }}>{landing.subheadline}</p>
        <span
          data-testid="landing-preview-cta"
          className="inline-block w-fit rounded-md px-3 py-1.5 text-sm"
          style={{ backgroundColor: primary, color: light.primaryForeground, borderRadius: theme.tokens.radius }}
        >
          Essayer gratuitement
        </span>
      </div>

      {landing.exampleOutput ? (
        <div
          className="rounded-md border p-3 text-sm whitespace-pre-wrap"
          style={{ borderColor: light.border, backgroundColor: light.card, color: light.cardForeground }}
        >
          {landing.exampleOutput}
        </div>
      ) : null}

      {landing.steps && landing.steps.length > 0 ? (
        <div className="grid gap-2">
          {landing.steps.map((step, index) => (
            <div key={index}>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-sm" style={{ color: light.mutedForeground }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {landing.faq.length > 0 ? (
        <div className="grid gap-2">
          {landing.faq.map((entry, index) => (
            <div key={index}>
              <p className="text-sm font-medium">{entry.question}</p>
              <p className="text-sm" style={{ color: light.mutedForeground }}>
                {entry.answer}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-1.5">
        {pricing.packs.map((pack, index) => (
          <p key={index} className="text-sm">
            {`${pack.credits} crédits · ${formatEur(pack.priceCents)}`}
          </p>
        ))}
      </div>
    </div>
  );
}
