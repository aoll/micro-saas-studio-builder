import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/marketing-navigation";
import { Hero } from "./_components/hero";
import { KeyNumbers } from "./_components/key-numbers";
import { BackofficeScreens } from "./_components/backoffice-screens";
import { WhyThisDemo } from "./_components/why-this-demo";
import { ProductsShowcase } from "./_components/products-showcase";
import { HowItsBuilt } from "./_components/how-its-built";
import { SiteFooter } from "./_components/site-footer";
import { LocaleSwitcher } from "./_components/locale-switcher";

// The recruiter landing at `/`: not one of the 17 screens of
// docs/02-ecrans.md (those cover the backoffice and the `/{slug}` sub-apps),
// because this page is about the demo itself, not a product of it. Content
// adapted from docs/00-accueil.md and docs/13-candidature.md, rewritten
// shorter for a page read in 30 seconds rather than a shared design doc.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.metadata");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: getPathname({ href: "/", locale: "fr" }),
      languages: {
        fr: getPathname({ href: "/", locale: "fr", forcePrefix: true }),
        en: getPathname({ href: "/", locale: "en", forcePrefix: true }),
        "x-default": "/",
      },
    },
  };
}

export default function HomePage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl justify-end px-4 pt-4 sm:px-8">
        <LocaleSwitcher pathname="/" />
      </header>
      <Hero />
      <KeyNumbers />
      <BackofficeScreens />
      <WhyThisDemo />
      <ProductsShowcase />
      <HowItsBuilt />
      <SiteFooter />
    </main>
  );
}
