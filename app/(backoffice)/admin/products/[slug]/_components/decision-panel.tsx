import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";
import type { ProductStatus } from "@/lib/schemas/product-config";
import type { DecisionCopy } from "./decision-copy";
import { DecisionGauge } from "./decision-gauge";
import { StatusChange } from "./status/status-change";

export type DecisionPanelProduct = { productId: string; slug: string; name: string; status: ProductStatus };

// docs/01-produit.md › "les seuils de décision" (BO-03): the studio's 4 thresholds, this
// product's current values, and — when there is one — the suggestion `toDecisionCopy` derived
// from the same `evaluate()` as the header's DecisionBadge. `null` (a killed product, or a
// product below the min-visits gate that still shows a "not enough data" line — decision-copy.ts
// handles both) renders no suggestion block at all.
//
// specs/mockups/BO-06.png: when the suggestion actually carries a decision (`badge` is `kill` or
// `scale`, not the "not enough visits" or "no suggestion" copies), the box also mounts
// `StatusChange`, preselected on that suggestion, so the admin can act right where the numbers
// justify it — a second mount point next to the header's (BO-06 task item 2).
export function DecisionPanel({
  decision,
  product,
  metrics,
  thresholds,
}: {
  decision: DecisionCopy;
  product: DecisionPanelProduct;
  metrics: DecisionMetrics;
  thresholds: Thresholds;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statut et seuils de décision</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {decision.thresholds.map((line) => (
            <div key={line.label} className="contents">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="text-right font-medium">{line.value}</dd>
            </div>
          ))}
        </dl>
        <DecisionGauge metrics={metrics} thresholds={thresholds} />
        <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Visites</dt>
            <dd className="font-medium">{decision.current.visits}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conversion</dt>
            <dd className="font-medium">{decision.current.conversion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Marge / génération</dt>
            <dd className="font-medium">{decision.current.margin}</dd>
          </div>
        </dl>
        {decision.suggestion ? (
          <div data-testid="decision-suggestion" className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <p className="font-medium">{decision.suggestion.headline}</p>
            <p className="text-muted-foreground">{decision.suggestion.detail}</p>
            {decision.badge ? (
              <div className="mt-2">
                <StatusChange
                  productId={product.productId}
                  slug={product.slug}
                  name={product.name}
                  status={product.status}
                  decision={decision.badge}
                  justification={decision.current}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
