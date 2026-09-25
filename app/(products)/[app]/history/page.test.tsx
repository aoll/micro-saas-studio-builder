// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frHistory from "@/messages/fr/history.json";
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
  getTranslations: async (namespace: "history") =>
    createTranslator({ locale: "fr", messages: { history: frHistory }, namespace }),
}));

// The page itself must never read the session or the anonymous_id cookie —
// only HistoryList, inside the <Suspense> boundary, does (task 12): this
// mock lets a call from the page fail the test loudly instead of silently
// resolving.
const getSession = vi.fn(() => {
  throw new Error("HistoryPage must not call getSession itself");
});
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("HistoryPage must not call cookies() itself");
  },
}));

const historyListSpy = vi.fn();
vi.mock("./_components/history-list", () => ({
  HistoryList: (props: unknown) => {
    historyListSpy(props);
    return <div data-testid="history-list-stub" />;
  },
}));
vi.mock("./_components/history-skeleton", () => ({
  HistorySkeleton: () => <div data-testid="history-skeleton-stub" />,
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, history: frHistory }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const product: Product = {
  id: "product-1",
  version: 1,
  isSeed: true,
  slug: "lettre-pro",
  name: "LettrePro",
  status: "test",
  themeId: "theme-1",
  locale: "fr",
  branding: {},
  landing: { headline: "h", subheadline: "s", faq: [], seoTitle: "t", seoDescription: "d" },
  inputs: [{ key: "poste", label: "Poste", type: "text", required: true }],
  generation: { model: "anthropic/claude-haiku", promptTemplate: "hello", outputType: "markdown" },
  pricing: { freeCreditsOnSignup: 3, anonymousFreeGenerations: 1, costPerGeneration: 1, packs: [] },
};

describe("/[app]/history page", () => {
  afterEach(() => {
    app.mockReset();
    getProduct.mockReset();
    historyListSpy.mockReset();
  });

  it("renders the title and forwards the product, its fields and searchParams unawaited to HistoryList", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    const searchParams = Promise.resolve({ page: "2" });
    const { default: HistoryPage } = await import("./page");
    const ui = await HistoryPage({ searchParams } as never);
    renderUi(ui);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Historique");
    expect(screen.getByTestId("history-list-stub")).toBeTruthy();
    expect(historyListSpy).toHaveBeenCalledWith({
      slug: "lettre-pro",
      productId: "product-1",
      fields: product.inputs,
      searchParams,
    });
  });

  it("calls notFound for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: HistoryPage } = await import("./page");
    await expect(HistoryPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound and never reads the product when there is no root param", async () => {
    app.mockResolvedValue(undefined);
    const { default: HistoryPage } = await import("./page");
    await expect(HistoryPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProduct).not.toHaveBeenCalled();
  });
});
