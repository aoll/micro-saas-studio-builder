import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { Suspense } from "react";
import { getProduct } from "@/lib/dal/products";
import { CheckoutFlow } from "@/app/(products)/[app]/checkout/_components/checkout-flow";
import { CheckoutSkeleton } from "@/app/(products)/[app]/checkout/[packId]/_components/checkout-skeleton";

// SA-05 (specs/SA-05-paiement.md): intercepts /checkout/[packId] on client
// navigation from the outil (SA-02's paywall) or from /pricing (SA-04),
// exactly like @modal/(.)pricing intercepts /pricing (same `(.)` rule,
// docs/04-nextjs.md). Same product/pack resolution as the full page; the
// title itself (including its "confirmed" variant) is owned by CheckoutFlow
// in its "modal" variant, since only it knows the purchase's status.
export async function generateStaticParams() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) return [];
  return product.pricing.packs.map((pack) => ({ packId: pack.id }));
}

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md, orchestrator note): same
// categorical "await params outside <Suspense>" violation as the full page
// (.claude/qa/reports/2026-09-25-full.md › B14), same fix, same
// CheckoutSkeleton fallback (the page and its intercepted modal render
// identical content, docs/04-nextjs.md's "modales en intercepting
// routes"). CheckoutModal stays synchronous; CheckoutModalContent, behind
// the boundary, does the awaiting.
export default function CheckoutModal({ params }: PageProps<"/[app]/checkout/[packId]">) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutModalContent params={params} />
    </Suspense>
  );
}

export async function CheckoutModalContent({ params }: Pick<PageProps<"/[app]/checkout/[packId]">, "params">) {
  const { app: slug, packId } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const pack = product.pricing.packs.find((candidate) => candidate.id === packId);
  if (!pack) notFound();

  return (
    <CheckoutFlow
      variant="modal"
      slug={product.slug}
      productName={product.name}
      pack={pack}
      costPerGeneration={product.pricing.costPerGeneration}
    />
  );
}
