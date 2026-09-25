import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { Suspense } from "react";
import { getProduct } from "@/lib/dal/products";
import { CheckoutFlow } from "../_components/checkout-flow";
import { CheckoutSkeleton } from "./_components/checkout-skeleton";

// SA-05 (specs/SA-05-paiement.md), full page: reachable directly (link
// shared, refresh) and rendered identically by the intercepted modal
// (@modal/(.)checkout/[packId]). generateStaticParams reads the current
// [app] root param via next/root-params (docs/04-nextjs.md: "you can also
// read it inside a nested generateStaticParams by calling its getter"),
// since this child route sits below the layout that already generates
// [app]'s own static params.
export async function generateStaticParams() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) return [];
  return product.pricing.packs.map((pack) => ({ packId: pack.id }));
}

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md): Cache Components flags
// awaiting `params` outside a <Suspense> boundary categorically
// (node_modules/next/dist/docs/…/migrating-to-cache-components.md ›
// "Await params inside <Suspense>"), regardless of generateStaticParams
// enumerating every concrete packId above — same pattern already used one
// route over (history/page.tsx forwards searchParams unawaited into
// <HistoryList>). CheckoutPage stays synchronous and never touches
// `params` itself; only CheckoutContent, behind the boundary, does.
export default function CheckoutPage({ params }: PageProps<"/[app]/checkout/[packId]">) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent params={params} />
    </Suspense>
  );
}

export async function CheckoutContent({ params }: Pick<PageProps<"/[app]/checkout/[packId]">, "params">) {
  const { app: slug, packId } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const pack = product.pricing.packs.find((candidate) => candidate.id === packId);
  if (!pack) notFound();

  return (
    <CheckoutFlow
      variant="page"
      slug={product.slug}
      productName={product.name}
      pack={pack}
      costPerGeneration={product.pricing.costPerGeneration}
    />
  );
}
