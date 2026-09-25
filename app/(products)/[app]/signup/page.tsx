import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { Suspense } from "react";
import { getProduct } from "@/lib/dal/products";
import { SignupPanel } from "./_components/signup-panel";

// SA-03 (specs/SA-03-inscription.md), full page: reachable directly and on
// refresh, same content as the intercepted modal (@modal/(.)signup). Only
// `killed` is checked by the [app] layout (design decision 4, mirroring
// pricing/page.tsx): this page only guards against an unknown product.
// `searchParams` is forwarded unawaited, read only inside <Suspense> by
// SignupPanel (docs/04-nextjs.md), so the shell (heading, form) stays
// instant even though the `?error=` query is a dynamic input.
//
// Review fix (mirrors pricing/page.tsx's own <h1>): the page owns the only
// heading, built from the same `auth.heading` / `auth.headingAccent` keys
// as the modal's RouteModal title, so SignupFlow (no heading of its own)
// never duplicates it here.
export default async function SignupPage({ searchParams }: PageProps<"/[app]/signup">) {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("auth");

  return (
    <section className="mx-auto grid max-w-md gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">
        {t("heading")}{" "}
        <span className="text-primary">{t("headingAccent", { count: product.pricing.freeCreditsOnSignup })}</span>
      </h1>
      <Suspense fallback={null}>
        <SignupPanel
          slug={product.slug}
          freeCreditsOnSignup={product.pricing.freeCreditsOnSignup}
          searchParams={searchParams}
        />
      </Suspense>
    </section>
  );
}
