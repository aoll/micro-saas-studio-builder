import { afterEach, describe, expect, it, vi } from "vitest";

class NotFoundMarker extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundMarker();
  },
}));

class MockImageResponse {
  element: unknown;
  options: unknown;
  constructor(element: unknown, options: unknown) {
    this.element = element;
    this.options = options;
  }
}
vi.mock("next/og", () => ({ ImageResponse: MockImageResponse }));

const getProduct = vi.fn();
const listProductSlugs = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct, listProductSlugs }));

const getTheme = vi.fn();
vi.mock("@/lib/dal/themes", () => ({ getTheme }));

afterEach(() => {
  vi.clearAllMocks();
});

const THEME = {
  id: "theme-1",
  slug: "editorial",
  name: "Editorial",
  tokens: {
    light: {
      background: "#ffffff",
      foreground: "#111111",
      card: "#ffffff",
      cardForeground: "#111111",
      primary: "rgb(220 38 38)",
      primaryForeground: "#fef2f2",
      secondary: "#f4f4f5",
      secondaryForeground: "#111111",
      muted: "#f4f4f5",
      mutedForeground: "hsl(240 4% 46%)",
      accent: "#f4f4f5",
      accentForeground: "#111111",
      destructive: "#dc2626",
      border: "#e4e4e7",
      input: "#e4e4e7",
      ring: "#dc2626",
    },
    dark: {},
    fontKey: "serif",
    radius: "0.5rem",
  },
  landingVariant: "centered",
  isSeed: true,
};

const ACTIVE_PRODUCT = {
  id: "product-1",
  slug: "lettre-pro",
  name: "LettrePro",
  status: "scale",
  themeId: "theme-1",
  locale: "fr",
  branding: {},
  landing: { headline: "Votre lettre de motivation en 2 minutes" },
};

describe("[app]/opengraph-image", () => {
  it("renders a 1200x630 png in the product's theme colours, with its name and headline", async () => {
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(THEME);
    const { default: OpengraphImage, size, contentType } = await import("./opengraph-image");
    const response = (await OpengraphImage({
      params: Promise.resolve({ app: "lettre-pro" }),
    })) as unknown as MockImageResponse;

    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(response.options).toMatchObject({ width: 1200, height: 630 });

    const json = JSON.stringify(response.element);
    expect(json).toContain("LettrePro");
    expect(json).toContain("Votre lettre de motivation en 2 minutes");
    expect(json).toContain("rgb(220 38 38)");
  });

  it("lets the branding primary color override the theme's primary", async () => {
    getProduct.mockResolvedValue({ ...ACTIVE_PRODUCT, branding: { primaryColor: "#00ff00" } });
    getTheme.mockResolvedValue(THEME);
    const { default: OpengraphImage } = await import("./opengraph-image");
    const response = (await OpengraphImage({
      params: Promise.resolve({ app: "lettre-pro" }),
    })) as unknown as MockImageResponse;
    expect(JSON.stringify(response.element)).toContain("#00ff00");
  });

  it("404s for an unknown product", async () => {
    getProduct.mockResolvedValue(null);
    const { default: OpengraphImage } = await import("./opengraph-image");
    await expect(OpengraphImage({ params: Promise.resolve({ app: "zz-unknown" }) })).rejects.toThrow(NotFoundMarker);
    expect(getTheme).not.toHaveBeenCalled();
  });

  it("404s for a killed product", async () => {
    getProduct.mockResolvedValue({ ...ACTIVE_PRODUCT, status: "killed" });
    const { default: OpengraphImage } = await import("./opengraph-image");
    await expect(OpengraphImage({ params: Promise.resolve({ app: "killed-product" }) })).rejects.toThrow(
      NotFoundMarker,
    );
    expect(getTheme).not.toHaveBeenCalled();
  });

  it("throws when the product's theme row is missing", async () => {
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(null);
    const { default: OpengraphImage } = await import("./opengraph-image");
    await expect(OpengraphImage({ params: Promise.resolve({ app: "lettre-pro" }) })).rejects.toThrow(
      /missing theme row/,
    );
  });

  it("generateStaticParams returns one { app } per product slug, prerendering the OG image like [app]/layout.tsx", async () => {
    listProductSlugs.mockResolvedValue(["lettre-pro", "descri-pro", "nom-de-marque"]);
    const { generateStaticParams } = await import("./opengraph-image");
    const params = await generateStaticParams();
    expect(params).toEqual([{ app: "lettre-pro" }, { app: "descri-pro" }, { app: "nom-de-marque" }]);
  });
});
