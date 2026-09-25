import type { Route } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/backoffice/status-badge";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { cn } from "@/components/utils";

// BO-04's own header (plan orchestrator decision 3: "The « Vue d'ensemble /
// Activité » tabs live in activity/_components/activity-header.tsx"). Does
// not reuse BO-03's SheetHeader (its decision badge and status-change modal
// are out of this spec's Périmètre) — only the name, the status pill, and
// the two tabs.
export function ActivityHeader({ slug, name, status }: { slug: string; name: string; status: ProductStatus }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <StatusBadge status={status} />
      </div>
      <ProductTabs slug={slug} active="activity" />
    </div>
  );
}

const TAB_BASE = "border-b-2 px-1 pb-2 text-sm font-medium";
const TAB_ACTIVE = "border-foreground text-foreground";
const TAB_INACTIVE = "border-transparent text-muted-foreground hover:text-foreground";

export function ProductTabs({ slug, active }: { slug: string; active: "overview" | "activity" }) {
  return (
    <nav className="flex gap-6 border-b">
      <Link
        href={`/admin/products/${slug}` as Route}
        className={cn(TAB_BASE, active === "overview" ? TAB_ACTIVE : TAB_INACTIVE)}
      >
        Vue d&apos;ensemble
      </Link>
      <Link
        href={`/admin/products/${slug}/activity` as Route}
        className={cn(TAB_BASE, active === "activity" ? TAB_ACTIVE : TAB_INACTIVE)}
      >
        Activité
      </Link>
    </nav>
  );
}
