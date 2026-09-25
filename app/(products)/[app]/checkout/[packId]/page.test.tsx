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

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ replace, back: vi.fn() }),
}));

const purchase = vi.fn();
vi.mock("../_actions", () => ({
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

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md, step 4): before this spec,
// CheckoutPage was an `async function` awaiting `params` at its top level,
// outside any <Suspense> — categorically flagged by Cache Components
// (node_modules/next/dist/docs/…/migrating-to-cache-components.md ›
// "Await params inside <Suspense>", .claude/qa/reports/2026-09-25-full.md ›
// B14). This structural guard replaces the old "await CheckoutPage(ctx())"
// assertions below (mirrors history/page.test.tsx's pattern): CheckoutPage
// itself is now synchronous and must return a <Suspense> element whose
// single child (CheckoutContent) receives the *same* params promise,
// unconsumed at this level.
describe("/[app]/checkout/[packId] page — structure", () => {
  it("returns a <Suspense> wrapping CheckoutContent, with params forwarded unawaited", async () => {
    const { default: CheckoutPage } = await import("./page");
    const paramsPromise = ctx("pack-50").params;
    const element = CheckoutPage({ params: paramsPromise, searchParams: Promise.resolve({}) }) as ReactElement<{
      children: ReactElement<{ params: unknown }>;
    }>;
    expect(element.type).toBe(Suspense);
    expect(element.props.children.props.params).toBe(paramsPromise);
  });
});

describe("/[app]/checkout/[packId] page — CheckoutContent", () => {
  it("renders the checkout flow for the requested pack, as a full page with an <h1>", async () => {
    getProduct.mockResolvedValue(product);
    const { CheckoutContent } = await import("./page");
    const ui = await CheckoutContent(ctx("pack-50"));
    renderUi(ui);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Paiement");
    expect(screen.getByText("BioInsta · pack")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("calls notFound for an unknown product", async () => {
    getProduct.mockResolvedValue(null);
    const { CheckoutContent } = await import("./page");
    await expect(CheckoutContent(ctx("pack-50"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound for a packId absent from the product's config", async () => {
    getProduct.mockResolvedValue(product);
    const { CheckoutContent } = await import("./page");
    await expect(CheckoutContent(ctx("does-not-exist"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/[app]/checkout/[packId] page — generateStaticParams", () => {
  it("returns every pack id of the current product", async () => {
    app.mockResolvedValue("bio-insta");
    getProduct.mockResolvedValue(product);
    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();
    expect(params).toEqual([{ packId: "pack-10" }, { packId: "pack-50" }]);
  });

  it("returns an empty array for an unknown product, instead of throwing at build time", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { generateStaticParams } = await import("./page");
    await expect(generateStaticParams()).resolves.toEqual([]);
  });
});
