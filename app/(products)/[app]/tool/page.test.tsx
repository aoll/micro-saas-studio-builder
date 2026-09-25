// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frTool from "@/messages/fr/tool.json";
import { BalanceProvider } from "@/components/product/balance";
import type { Product } from "@/lib/dal/products";

afterEach(cleanup);

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md, step 7): ToolPage itself
// must never read the session or a cookie — the "unstable value new Date()
// while prerendering" QA capture (.claude/qa/reports/2026-09-25-full.md ›
// B14) came from getSession() reached inside HeaderBalance, the layout's
// own <Suspense>-wrapped leaf (components/product/header-balance.tsx),
// never from this page. This locks that invariant: a future regression
// re-introducing a top-level session/cookie read here would resurrect the
// error on this route (mirrors history/page.test.tsx's own guard).
const getSession = vi.fn(() => {
  throw new Error("ToolPage must not call getSession itself");
});
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("ToolPage must not call cookies() itself");
  },
}));

const toolFormSpy = vi.fn();
vi.mock("./_components/tool-form", () => ({
  ToolForm: (props: unknown) => {
    toolFormSpy(props);
    return <div data-testid="tool-form-stub" />;
  },
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, tool: frTool }}>
      <BalanceProvider>{ui}</BalanceProvider>
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

function ctx(app = "lettre-pro") {
  return { params: Promise.resolve({ app }), searchParams: Promise.resolve({}) };
}

describe("/[app]/tool page", () => {
  afterEach(() => {
    getProduct.mockReset();
    toolFormSpy.mockReset();
  });

  it("renders the title and forwards the product's slug, inputs and costPerGeneration to ToolForm", async () => {
    getProduct.mockResolvedValue(product);
    const { default: ToolPage } = await import("./page");
    const ui = await ToolPage(ctx());
    renderUi(ui);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("LettrePro");
    expect(screen.getByTestId("tool-form-stub")).toBeTruthy();
    expect(toolFormSpy).toHaveBeenCalledWith({
      slug: "lettre-pro",
      inputs: product.inputs,
      costPerGeneration: 1,
    });
  });

  it("calls notFound for an unknown product", async () => {
    getProduct.mockResolvedValue(null);
    const { default: ToolPage } = await import("./page");
    await expect(ToolPage(ctx("unknown-slug"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("never reads the session or a cookie itself", async () => {
    getProduct.mockResolvedValue(product);
    const { default: ToolPage } = await import("./page");
    const ui = await ToolPage(ctx());
    renderUi(ui);

    expect(getSession).not.toHaveBeenCalled();
  });
});
