import { afterEach, describe, expect, it, vi } from "vitest";

// next-intl picks its server vs. client implementation of getRequestConfig
// via the "react-server" package export condition, which Vitest's plain
// "node" environment doesn't set: mocked here as the identity wrapper it
// really is (Next.js resolves the real one at runtime).
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

// docs/08-stack.md › i18n: the backoffice branch reads the `admin_locale`
// cookie and never `headers()` (no Accept-Language detection behind auth,
// I18N-BACKOFFICE bullet 3). `cookieJar` is empty by default: every
// existing test below never sets a cookie, and reaches this mock through
// the "no root param" path without needing to know it exists.
const cookieJar = new Map<string, { value: string }>();
const headersSpy = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookieJar.get(name) }),
  headers: headersSpy,
}));

const params = { requestLocale: Promise.resolve(undefined) };

afterEach(() => {
  cookieJar.clear();
  vi.clearAllMocks();
});

describe("i18n/request", () => {
  it("resolves the locale and messages of the current product", async () => {
    app.mockResolvedValue("bio-insta");
    getProduct.mockResolvedValue({ locale: "en" });
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("en");
    expect((config.messages!.common as { header: { signIn: string } }).header.signIn).toBe("Sign in");
  });

  it("falls back to fr when there is no root param", async () => {
    app.mockResolvedValue(undefined);
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("fr");
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("falls back to fr for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("fr");
  });
});

describe("backoffice branch", () => {
  it("reads the admin_locale cookie when there is no root param", async () => {
    app.mockResolvedValue(undefined);
    cookieJar.set("admin_locale", { value: "en" });
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("en");
    expect((config.messages!.backoffice as { localeSwitcher: { label: string } }).localeSwitcher.label).toBe(
      "Backoffice language",
    );
  });

  it("falls back to fr when there is no admin_locale cookie", async () => {
    app.mockResolvedValue(undefined);
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("fr");
  });

  it.each(["de", "EN", ""])("falls back to fr for an invalid cookie value %j", async (value) => {
    app.mockResolvedValue(undefined);
    cookieJar.set("admin_locale", { value });
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("fr");
  });

  it("never reads headers() (no browser detection behind auth)", async () => {
    app.mockResolvedValue(undefined);
    const { default: getRequestConfig } = await import("./request");
    await getRequestConfig(params);
    expect(headersSpy).not.toHaveBeenCalled();
  });

  it("keeps the product branch unchanged: a product's own locale wins over the cookie, cookies() is never called", async () => {
    app.mockResolvedValue("bio-insta");
    getProduct.mockResolvedValue({ locale: "en" });
    cookieJar.set("admin_locale", { value: "fr" });
    const cookiesModule = await import("next/headers");
    const cookiesSpy = vi.spyOn(cookiesModule, "cookies");
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("en");
    expect(cookiesSpy).not.toHaveBeenCalled();
  });

  it("keeps the unknown-product fallback unchanged: cookies() is never called", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    cookieJar.set("admin_locale", { value: "en" });
    const cookiesModule = await import("next/headers");
    const cookiesSpy = vi.spyOn(cookiesModule, "cookies");
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("fr");
    expect(cookiesSpy).not.toHaveBeenCalled();
  });
});

describe("explicit locale (Server Actions)", () => {
  it("wins over everything else and calls neither app() nor cookies()", async () => {
    app.mockRejectedValue(new Error("app() is not supported in Server Actions"));
    cookieJar.set("admin_locale", { value: "fr" });
    const cookiesModule = await import("next/headers");
    const cookiesSpy = vi.spyOn(cookiesModule, "cookies");
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig({ locale: "en", requestLocale: params.requestLocale });
    expect(config.locale).toBe("en");
    expect((config.messages!.backoffice as { localeSwitcher: { label: string } }).localeSwitcher.label).toBe(
      "Backoffice language",
    );
    expect(app).not.toHaveBeenCalled();
    expect(cookiesSpy).not.toHaveBeenCalled();
  });

  it("falls back to fr for an invalid explicit locale, still without calling app() or cookies()", async () => {
    app.mockRejectedValue(new Error("app() is not supported in Server Actions"));
    const cookiesModule = await import("next/headers");
    const cookiesSpy = vi.spyOn(cookiesModule, "cookies");
    const { default: getRequestConfig } = await import("./request");
    // `as "fr"`: a Server Action's `locale` is a runtime value TypeScript can't fully
    // guard (i18n/global.d.ts's AppConfig.Locale narrows the real type to "fr" | "en"),
    // exactly the case this test defends against.
    const config = await getRequestConfig({ locale: "de" as "fr", requestLocale: params.requestLocale });
    expect(config.locale).toBe("fr");
    expect(app).not.toHaveBeenCalled();
    expect(cookiesSpy).not.toHaveBeenCalled();
  });
});
