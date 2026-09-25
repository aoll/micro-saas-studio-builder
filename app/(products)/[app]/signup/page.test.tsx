// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frAuth from "@/messages/fr/auth.json";
import frCommon from "@/messages/fr/common.json";
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

// next-intl/server picks its "react-server" export via a condition Vitest's
// node/jsdom environments don't set (see @modal/(.)pricing/page.test.tsx).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "auth") =>
    createTranslator({ locale: "fr", messages: { auth: frAuth }, namespace }),
}));

const { SignupPanel } = vi.hoisted(() => ({
  SignupPanel: vi.fn((props: { slug: string; searchParams: Promise<Record<string, unknown>> }) => (
    <div data-testid="signup-panel" data-slug={props.slug} />
  )),
}));
vi.mock("./_components/signup-panel", () => ({ SignupPanel }));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: frCommon, auth: frAuth }}>
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
    packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
  },
};

describe("/[app]/signup page", () => {
  it("renders exactly one <h1> with the heading, and SignupPanel with the product's slug", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    const { default: SignupPage } = await import("./page");
    const ui = await SignupPage({ searchParams: Promise.resolve({}) } as never);
    renderUi(ui);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]!.textContent).toContain("Vous avez aimé ?");
    expect(headings[0]!.textContent).toContain("3 crédits offerts");

    const panel = screen.getByTestId("signup-panel");
    expect(panel.dataset.slug).toBe("lettre-pro");
  });

  it("calls notFound for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: SignupPage } = await import("./page");
    await expect(SignupPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound and never reads the product when there is no root param", async () => {
    app.mockResolvedValue(undefined);
    const { default: SignupPage } = await import("./page");
    await expect(SignupPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProduct).not.toHaveBeenCalled();
  });
});
