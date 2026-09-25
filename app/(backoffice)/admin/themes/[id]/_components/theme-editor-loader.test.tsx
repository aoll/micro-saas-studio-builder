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

const isEditable = vi.fn();
vi.mock("@/lib/dal/guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dal/guards")>("@/lib/dal/guards");
  return { ...actual, isEditable: (row: unknown) => isEditable(row) };
});

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

// The editor itself has its own full test suite (theme-editor.test.tsx):
// stubbed here so this loader's tests only assert what *it* is
// responsible for (finding the row, notFound, the h1, read-only, the
// sample name), not the editor's internals.
vi.mock("./theme-editor", () => ({
  ThemeEditor: ({
    theme,
    readOnly,
    sampleProductName,
  }: {
    theme: Theme;
    readOnly: boolean;
    sampleProductName?: string;
  }) => (
    <div data-testid="theme-editor-stub" data-readonly={readOnly} data-sample={sampleProductName ?? ""}>
      {theme.name}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const COLOR_SET = {
  background: "#111",
  foreground: "#222",
  card: "#333",
  cardForeground: "#444",
  primary: "#555",
  primaryForeground: "#666",
  secondary: "#777",
  secondaryForeground: "#888",
  muted: "#999",
  mutedForeground: "#aaa",
  accent: "#bbb",
  accentForeground: "#ccc",
  destructive: "#ddd",
  border: "#eee",
  input: "#fff",
  ring: "#000",
};

const tokens: ThemeTokens = { light: COLOR_SET, dark: COLOR_SET, fontKey: "sans", radius: "0.5rem" };

const EDITORIAL = "11111111-1111-1111-1111-111111111111";
const NEON = "22222222-2222-2222-2222-222222222222";

function theme(overrides: Partial<Theme>): Theme {
  return { id: "id", slug: "slug", name: "Name", tokens, landingVariant: "centered", isSeed: false, ...overrides };
}

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

describe("ThemeEditorLoader", () => {
  it("calls notFound() for an id not present among the themes", async () => {
    listThemeOptions.mockResolvedValue([theme({ id: EDITORIAL, name: "Editorial" })]);
    listProducts.mockResolvedValue([]);

    const { ThemeEditorLoader } = await import("./theme-editor-loader");
    await expect(ThemeEditorLoader({ id: NEON })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("shows the theme's name in an h1", async () => {
    listThemeOptions.mockResolvedValue([theme({ id: EDITORIAL, name: "Editorial" })]);
    listProducts.mockResolvedValue([]);
    isEditable.mockReturnValue(true);

    const { ThemeEditorLoader } = await import("./theme-editor-loader");
    render(await ThemeEditorLoader({ id: EDITORIAL }));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Thème · Editorial");
  });

  it("counts killed products toward the usage warning", async () => {
    listThemeOptions.mockResolvedValue([theme({ id: EDITORIAL, name: "Editorial" })]);
    listProducts.mockResolvedValue([product({ id: "1", name: "LettrePro", themeId: EDITORIAL, status: "killed" })]);
    isEditable.mockReturnValue(true);

    const { ThemeEditorLoader } = await import("./theme-editor-loader");
    render(await ThemeEditorLoader({ id: EDITORIAL }));

    expect(screen.getByRole("status").textContent).toBe(
      "Utilisé par 1 produit · LettrePro. Les modifications s'appliquent immédiatement.",
    );
  });

  it("passes the first product's name on the theme as the editor's sample", async () => {
    listThemeOptions.mockResolvedValue([theme({ id: EDITORIAL, name: "Editorial" })]);
    listProducts.mockResolvedValue([
      product({ id: "1", name: "Zeta", themeId: EDITORIAL }),
      product({ id: "2", name: "Alpha", themeId: EDITORIAL }),
    ]);
    isEditable.mockReturnValue(true);

    const { ThemeEditorLoader } = await import("./theme-editor-loader");
    render(await ThemeEditorLoader({ id: EDITORIAL }));

    expect(screen.getByTestId("theme-editor-stub").dataset.sample).toBe("Alpha");
  });

  it("passes readOnly=true when isEditable(theme) is false", async () => {
    listThemeOptions.mockResolvedValue([theme({ id: EDITORIAL, name: "Editorial", isSeed: true })]);
    listProducts.mockResolvedValue([]);
    isEditable.mockReturnValue(false);

    const { ThemeEditorLoader } = await import("./theme-editor-loader");
    render(await ThemeEditorLoader({ id: EDITORIAL }));

    expect(isEditable).toHaveBeenCalledWith(expect.objectContaining({ isSeed: true }));
    expect(screen.getByTestId("theme-editor-stub").dataset.readonly).toBe("true");
  });

  it("propagates a DAL rejection instead of swallowing it", async () => {
    listThemeOptions.mockRejectedValue(new Error("db down"));
    listProducts.mockResolvedValue([]);

    const { ThemeEditorLoader } = await import("./theme-editor-loader");
    await expect(ThemeEditorLoader({ id: EDITORIAL })).rejects.toThrow("db down");
  });
});
