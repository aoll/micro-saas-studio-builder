import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/components/utils";

// Shared by BO-03's SheetHeader (`active="overview"`) and BO-04's
// ActivityHeader (`active="activity"`): the two screens link to each other
// through the same two tabs (docs/02-ecrans.md › BO-03, BO-04).
const TAB_BASE = "border-b-2 px-1 pb-2 text-sm font-medium";
const TAB_ACTIVE = "border-foreground text-foreground";
const TAB_INACTIVE = "border-transparent text-muted-foreground hover:text-foreground";

// I18N-BACKOFFICE-STRINGS: kept a plain (non-async) component — its two
// callers are themselves async Server Components that already resolve their
// own translator (getTranslations("backoffice-product-sheet")), and pass the
// two labels down. Nesting an async component as a plain JSX child breaks
// under React Testing Library's client renderer ("Only Server Components can
// be async"), even though Next.js itself would render it fine; passing
// already-translated strings avoids that trap entirely and keeps this
// component trivially testable.
export function ProductTabs({
  slug,
  active,
  overviewLabel,
  activityLabel,
}: {
  slug: string;
  active: "overview" | "activity";
  overviewLabel: string;
  activityLabel: string;
}) {
  return (
    <nav className="flex gap-6 border-b">
      <Link
        href={`/admin/products/${slug}` as Route}
        className={cn(TAB_BASE, active === "overview" ? TAB_ACTIVE : TAB_INACTIVE)}
        aria-current={active === "overview" ? "page" : undefined}
      >
        {overviewLabel}
      </Link>
      <Link
        href={`/admin/products/${slug}/activity` as Route}
        className={cn(TAB_BASE, active === "activity" ? TAB_ACTIVE : TAB_INACTIVE)}
        aria-current={active === "activity" ? "page" : undefined}
      >
        {activityLabel}
      </Link>
    </nav>
  );
}
