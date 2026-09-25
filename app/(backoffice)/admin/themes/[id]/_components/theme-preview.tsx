import { fontFor } from "@/lib/fonts";
import type { LandingVariant, ThemeTokens } from "@/lib/schemas/theme-tokens";
import { cn } from "@/components/utils";
import { previewCssVars } from "./preview-vars";

// BO-08's preview column (docs/03-maquettes.md › BO-08: "Tokens à gauche,
// rendu de la landing et des composants à droite", plan's design decision
// 6). A real mini-render (docs/04-nextjs.md: "ce sont de vrais mini-rendus
// React avec les tokens du thème"), scoped through `previewCssVars` on its
// own root rather than `<html>`: `var(--token)` in every child's inline
// style resolves through this root, live as the draft tokens change.
export function ThemePreview({
  tokens,
  landingVariant,
  mode,
  sampleProductName,
}: {
  tokens: ThemeTokens;
  landingVariant: LandingVariant;
  mode: "light" | "dark";
  sampleProductName?: string;
}) {
  const font = fontFor(tokens.fontKey);
  const headline = sampleProductName ?? "Produit exemple";

  return (
    <div
      data-testid="theme-preview"
      data-mode={mode}
      data-variant={landingVariant}
      className={cn(font.className, "flex flex-col gap-4 border p-4")}
      style={{
        ...previewCssVars(tokens, mode),
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        borderColor: "var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className={cn("flex gap-4", landingVariant === "split" && "items-center justify-between")}>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{headline}</h2>
          {landingVariant !== "minimal" ? (
            <p style={{ color: "var(--muted-foreground)" }}>Un sous-titre de démonstration pour l’aperçu.</p>
          ) : null}
          <button
            type="button"
            className="w-fit rounded px-3 py-1.5 text-sm"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: "var(--radius)",
            }}
          >
            Essayer
          </button>
        </div>
        {landingVariant === "split" ? (
          <div
            data-testid="theme-preview-example"
            className="w-24 shrink-0 rounded p-3 text-xs"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--card-foreground)",
              borderRadius: "var(--radius)",
            }}
          >
            Exemple de résultat
          </div>
        ) : null}
      </div>

      <div data-testid="theme-preview-components" className="flex flex-wrap items-center gap-2">
        <button
          data-testid="theme-preview-button-primary"
          type="button"
          className="rounded px-3 py-1.5 text-sm"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            borderRadius: "var(--radius)",
          }}
        >
          Primaire
        </button>
        <button
          data-testid="theme-preview-button-secondary"
          type="button"
          className="rounded px-3 py-1.5 text-sm"
          style={{
            backgroundColor: "var(--secondary)",
            color: "var(--secondary-foreground)",
            borderRadius: "var(--radius)",
          }}
        >
          Secondaire
        </button>
        <span
          data-testid="theme-preview-badge-accent"
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          Accent
        </span>
        <span
          data-testid="theme-preview-badge-destructive"
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ backgroundColor: "var(--destructive)", color: "var(--primary-foreground)" }}
        >
          Erreur
        </span>
      </div>
    </div>
  );
}
