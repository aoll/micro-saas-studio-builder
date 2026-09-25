import { Skeleton } from "@/components/ui/skeleton";

// <Suspense fallback> for the product sheet's data (page.tsx): roughly the shape of
// ProductSheetView, so the page doesn't jump once the real data streams in (mirrors
// PortfolioSkeleton, specs/BO-02-portefeuille.md plan, design decision 8).
export function ProductSheetSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
      <Skeleton className="h-40" />
    </div>
  );
}
