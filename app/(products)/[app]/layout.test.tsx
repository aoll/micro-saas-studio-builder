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

vi.mock("@/app/globals.css", () => ({}));

const appRootParam = vi.fn();
vi.mock("next/root-params", () => ({ app: appRootParam }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct, listProductSlugs: vi.fn() }));

const getTheme = vi.fn();
vi.mock("@/lib/dal/themes", () => ({ getTheme }));

const loadMessages = vi.fn();
vi.mock("@/i18n/load-messages", () => ({ loadMessages }));

vi.mock("@/lib/fonts", () => ({ fontFor: () => ({ variable: "font-v", className: "font-c" }) }));

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession }));

const getBalance = vi.fn();
vi.mock("@/lib/dal/credits", () => ({ getBalance }));

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_URL: "https://studio.example.com/" } }));

afterEach(() => {
  vi.clearAllMocks();
});

const THEME = {
  id: "theme-1",
  slug: "editorial",
  name: "Editorial",
  tokens: { light: { primary: "#112233" }, dark: {}, fontKey: "serif", radius: "0.5rem" },
  landingVariant: "hero-centered",
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
};

describe("ProductLayout", () => {
  it("rejects an unknown slug with notFound()", async () => {
    appRootParam.mockResolvedValue("zz-unknown");
    getProduct.mockResolvedValue(null);
    const { default: ProductLayout } = await import("./layout");
    await expect(
      ProductLayout({ children: null, modal: null, params: Promise.resolve({ app: "zz-unknown" }) }),
    ).rejects.toThrow(NotFoundMarker);
    expect(getTheme).not.toHaveBeenCalled();
  });

  it("rejects when app() has no value, without calling getProduct", async () => {
    appRootParam.mockResolvedValue(undefined);
    const { default: ProductLayout } = await import("./layout");
    await expect(ProductLayout({ children: null, modal: null, params: Promise.resolve({ app: "" }) })).rejects.toThrow(
      NotFoundMarker,
    );
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("rejects a killed product with notFound(), without calling getTheme", async () => {
    appRootParam.mockResolvedValue("killed-product");
    getProduct.mockResolvedValue({ ...ACTIVE_PRODUCT, slug: "killed-product", status: "killed" });
    const { default: ProductLayout } = await import("./layout");
    await expect(
      ProductLayout({ children: null, modal: null, params: Promise.resolve({ app: "killed-product" }) }),
    ).rejects.toThrow(NotFoundMarker);
    expect(getTheme).not.toHaveBeenCalled();
  });

  it("resolves an active product: locale prop and getTheme(themeId) called", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(THEME);
    loadMessages.mockResolvedValue({ common: {} });
    getSession.mockResolvedValue(null);
    const { default: ProductLayout } = await import("./layout");
    const ui = await ProductLayout({
      children: <p>child</p>,
      modal: null,
      params: Promise.resolve({ app: "lettre-pro" }),
    });
    expect(ui.props.lang).toBe(ACTIVE_PRODUCT.locale);
    expect(getTheme).toHaveBeenCalledWith("theme-1");
  });
});

describe("metadata", () => {
  it("sets metadataBase from env.BETTER_AUTH_URL", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.metadataBase?.toString()).toBe("https://studio.example.com/");
  });
});

describe("generateViewport", () => {
  it("returns the resolved primary color as themeColor, cached and tagged", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(THEME);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({ themeColor: "#112233" });
    expect(cacheLife).toHaveBeenCalledWith("max");
    expect(cacheTag).toHaveBeenCalledWith("product:lettre-pro");
  });

  it("prefers the branding primary color override over the theme's primary", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue({ ...ACTIVE_PRODUCT, branding: { primaryColor: "#ff0000" } });
    getTheme.mockResolvedValue(THEME);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({ themeColor: "#ff0000" });
  });

  it("returns an empty object when there is no root param", async () => {
    appRootParam.mockResolvedValue(undefined);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({});
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("returns an empty object for an unknown product", async () => {
    appRootParam.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({});
  });

  it("returns an empty object when the product's theme row is missing", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(null);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({});
  });
});
