import { getRequestConfig, type GetRequestConfigParams } from "next-intl/server";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { marketingRouting } from "./marketing-routing";
import { loadMessages } from "./load-messages";

// The single getRequestConfig of the whole app (docs/08-stack.md's "un seul
// point d'entrée"), a three-branch dispatch: root param [app] present ->
// product locale (unchanged); else the locale the marketing middleware of
// proxy.ts resolved for `/` and `/making-of` (I18N-MARKETING); else the
// backoffice's `admin_locale` cookie, fr by default (I18N-BACKOFFICE, left
// as the one-line fallback below so that spec's diff stays a pure append).
//
// CRITICAL: never destructure `requestLocale` (or bundle it with `locale`)
// in this function's own signature — `async ({ requestLocale }) => …` would
// still work, but the destructuring reads the getter immediately. It is a
// lazy getter over `headers()` (next-intl's `getRequestLocale`, itself
// reading the `X-NEXT-INTL-LOCALE` header proxy.ts sets): merely *accessing*
// it — even without awaiting the promise it returns — calls `headers()` and
// taints the whole render as dynamic. Since this is the only
// `getRequestConfig` in the app, that would break the static prerender of
// every product landing (SA-01). `params.requestLocale` is read by property
// access below, only inside the marketing branch, only after the product
// branch has already returned.
export default getRequestConfig(async (params: GetRequestConfigParams) => {
  // 0. Explicit override: a caller (I18N-BACKOFFICE's Server Actions, which
  // cannot use next/root-params) passed its own locale to an awaitable
  // function like `getTranslations({ locale })`. A plain value set by the
  // caller, never derived from headers() — safe to read unconditionally.
  if (params.locale !== undefined) {
    const locale = params.locale === "en" ? "en" : "fr";
    return { locale, messages: await loadMessages(locale) };
  }

  // 1. Product (unchanged): root param [app] -> product locale, fr for a
  // route outside [app] or an unknown slug.
  const slug = await app();
  if (slug) {
    const product = await getProduct(slug);
    const locale = product?.locale ?? "fr";
    return { locale, messages: await loadMessages(locale) };
  }

  // 2. Marketing: the locale resolved by createMiddleware(marketingRouting)
  // in proxy.ts, for `/` and `/making-of` only. See the CRITICAL note above.
  const marketingLocale = await params.requestLocale;
  if ((marketingRouting.locales as readonly string[]).includes(marketingLocale ?? "")) {
    const locale = marketingLocale as "fr" | "en";
    return { locale, messages: await loadMessages(locale) };
  }

  // 3. Backoffice (I18N-BACKOFFICE replaces this with the admin_locale
  // cookie): fr by default.
  return { locale: "fr", messages: await loadMessages("fr") };
});
