import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { DecisionPanel } from "./decision-panel";
import { FunnelCard } from "./funnel-card";
import type { ProductSheetViewModel } from "./sheet";
import { SheetHeader } from "./sheet-header";
import { SheetKpis } from "./sheet-kpis";
import { TrendChart } from "./trend-chart";

// docs/02-ecrans.md › BO-03 état "Produit sans données" (plan design decision 5): the KPIs and
// the decision panel stay (they render "—" on their own for a product with no data), only the
// funnel and the trend chart — which have nothing to show — are replaced by one EmptyState
// pointing at the live sub-app. I18N-BACKOFFICE-STRINGS: async, its own translator, and — since
// React Testing Library's client renderer can't render an async component nested as plain JSX
// (product-tabs.tsx's comment, app/(products)/not-found.tsx's precedent) — `SheetHeader` is
// called and awaited directly rather than mounted as `<SheetHeader ... />`.
export async function ProductSheetView({ sheet }: { sheet: ProductSheetViewModel }) {
  const t = await getTranslations("backoffice-product-sheet");
  const header = await SheetHeader({ sheet });
  return (
    <div className="grid gap-6">
      {header}
      <SheetKpis kpis={sheet.kpis} />
      {sheet.hasData ? (
        <>
          <FunnelCard title={t("funnel.title")} rows={sheet.funnelRows} />
          <TrendChart points={sheet.trend} />
        </>
      ) : (
        <EmptyState
          title={t("emptyState.title")}
          description={t("emptyState.description")}
          action={
            <Button asChild variant="outline">
              <a href={`/${sheet.slug}`} target="_blank" rel="noopener noreferrer">
                {t("viewLive", { slug: sheet.slug })}
              </a>
            </Button>
          }
        />
      )}
      <DecisionPanel
        decision={sheet.decision}
        product={{ productId: sheet.productId, slug: sheet.slug, name: sheet.name, status: sheet.status }}
        metrics={sheet.decisionMetrics}
        thresholds={sheet.thresholds}
      />
    </div>
  );
}
