import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/components/utils";

// Shared by BO-03's SheetHeader (`active="overview"`) and BO-04's
// ActivityHeader (`active="activity"`): the two screens link to each other
// through the same two tabs (docs/02-ecrans.md › BO-03, BO-04).
const TAB_BASE = "border-b-2 px-1 pb-2 text-sm font-medium";
const TAB_ACTIVE = "border-foreground text-foreground";
const TAB_INACTIVE = "border-transparent text-muted-foreground hover:text-foreground";

export function ProductTabs({ slug, active }: { slug: string; active: "overview" | "activity" }) {
  return (
    <nav className="flex gap-6 border-b">
      <Link
        href={`/admin/products/${slug}` as Route}
        className={cn(TAB_BASE, active === "overview" ? TAB_ACTIVE : TAB_INACTIVE)}
        aria-current={active === "overview" ? "page" : undefined}
      >
        Vue d&apos;ensemble
      </Link>
      <Link
        href={`/admin/products/${slug}/activity` as Route}
        className={cn(TAB_BASE, active === "activity" ? TAB_ACTIVE : TAB_INACTIVE)}
        aria-current={active === "activity" ? "page" : undefined}
      >
        Activité
      </Link>
    </nav>
  );
}
