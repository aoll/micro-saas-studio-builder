import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/making-of.json";

// Same reasoning as app/(marketing)/page.test.tsx: @/i18n/marketing-navigation
// must be mocked (createNavigation() runs at module load, and next-intl's
// ESM navigation build can't be resolved unmocked under Vitest).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "fr", messages: { "making-of": fr }, namespace: namespace as never }),
}));

vi.mock("@/i18n/marketing-navigation", () => ({
  getPathname: ({ href, locale, forcePrefix }: { href: string; locale: string; forcePrefix?: boolean }) => {
    if (locale === "fr") return forcePrefix ? (href === "/" ? "/fr" : `/fr${href}`) : href;
    return href === "/" ? "/en" : `/en${href}`;
  },
}));

// nextjs-reviewer finding, same bug as the landing: alternates.languages.fr
// must mirror canonical (no forcePrefix), or hreflang="fr" points at "/fr",
// which next-intl always 307-redirects to "/making-of".
describe("app/(marketing)/making-of generateMetadata", () => {
  it("alternates.languages.fr matches canonical exactly; en keeps its forced prefix", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe("/making-of");
    expect(metadata.alternates?.languages?.fr).toBe(metadata.alternates?.canonical);
    expect(metadata.alternates?.languages?.en).toBe("/en/making-of");
    expect(metadata.alternates?.languages?.["x-default"]).toBe("/making-of");
  });
});
