import { formatUsage } from "../../_components/theme-usage";

// BO-08's "utilisé par N produits" warning (specs/BO-08-editeur-theme.md,
// docs/02-ecrans.md › BO-08 États à prévoir). Reuses BO-07's `formatUsage`
// (plan's frozen inputs); `role="status"` only when there is something to
// warn about (plan's design decision 7) — a theme used by nobody is not an
// alert, so it stays plain text.
export function UsageWarning({ productNames }: { productNames: string[] }) {
  if (productNames.length === 0) {
    return <p className="text-sm text-muted-foreground">{formatUsage(productNames)}</p>;
  }

  return (
    <p role="status" className="text-sm text-muted-foreground">
      {formatUsage(productNames)}. Les modifications s&apos;appliquent immédiatement.
    </p>
  );
}
