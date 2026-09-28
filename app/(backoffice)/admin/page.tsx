import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getPortfolioMetrics } from "@/lib/dal/metrics";
import { getThresholds } from "@/lib/dal/thresholds";
import { requireAdmin } from "@/lib/dal/session";
import { PortfolioSkeleton } from "./_components/portfolio/portfolio-skeleton";
import { PortfolioView } from "./_components/portfolio/portfolio-view";
import { toPortfolioRows } from "./_components/portfolio/rows";

const NEW_PRODUCT_HREF = "/admin/products/new";

// The portfolio's data: session-gated (never cached, docs/04-nextjs.md),
// so it streams under <Suspense> while the shell above renders instantly.
// I18N-BACKOFFICE-STRINGS: `locale` is resolved once here and threaded
// into toPortfolioRows() (format.ts's Intl formatters), instead of every
// row re-reading the ambient request config.
async function Portfolio() {
  await requireAdmin();
  const locale = (await getLocale()) as "fr" | "en";
  const metrics = await getPortfolioMetrics({ days: 30 });
  const thresholdsById = Object.fromEntries(
    await Promise.all(
      metrics.products.map(async (product) => [product.productId, await getThresholds(product.productId)] as const),
    ),
  );
  const rows = toPortfolioRows(metrics, thresholdsById, locale);
  return <PortfolioView totals={metrics.totals} rows={rows} />;
}

export default async function AdminPortfolioPage() {
  const t = await getTranslations("backoffice-portfolio");
  return (
    <main className="grid gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("portfolio.title")}</h1>
        <Button asChild>
          <Link href={NEW_PRODUCT_HREF}>{t("portfolio.newProduct")}</Link>
        </Button>
      </div>
      <Suspense fallback={<PortfolioSkeleton />}>
        <Portfolio />
      </Suspense>
    </main>
  );
}
