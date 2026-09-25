import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { RouteModal } from "@/components/product/route-modal";
import { PricingContent } from "@/app/(products)/[app]/pricing/_components/pricing-content";

// SA-04 (specs/SA-04-tarifs.md), modal on top of the outil: `(.)` matches
// `pricing` because @modal is a parallel routes slot, not a path segment
// (docs/04-nextjs.md), so the intercepted route sits at the same level as
// the page it intercepts. Same PricingContent as the full page
// ([app]/pricing/page.tsx); SA-02 opens this route when the balance hits 0.
export default async function PricingModal() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("pricing");

  return (
    <RouteModal title={`${t("title")} ${t("titleAccent")}`}>
      <PricingContent slug={product.slug} pricing={product.pricing} />
    </RouteModal>
  );
}
