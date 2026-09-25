import type { Decision } from "@/lib/decision";
import type { ProductStatus } from "@/lib/schemas/product-config";

export type StatusChangeProps = {
  productId: string;
  slug: string;
  name: string;
  status: ProductStatus;
  decision: Decision;
  justification: { visits: string; conversion: string; margin: string };
};

// BO-06 slot (docs/02-ecrans.md › "Changement de statut", specs/BO-06-changement-statut.md,
// not yet a spec of this run): the plan's orchestrator decision 6 hands BO-06 this component's
// props — everything its modal needs (the metrics that justify the decision, docs/02) — already
// wired into the header and the decision panel. Renders nothing until BO-06 lands.
export function StatusChange(_props: StatusChangeProps) {
  return null;
}
