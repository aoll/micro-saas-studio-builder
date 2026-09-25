// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import type { PortfolioRow } from "./rows";
import { PortfolioView } from "./portfolio-view";

afterEach(cleanup);

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
    marginPerGenerationMicros: 1000,
    display: { visits: "1 200", conversion: "7 %", revenue: "24,70 €", aiCost: "0,08 €", margin: "0,00 €" },
    ...overrides,
  };
}

describe("PortfolioView", () => {
  it("shows the KPIs and the table when there are products", () => {
    render(<PortfolioView totals={totals} rows={[row()]} />);
    expect(screen.getByText("Visites · 30 j")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByText("Aucun produit")).toBeNull();
  });

  it("shows an empty state with a link to create a product, and no table, when there are no products", () => {
    render(<PortfolioView totals={totals} rows={[]} />);
    expect(screen.getByText("Aucun produit")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    const link = screen.getByRole("link", { name: /produit/i });
    expect(link.getAttribute("href")).toBe("/admin/products/new");
  });

  it("still shows the KPIs when there are no products", () => {
    render(<PortfolioView totals={totals} rows={[]} />);
    expect(screen.getByText("Visites · 30 j")).toBeTruthy();
  });
});
