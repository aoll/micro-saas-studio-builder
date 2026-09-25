import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/dal/products";
import { formatUsage, productsByTheme } from "./theme-usage";

const THEME_A = "11111111-1111-1111-1111-111111111111";
const THEME_B = "22222222-2222-2222-2222-222222222222";
const THEME_C = "33333333-3333-3333-3333-333333333333";

function product(overrides: Partial<Product>): Product {
  return {
    id: overrides.id ?? "product-id",
    name: "Produit",
    slug: "produit",
    status: "test",
    themeId: THEME_A,
    locale: "fr",
    branding: {},
    landing: {
      headline: "",
      subheadline: "",
      faq: [],
      seoTitle: "x",
      seoDescription: "x",
    },
    inputs: [{ key: "a", label: "A", type: "text", required: true }],
    generation: { model: "m", promptTemplate: "{{a}}", outputType: "markdown" },
    pricing: {
      freeCreditsOnSignup: 0,
      anonymousFreeGenerations: 0,
      costPerGeneration: 1,
      packs: [{ id: "p", credits: 1, priceCents: 100 }],
    },
    version: 1,
    isSeed: false,
    ...overrides,
  };
}

describe("productsByTheme", () => {
  it("returns an empty map for an empty product list", () => {
    expect(productsByTheme([]).size).toBe(0);
  });

  it("groups products by themeId, names sorted with French collation", () => {
    const products = [
      product({ id: "1", name: "Zeta", themeId: THEME_A }),
      product({ id: "2", name: "Été", themeId: THEME_A }),
    ];
    const grouped = productsByTheme(products);
    expect(grouped.get(THEME_A)).toEqual(["Été", "Zeta"]);
  });

  it("keeps an unknown themeId in the map even if never displayed", () => {
    const products = [product({ id: "1", name: "Orphan", themeId: THEME_C })];
    const grouped = productsByTheme(products);
    expect(grouped.get(THEME_C)).toEqual(["Orphan"]);
  });

  it("does not mutate the input array", () => {
    const products = [
      product({ id: "1", name: "Zeta", themeId: THEME_B }),
      product({ id: "2", name: "Alpha", themeId: THEME_B }),
    ];
    const copy = [...products];
    productsByTheme(products);
    expect(products).toEqual(copy);
  });
});

describe("formatUsage", () => {
  it("returns 'Aucun produit' for zero products", () => {
    expect(formatUsage([])).toBe("Aucun produit");
  });

  it("returns a singular sentence for one product", () => {
    expect(formatUsage(["LettrePro"])).toBe("Utilisé par 1 produit · LettrePro");
  });

  it("returns a plural sentence for several products", () => {
    expect(formatUsage(["DescriPro", "LettrePro", "NomDeMarque"])).toBe(
      "Utilisé par 3 produits · DescriPro, LettrePro, NomDeMarque",
    );
  });
});
