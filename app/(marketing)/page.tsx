import type { Metadata } from "next";
import { Hero } from "./_components/hero";
import { KeyNumbers } from "./_components/key-numbers";
import { WhyThisDemo } from "./_components/why-this-demo";
import { ProductsShowcase } from "./_components/products-showcase";
import { HowItsBuilt } from "./_components/how-its-built";
import { SiteFooter } from "./_components/site-footer";

// The recruiter landing at `/`: not one of the 17 screens of
// docs/02-ecrans.md (those cover the backoffice and the `/{slug}` sub-apps),
// because this page is about the demo itself, not a product of it. Content
// adapted from docs/00-accueil.md and docs/13-candidature.md, rewritten
// shorter for a page read in 30 seconds rather than a shared design doc.
export const metadata: Metadata = {
  title: "Micro-SaaS Studio Builder — démo pour Dotworld",
  description:
    "Un backoffice Next.js qui lance un micro-SaaS IA en quelques minutes et le pilote par la donnée : Test → Learn → Scale.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main>
      <Hero />
      <KeyNumbers />
      <WhyThisDemo />
      <ProductsShowcase />
      <HowItsBuilt />
      <SiteFooter />
    </main>
  );
}
