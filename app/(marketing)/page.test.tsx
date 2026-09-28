import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/marketing.json";

// next-intl/navigation can't be imported unmocked under Vitest (proxy.test.ts's
// comment explains why: its ESM build imports the bare "next/navigation"
// specifier, which Node can't resolve without a bundler). @/i18n/marketing-navigation
// calls createNavigation() at module load, so it must be mocked here too, not
// just next-intl/server. This getPathname mirrors marketingRouting's real
// "as-needed" behaviour (fr default unprefixed unless forced, en always
// prefixed) closely enough for generateMetadata's own two calls.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "fr", messages: { marketing: fr }, namespace: namespace as never }),
}));

vi.mock("@/i18n/marketing-navigation", () => ({
  getPathname: ({ href, locale, forcePrefix }: { href: string; locale: string; forcePrefix?: boolean }) => {
    if (locale === "fr") return forcePrefix ? (href === "/" ? "/fr" : `/fr${href}`) : href;
    return href === "/" ? "/en" : `/en${href}`;
  },
}));

vi.mock("@/lib/dal/products", () => ({ listProducts: vi.fn() }));

// nextjs-reviewer finding: alternates.languages.fr used to be built with
// forcePrefix: true (-> "/fr"), which next-intl's own middleware always
// 307-redirects to "/" (proxy.test.ts's "/fr…" cases) — a search engine
// would get an hreflang="fr" link that's never the URL actually served,
// contradicting `canonical` (built without forcePrefix, "/", the real URL).
describe("app/(marketing) generateMetadata", () => {
  it("alternates.languages.fr matches canonical exactly; en keeps its forced prefix", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.alternates?.languages?.fr).toBe(metadata.alternates?.canonical);
    expect(metadata.alternates?.languages?.en).toBe("/en");
    expect(metadata.alternates?.languages?.["x-default"]).toBe("/");
  });
});
