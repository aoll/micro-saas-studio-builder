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
// crédits" then "Achats · 30 j" stacked on the right. I18N-BACKOFFICE-STRINGS: async, its four
// nested Server Components (ActivityHeader, GenerationsTable, MovementsCard, PurchasesCard) each
// called and awaited directly rather than mounted as plain JSX — React Testing Library's client
// renderer can't render an async component that way (product-tabs.tsx's comment), even though
// Next's own RSC renderer would.
export async function ActivityView({
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

  const [header, generationsTable, movementsCard, purchasesCard] = await Promise.all([
    ActivityHeader({ slug, name, status }),
    GenerationsTable({
      slug,
      entries: generations.entries,
      total: generations.total,
      page: generations.page,
      hasMore: generations.hasMore,
      fields,
      now,
      currentPages,
    }),
    MovementsCard({
      slug,
      entries: movements.entries,
      total: movements.total,
      page: movements.page,
      hasMore: movements.hasMore,
      now,
      currentPages,
    }),
    PurchasesCard({
      slug,
      summary: purchaseSummary,
      entries: purchases.entries,
      total: purchases.total,
      page: purchases.page,
      hasMore: purchases.hasMore,
      now,
      currentPages,
    }),
  ]);

  return (
    <div className="grid gap-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {generationsTable}
        <div className="grid gap-6">
          {movementsCard}
          {purchasesCard}
        </div>
      </div>
    </div>
  );
}
