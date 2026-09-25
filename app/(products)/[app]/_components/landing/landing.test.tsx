// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/landing.json";
import common from "@/messages/fr/common.json";
import type { LandingVariant } from "@/lib/schemas/theme-tokens";
import type { Product } from "@/lib/dal/products";
import { Landing } from "./landing";

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ landing: fr, common }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const product = {
  slug: "lettre-pro",
  name: "LettrePro",
  status: "scale",
  themeId: "11111111-1111-1111-1111-111111111111",
  locale: "fr",
  branding: {},
  landing: {
    headline: "Générez votre lettre de motivation en 30 secondes",
    subheadline: "Un outil IA qui rédige une lettre de motivation percutante.",
    faq: [{ question: "Combien coûte une génération ?", answer: "1 crédit par lettre générée." }],
    seoTitle: "Générateur de lettre de motivation IA",
    seoDescription: "Créez une lettre de motivation en 30 secondes.",
    exampleOutput: "Madame, Monsieur,\n\nJe candidate...",
    steps: [{ title: "Décrivez le poste", description: "Indiquez le poste visé." }],
  },
  inputs: [{ key: "poste", label: "Poste visé", type: "text", required: true }],
  generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "{{poste}}", outputType: "markdown" },
  pricing: {
    freeCreditsOnSignup: 3,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [
      { id: "pack-10", credits: 10, priceCents: 490 },
      { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
    ],
  },
  id: "product-1",
  version: 1,
  isSeed: true,
} satisfies Product;

const variants: LandingVariant[] = ["centered", "split", "minimal"];

describe("Landing", () => {
  it.each(variants)("renders every section for the %s variant", (variant) => {
    const { container } = renderUi(<Landing product={product} variant={variant} />);
    const root = container.querySelector("[data-variant]");
    expect(root?.getAttribute("data-variant")).toBe(variant);
    expect(screen.getByRole("heading", { level: 1, name: product.landing.headline })).toBeTruthy();
    expect(screen.getByText("Exemple de résultat")).toBeTruthy();
    expect(screen.getByText("Comment ça marche")).toBeTruthy();
    expect(screen.getByText("Tarifs")).toBeTruthy();
    expect(screen.getByText("Questions fréquentes")).toBeTruthy();
  });

  it("puts the example result inside the hero block for the split variant", () => {
    const { container } = renderUi(<Landing product={product} variant="split" />);
    const hero = container.querySelector('[data-testid="landing-hero"]');
    expect(hero?.textContent).toContain("Exemple de résultat");
  });

  it("centers the hero and keeps the example outside it for the centered variant", () => {
    const { container } = renderUi(<Landing product={product} variant="centered" />);
    const hero = container.querySelector('[data-testid="landing-hero"]');
    expect(hero?.getAttribute("data-align")).toBe("center");
    expect(hero?.textContent).not.toContain("Exemple de résultat");
  });

  it("renders a bare blockquote example, left-aligned, for the minimal variant", () => {
    const { container } = renderUi(<Landing product={product} variant="minimal" />);
    const hero = container.querySelector('[data-testid="landing-hero"]');
    expect(hero?.getAttribute("data-align")).toBe("start");
    expect(container.querySelector("blockquote")).toBeTruthy();
    expect(container.querySelector('[data-slot="card"] blockquote')).toBeNull();
  });
});
