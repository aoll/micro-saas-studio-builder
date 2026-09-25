import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { PricingContent } from "./_components/pricing-content";

// SA-04 (specs/SA-04-tarifs.md), full page: same content as the intercepted
// modal (@modal/(.)pricing), reachable directly and on refresh. [app] is a
// root param (docs/04-nextjs.md), read with next/root-params like the rest
// of the sub-app's Server Components below the [app] layout.
export default async function PricingPage() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("pricing");

  return (
    <section className="mx-auto grid max-w-md gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">
        {t("title")} <span className="text-primary">{t("titleAccent")}</span>
      </h1>
      <PricingContent slug={product.slug} pricing={product.pricing} />
    </section>
  );
}
