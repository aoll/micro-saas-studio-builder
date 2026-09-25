import type {
  ActivityPage,
  ActivityGeneration,
  ActivityMovement,
  ActivityPurchase,
  PurchaseSummary,
} from "@/lib/dal/activity";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { ActivityHeader } from "./activity-header";
import { GenerationsTable } from "./generations-table";
import { MovementsCard } from "./movements-card";
import { PurchasesCard } from "./purchases-card";
import type { ActivityListKey } from "../_lib/pagination";

// BO-04's page layout (mockup, specs/mockups/BO-04.png): the header and
// tabs, "Dernières générations" as the wide left column, "Mouvements de
// crédits" then "Achats · 30 j" stacked on the right.
export function ActivityView({
  slug,
  name,
  status,
  fields,
  generations,
  movements,
  purchases,
  purchaseSummary,
  now,
}: {
  slug: string;
  name: string;
  status: ProductStatus;
  fields: { key: string; label: string }[];
  generations: ActivityPage<ActivityGeneration>;
  movements: ActivityPage<ActivityMovement>;
  purchases: ActivityPage<ActivityPurchase>;
  purchaseSummary: PurchaseSummary;
  now: Date;
}) {
  const currentPages: Partial<Record<ActivityListKey, number>> = {
    generations: generations.page,
    purchases: purchases.page,
    movements: movements.page,
  };

  return (
    <div className="grid gap-6">
      <ActivityHeader slug={slug} name={name} status={status} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <GenerationsTable
          slug={slug}
          entries={generations.entries}
          total={generations.total}
          page={generations.page}
          hasMore={generations.hasMore}
          fields={fields}
          now={now}
          currentPages={currentPages}
        />
        <div className="grid gap-6">
          <MovementsCard
            slug={slug}
            entries={movements.entries}
            total={movements.total}
            page={movements.page}
            hasMore={movements.hasMore}
            now={now}
            currentPages={currentPages}
          />
          <PurchasesCard
            slug={slug}
            summary={purchaseSummary}
            entries={purchases.entries}
            total={purchases.total}
            page={purchases.page}
            hasMore={purchases.hasMore}
            now={now}
            currentPages={currentPages}
          />
        </div>
      </div>
    </div>
  );
}
