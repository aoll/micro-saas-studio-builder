import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md, step 5): <Suspense> fallback
// for CheckoutContent, shaped like PackSummary + TestCardFields (mirrors
// HistorySkeleton's pattern, app/(products)/[app]/history/_components/
// history-skeleton.tsx) so the shell already has the checkout page's form
// while `params` resolves and getProduct() (already 'use cache') is warmed.
// Shared by both the full page and the intercepted modal (@modal/(.)checkout/
// [packId]/page.tsx): same content, same wait.
export async function CheckoutSkeleton() {
  const t = await getTranslations("checkout");
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
