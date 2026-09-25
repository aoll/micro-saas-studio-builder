// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ProductSheetViewModel } from "./sheet";
import { SheetHeader } from "./sheet-header";

afterEach(cleanup);

function sheet(overrides: Partial<ProductSheetViewModel> = {}): ProductSheetViewModel {
  return {
    productId: "p1",
    slug: "my-product",
    name: "My Product",
    status: "test",
    hasData: true,
    kpis: [],
    funnelRows: [],
    trend: [],
    decision: {
      thresholds: [],
      current: { visits: "1 200", conversion: "7 %", margin: "0,50 €" },
      suggestion: null,
      badge: null,
    },
    ...overrides,
  };
}

describe("SheetHeader", () => {
  it("shows the product name, its status badge and links to the sub-app and the editor", () => {
    render(<SheetHeader sheet={sheet()} />);
    expect(screen.getByText("My Product")).toBeTruthy();
    expect(screen.getByTestId("status-badge")).toBeTruthy();
    const subAppLink = screen.getByRole("link", { name: /my-product/i });
    expect(subAppLink.getAttribute("href")).toBe("/my-product");
    expect(subAppLink.getAttribute("target")).toBe("_blank");
    const editLink = screen.getByRole("link", { name: /modifier/i });
    expect(editLink.getAttribute("href")).toBe("/admin/products/my-product/edit");
  });

  it("shows the DecisionBadge when there is a suggested decision", () => {
    render(
      <SheetHeader
        sheet={sheet({
          decision: {
            thresholds: [],
            current: { visits: "", conversion: "", margin: "" },
            suggestion: null,
            badge: "kill",
          },
        })}
      />,
    );
    expect(screen.getByText("à couper")).toBeTruthy();
  });

  it("shows a closed banner instead of the DecisionBadge for a killed product", () => {
    render(
      <SheetHeader
        sheet={sheet({
          status: "killed",
          decision: {
            thresholds: [],
            current: { visits: "", conversion: "", margin: "" },
            suggestion: null,
            badge: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/produit fermé/i)).toBeTruthy();
    expect(screen.getByText(/SA-08/)).toBeTruthy();
  });

  it("still shows the sub-app link for a killed product", () => {
    render(<SheetHeader sheet={sheet({ status: "killed", slug: "gone" })} />);
    const subAppLink = screen.getByRole("link", { name: /gone/i });
    expect(subAppLink.getAttribute("href")).toBe("/gone");
  });
});
