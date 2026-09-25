import Link from "next/link";
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
async function Portfolio() {
  await requireAdmin();
  const metrics = await getPortfolioMetrics({ days: 30 });
  const thresholdsById = Object.fromEntries(
    await Promise.all(
      metrics.products.map(async (product) => [product.productId, await getThresholds(product.productId)] as const),
    ),
  );
  const rows = toPortfolioRows(metrics, thresholdsById);
  return <PortfolioView totals={metrics.totals} rows={rows} />;
}

export default function AdminPortfolioPage() {
  return (
    <main className="grid gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Portefeuille</h1>
        <Button asChild>
          <Link href={NEW_PRODUCT_HREF}>Nouveau produit</Link>
        </Button>
      </div>
      <Suspense fallback={<PortfolioSkeleton />}>
        <Portfolio />
      </Suspense>
    </main>
  );
}
