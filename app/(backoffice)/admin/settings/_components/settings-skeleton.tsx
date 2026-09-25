import { Skeleton } from "@/components/ui/skeleton";

// Shared by <Suspense fallback> on /admin/settings and settings/loading.tsx
// (mirrors portfolio-skeleton.tsx's pattern): roughly the shape of
// ThresholdsSettings' two forms, so the page never jumps once the real
// data streams in.
export function SettingsSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 rounded-md border p-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9" />
        ))}
      </div>
      <div className="grid gap-4 rounded-md border p-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9" />
        ))}
      </div>
    </div>
  );
}
