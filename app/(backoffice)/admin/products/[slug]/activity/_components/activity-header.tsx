import { StatusBadge } from "@/components/backoffice/status-badge";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { ProductTabs } from "../../_components/product-tabs";

// BO-04's own header. Does not reuse BO-03's SheetHeader (its decision badge
// and status-change modal are out of this spec's Périmètre) — only the name,
// the status pill, and the two tabs, now shared with SheetHeader via
// ../../_components/product-tabs (orchestrator follow-up: the two screens
// link to each other, docs/09-arborescence.md "colocation first, promote next").
export function ActivityHeader({ slug, name, status }: { slug: string; name: string; status: ProductStatus }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <StatusBadge status={status} />
      </div>
      <ProductTabs slug={slug} active="activity" />
    </div>
  );
}
