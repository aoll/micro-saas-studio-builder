import "@/app/globals.css";
import { NextIntlClientProvider } from "next-intl";
import { app } from "next/root-params";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fontFor } from "@/lib/fonts";
import { loadMessages } from "@/i18n/load-messages";
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

// The layout that renders <html> for every sub-app: [app] is a root param
// (docs/04-nextjs.md), read with next/root-params since it sits above this
// root layout. An unknown slug or a `killed` product both 404 (specs/SA-08):
// spiked at specs/SA-08-introuvable.md's task 1, on a throwaway build
// served on :3108 with a real killed row. Neither a plain `notFound()` in
// this layout nor the root-layout-with-slots fallback pass (a second
// invocation with `modal` left `undefined`, per
// node_modules/next/dist/server/app-render/create-component-tree.js) ever
// rendered `[app]/not-found.tsx`'s content or status 404 without falling
// back to Next's own generic "This page could not be found" — outcome C,
// reported as a blocker (see the PR body). A product whose theme row is
// missing is a data integrity error, not a 404, so it throws instead of
// calling notFound().
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
