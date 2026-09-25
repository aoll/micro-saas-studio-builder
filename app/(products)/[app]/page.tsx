import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { getTheme } from "@/lib/dal/themes";
import { TrackVisit } from "@/components/track-visit";
import { Landing } from "./_components/landing/landing";

// SA-01 (specs/SA-01-landing.md): the landing, entirely read from the
// cached product config and its theme's variant, pre-rendered
// (generateStaticParams lives in this route's layout, docs/04-nextjs.md).
// `app()` (root param), not `params`, like the layout and i18n/request.ts:
// `[app]` sits above this route's root layout.
export default async function ProductPage() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) notFound();

  const theme = await getTheme(product.themeId);
  if (!theme) throw new Error(`ProductPage(${product.slug}): missing theme row for ${product.themeId}`);

  return (
    <>
      <TrackVisit slug={product.slug} />
      <Landing product={product} variant={theme.landingVariant} />
    </>
  );
}

// Cached under the same `product:{slug}` tag as the page's own data
// (docs/04-nextjs.md › SEO par produit): the backoffice's save action
// invalidates both together.
export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  cacheLife("max");
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) return {};
  cacheTag(`product:${product.slug}`);
  return {
    title: product.landing.seoTitle,
    description: product.landing.seoDescription,
    // docs/04-nextjs.md > SEO par produit: one canonical URL per landing,
    // resolved against [app]/layout.tsx's metadataBase.
    alternates: { canonical: `/${product.slug}` },
    // The OG image itself already comes from [app]/opengraph-image.tsx
    // (I18N-SEO); only the text fields are set here, never duplicated.
    openGraph: { title: product.landing.seoTitle, description: product.landing.seoDescription },
  };
}
