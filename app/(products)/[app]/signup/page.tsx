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
export default async function SignupPage({ searchParams }: PageProps<"/[app]/signup">) {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  return (
    <section className="mx-auto grid max-w-md gap-6 px-4 py-8">
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
