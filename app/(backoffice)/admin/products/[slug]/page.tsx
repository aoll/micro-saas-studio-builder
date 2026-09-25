import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFunnel } from "@/lib/dal/metrics";
import { getProduct } from "@/lib/dal/products";
import { getThresholds } from "@/lib/dal/thresholds";
import { requireAdmin } from "@/lib/dal/session";
import { toProductSheet } from "./_components/sheet";
import { ProductSheetSkeleton } from "./_components/product-sheet-skeleton";
import { ProductSheetView } from "./_components/product-sheet-view";

const RANGE_DAYS = 30;

// BO-03 (specs/BO-03-fiche.md): session-gated (own requireAdmin(), like every /admin page —
// require-admin-coverage.test.ts), never cached (docs/04-nextjs.md), so it streams under
// <Suspense> while the shell above renders instantly. notFound() for an unknown slug
// (docs/02-ecrans.md › SA-08-like "produit introuvable" for the backoffice); a killed product
// still renders (ProductSheetView's own banner), it just isn't notFound()'d.
async function ProductSheet({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [funnel, thresholds] = await Promise.all([
    getFunnel(product.id, { days: RANGE_DAYS }),
    getThresholds(product.id),
  ]);
  const sheet = toProductSheet(funnel, thresholds);

  return <ProductSheetView sheet={sheet} />;
}

export default function ProductSheetPage({ params }: PageProps<"/admin/products/[slug]">) {
  return (
    <main className="p-6">
      <Suspense fallback={<ProductSheetSkeleton />}>
        <ProductSheet params={params} />
      </Suspense>
    </main>
  );
}
