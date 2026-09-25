import type { Lockable } from "@/lib/dal/guards";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import type { ThresholdOverride, Thresholds } from "@/lib/dal/thresholds";
import type { ThresholdSettings } from "@/lib/dal/thresholds";
import type { ProductStatus } from "@/lib/schemas/product-config";

export type SettingsProductRow = {
  productId: string;
  name: string;
  status: ProductStatus;
  isSeed: boolean;
  visits: number;
  signupToPurchaseRate: number | null;
  marginPerGenerationMicros: number | null;
  override: ThresholdOverride | null;
  editable: boolean;
};

export type SettingsView = {
  defaults: { values: Thresholds; isSeed: boolean; editable: boolean };
  products: SettingsProductRow[];
};

// `/admin/settings`'s page-level join (plan design decision 9): the page
// reads `getPortfolioMetrics` and `getThresholdSettings` in parallel, then
// this pure function combines them into one row per product — funnel
// numbers for the live preview, `override` for the two forms. A product
// with no metrics row (a data inconsistency `getPortfolioMetrics` cannot
// produce for a product `getThresholdSettings` also lists, since both read
// the same `products` table) falls back to its id and zeroed metrics
// rather than throwing. `isEditable` is the demo-mode lock (lib/dal/guards,
// server-only), passed in by the page so this function stays pure: the
// default row and each product row carry their own `editable` flag.
export function toSettingsView(
  metrics: PortfolioMetrics,
  settings: ThresholdSettings,
  isEditable: (row: Lockable) => boolean,
): SettingsView {
  const metricsByProductId = new Map(metrics.products.map((product) => [product.productId, product]));
  return {
    defaults: { ...settings.defaults, editable: isEditable(settings.defaults) },
    products: settings.products.map((row) => {
      const product = metricsByProductId.get(row.productId);
      return {
        productId: row.productId,
        name: product?.name ?? row.productId,
        status: product?.status ?? "test",
        isSeed: row.isSeed,
        visits: product?.visits ?? 0,
        signupToPurchaseRate: product?.signupToPurchaseRate ?? null,
        marginPerGenerationMicros: product?.marginPerGenerationMicros ?? null,
        override: row.override,
        editable: isEditable(row),
      };
    }),
  };
}
