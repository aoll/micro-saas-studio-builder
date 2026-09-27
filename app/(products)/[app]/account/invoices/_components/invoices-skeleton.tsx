import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

// <Suspense> fallback for InvoicesContent (SA-09), mirroring
// account-skeleton.tsx: the shell already has the page's shape while the
// session, purchases and job list resolve. `loading` is a screen-reader-only
// label, not shown visually.
export async function InvoicesSkeleton() {
  const t = await getTranslations("invoices");
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
