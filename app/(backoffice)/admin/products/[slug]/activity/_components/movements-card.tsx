import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityMovement } from "@/lib/dal/activity";
import { formatDelta, formatRelative, movementLabel } from "../_lib/activity-format";
import { activityHref, type ActivityListKey } from "../_lib/pagination";
import { PaginationNav } from "./pagination-nav";

// BO-04's "Mouvements de crédits" card (mockup): every user's ledger rows
// on this product, newest first — signup bonus, purchase, generation,
// refund. I18N-BACKOFFICE-STRINGS: async, its own translator, and —
// since React Testing Library's client renderer can't render an async
// component nested as plain JSX (product-tabs.tsx's comment) —
// `PaginationNav` is called and awaited directly rather than mounted as
// `<PaginationNav ... />`.
export async function MovementsCard({
  slug,
  entries,
  total,
  page,
  hasMore,
  now,
  currentPages,
}: {
  slug: string;
  entries: ActivityMovement[];
  total: number;
  page: number;
  hasMore: boolean;
  now: Date;
  currentPages: Partial<Record<ActivityListKey, number>>;
}) {
  const listKey: ActivityListKey = "movements";
  const t = await getTranslations("backoffice-product-sheet");
  const paginationNav = await PaginationNav({ slug, listKey, page, hasMore, currentPages });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("activity.movements.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {total === 0 ? (
          <EmptyState title={t("activity.movements.empty")} />
        ) : entries.length === 0 ? (
          <EmptyState
            title={t("activity.emptyPage.title")}
            action={
              <Link href={activityHref(slug, currentPages, { key: listKey, page: 1 })} className="underline">
                {t("activity.emptyPage.backToFirstPage")}
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-2">
            {entries.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={`font-medium ${movement.delta >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                  {formatDelta(movement.delta)}
                </span>
                <span className="flex-1">{movementLabel(movement, t)}</span>
                <span className="text-muted-foreground">{formatRelative(movement.createdAt, now, t)}</span>
              </li>
            ))}
          </ul>
        )}
        {paginationNav}
      </CardContent>
    </Card>
  );
}
