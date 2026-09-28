import { defineRouting } from "next-intl/routing";

// docs/08-stack.md's "Landing et making-of": the only zone of the app that
// uses next-intl's *i18n routing* (fr unprefixed, en under `/en`), chained
// in proxy.ts ahead of the admin guard and the anonymous_id cookie
// (i18n/request.ts's marketing branch reads the locale it resolves).
// `localeCookie.maxAge` matches ANONYMOUS_ID_COOKIE's one year
// (app/(products)/[app]/api/events/anonymous-id.ts), so "cette préférence
// l'emporte sur la détection lors des visites suivantes" (spec) actually
// persists across visits rather than expiring with the browser session.
export const marketingRouting = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type MarketingLocale = (typeof marketingRouting.locales)[number];

const MARKETING_ROUTES = new Set(["/", "/making-of"]);

export type MarketingPath = { locale: MarketingLocale | undefined; pathname: string };

// A pure parse of the request pathname, with no dependency on next-intl's
// own locale resolution: recognizes `/`, `/making-of`, and both optionally
// prefixed by `/fr` or `/en` (trailing slash normalized). Returns `null` for
// anything else — products, `/admin*`, `/api/*` — so proxy.ts can gate the
// marketing branch before running the two existing rules (R4). `locale` is
// the prefix found in the URL, if any: `undefined` for an unprefixed path,
// which — once next-intl decides not to redirect it — always resolves to
// the default locale `fr` (see i18n/marketing-routing.plan.md finding 1:
// with `as-needed`, an unprefixed request that resolves to `en` is always
// redirected to add the prefix).
export function marketingPath(pathname: string): MarketingPath | null {
  const trimmed = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (MARKETING_ROUTES.has(trimmed)) return { locale: undefined, pathname: trimmed === "" ? "/" : trimmed };
  for (const locale of marketingRouting.locales) {
    const prefix = `/${locale}`;
    if (trimmed === prefix) return { locale, pathname: "/" };
    if (trimmed.startsWith(`${prefix}/`)) {
      const rest = trimmed.slice(prefix.length);
      if (MARKETING_ROUTES.has(rest)) return { locale, pathname: rest };
    }
  }
  return null;
}
