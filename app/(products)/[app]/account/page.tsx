import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { Suspense } from "react";
import { getProduct } from "@/lib/dal/products";
import { AccountContent } from "./_components/account-content";
import { AccountSkeleton } from "./_components/account-skeleton";

// SA-07 (specs/SA-07-compte.md): a static shell mirroring SA-06's history
// page — title from the cached getProduct, and the one async leaf that
// reads the session (AccountContent) kept under <Suspense> so the shell
// stays instant (docs/04-nextjs.md: "Historique, compte … streamé sous
// <Suspense>"). No session, cookie or searchParams read here.
export default async function AccountPage() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("account");

  return (
    <section className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent slug={product.slug} productId={product.id} />
      </Suspense>
    </section>
  );
}
