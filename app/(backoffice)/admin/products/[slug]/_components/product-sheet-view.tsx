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
// pointing at the live sub-app.
export function ProductSheetView({ sheet }: { sheet: ProductSheetViewModel }) {
  return (
    <div className="grid gap-6">
      <SheetHeader sheet={sheet} />
      <SheetKpis kpis={sheet.kpis} />
      {sheet.hasData ? (
        <>
          <FunnelCard rows={sheet.funnelRows} />
          <TrendChart points={sheet.trend} />
        </>
      ) : (
        <EmptyState
          title="Aucune donnée pour l'instant"
          description="Le funnel et les courbes apparaîtront dès la première visite."
          action={
            <Button asChild variant="outline">
              <a href={`/${sheet.slug}`} target="_blank" rel="noopener noreferrer">
                Voir /{sheet.slug} ↗
              </a>
            </Button>
          }
        />
      )}
      <DecisionPanel decision={sheet.decision} />
    </div>
  );
}
