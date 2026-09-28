// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen, within } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import type { ProductSheetViewModel } from "./sheet";

// `SheetHeader` statically imports `StatusChange`, which statically imports
// `setProductStatus` from `../../_actions` (CLAUDE.md: every other
// `_actions.ts` consumer does the same). `_actions.ts` transitively imports
// the DAL (session → lib/auth → lib/db, products, product-status), which
// eagerly touches `env.DATABASE_URL` at module load: mocked at this
// boundary so this render-only test never needs a real database, without
// weakening anything it asserts.
vi.mock("@/lib/dal/session", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/dal/products", () => ({ getProduct: vi.fn() }));
vi.mock("@/lib/dal/product-status", () => ({ updateStatus: vi.fn() }));

// SheetHeader and the ProductTabs it nests are Server Components: mocked
// with a real translator (product-tabs.test.tsx's comment) so this stays a
// render-only test without a real next-intl request context.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
}));

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

describe("SheetHeader", () => {
  it("shows the product name, its status badge and links to the sub-app and the editor", async () => {
    const { SheetHeader } = await import("./sheet-header");
    render(await SheetHeader({ sheet: sheet() }));
    expect(screen.getByText("My Product")).toBeTruthy();
    expect(screen.getByTestId("status-badge")).toBeTruthy();
    const subAppLink = screen.getByRole("link", { name: /my-product/i });
    expect(subAppLink.getAttribute("href")).toBe("/my-product");
    expect(subAppLink.getAttribute("target")).toBe("_blank");
    const editLink = screen.getByRole("link", { name: /modifier/i });
    expect(editLink.getAttribute("href")).toBe("/admin/products/my-product/edit");
  });

  it("shows the DecisionBadge when there is a suggested decision", async () => {
    const { SheetHeader } = await import("./sheet-header");
    render(
      await SheetHeader({
        sheet: sheet({
          decision: {
            thresholds: [],
            current: { visits: "", conversion: "", margin: "" },
            suggestion: null,
            badge: "kill",
          },
        }),
      }),
    );
    expect(screen.getByText("à couper")).toBeTruthy();
  });

  it("shows a closed banner instead of the DecisionBadge for a killed product", async () => {
    const { SheetHeader } = await import("./sheet-header");
    render(
      await SheetHeader({
        sheet: sheet({
          status: "killed",
          decision: {
            thresholds: [],
            current: { visits: "", conversion: "", margin: "" },
            suggestion: null,
            badge: null,
          },
        }),
      }),
    );
    expect(screen.getByText(/produit fermé/i)).toBeTruthy();
    expect(screen.getByText(/SA-08/)).toBeTruthy();
  });

  it("still shows the sub-app link for a killed product", async () => {
    const { SheetHeader } = await import("./sheet-header");
    render(await SheetHeader({ sheet: sheet({ status: "killed", slug: "gone" }) }));
    const subAppLink = screen.getByRole("link", { name: /gone/i });
    expect(subAppLink.getAttribute("href")).toBe("/gone");
  });

  // specs/mockups/BO-06.png: "Changer de statut" sits top-right, alongside
  // "Voir /{slug}" and "Modifier la config", not below the header row.
  it("puts the status-change trigger in the top-right action group, next to the sub-app link and Modifier la config", async () => {
    const { SheetHeader } = await import("./sheet-header");
    render(await SheetHeader({ sheet: sheet() }));
    const actions = screen.getByTestId("sheet-actions");
    expect(within(actions).getByRole("link", { name: /my-product/i })).toBeTruthy();
    expect(within(actions).getByRole("link", { name: /modifier/i })).toBeTruthy();
    expect(within(actions).getByRole("button", { name: "Changer de statut" })).toBeTruthy();
  });

  // specs/mockups/BO-03.png and BO-04.png: the same "Vue d'ensemble / Activité"
  // tabs appear on both screens, so a visitor on the sheet can reach the
  // activity screen and back.
  it("mounts the Vue d'ensemble / Activité tabs, with Vue d'ensemble current", async () => {
    const { SheetHeader } = await import("./sheet-header");
    render(await SheetHeader({ sheet: sheet({ slug: "my-product" }) }));
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.getAttribute("href")).toBe("/admin/products/my-product");
    expect(activity.getAttribute("href")).toBe("/admin/products/my-product/activity");
    expect(overview.className).toContain("border-foreground");
    expect(activity.className).not.toContain("border-foreground");
    // components/backoffice/nav-link.tsx:13 convention.
    expect(overview.getAttribute("aria-current")).toBe("page");
    expect(activity.getAttribute("aria-current")).toBeNull();
  });

  it("renders the edit link and the killed banner in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
    }));
    vi.resetModules();
    const { SheetHeader } = await import("./sheet-header");
    render(
      await SheetHeader({
        sheet: sheet({
          status: "killed",
          slug: "gone",
          decision: {
            thresholds: [],
            current: { visits: "", conversion: "", margin: "" },
            suggestion: null,
            badge: null,
          },
        }),
      }),
    );
    const editLink = screen.getByRole("link", { name: /edit configuration/i });
    expect(editLink.getAttribute("href")).toBe("/admin/products/gone/edit");
    expect(screen.getByText(/closed product \(Killed\)/i)).toBeTruthy();
    expect(screen.getByText(/SA-08/)).toBeTruthy();
  });
});
