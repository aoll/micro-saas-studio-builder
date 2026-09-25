import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { RouteModal } from "@/components/product/route-modal";
import { SignupFlow } from "@/app/(products)/[app]/signup/_components/signup-flow";

// SA-03 (specs/SA-03-inscription.md), modal on top of the outil: opened by
// ToolForm right after the free generation
// (tool/_components/tool-form.tsx's `router.push(`/${slug}/signup`)`), so
// there is never an `?error=` to read here — that only ever reaches the
// full page, via Better Auth's server-side redirect after a magic-link
// verify (design decision 8). `(.)` matches `signup` because @modal is a
// parallel routes slot (docs/04-nextjs.md), same as @modal/(.)pricing.
export default async function SignupModal() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const t = await getTranslations("auth");

  return (
    <RouteModal title={`${t("heading")} ${t("headingAccent", { count: product.pricing.freeCreditsOnSignup })}`}>
      <SignupFlow slug={product.slug} />
    </RouteModal>
  );
}
