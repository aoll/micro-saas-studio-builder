// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/landing.json";
import common from "@/messages/fr/common.json";

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const getTheme = vi.fn();
vi.mock("@/lib/dal/themes", () => ({ getTheme: (id: string) => getTheme(id) }));

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

class NotFoundError extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

vi.mock("@/components/track-visit", () => ({
  TrackVisit: ({ slug }: { slug: string }) => <div data-testid="track-visit" data-slug={slug} />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
    packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
  },
  id: "product-1",
  version: 1,
  isSeed: true,
};

const theme = { id: product.themeId, slug: "editorial", name: "Editorial", landingVariant: "split" as const };

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ landing: fr, common }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ProductPage (SA-01 landing)", () => {
  it("renders the landing for the current root param, in the theme's variant, and tracks the visit", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    getTheme.mockResolvedValue(theme);

    const { default: ProductPage } = await import("./page");
    const ui = await ProductPage();
    const { container } = renderUi(ui);

    expect(getProduct).toHaveBeenCalledWith("lettre-pro");
    expect(getTheme).toHaveBeenCalledWith(product.themeId);
    expect(screen.getByRole("heading", { level: 1, name: product.landing.headline })).toBeTruthy();
    expect(container.querySelector("[data-variant]")?.getAttribute("data-variant")).toBe("split");
    const tracker = screen.getByTestId("track-visit");
    expect(tracker.getAttribute("data-slug")).toBe("lettre-pro");
  });

  it("calls notFound() when there is no root param", async () => {
    app.mockResolvedValue(undefined);
    const { default: ProductPage } = await import("./page");
    await expect(ProductPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("calls notFound() when the product is unknown", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: ProductPage } = await import("./page");
    await expect(ProductPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws a named error when the product's theme row is missing", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    getTheme.mockResolvedValue(null);
    const { default: ProductPage } = await import("./page");
    await expect(ProductPage()).rejects.toThrow(/lettre-pro/);
  });
});

describe("generateMetadata", () => {
  it("returns the config's SEO title and description for a known product, cached and tagged", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata).toEqual({
      title: product.landing.seoTitle,
      description: product.landing.seoDescription,
      alternates: { canonical: `/${product.slug}` },
      openGraph: { title: product.landing.seoTitle, description: product.landing.seoDescription },
    });
    expect(cacheLife).toHaveBeenCalledWith("max");
    expect(cacheTag).toHaveBeenCalledWith("product:lettre-pro");
  });

  it("returns an empty object for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata).toEqual({});
  });
});
