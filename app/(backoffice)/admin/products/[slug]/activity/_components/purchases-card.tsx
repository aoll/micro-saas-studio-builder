import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityPurchase, PurchaseSummary } from "@/lib/dal/activity";
import { formatRelative, purchaseSummaryLines } from "../_lib/activity-format";
import { formatEuroCents } from "@/app/(backoffice)/admin/_components/portfolio/format";
import { activityHref, type ActivityListKey } from "../_lib/pagination";
import { PaginationNav } from "./pagination-nav";

// BO-04's "Achats" card: the mockup's 30-day summary ("14 achats · 72 €",
// "Pack 10 : 11 · Pack 50 : 3") plus a paginated list of every purchase
// (plan § "Purchases show the mockup's 30-day summary and a paginated
// list").
export function PurchasesCard({
  slug,
  summary,
  entries,
  total,
  page,
  hasMore,
  now,
  currentPages,
}: {
  slug: string;
  summary: PurchaseSummary;
  entries: ActivityPurchase[];
  total: number;
  page: number;
  hasMore: boolean;
  now: Date;
  currentPages: Partial<Record<ActivityListKey, number>>;
}) {
  const listKey: ActivityListKey = "purchases";
  const [headline, breakdown] = purchaseSummaryLines(summary);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Achats · 30 j</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <p className="text-lg font-semibold">{headline}</p>
          {breakdown ? <p className="text-sm text-muted-foreground">{breakdown}</p> : null}
        </div>

        {total === 0 ? (
          <EmptyState title="Aucun achat pour l'instant" />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Page vide"
            action={
              <Link href={activityHref(slug, currentPages, { key: listKey, page: 1 })} className="underline">
                Revenir à la première page
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-2">
            {entries.map((purchase) => (
              <li key={purchase.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">+{purchase.credits}</span>
                <span className="flex-1">{formatEuroCents(purchase.amountCents)}</span>
                <span className="text-muted-foreground">{formatRelative(purchase.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        )}
        <PaginationNav slug={slug} listKey={listKey} page={page} hasMore={hasMore} currentPages={currentPages} />
      </CardContent>
    </Card>
  );
}
