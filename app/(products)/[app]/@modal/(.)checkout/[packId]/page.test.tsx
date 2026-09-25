// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import type { ReactElement } from "react";
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
  useRouter: () => ({ back, replace: vi.fn(), refresh: vi.fn() }),
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

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md, orchestrator note: the
// spec's acceptance covers the checkout modal too, extended into this
// spec's Périmètre since B14 starts after B3 merges): same categorical
// "await params outside <Suspense>" violation as the full page
// (.claude/qa/reports/2026-09-25-full.md › B14), same fix — CheckoutModal
// stays synchronous, CheckoutModalContent does the awaiting behind
// <Suspense>. Replaces the old "await CheckoutModal(ctx())" assertions
// below (mirrors page.test.tsx's own structural guard).
describe("@modal/(.)checkout/[packId] page — structure", () => {
  it("returns a <Suspense> wrapping CheckoutModalContent, with params forwarded unawaited", async () => {
    const { default: CheckoutModal } = await import("./page");
    const paramsPromise = ctx("pack-50").params;
    const element = CheckoutModal({ params: paramsPromise, searchParams: Promise.resolve({}) }) as ReactElement<{
      children: ReactElement<{ params: unknown }>;
    }>;
    expect(element.type).toBe(Suspense);
    expect(element.props.children.props.params).toBe(paramsPromise);
  });
});

describe("@modal/(.)checkout/[packId] page — CheckoutModalContent", () => {
  it("renders the checkout flow in an open dialog titled « Paiement »", async () => {
    getProduct.mockResolvedValue(product);
    const { CheckoutModalContent } = await import("./page");
    const ui = await CheckoutModalContent(ctx("pack-50"));
    renderUi(ui);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Paiement");
    expect(dialog.textContent).toContain("BioInsta · pack");
  });

  it("fills the viewport on mobile and becomes a centered dialog from the sm breakpoint", async () => {
    getProduct.mockResolvedValue(product);
    const { CheckoutModalContent } = await import("./page");
    const ui = await CheckoutModalContent(ctx("pack-50"));
    renderUi(ui);
    const classes = screen.getByRole("dialog").className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["h-dvh", "max-h-dvh", "w-dvw", "max-w-dvw"]));
    expect(classes).toEqual(expect.arrayContaining(["sm:h-auto", "sm:w-full", "sm:max-w-lg"]));
  });

  it("navigates back when closed", async () => {
    getProduct.mockResolvedValue(product);
    const { CheckoutModalContent } = await import("./page");
    const ui = await CheckoutModalContent(ctx("pack-50"));
    const { fireEvent } = await import("@testing-library/dom");
    renderUi(ui);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(back).toHaveBeenCalled();
  });

  it("calls notFound for an unknown product", async () => {
    getProduct.mockResolvedValue(null);
    const { CheckoutModalContent } = await import("./page");
    await expect(CheckoutModalContent(ctx("pack-50"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound for a packId absent from the product's config", async () => {
    getProduct.mockResolvedValue(product);
    const { CheckoutModalContent } = await import("./page");
    await expect(CheckoutModalContent(ctx("does-not-exist"))).rejects.toThrow("NEXT_NOT_FOUND");
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
