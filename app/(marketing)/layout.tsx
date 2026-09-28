import "@/app/globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { display, mono, sans } from "@/components/brand/fonts";

// Root layout for `/`: a third root layout alongside `(backoffice)` and
// `(products)/[app]` (docs/09-arborescence.md's "multiple root layouts"
// case) — this page has neither the backoffice's session-gated UI nor a
// product's theme, so it gets its own minimal shell. `metadataBase` follows
// the same pattern as `(products)/[app]/layout.tsx` and app/sitemap.ts: one
// base URL for every relative metadata field.
export const metadata: Metadata = {
  metadataBase: new URL(env.BETTER_AUTH_URL),
};

// I18N-MARKETING (plan finding 3): the locale now comes from a request
// header proxy.ts's marketing middleware sets, not a URL segment or a
// cached product config — there is no way to prerender one shell per
// locale here. This opts `/` and `/making-of` out of Cache Components'
// static-shell validation (docs/04-nextjs.md); `listProducts()` (used by
// KeyNumbers and ProductsShowcase) stays `'use cache'`, so the per-request
// cost of losing the static shell stays low (plan risk R-M: a `'use cache'`
// inner shell keyed by locale is a possible later optimization).
export const instant = false;

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh mk-backdrop font-[family-name:var(--font-mk-sans)] text-mk-ink">
        {/* Empty messages: no client component under this layout calls
            useTranslations — only next-intl's own `Link`
            (i18n/marketing-navigation.ts), which needs the locale via
            useLocale(), never the messages payload (plan step 6). */}
        <NextIntlClientProvider locale={locale} messages={{}}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
