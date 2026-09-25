// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import checkoutFr from "@/messages/fr/checkout.json";
import { BalanceProvider } from "@/components/product/balance";
import type { Product } from "@/lib/dal/products";

afterEach(cleanup);

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const back = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ back, replace: vi.fn() }),
}));

const purchase = vi.fn();
vi.mock("../../../checkout/_actions", () => ({
  purchase: (slug: string, packId: string, key: string) => purchase(slug, packId, key),
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, checkout: checkoutFr }}>
      <BalanceProvider>{ui}</BalanceProvider>
    </NextIntlClientProvider>,
  );
}

const product: Product = {
  id: "product-1",
  version: 1,
  isSeed: true,
  slug: "bio-insta",
  name: "BioInsta",
  status: "test",
  themeId: "theme-1",
  locale: "fr",
  branding: {},
  landing: { headline: "h", subheadline: "s", faq: [], seoTitle: "t", seoDescription: "d" },
  inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
  generation: { model: "anthropic/claude-haiku", promptTemplate: "hello", outputType: "markdown" },
  pricing: {
    freeCreditsOnSignup: 3,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [
      { id: "pack-10", credits: 10, priceCents: 490 },
      { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
    ],
  },
};

function ctx(packId = "pack-50") {
  return { params: Promise.resolve({ app: "bio-insta", packId }), searchParams: Promise.resolve({}) };
}

describe("@modal/(.)checkout/[packId] page", () => {
  it("renders the checkout flow in an open dialog titled « Paiement »", async () => {
    getProduct.mockResolvedValue(product);
    const { default: CheckoutModal } = await import("./page");
    const ui = await CheckoutModal(ctx("pack-50"));
    renderUi(ui);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Paiement");
    expect(dialog.textContent).toContain("BioInsta · pack");
  });

  it("navigates back when closed", async () => {
    getProduct.mockResolvedValue(product);
    const { default: CheckoutModal } = await import("./page");
    const ui = await CheckoutModal(ctx("pack-50"));
    const { fireEvent } = await import("@testing-library/dom");
    renderUi(ui);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(back).toHaveBeenCalled();
  });

  it("calls notFound for an unknown product", async () => {
    getProduct.mockResolvedValue(null);
    const { default: CheckoutModal } = await import("./page");
    await expect(CheckoutModal(ctx("pack-50"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound for a packId absent from the product's config", async () => {
    getProduct.mockResolvedValue(product);
    const { default: CheckoutModal } = await import("./page");
    await expect(CheckoutModal(ctx("does-not-exist"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("@modal/(.)checkout/[packId] page — generateStaticParams", () => {
  it("returns every pack id of the current product", async () => {
    app.mockResolvedValue("bio-insta");
    getProduct.mockResolvedValue(product);
    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();
    expect(params).toEqual([{ packId: "pack-10" }, { packId: "pack-50" }]);
  });
});
