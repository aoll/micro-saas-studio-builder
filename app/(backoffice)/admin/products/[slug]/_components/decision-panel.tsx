import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";
import type { ProductStatus } from "@/lib/schemas/product-config";
import type { DecisionCopy, DecisionSuggestion } from "./decision-copy";
import { DecisionGauge } from "./decision-gauge";
import { StatusChange } from "./status/status-change";

export type DecisionPanelProduct = { productId: string; slug: string; name: string; status: ProductStatus };

type Translate = Awaited<ReturnType<typeof getTranslations>>;

function toSuggestionCopy(t: Translate, suggestion: DecisionSuggestion): { headline: string; detail: string } | null {
  if (!suggestion) return null;
  if (suggestion.kind === "notEnoughVisits") {
    return {
      headline: t("panel.suggestion.notEnoughVisits.headline"),
      detail: t("panel.suggestion.notEnoughVisits.detail", {
        visits: suggestion.visits,
        minVisits: suggestion.minVisits,
      }),
    };
  }
  if (suggestion.kind === "thresholdReached") {
    return {
      headline: t("panel.suggestion.thresholdReached.headline"),
      detail: t(
        suggestion.decision === "kill"
          ? "panel.suggestion.thresholdReached.detailKill"
          : "panel.suggestion.thresholdReached.detailScale",
      ),
    };
  }
  return { headline: t("panel.suggestion.none.headline"), detail: t("panel.suggestion.none.detail") };
}

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
//
// I18N-BACKOFFICE-STRINGS (lot 3): async, so it can call
// getTranslations("backoffice-decision") itself to turn `decision`'s structural keys (decision-copy.ts)
// into text. It awaits `DecisionGauge` explicitly instead of using `<DecisionGauge …/>` as plain
// JSX: Next.js's RSC renderer supports either form, but only the resolved-element form lets this
// component's own tests use @testing-library/react's synchronous `render()`.
export async function DecisionPanel({
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
  const t = await getTranslations("backoffice-decision");
  const gauge = await DecisionGauge({ metrics, thresholds });
  const suggestion = toSuggestionCopy(t, decision.suggestion);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("panel.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {decision.thresholds.map((line) => (
            <div key={line.key} className="contents">
              <dt className="text-muted-foreground">{t(`panel.thresholds.${line.key}`)}</dt>
              <dd className="text-right font-medium">
                {line.key === "positiveMarginRequired" ? t(line.value ? "panel.yes" : "panel.no") : line.value}
              </dd>
            </div>
          ))}
        </dl>
        {gauge}
        <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("panel.current.visits")}</dt>
            <dd className="font-medium">{decision.current.visits}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("panel.current.conversion")}</dt>
            <dd className="font-medium">{decision.current.conversion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("panel.current.margin")}</dt>
            <dd className="font-medium">{decision.current.margin}</dd>
          </div>
        </dl>
        {suggestion ? (
          <div data-testid="decision-suggestion" className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <p className="font-medium">{suggestion.headline}</p>
            <p className="text-muted-foreground">{suggestion.detail}</p>
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
