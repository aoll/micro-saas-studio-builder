// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProductSheetViewModel } from "./sheet";
import { ProductSheetView } from "./product-sheet-view";

// `ProductSheetView` renders `SheetHeader` and `DecisionPanel`, both of
// which statically import `StatusChange`, which statically imports
// `setProductStatus` from `../_actions` (CLAUDE.md: every other
// `_actions.ts` consumer does the same). `_actions.ts` transitively imports
// the DAL (session → lib/auth → lib/db, products, product-status), which
// eagerly touches `env.DATABASE_URL` at module load: mocked at this
// boundary so this render-only test never needs a real database, without
// weakening anything it asserts.
vi.mock("@/lib/dal/session", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/dal/products", () => ({ getProduct: vi.fn() }));
vi.mock("@/lib/dal/product-status", () => ({ updateStatus: vi.fn() }));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = ResizeObserverStub;
});

afterEach(cleanup);

function sheet(overrides: Partial<ProductSheetViewModel> = {}): ProductSheetViewModel {
  return {
    productId: "p1",
    slug: "my-product",
    name: "My Product",
    status: "test",
    hasData: true,
    kpis: [{ label: "Revenu · 30 j", value: "24,70 €" }],
    funnelRows: [{ type: "visit", label: "Visites landing", count: "1 200", rate: "—", widthPercent: 100 }],
    trend: [{ date: "01/09", visits: 10, purchases: 1 }],
    decision: {
      thresholds: [],
      current: { visits: "1 200", conversion: "7 %", margin: "0,50 €" },
      suggestion: null,
      badge: null,
    },
    decisionMetrics: { visits: 1200, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 },
    thresholds: {
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    },
    ...overrides,
  };
}

describe("ProductSheetView", () => {
  it("shows the funnel and trend chart when there is data", () => {
    render(<ProductSheetView sheet={sheet()} />);
    expect(screen.getByText("Visites landing")).toBeTruthy();
    expect(screen.getByText("Achats")).toBeTruthy(); // trend chart legend
    expect(screen.queryByText(/aucune donnée/i)).toBeNull();
  });

  it("shows an EmptyState with a sub-app link instead of the funnel and chart when there is no data", () => {
    render(<ProductSheetView sheet={sheet({ hasData: false })} />);
    expect(screen.getByText(/aucune donnée/i)).toBeTruthy();
    expect(screen.queryByText("Visites landing")).toBeNull();
    // Two links point at the sub-app when there is no data: the header's and the EmptyState's.
    const links = screen.getAllByRole("link", { name: /my-product/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/my-product");
  });

  it("always shows the KPIs and the decision panel, with or without data", () => {
    render(<ProductSheetView sheet={sheet({ hasData: false })} />);
    expect(screen.getByText("Revenu · 30 j")).toBeTruthy();
    expect(screen.getByText("Statut et seuils de décision")).toBeTruthy();
  });
});
