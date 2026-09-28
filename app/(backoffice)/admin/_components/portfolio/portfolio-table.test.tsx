// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import type { PortfolioRow } from "./rows";
import { PortfolioTable } from "./portfolio-table";

afterEach(cleanup);

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    productId: "p1",
    slug: "lettre-pro",
    name: "LettrePro",
    status: "scale",
    decision: "scale",
    visits: 1200,
    signupToPurchaseRate: 0.07,
    revenueCents: 2470,
    aiCostMicros: 80000,
    marginRate: 0.99,
    display: { visits: "1 200", conversion: "7 %", revenue: "24,70 €", aiCost: "0,08 €", margin: "99 %" },
    ...overrides,
  };
}

function renderUi(rows: PortfolioRow[], locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-portfolio": messages }}>
      <PortfolioTable rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe("PortfolioTable", () => {
  it("shows the product count in its caption", () => {
    renderUi([row(), row({ productId: "p2", slug: "descri-pro", name: "DescriPro" })]);
    expect(screen.getByText("Produits (2)")).toBeTruthy();
  });

  it("uses the singular form for a single product", () => {
    renderUi([row()]);
    expect(screen.getByText("Produit (1)")).toBeTruthy();
  });

  it("shows the product count in English", () => {
    renderUi([row(), row({ productId: "p2", slug: "descri-pro", name: "DescriPro" })], "en");
    expect(screen.getByText("Products (2)")).toBeTruthy();
  });

  it("puts the product first, under a « Produit » header, with its slug", () => {
    renderUi([row()]);
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]!.textContent).toBe("Produit");
    const firstCell = screen.getAllByRole("cell")[0]!;
    expect(firstCell.textContent).toContain("LettrePro");
    expect(firstCell.textContent).toContain("/lettre-pro");
  });

  it("renders the 6 sortable column headers", () => {
    renderUi([row()]);
    for (const label of ["Statut", "Visites", "Conversion", "Revenu", "Coût IA", "Marge"]) {
      const header = screen.getByRole("columnheader", { name: new RegExp(label) });
      expect(header.getAttribute("aria-sort")).toBeDefined();
    }
  });

  it("renders the 7 column headers in English", () => {
    renderUi([row()], "en");
    for (const label of ["Product", "Status", "Visits", "Conversion", "Revenue", "AI cost", "Margin"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it("links each row to its product sheet", () => {
    renderUi([row()]);
    const link = screen.getByRole("link", { name: /LettrePro/ });
    expect(link.getAttribute("href")).toBe("/admin/products/lettre-pro");
  });

  it("shows the status badge and the decision badge next to it", () => {
    renderUi([row({ decision: "kill" })]);
    expect(screen.getByTestId("status-badge")).toBeTruthy();
    expect(screen.getByText("à couper")).toBeTruthy();
  });

  it("reorders rows and toggles aria-sort when a header is clicked", () => {
    renderUi([
      row({ productId: "p1", name: "Low", visits: 10, slug: "low" }),
      row({ productId: "p2", name: "High", visits: 100, slug: "high" }),
    ]);
    const header = screen.getByRole("columnheader", { name: /Visites/ });
    const button = header.querySelector("button")!;

    fireEvent.click(button);
    let names = screen.getAllByRole("link").map((link) => link.textContent);
    expect(names).toEqual(["Low", "High"]);
    expect(header.getAttribute("aria-sort")).toBe("ascending");

    fireEvent.click(button);
    names = screen.getAllByRole("link").map((link) => link.textContent);
    expect(names).toEqual(["High", "Low"]);
    expect(header.getAttribute("aria-sort")).toBe("descending");
  });
});
