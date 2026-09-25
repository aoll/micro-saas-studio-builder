import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { Suspense } from "react";
import { getProduct } from "@/lib/dal/products";
import { HistoryList } from "./_components/history-list";
import { HistorySkeleton } from "./_components/history-skeleton";

// SA-06 (specs/SA-06-historique.md): a static shell (title, from the cached
// getProduct) around the one async leaf that reads the session/cookie and
// `?page=` — HistoryList — kept under <Suspense> so this page's own shell
// stays instant (docs/04-nextjs.md's rendering table: "Historique …
// streamed: données de l'utilisateur"). `searchParams` is forwarded
// unawaited: only HistoryList reads it, inside the Suspense boundary.
export default async function HistoryPage({ searchParams }: PageProps<"/[app]/history">) {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("history");

  return (
    <section className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryList slug={product.slug} productId={product.id} fields={product.inputs} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
