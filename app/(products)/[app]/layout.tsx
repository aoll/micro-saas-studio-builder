import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { cacheLife, cacheTag } from "next/cache";
import { app } from "next/root-params";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fontFor } from "@/lib/fonts";
import { loadMessages } from "@/i18n/load-messages";
import { env } from "@/lib/env";
import { getProduct, listProductSlugs } from "@/lib/dal/products";
import { getTheme } from "@/lib/dal/themes";
import { BalanceBadgeSkeleton, BalanceProvider } from "@/components/product/balance";
import { DemoBanner } from "@/components/product/demo-banner";
import { HeaderBalance } from "@/components/product/header-balance";
import { ProductFooter } from "@/components/product/product-footer";
import { ProductHeader } from "@/components/product/product-header";
import { themeCssVars } from "@/components/product/theme-vars";
import { Toaster } from "@/components/ui/sonner";

// A root param needs at least one value under Cache Components (docs/04-nextjs.md).
export async function generateStaticParams() {
  const slugs = await listProductSlugs();
  return slugs.map((app) => ({ app }));
}

// docs/04-nextjs.md › SEO par produit: the base URL every relative
// URL-based metadata field (canonical, Open Graph images…) resolves
// against, same `env.BETTER_AUTH_URL` as app/sitemap.ts and app/robots.ts.
// It never varies per product, so a static `metadata` export (not
// `generateMetadata`) is enough: no cache scope, no serialization concern.
export const metadata: Metadata = {
  metadataBase: new URL(env.BETTER_AUTH_URL),
};

// docs/04-nextjs.md › SEO par produit: the mobile browser bar's
// `theme-color`, from the product's resolved primary colour (branding
// override, same precedence as theme-vars.ts's `themeCssVars`). Cached
// under the same `product:{slug}` tag as the rest of the product's
// metadata and config, so a backoffice save invalidates it too. An
// unknown product, a missing root param or a missing theme row all
// resolve to an empty viewport: the default export below is what 404s or
// throws.
export async function generateViewport(): Promise<Viewport> {
  "use cache";
  cacheLife("max");
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product) return {};
  cacheTag(`product:${product.slug}`);

  const theme = await getTheme(product.themeId);
  if (!theme) return {};

  return { themeColor: product.branding.primaryColor ?? theme.tokens.light.primary };
}

// The layout that renders <html> for every sub-app: [app] is a root param
// (docs/04-nextjs.md), read with next/root-params since it sits above this
// root layout. An unknown slug or a `killed` product both 404 (specs/SA-08):
// spiked at specs/SA-08-introuvable.md's task 1, on a throwaway build
// served on :3108 with a real killed row, then re-checked on a clean build
// in a browser (plan round 2, decision 3). Outcome: this `notFound()` call
// is rendered by the *parent* segment's not-found
// (app/(products)/not-found.tsx), never by this segment's own
// `[app]/not-found.tsx` — real 404 status, SA-08 content served one level
// up. A product whose theme row is missing is a data integrity error, not
// a 404, so it throws instead of calling notFound().
export default async function ProductLayout({ children, modal }: LayoutProps<"/[app]">) {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  if (!product || product.status === "killed") notFound();

  const theme = await getTheme(product.themeId);
  if (!theme) throw new Error(`ProductLayout(${product.slug}): missing theme row for ${product.themeId}`);

  const messages = await loadMessages(product.locale);

  return (
    <html
      lang={product.locale}
      className={fontFor(theme.tokens.fontKey).variable}
      style={themeCssVars(theme.tokens, product.branding)}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider locale={product.locale} messages={messages}>
          <BalanceProvider>
            <DemoBanner />
            <ProductHeader
              slug={product.slug}
              name={product.name}
              logoUrl={product.branding.logoUrl}
              balance={
                <Suspense fallback={<BalanceBadgeSkeleton />}>
                  <HeaderBalance productId={product.id} slug={product.slug} />
                </Suspense>
              }
            />
            <main className="flex-1">{children}</main>
            <ProductFooter name={product.name} />
            {modal}
            <Toaster />
          </BalanceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
