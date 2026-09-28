import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { activityHref, type ActivityListKey } from "../_lib/pagination";

// Shared Précédent/Suivant nav for the three paginated lists (plan § "each
// with its empty state, a « page vide » state and Précédent/Suivant
// links"): changing one list's page keeps the other two where they are
// (activityHref). I18N-BACKOFFICE-STRINGS: async, its own translator
// (mirrors product-tabs.tsx's callers).
export async function PaginationNav({
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
  const t = await getTranslations("backoffice-product-sheet");

  return (
    <nav className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={activityHref(slug, currentPages, { key: listKey, page: page - 1 })}>
          {t("activity.pagination.previous")}
        </Link>
      ) : (
        <span />
      )}
      {hasMore ? (
        <Link href={activityHref(slug, currentPages, { key: listKey, page: page + 1 })}>
          {t("activity.pagination.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
