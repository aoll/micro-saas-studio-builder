// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import type { PortfolioRow } from "./rows";

afterEach(() => {
  cleanup();
  vi.resetModules();
});

function mockNextIntlServer(locale: "fr" | "en") {
  const messages = locale === "fr" ? fr : en;
  vi.doMock("next-intl/server", () => ({
    getTranslations: async (namespace: string) =>
      createTranslator({ locale, messages: { "backoffice-portfolio": messages }, namespace: namespace as never }),
  }));
}

// PortfolioKpis is itself an async Server Component: react-dom's client
// renderer (used by testing-library's render() here) cannot render an
// async component directly, only real RSC rendering can (same reason
// account-content.test.tsx stubs MovementList/PurchaseList). Its own
// translations are covered by portfolio-kpis.test.tsx.
const portfolioKpisSpy = vi.fn();
vi.mock("./portfolio-kpis", () => ({
  PortfolioKpis: (props: unknown) => {
    portfolioKpisSpy(props);
    return <div data-testid="portfolio-kpis-stub" />;
  },
}));

const totals: PortfolioMetrics["totals"] = { visits: 0, revenueCents: 0, aiCostMicros: 0, marginMicros: 0 };

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    productId: "p1",
    slug: "lettre-pro",
    name: "LettrePro",
    status: "scale",
    decision: null,
    visits: 1200,
    signupToPurchaseRate: 0.07,
    revenueCents: 2470,
    aiCostMicros: 80000,
    marginRate: 0.99,
    display: { visits: "1 200", conversion: "7 %", revenue: "24,70 €", aiCost: "0,08 €", margin: "99 %" },
    ...overrides,
  };
}

describe("PortfolioView", () => {
  afterEach(() => portfolioKpisSpy.mockReset());

  it("shows the KPIs and the table when there are products", async () => {
    mockNextIntlServer("fr");
    const { PortfolioView } = await import("./portfolio-view");
    // PortfolioTable is a real (non-mocked) 'use client' component here: it
    // reads useTranslations from the root NextIntlClientProvider context.
    render(
      <NextIntlClientProvider locale="fr" messages={{ "backoffice-portfolio": fr }}>
        {await PortfolioView({ totals, rows: [row()] })}
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId("portfolio-kpis-stub")).toBeTruthy();
    expect(portfolioKpisSpy).toHaveBeenCalledWith({ totals });
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByText("Aucun produit")).toBeNull();
  });

  it("shows an empty state with a link to create a product, and no table, when there are no products", async () => {
    mockNextIntlServer("fr");
    const { PortfolioView } = await import("./portfolio-view");
    render(await PortfolioView({ totals, rows: [] }));
    expect(screen.getByText("Aucun produit")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    const link = screen.getByRole("link", { name: /produit/i });
    expect(link.getAttribute("href")).toBe("/admin/products/new");
  });

  it("still shows the KPIs when there are no products", async () => {
    mockNextIntlServer("fr");
    const { PortfolioView } = await import("./portfolio-view");
    render(await PortfolioView({ totals, rows: [] }));
    expect(screen.getByTestId("portfolio-kpis-stub")).toBeTruthy();
  });

  it("shows the empty state in English", async () => {
    mockNextIntlServer("en");
    const { PortfolioView } = await import("./portfolio-view");
    render(await PortfolioView({ totals, rows: [] }));
    expect(screen.getByText("No products")).toBeTruthy();
    expect(screen.getByText("Create your first product to see its metrics appear here.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a product" })).toBeTruthy();
  });
});
