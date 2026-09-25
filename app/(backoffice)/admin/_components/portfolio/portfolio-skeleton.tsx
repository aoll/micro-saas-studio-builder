import { Skeleton } from "@/components/ui/skeleton";

// Shared by <Suspense fallback> on the portfolio page and admin/loading.tsx
// (specs/BO-02-portefeuille.md plan, design decision 8): the same shape as
// PortfolioView, so the page never jumps once the real data streams in.
export function PortfolioSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8" />
        ))}
      </div>
    </div>
  );
}
