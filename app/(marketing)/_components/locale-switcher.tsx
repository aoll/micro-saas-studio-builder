import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/marketing-navigation";
import { marketingRouting } from "@/i18n/marketing-routing";

// Plan finding 4: a plain `<a href>`, not next-intl's `Link` — `/` and
// `/en` rewrite to the same internal route tree (proxy.ts), so a soft
// client-side navigation between them could reuse the shared root layout
// segment and leave a stale `<html lang>`, provider and switcher. A full
// page load always re-runs the marketing middleware and this layout.
// `forcePrefix: true` on the French link is what lets the visitor switch
// back from an `en` NEXT_LOCALE cookie: without it, `/` would just get
// redirected straight back to `/en` by that cookie (plan finding 4).
export async function LocaleSwitcher({ pathname }: { pathname: "/" | "/making-of" }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("marketing.localeSwitcher")]);

  return (
    <nav aria-label={t("label")} className="flex items-center gap-2 text-[13px] font-medium">
      {marketingRouting.locales.map((candidate) => (
        <a
          key={candidate}
          href={getPathname({ href: pathname, locale: candidate, forcePrefix: true })}
          hrefLang={candidate}
          lang={candidate}
          aria-current={candidate === locale ? "true" : undefined}
          className={
            candidate === locale
              ? "text-mk-ink underline underline-offset-4"
              : "text-mk-muted hover:text-mk-link hover:underline"
          }
        >
          {t(candidate)}
        </a>
      ))}
    </nav>
  );
}
