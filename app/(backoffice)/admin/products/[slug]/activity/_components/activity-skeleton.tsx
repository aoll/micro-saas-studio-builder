import { Skeleton } from "@/components/ui/skeleton";

// <Suspense fallback> for the activity page's data (page.tsx), roughly the
// shape of ActivityView (mirrors ProductSheetSkeleton, BO-03's plan): a
// wide skeleton for the generations table, two shorter ones stacked for
// the movements and purchases cards.
export function ActivitySkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-96" />
        <div className="grid gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
