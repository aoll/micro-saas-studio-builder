import Link from "next/link";
import type { Theme } from "@/lib/dal/themes";
import { Card } from "@/components/ui/card";
import { ThemeThumbnail } from "@/components/backoffice/theme-thumbnail";
import { landingVariantLabel } from "./landing-variant-labels";
import { formatUsage, type ThemesTranslator } from "./theme-usage";

// BO-07 (specs/BO-07-themes.md): one card of the theme library grid. The
// card's own <h2> carries the theme's name, so ThemeThumbnail is rendered
// without `name` (plan's design decision 4) to avoid duplicating it.
//
// The heading links to the theme's BO-08 editor (/admin/themes/[id]): only
// the heading text is wrapped, so the link's accessible name stays the
// theme name instead of the whole card's text, and no interactive element
// ends up nested inside another.
//
// I18N-BACKOFFICE-STRINGS (lot 7): `t` is resolved once by the async
// ThemeLibrary (`getTranslations("backoffice-themes")`) and passed down as
// a plain prop, so ThemeCard itself stays a synchronous Server Component —
// composing an async component inside another Server Component's JSX tree
// needs the RSC renderer, which the plain react-dom `render()` this
// component's own tests use does not provide.
export function ThemeCard({ theme, productNames, t }: { theme: Theme; productNames: string[]; t: ThemesTranslator }) {
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-base font-semibold">
        <Link
          href={`/admin/themes/${theme.id}`}
          className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {theme.name}
        </Link>
      </h2>
      <ThemeThumbnail tokens={theme.tokens} landingVariant={theme.landingVariant} />
      <p className="text-sm text-muted-foreground" data-count={productNames.length}>
        {formatUsage(productNames, t)}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("card.variantLabel", { variant: landingVariantLabel(theme.landingVariant, t) })}
      </p>
    </Card>
  );
}
