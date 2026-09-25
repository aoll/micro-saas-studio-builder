// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";
import type { Product } from "@/lib/dal/products";

afterEach(cleanup);

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "account") =>
    createTranslator({ locale: "fr", messages: { account: frAccount }, namespace }),
}));

// The page itself must never read the session or a cookie — only
// AccountContent, inside the <Suspense> boundary, does (mirrors
// history/page.test.tsx's guard): a call from the page fails the test
// loudly instead of silently resolving.
const getSession = vi.fn(() => {
  throw new Error("AccountPage must not call getSession itself");
});
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("AccountPage must not call cookies() itself");
  },
}));

const accountContentSpy = vi.fn();
vi.mock("./_components/account-content", () => ({
  AccountContent: (props: unknown) => {
    accountContentSpy(props);
    return <div data-testid="account-content-stub" />;
  },
}));
vi.mock("./_components/account-skeleton", () => ({
  AccountSkeleton: () => <div data-testid="account-skeleton-stub" />,
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const product: Product = {
  id: "product-1",
  version: 1,
  isSeed: true,
  slug: "nom-de-marque",
  name: "NomDeMarque",
  status: "test",
  themeId: "theme-1",
  locale: "fr",
  branding: {},
  landing: { headline: "h", subheadline: "s", faq: [], seoTitle: "t", seoDescription: "d" },
  inputs: [{ key: "activite", label: "Activité", type: "text", required: true }],
  generation: { model: "anthropic/claude-haiku", promptTemplate: "hello", outputType: "markdown" },
  pricing: { freeCreditsOnSignup: 3, anonymousFreeGenerations: 1, costPerGeneration: 1, packs: [] },
};

describe("/[app]/account page", () => {
  afterEach(() => {
    app.mockReset();
    getProduct.mockReset();
    accountContentSpy.mockReset();
  });

  it("renders the title and forwards the product's slug and id to AccountContent", async () => {
    app.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue(product);
    const { default: AccountPage } = await import("./page");
    const ui = await AccountPage();
    renderUi(ui);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mon compte");
    expect(screen.getByTestId("account-content-stub")).toBeTruthy();
    expect(accountContentSpy).toHaveBeenCalledWith({ slug: "nom-de-marque", productId: "product-1" });
  });

  it("calls notFound for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: AccountPage } = await import("./page");
    await expect(AccountPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound and never reads the product when there is no root param", async () => {
    app.mockResolvedValue(undefined);
    const { default: AccountPage } = await import("./page");
    await expect(AccountPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProduct).not.toHaveBeenCalled();
  });
});
