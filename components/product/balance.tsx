import { Skeleton } from "@/components/ui/skeleton";

// Fallback for <Suspense> around HeaderBalance (docs/04-nextjs.md: the
// session-reading balance badge streams so the landing shell stays static).
export function BalanceBadgeSkeleton() {
  return <Skeleton aria-hidden="true" className="h-6 w-16 rounded-full" />;
}
