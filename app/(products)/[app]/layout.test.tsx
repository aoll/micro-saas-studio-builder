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
vi.mock("@/lib/dal/credits", () => ({ getBalance, grantSignupBonus: vi.fn() }));

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md): the new
// CrossProductSignupBonus gate's client leaf transitively imports
// _lib/claim.ts (lib/dal/events.ts, server-only), which this file never
// needs to exercise -- only the element tree ProductLayout returns.
vi.mock("@/lib/dal/events", () => ({ track: vi.fn() }));

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

  // QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 6:
  // a session already connected on another product must reach
  // CrossProductSignupBonus on every page of this product, streamed under
  // its own <Suspense> (docs/04-nextjs.md's "isoler ce qui lit la
  // session") so it never forces the statically pre-rendered landing
  // dynamic. This walks the raw element tree ProductLayout returns
  // (no render(), same style as this file's other assertions) looking for
  // that Suspense boundary wrapping the gate with the product's slug.
  it("wraps CrossProductSignupBonus in its own <Suspense>, with the product's slug", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(THEME);
    loadMessages.mockResolvedValue({ common: {} });
    getSession.mockResolvedValue(null);
    const { default: ProductLayout } = await import("./layout");
    const { CrossProductSignupBonus } = await import("./signup/_components/cross-product-signup-bonus");
    const { Suspense } = await import("react");
    const ui = await ProductLayout({
      children: <p>child</p>,
      modal: null,
      params: Promise.resolve({ app: "lettre-pro" }),
    });

    type El = { type: unknown; props: Record<string, unknown> };
    function findAll(node: unknown, predicate: (n: El) => boolean, out: El[] = []): El[] {
      if (node == null || typeof node !== "object") return out;
      if (Array.isArray(node)) {
        for (const child of node) findAll(child, predicate, out);
        return out;
      }
      const element = node as { type?: unknown; props?: Record<string, unknown> };
      if (element.type !== undefined && element.props !== undefined) {
        const el = element as El;
        if (predicate(el)) out.push(el);
        findAll(el.props.children, predicate, out);
      }
      return out;
    }

    const suspenseNodes = findAll(ui, (n) => n.type === Suspense);
    const gateWrapper = suspenseNodes.find((node) => {
      const children = node.props.children;
      const list = Array.isArray(children) ? children : [children];
      return list.some((child) => (child as { type?: unknown })?.type === CrossProductSignupBonus);
    });
    expect(gateWrapper).toBeDefined();

    const gate = findAll(ui, (n) => n.type === CrossProductSignupBonus)[0];
    expect(gate?.props).toEqual({ slug: "lettre-pro" });
  });
});

describe("metadata", () => {
  it("sets metadataBase from env.BETTER_AUTH_URL", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.metadataBase?.toString()).toBe("https://studio.example.com/");
  });
});

describe("generateViewport", () => {
  it("returns the resolved primary color as themeColor, cached and tagged by product and theme", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(THEME);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({ themeColor: "#112233" });
    expect(cacheLife).toHaveBeenCalledWith("max");
    expect(cacheTag).toHaveBeenCalledWith("product:lettre-pro");
    expect(cacheTag).toHaveBeenCalledWith("theme:theme-1");
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

  it("returns an empty object for a killed product, without calling getTheme", async () => {
    appRootParam.mockResolvedValue("killed-product");
    getProduct.mockResolvedValue({ ...ACTIVE_PRODUCT, slug: "killed-product", status: "killed" });
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({});
    expect(getTheme).not.toHaveBeenCalled();
  });

  it("returns an empty object when the product's theme row is missing", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue(null);
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({});
  });

  it("omits themeColor and returns an empty object when the resolved primary colour is not drawable (oklch)", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(ACTIVE_PRODUCT);
    getTheme.mockResolvedValue({
      ...THEME,
      tokens: { ...THEME.tokens, light: { primary: "oklch(0.7 0.15 250)" } },
    });
    const { generateViewport } = await import("./layout");
    const viewport = await generateViewport();
    expect(viewport).toEqual({});
  });
});
