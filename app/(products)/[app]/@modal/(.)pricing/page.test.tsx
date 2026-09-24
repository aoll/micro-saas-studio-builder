// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frPricing from "@/messages/fr/pricing.json";
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
  useRouter: () => ({ back }),
}));

// next-intl/server picks its "react-server" export via a condition Vitest's
// node/jsdom environments don't set (see i18n/request.test.ts).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "fr", messages: { pricing: frPricing }, namespace }),
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, pricing: frPricing }}>
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

describe("@modal/(.)pricing page", () => {
  it("renders the packs in an open dialog titled with the pricing title", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    const { default: PricingModal } = await import("./page");
    const ui = await PricingModal();
    renderUi(ui);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Plus de crédits ?");
    expect(dialog.textContent).toContain("Rechargez.");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("navigates back when closed", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    const { default: PricingModal } = await import("./page");
    const ui = await PricingModal();
    renderUi(ui);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(back).toHaveBeenCalled();
  });

  it("calls notFound for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: PricingModal } = await import("./page");
    await expect(PricingModal()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
