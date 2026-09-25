import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityMovement } from "@/lib/dal/activity";
import { formatDelta, formatRelative, movementLabel } from "../_lib/activity-format";
import { activityHref, type ActivityListKey } from "../_lib/pagination";
import { PaginationNav } from "./pagination-nav";

// BO-04's "Mouvements de crédits" card (mockup): every user's ledger rows
// on this product, newest first — signup bonus, purchase, generation,
// refund.
export function MovementsCard({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mouvements de crédits</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {total === 0 ? (
          <EmptyState title="Aucun mouvement pour l'instant" />
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
            {entries.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={`font-medium ${movement.delta >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                  {formatDelta(movement.delta)}
                </span>
                <span className="flex-1">{movementLabel(movement)}</span>
                <span className="text-muted-foreground">{formatRelative(movement.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        )}
        <PaginationNav slug={slug} listKey={listKey} page={page} hasMore={hasMore} currentPages={currentPages} />
      </CardContent>
    </Card>
  );
}
