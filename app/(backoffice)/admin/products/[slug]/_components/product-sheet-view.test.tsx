// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import frDecision from "@/messages/fr/backoffice-decision.json";
import enDecision from "@/messages/en/backoffice-decision.json";
import type { ProductSheetViewModel } from "./sheet";

// I18N-BACKOFFICE-STRINGS: ProductSheetView also mounts DecisionPanel
// (lot 3), async too, its own `getTranslations("backoffice-decision")` —
// both zones' messages below, fr by default.
const messagesFr = { "backoffice-product-sheet": frSheet, "backoffice-decision": frDecision };
const messagesEn = { "backoffice-product-sheet": enSheet, "backoffice-decision": enDecision };

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

// ProductSheetView and its nested SheetHeader/FunnelCard/EmptyState text are
// Server Components: mocked with a real translator (product-tabs.test.tsx's
// comment). TrendChart, the one 'use client' leaf, still reads its
// translations from a NextIntlClientProvider (renderUi below) — both live
// side by side here, mirroring production (app/(backoffice)/layout.tsx
// forwards every backoffice* zone to the client provider).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet" | "backoffice-decision") =>
    createTranslator({ locale: "fr", messages: messagesFr, namespace }),
  // DecisionGauge (lot 3) also calls getFormatter() for its locale-aware
  // number formatting (decision-gauge.test.tsx's own mock, reproduced here).
  getFormatter: async () => ({ number: (value: number) => new Intl.NumberFormat("fr").format(value) }),
}));

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

async function renderUi(model: ProductSheetViewModel) {
  const { ProductSheetView } = await import("./product-sheet-view");
  const ui = await ProductSheetView({ sheet: model });
  return render(
    <NextIntlClientProvider locale="fr" messages={messagesFr}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ProductSheetView", () => {
  it("shows the funnel and trend chart when there is data", async () => {
    await renderUi(sheet());
    expect(screen.getByText("Visites landing")).toBeTruthy();
    expect(screen.getByText("Achats")).toBeTruthy(); // trend chart legend
    expect(screen.queryByText(/aucune donnée/i)).toBeNull();
  });

  it("shows an EmptyState with a sub-app link instead of the funnel and chart when there is no data", async () => {
    await renderUi(sheet({ hasData: false }));
    expect(screen.getByText(/aucune donnée/i)).toBeTruthy();
    expect(screen.queryByText("Visites landing")).toBeNull();
    // Two links point at the sub-app when there is no data: the header's and the EmptyState's.
    const links = screen.getAllByRole("link", { name: /my-product/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/my-product");
  });

  it("always shows the KPIs and the decision panel, with or without data", async () => {
    await renderUi(sheet({ hasData: false }));
    expect(screen.getByText("Revenu · 30 j")).toBeTruthy();
    expect(screen.getByText("Statut et seuils de décision")).toBeTruthy();
  });

  it("renders the empty state and the funnel title in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet" | "backoffice-decision") =>
        createTranslator({ locale: "en", messages: messagesEn, namespace }),
      getFormatter: async () => ({ number: (value: number) => new Intl.NumberFormat("en").format(value) }),
    }));
    vi.resetModules();
    const { ProductSheetView } = await import("./product-sheet-view");
    const ui = await ProductSheetView({ sheet: sheet({ hasData: false }) });
    render(
      <NextIntlClientProvider locale="en" messages={messagesEn}>
        {ui}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("No data yet")).toBeTruthy();
    // Two links share the "view live" label here too (the header's and the EmptyState's).
    expect(screen.getAllByRole("link", { name: /view \/my-product/i }).length).toBeGreaterThanOrEqual(2);
  });
});
