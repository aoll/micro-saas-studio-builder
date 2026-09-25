import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getPurchaseSummary,
  listProductCreditMovements,
  listProductGenerations,
  listProductPurchases,
} from "@/lib/dal/activity";
import { getProduct } from "@/lib/dal/products";
import { requireAdmin } from "@/lib/dal/session";
import { ActivitySkeleton } from "./_components/activity-skeleton";
import { ActivityView } from "./_components/activity-view";
import { readPageParam } from "./_lib/pagination";

// BO-04 (specs/BO-04-activite.md): session-gated (own requireAdmin(), like
// every /admin page — require-admin-coverage.test.ts), never cached
// (docs/04-nextjs.md), so it streams under <Suspense> while the shell above
// renders instantly. notFound() for an unknown slug; a killed product still
// shows its history (plan § "killed product still shows its history").
async function Activity({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  // Created once, after requireAdmin() (a request-time API), then passed
  // down to every pure helper that formats a relative date or windows the
  // purchase summary (plan design decision 8).
  const now = new Date();

  const search = await searchParams;
  const genPage = readPageParam(search, "generations");
  const purPage = readPageParam(search, "purchases");
  const movPage = readPageParam(search, "movements");

  const [generations, purchases, movements, purchaseSummary] = await Promise.all([
    listProductGenerations(product.id, genPage),
    listProductPurchases(product.id, purPage),
    listProductCreditMovements(product.id, movPage),
    getPurchaseSummary(product.id, now),
  ]);

  return (
    <ActivityView
      slug={product.slug}
      name={product.name}
      status={product.status}
      fields={product.inputs}
      generations={generations}
      movements={movements}
      purchases={purchases}
      purchaseSummary={purchaseSummary}
      now={now}
    />
  );
}

export default function ProductActivityPage({ params, searchParams }: PageProps<"/admin/products/[slug]/activity">) {
  return (
    <main className="p-6">
      <Suspense fallback={<ActivitySkeleton />}>
        <Activity params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
