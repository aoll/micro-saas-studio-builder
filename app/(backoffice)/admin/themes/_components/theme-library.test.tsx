// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/dal/products";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

const listThemeOptions = vi.fn();
vi.mock("@/lib/dal/product-editor", () => ({ listThemeOptions: () => listThemeOptions() }));

const listProducts = vi.fn();
vi.mock("@/lib/dal/products", () => ({ listProducts: () => listProducts() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const tokens: ThemeTokens = {
  light: {
    background: "#faf7f2",
    foreground: "#2b2620",
    card: "#ffffff",
    cardForeground: "#2b2620",
    primary: "#8a5a34",
    primaryForeground: "#ffffff",
    secondary: "#efe7da",
    secondaryForeground: "#2b2620",
    muted: "#efe7da",
    mutedForeground: "#6b6357",
    accent: "#cbb994",
    accentForeground: "#2b2620",
    destructive: "#b3261e",
    border: "#e3dccb",
    input: "#e3dccb",
    ring: "#8a5a34",
  },
  dark: {
    background: "#1c1712",
    foreground: "#f4efe4",
    card: "#251f18",
    cardForeground: "#f4efe4",
    primary: "#c98f5e",
    primaryForeground: "#1c1712",
    secondary: "#332a20",
    secondaryForeground: "#f4efe4",
    muted: "#332a20",
    mutedForeground: "#b3a891",
    accent: "#8a5a34",
    accentForeground: "#f4efe4",
    destructive: "#ff6961",
    border: "#3a3025",
    input: "#3a3025",
    ring: "#c98f5e",
  },
  fontKey: "serif",
  radius: "0.5rem",
};

const EDITORIAL = "11111111-1111-1111-1111-111111111111";
const NEON = "22222222-2222-2222-2222-222222222222";
const CORPORATE = "33333333-3333-3333-3333-333333333333";
const PLAYFUL = "44444444-4444-4444-4444-444444444444";

function theme(overrides: Partial<Theme>): Theme {
  return {
    id: "id",
    slug: "slug",
    name: "Name",
    tokens,
    landingVariant: "centered",
    isSeed: true,
    ...overrides,
  };
}

const themes: Theme[] = [
  theme({ id: EDITORIAL, name: "Editorial", landingVariant: "split" }),
  theme({ id: NEON, name: "Neon", landingVariant: "centered" }),
  theme({ id: CORPORATE, name: "Corporate", landingVariant: "minimal" }),
  theme({ id: PLAYFUL, name: "Playful", landingVariant: "centered" }),
];

function product(overrides: Partial<Product>): Product {
  return {
    id: "product-id",
    name: "Produit",
    slug: "produit",
    status: "test",
    themeId: EDITORIAL,
    locale: "fr",
    branding: {},
    landing: { headline: "", subheadline: "", faq: [], seoTitle: "x", seoDescription: "x" },
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

const products: Product[] = [
  product({ id: "1", name: "LettrePro", themeId: EDITORIAL }),
  product({ id: "2", name: "DescriPro", themeId: EDITORIAL }),
  product({ id: "3", name: "NomDeMarque", themeId: CORPORATE, status: "killed" }),
];

describe("ThemeLibrary", () => {
  it("lists every theme, in DAL order, with its usage count", async () => {
    listThemeOptions.mockResolvedValue(themes);
    listProducts.mockResolvedValue(products);

    const { ThemeLibrary } = await import("./theme-library");
    const ui = await ThemeLibrary();
    render(ui);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Editorial"),
      expect.stringContaining("Neon"),
      expect.stringContaining("Corporate"),
      expect.stringContaining("Playful"),
    ]);
  });

  it("shows the product names for a used theme", async () => {
    listThemeOptions.mockResolvedValue(themes);
    listProducts.mockResolvedValue(products);

    const { ThemeLibrary } = await import("./theme-library");
    render(await ThemeLibrary());

    expect(screen.getByText("Utilisé par 2 produits · DescriPro, LettrePro")).toBeTruthy();
  });

  it("shows 'Aucun produit' for an unused theme", async () => {
    listThemeOptions.mockResolvedValue(themes);
    listProducts.mockResolvedValue(products);

    const { ThemeLibrary } = await import("./theme-library");
    render(await ThemeLibrary());

    expect(screen.getAllByText("Aucun produit", { selector: "p" }).length).toBeGreaterThan(0);
  });

  it("counts a killed product toward its theme's usage", async () => {
    listThemeOptions.mockResolvedValue(themes);
    listProducts.mockResolvedValue(products);

    const { ThemeLibrary } = await import("./theme-library");
    render(await ThemeLibrary());

    expect(screen.getByText("Utilisé par 1 produit · NomDeMarque")).toBeTruthy();
  });

  it("calls each DAL function exactly once", async () => {
    listThemeOptions.mockResolvedValue(themes);
    listProducts.mockResolvedValue(products);

    const { ThemeLibrary } = await import("./theme-library");
    await ThemeLibrary();

    expect(listThemeOptions).toHaveBeenCalledTimes(1);
    expect(listProducts).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there are no themes", async () => {
    listThemeOptions.mockResolvedValue([]);
    listProducts.mockResolvedValue([]);

    const { ThemeLibrary } = await import("./theme-library");
    render(await ThemeLibrary());

    expect(screen.getByText("Aucun thème en base")).toBeTruthy();
  });

  it("propagates a DAL rejection instead of swallowing it", async () => {
    listThemeOptions.mockRejectedValue(new Error("db down"));
    listProducts.mockResolvedValue([]);

    const { ThemeLibrary } = await import("./theme-library");
    await expect(ThemeLibrary()).rejects.toThrow("db down");
  });
});
