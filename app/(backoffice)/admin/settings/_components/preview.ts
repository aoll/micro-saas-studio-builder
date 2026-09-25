import type { Thresholds, ThresholdOverride } from "@/lib/dal/thresholds";
import { evaluate, type Decision, type DecisionMetrics } from "@/lib/decision";
import type { ThresholdsInput } from "@/lib/schemas/inputs";

// BO-09's "avant d'enregistrer, aperçu des produits dont le badge
// changerait" (spec bullet 4): field-by-field merge, shared with
// `getThresholds` (lib/dal/thresholds.ts)'s own merge, but here pure and
// client-safe (no cache, no session).
export function mergeThresholds(base: Thresholds, override: ThresholdOverride | null): Thresholds {
  if (!override) return base;
  return {
    minVisits: override.minVisits ?? base.minVisits,
    killMaxConversion: override.killMaxConversion ?? base.killMaxConversion,
    scaleMinConversion: override.scaleMinConversion ?? base.scaleMinConversion,
    scaleRequiresPositiveMargin: override.scaleRequiresPositiveMargin ?? base.scaleRequiresPositiveMargin,
  };
}

export type PreviewProduct = {
  productId: string;
  name: string;
  visits: number;
  signupToPurchaseRate: number | null;
  marginPerGenerationMicros: number | null;
  override: ThresholdOverride | null;
};

// The defaults form previews every product (a product's own override, if
// any, still wins on the fields it sets); the per-product form previews
// only the one product being edited.
export type PreviewScope = { kind: "default" } | { kind: "product"; productId: string };

export type PreviewChange = { productId: string; name: string; before: Decision; after: Decision };

function metricsOf(product: PreviewProduct): DecisionMetrics {
  return {
    visits: product.visits,
    signupToPurchaseRate: product.signupToPurchaseRate,
    marginPerGenerationMicros: product.marginPerGenerationMicros,
  };
}

// BO-09's live preview (spec bullet 4), computed on the client from
// already-loaded data (no round trip while typing): only the rows whose
// `evaluate()` badge actually changes. The caller only invokes this with a
// candidate that already passed `thresholdsInputSchema.safeParse`
// (`ThresholdsSettings`/`ThresholdsForm`, plan design decision 7's "invalid
// candidate → no preview").
export function previewChanges(
  products: PreviewProduct[],
  defaults: Thresholds,
  scope: PreviewScope,
  candidate: ThresholdsInput,
): PreviewChange[] {
  const changes: PreviewChange[] = [];
  for (const product of products) {
    if (scope.kind === "product" && product.productId !== scope.productId) continue;
    const before = evaluate(metricsOf(product), mergeThresholds(defaults, product.override));
    const afterThresholds = scope.kind === "default" ? mergeThresholds(candidate, product.override) : candidate;
    const after = evaluate(metricsOf(product), afterThresholds);
    if (before !== after) changes.push({ productId: product.productId, name: product.name, before, after });
  }
  return changes;
}
