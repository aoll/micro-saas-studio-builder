import type { Product } from "@/lib/dal/products";
import type { LandingVariant } from "@/lib/schemas/theme-tokens";
import { Hero } from "./hero";
import { ExampleResult } from "./example-result";
import { HowItWorks } from "./how-it-works";
import { LandingPricing } from "./landing-pricing";
import { Faq } from "./faq";

// SA-01: the 3 layouts a theme can pick for its landing
// (docs/01-produit.md › Thèmes › Variante de landing), all 5 sections in
// every variant, differing only in layout (plan design decision 6).
type Sections = {
  hero: React.ReactNode;
  example: React.ReactNode;
  steps: React.ReactNode;
  pricing: React.ReactNode;
  faq: React.ReactNode;
};

function CenteredLanding({ hero, example, steps, pricing, faq }: Sections) {
  return (
    <div className="mx-auto grid max-w-3xl gap-16 px-4 py-16">
      {hero}
      {example}
      {steps}
      {pricing}
      {faq}
    </div>
  );
}

function SplitLanding({ hero, steps, pricing, faq }: Sections) {
  return (
    <div className="mx-auto grid max-w-5xl gap-16 px-4 py-16">
      {hero}
      {steps}
      {pricing}
      {faq}
    </div>
  );
}

function MinimalLanding({ hero, example, steps, pricing, faq }: Sections) {
  return (
    <div className="mx-auto grid max-w-2xl gap-12 px-4 py-12 text-left">
      {hero}
      {example}
      {steps}
      {pricing}
      {faq}
    </div>
  );
}

const VARIANTS = {
  centered: CenteredLanding,
  split: SplitLanding,
  minimal: MinimalLanding,
} satisfies Record<LandingVariant, (sections: Sections) => React.ReactNode>;

export function Landing({ product, variant }: { product: Product; variant: LandingVariant }) {
  const { landing, pricing, slug } = product;
  const Layout = VARIANTS[variant];

  const example = <ExampleResult exampleOutput={landing.exampleOutput} bare={variant === "minimal"} />;
  const steps = <HowItWorks steps={landing.steps} />;
  const pricingSection = (
    <LandingPricing
      slug={slug}
      packs={pricing.packs}
      costPerGeneration={pricing.costPerGeneration}
      freeCreditsOnSignup={pricing.freeCreditsOnSignup}
    />
  );
  const faq = <Faq entries={landing.faq} />;

  const hero = (
    <Hero
      slug={slug}
      headline={landing.headline}
      subheadline={landing.subheadline}
      eyebrow={landing.seoTitle}
      anonymousFreeGenerations={pricing.anonymousFreeGenerations}
      align={variant === "centered" ? "center" : "start"}
    >
      {variant === "split" ? example : null}
    </Hero>
  );

  return (
    <div data-variant={variant}>
      <Layout
        hero={hero}
        example={variant === "split" ? null : example}
        steps={steps}
        pricing={pricingSection}
        faq={faq}
      />
    </div>
  );
}
