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
// 2. The [app] root param, when present: the product's own locale
//    (unchanged since before this spec).
// 3. Otherwise, the backoffice: the admin_locale cookie, fr by default. No
//    Accept-Language detection behind auth (I18N-BACKOFFICE bullet 3).
// (I18N-MARKETING's marketing requestLocale branch goes between 2 and 3.)
export default getRequestConfig(async ({ locale: explicit, requestLocale }) => {
  const locale = explicit !== undefined ? toLocale(explicit) : await resolveLocale(requestLocale);
  return { locale, messages: await loadMessages(locale) };
});

// `requestLocale` isn't read yet: it stays a parameter, unused for now, so
// I18N-MARKETING's own branch (the marketing group's next-intl routing) can
// land here without touching this function's signature or call site — the
// seam the orchestrator asked for (merge-order decision, I18N-BACKOFFICE
// plan).
async function resolveLocale(requestLocale: Promise<string | undefined>): Promise<ProductConfig["locale"]> {
  void requestLocale;
  const slug = await app();
  if (slug) {
    const product = await getProduct(slug);
    return product?.locale ?? "fr";
  }
  // I18N-MARKETING: the marketing requestLocale branch goes here, before
  // the cookie fallback.
  return backofficeLocale();
}

async function backofficeLocale(): Promise<ProductConfig["locale"]> {
  const jar = await cookies();
  return toLocale(jar.get(ADMIN_LOCALE_COOKIE)?.value);
}

function toLocale(value: string | undefined): ProductConfig["locale"] {
  return localeSchema.safeParse(value).data ?? "fr";
}
