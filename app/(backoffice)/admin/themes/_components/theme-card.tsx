import type { Theme } from "@/lib/dal/themes";
import { Card } from "@/components/ui/card";
import { ThemeThumbnail } from "@/components/backoffice/theme-thumbnail";
import { LANDING_VARIANT_LABELS } from "./landing-variant-labels";
import { formatUsage } from "./theme-usage";

// BO-07 (specs/BO-07-themes.md): one card of the theme library grid. The
// card's own <h2> carries the theme's name, so ThemeThumbnail is rendered
// without `name` (plan's design decision 4) to avoid duplicating it.
export function ThemeCard({ theme, productNames }: { theme: Theme; productNames: string[] }) {
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-base font-semibold">{theme.name}</h2>
      <ThemeThumbnail tokens={theme.tokens} landingVariant={theme.landingVariant} />
      <p className="text-sm text-muted-foreground" data-count={productNames.length}>
        {formatUsage(productNames)}
      </p>
      <p className="text-xs text-muted-foreground">Variante « {LANDING_VARIANT_LABELS[theme.landingVariant]} »</p>
    </Card>
  );
}
