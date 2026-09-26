import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { Suspense } from "react";
import { getProduct } from "@/lib/dal/products";
import { InvoicesContent } from "./_components/invoices-content";
import { InvoicesSkeleton } from "./_components/invoices-skeleton";

// SA-09 (specs/SA-09-facture.md): a static shell mirroring SA-07's account
// page pattern — title from the cached getProduct, and the one async leaf
// that reads the session (InvoicesContent) kept under <Suspense> so the
// shell stays instant. No session, cookie or searchParams read here.
export default async function InvoicesPage() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("invoices");

  return (
    <section className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<InvoicesSkeleton />}>
        <InvoicesContent slug={product.slug} productId={product.id} />
      </Suspense>
    </section>
  );
}
