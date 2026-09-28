import { formatUsage, type ThemesTranslator } from "../../_components/theme-usage";

// BO-08's "utilisé par N produits" warning (specs/BO-08-editeur-theme.md,
// docs/02-ecrans.md › BO-08 États à prévoir). Reuses BO-07's `formatUsage`
// (plan's frozen inputs); `role="status"` only when there is something to
// warn about (plan's design decision 7) — a theme used by nobody is not an
// alert, so it stays plain text.
//
// I18N-BACKOFFICE-STRINGS (lot 7): `t` is resolved once by the async
// ThemeEditorLoader and passed down as a plain prop (same reasoning as
// ThemeCard); "usageWarning.appliesImmediately" composes the already
// translated usage sentence with the reminder, rather than concatenating
// two separately translated strings.
export function UsageWarning({ productNames, t }: { productNames: string[]; t: ThemesTranslator }) {
  const usage = formatUsage(productNames, t);
  if (productNames.length === 0) {
    return <p className="text-sm text-muted-foreground">{usage}</p>;
  }

  return (
    <p role="status" className="text-sm text-muted-foreground">
      {t("usageWarning.appliesImmediately", { usage })}
    </p>
  );
}
