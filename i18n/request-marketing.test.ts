import { describe, expect, it, vi } from "vitest";

// Same identity-wrapper mock as i18n/request.test.ts (kept in its own file,
// spec I18N-MARKETING's Périmètre — never i18n/request.test.ts, the sister
// spec I18N-BACKOFFICE's own file, so the two specs' diffs never touch the
// same hunk at merge time).
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

// Needed since the merge of I18N-BACKOFFICE's branch 3 (own commit, see its
// message): the "falls back to fr" cases below now fall all the way
// through to the real backofficeLocale(), which calls next/headers'
// cookies() — unmocked, that throws "called outside a request scope"
// under Vitest. Same mock as i18n/request.test.ts (the sister spec's own
// file); an empty cookie jar reproduces the same fr fallback these tests
// already asserted before the merge, so no assertion below changes.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

describe("i18n/request — marketing branch", () => {
  it("resolves the locale the marketing middleware chose (en)", async () => {
    app.mockResolvedValue(undefined);
    const params = { requestLocale: Promise.resolve("en") };
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("en");
    expect((config.messages!.common as { header: { signIn: string } }).header.signIn).toBe("Sign in");
  });

  it("resolves fr when the marketing middleware chose fr", async () => {
    app.mockResolvedValue(undefined);
    const params = { requestLocale: Promise.resolve("fr") };
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("fr");
  });

  // Finding 2 of the plan: merely *accessing* `params.requestLocale` — even
  // without awaiting it — calls next-intl's lazy getter over headers(),
  // which taints every render as dynamic. A product page must never trigger
  // it, or SA-01's static prerender breaks. This getter-spy proves the
  // product branch returns before that property is ever read.
  it("never reads requestLocale when a product root param is present (product locale wins)", async () => {
    app.mockResolvedValue("bio-insta");
    getProduct.mockResolvedValue({ locale: "en" });
    const requestLocaleGetter = vi.fn(() => Promise.resolve("fr"));
    const params = {} as { requestLocale: Promise<string | undefined> };
    Object.defineProperty(params, "requestLocale", { get: requestLocaleGetter });
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("en");
    expect(requestLocaleGetter).not.toHaveBeenCalled();
  });

  it.each([undefined, "de", "not-a-locale"])(
    "falls back to the existing fr default when requestLocale is %s (no product, unchanged behaviour)",
    async (value) => {
      app.mockResolvedValue(undefined);
      const params = { requestLocale: Promise.resolve(value) };
      const { default: getRequestConfig } = await import("./request");
      const config = await getRequestConfig(params);
      expect(config.locale).toBe("fr");
    },
  );

  // Branch 0 of the reconciled shape (I18N-BACKOFFICE's Server Actions call
  // `getTranslations({ locale })`, which passes `locale` explicitly since
  // `next/root-params` throws outside a Server Component): proves it
  // short-circuits before `app()` and before `requestLocale` is read, so
  // this spec's marketing branch never runs for an explicit-locale caller.
  it("returns the explicit params.locale without calling app() or reading requestLocale", async () => {
    const requestLocaleGetter = vi.fn(() => Promise.resolve("fr"));
    const params = { locale: "en" } as { locale?: "fr" | "en"; requestLocale: Promise<string | undefined> };
    Object.defineProperty(params, "requestLocale", { get: requestLocaleGetter });
    const { default: getRequestConfig } = await import("./request");
    const config = await getRequestConfig(params);
    expect(config.locale).toBe("en");
    expect(app).not.toHaveBeenCalled();
    expect(requestLocaleGetter).not.toHaveBeenCalled();
  });
});
