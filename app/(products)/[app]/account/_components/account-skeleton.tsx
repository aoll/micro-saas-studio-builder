import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

// <Suspense> fallback for AccountContent (SA-07): the shell already has the
// page's shape while the session and its balance/movements/purchases
// resolve (docs/02-ecrans.md › États communs, docs/04-nextjs.md's skeleton
// fallbacks). `loading` is a screen-reader-only label, not shown visually.
export async function AccountSkeleton() {
  const t = await getTranslations("account");
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
