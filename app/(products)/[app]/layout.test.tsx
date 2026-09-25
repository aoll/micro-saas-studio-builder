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

afterEach(() => {
  vi.clearAllMocks();
});

const THEME = {
  id: "theme-1",
  slug: "editorial",
  name: "Editorial",
  tokens: { light: {}, dark: {}, fontKey: "serif", radius: "0.5rem" },
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
