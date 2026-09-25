import Link from "next/link";
import { activityHref, type ActivityListKey } from "../_lib/pagination";

// Shared Précédent/Suivant nav for the three paginated lists (plan § "each
// with its empty state, a « page vide » state and Précédent/Suivant
// links"): changing one list's page keeps the other two where they are
// (activityHref).
export function PaginationNav({
  slug,
  listKey,
  page,
  hasMore,
  currentPages,
}: {
  slug: string;
  listKey: ActivityListKey;
  page: number;
  hasMore: boolean;
  currentPages: Partial<Record<ActivityListKey, number>>;
}) {
  if (page <= 1 && !hasMore) return null;

  return (
    <nav className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={activityHref(slug, currentPages, { key: listKey, page: page - 1 })}>Précédent</Link>
      ) : (
        <span />
      )}
      {hasMore ? (
        <Link href={activityHref(slug, currentPages, { key: listKey, page: page + 1 })}>Suivant</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
