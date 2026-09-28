import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { localeSchema, type ProductConfig } from "@/lib/schemas/product-config";
import { loadMessages } from "./load-messages";

// docs/08-stack.md › i18n: the cookie the backoffice's LocaleSwitcher
// writes (app/(backoffice)/admin/_components/locale-switcher.tsx). Kept as
// a literal there too: a server module (this file) cannot be imported from
// a 'use client' file.
const ADMIN_LOCALE_COOKIE = "admin_locale";

// The single getRequestConfig of the whole app (docs/08-stack.md › i18n:
// "un seul point d'entrée"), an aiguillage in three branches, in this
// order:
// 1. An explicit `locale` (a caller doing `getTranslations({ locale })`,
//    e.g. a Server Action of admin/** returning an error message in the
//    admin's chosen language, docs/08-stack.md: next/root-params isn't
//    available there, so the action receives the locale as an argument
//    instead, bound client-side from useLocale()). Wins over everything
//    else, calls neither app() (throws in a Server Action) nor cookies().
//    `params.locale` is a plain value here, never derived from headers(),
//    so it's safe to read unconditionally.
// 2. The [app] root param, when present: the product's own locale
//    (unchanged since before this spec).
// 3. Otherwise, the backoffice: the admin_locale cookie, fr by default. No
//    Accept-Language detection behind auth (I18N-BACKOFFICE bullet 3).
//
// IMPORTANT: never destructure `requestLocale` out of `params`, alone or
// alongside `locale` (`async ({ locale, requestLocale }) => …`). It's a
// lazy getter backed by headers(): merely accessing the property — even
// without awaiting it — marks the whole render dynamic. Since this is the
// only getRequestConfig of the site, that would break every statically
// prerendered product landing (SA-01), including requests that resolve
// through the product branch below and never needed it. Take `params` as
// a whole and only ever read `params.locale`; I18N-MARKETING inserts its
// own branch here (between 2 and 3) and is the only one that reads
// `params.requestLocale`, inside that branch, never before it.
export default getRequestConfig(async (params) => {
  if (params.locale !== undefined) {
    const locale = toLocale(params.locale);
    return { locale, messages: await loadMessages(locale) };
  }

  const slug = await app();
  if (slug) {
    const product = await getProduct(slug);
    const locale = product?.locale ?? "fr";
    return { locale, messages: await loadMessages(locale) };
  }

  // I18N-MARKETING: the marketing requestLocale branch goes here, before
  // the cookie fallback, reading params.requestLocale itself.

  const locale = await backofficeLocale();
  return { locale, messages: await loadMessages(locale) };
});

async function backofficeLocale(): Promise<ProductConfig["locale"]> {
  const jar = await cookies();
  return toLocale(jar.get(ADMIN_LOCALE_COOKIE)?.value);
}

function toLocale(value: string | undefined): ProductConfig["locale"] {
  return localeSchema.safeParse(value).data ?? "fr";
}
