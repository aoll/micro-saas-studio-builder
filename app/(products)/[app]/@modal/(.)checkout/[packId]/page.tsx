import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { CheckoutFlow } from "@/app/(products)/[app]/checkout/_components/checkout-flow";

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

export default async function CheckoutModal({ params }: PageProps<"/[app]/checkout/[packId]">) {
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
