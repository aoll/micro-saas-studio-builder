import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

// <Suspense> fallback for HistoryList (SA-06): the shell already has the
// page's shape while the session/cookie and the DAL call resolve
// (docs/02-ecrans.md › États communs, docs/04-nextjs.md's squeleton
// fallbacks). `loading` is a screen-reader-only label, not shown visually.
export async function HistorySkeleton() {
  const t = await getTranslations("history");
  return (
    <div className="grid gap-4" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
