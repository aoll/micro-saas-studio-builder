import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { app } from "next/root-params";
import { getProduct, listProducts } from "@/lib/dal/products";

// SA-08 content, shared by both not-found files (specs/SA-08-introuvable.md,
// plan round 2, decision 4): `[app]/not-found.tsx` (a missing page under an
// *active* product, "Page introuvable") and `app/(products)/not-found.tsx`
// (an unknown slug or a `killed` product; the root layout's `notFound()`
// only ever renders through this parent segment's not-found, per task 1's
// spike, outcome 3 — see both callers' comments). This component owns the
// data fetch and every branch; its callers only differ in the surrounding
// `<html>` document.
export async function ProductNotFound() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  const t = await getTranslations("not-found");

  const otherProducts = (await listProducts())
    .filter((candidate) => candidate.status !== "killed" && candidate.slug !== product?.slug)
    .map((candidate) => ({ slug: candidate.slug, name: candidate.name, tagline: candidate.landing.seoTitle }))
    .sort((a, b) => a.name.localeCompare(b.name, product?.locale ?? "fr"));

  const isNestedUnderActiveProduct = product !== null && product.status !== "killed";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b px-4 py-3">
        <p className="font-semibold">◆ {t("studio")}</p>
      </header>
      <main className="flex-1 px-4 py-16 text-center">
        <p aria-hidden="true" className="text-8xl font-bold text-muted-foreground/40">
          404
        </p>
        <h1 className="mt-6 text-3xl font-bold text-balance">
          {isNestedUnderActiveProduct ? t("pageTitle") : t("title")}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {isNestedUnderActiveProduct
            ? t("pageMissing", { name: product.name })
            : product
              ? t("closed", { name: product.name })
              : t("unknown")}
        </p>
        {isNestedUnderActiveProduct ? (
          <p className="mt-2">
            <Link href={`/${product.slug}`} className="underline underline-offset-4">
              {t("backTo", { name: product.name })}
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground">{t("dataOnRequest")}</p>
        )}

        {otherProducts.length > 0 ? (
          <div className="mx-auto mt-12 max-w-md text-left">
            <h2 className="text-sm font-semibold">{t("otherTools")}</h2>
            <ul className="mt-3 space-y-3">
              {otherProducts.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`/${other.slug}`}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 hover:bg-muted"
                  >
                    <span>
                      <span className="block font-semibold">{other.name}</span>
                      <span className="block text-sm text-muted-foreground">{other.tagline}</span>
                    </span>
                    <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
    </div>
  );
}
