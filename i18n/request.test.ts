import { describe, expect, it, vi } from "vitest";

// next-intl picks its server vs. client implementation of getRequestConfig
// via the "react-server" package export condition, which Vitest's plain
// "node" environment doesn't set: mocked here as the identity wrapper it
// really is (Next.js resolves the real one at runtime).
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const params = { requestLocale: Promise.resolve(undefined) };

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
