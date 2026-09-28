// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frDecision from "@/messages/fr/backoffice-decision.json";
import type { DecisionCopy } from "./decision-copy";

// `DecisionPanel` statically imports `StatusChange`, which statically
// imports `setProductStatus` from `../_actions` (CLAUDE.md: every other
// `_actions.ts` consumer does the same). `_actions.ts` transitively imports
// the DAL (session → lib/auth → lib/db, products, product-status), which
// eagerly touches `env.DATABASE_URL` at module load: mocked at this
// boundary so this render-only test never needs a real database.
vi.mock("@/lib/dal/session", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/dal/products", () => ({ getProduct: vi.fn() }));
vi.mock("@/lib/dal/product-status", () => ({ updateStatus: vi.fn() }));

// I18N-BACKOFFICE-STRINGS (lot 3): DecisionPanel and DecisionGauge (which it
// awaits internally, see decision-gauge.tsx) both call
// getTranslations("backoffice-decision") — mocked once with a real
// translator, the movement-list.test.tsx pattern. StatusChange, a 'use
// client' leaf, reads the same zone through useTranslations, so `render()`
// below wraps the resolved tree in a real NextIntlClientProvider instead.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-decision") =>
    createTranslator({ locale: "fr", messages: { "backoffice-decision": frDecision }, namespace }),
  getFormatter: async () => ({
    number: (value: number) => new Intl.NumberFormat("fr").format(value),
  }),
  getLocale: async () => "fr",
}));

afterEach(cleanup);

function decision(overrides: Partial<DecisionCopy> = {}): DecisionCopy {
  return {
    thresholds: [
      { key: "minVisits", value: "1 000" },
      { key: "killMaxConversion", value: "2 %" },
      { key: "scaleMinConversion", value: "5 %" },
      { key: "positiveMarginRequired", value: true },
    ],
    current: { visits: "1 200", conversion: "7 %", margin: "0,50 €" },
    suggestion: null,
    badge: null,
    ...overrides,
  };
}

const product = { productId: "p1", slug: "my-product", name: "My Product", status: "test" as const };
const thresholds = {
  minVisits: 1000,
  killMaxConversion: 0.02,
  scaleMinConversion: 0.05,
  scaleRequiresPositiveMargin: true,
};
const metrics = { visits: 1200, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 };

async function renderPanel(props: Parameters<typeof import("./decision-panel").DecisionPanel>[0]) {
  const { DecisionPanel } = await import("./decision-panel");
  const ui = await DecisionPanel(props);
  return render(
    <NextIntlClientProvider locale="fr" messages={{ "backoffice-decision": frDecision }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("DecisionPanel", () => {
  it("shows every threshold line and the current values", async () => {
    await renderPanel({ decision: decision(), product, metrics, thresholds });
    expect(screen.getByText("Visites minimales")).toBeTruthy();
    expect(screen.getByText("1 000")).toBeTruthy();
    expect(screen.getByText("1 200")).toBeTruthy();
    expect(screen.getByText("0,50 €")).toBeTruthy();
  });

  it("translates the positiveMarginRequired boolean, never showing a raw true/false", async () => {
    await renderPanel({
      decision: decision({ thresholds: [{ key: "positiveMarginRequired", value: true }] }),
      product,
      metrics,
      thresholds,
    });
    expect(screen.getByText("Oui")).toBeTruthy();
  });

  it("renders the threshold gauge with a marker for the current conversion rate", async () => {
    await renderPanel({ decision: decision(), product, metrics, thresholds });
    expect(screen.getByTestId("gauge-marker")).toBeTruthy();
  });

  it("shows the visits-gate note instead of a marker note when below minVisits", async () => {
    await renderPanel({ decision: decision(), product, metrics: { ...metrics, visits: 400 }, thresholds });
    expect(screen.getByText(/Seuil de visites non atteint/)).toBeTruthy();
  });

  it("shows the suggestion headline and detail for a not-enough-visits suggestion", async () => {
    await renderPanel({
      decision: decision({ suggestion: { kind: "notEnoughVisits", visits: "500", minVisits: "1 000" } }),
      product,
      metrics,
      thresholds,
    });
    expect(screen.getByText("Pas assez de visites pour décider")).toBeTruthy();
    expect(screen.getByText("500 / 1 000")).toBeTruthy();
  });

  it("shows the suggestion headline and detail for a kill suggestion", async () => {
    await renderPanel({
      decision: decision({ suggestion: { kind: "thresholdReached", decision: "kill" }, badge: "kill" }),
      product,
      metrics,
      thresholds,
    });
    expect(screen.getByText("Seuil de décision atteint")).toBeTruthy();
    expect(screen.getByText("Statut suggéré : Killed (à couper)")).toBeTruthy();
  });

  it("shows nothing where the suggestion goes when there isn't one", async () => {
    await renderPanel({ decision: decision({ suggestion: null }), product, metrics, thresholds });
    expect(screen.queryByTestId("decision-suggestion")).toBeNull();
  });

  // specs/mockups/BO-06.png · task item 2: StatusChange also mounts inside the
  // "Seuil de décision atteint" box, so the admin can act right where the
  // suggestion is justified.
  it("mounts the status-change trigger inside the suggestion box for a kill suggestion", async () => {
    await renderPanel({
      decision: decision({ suggestion: { kind: "thresholdReached", decision: "kill" }, badge: "kill" }),
      product,
      metrics,
      thresholds,
    });
    const box = screen.getByTestId("decision-suggestion");
    expect(
      screen.getByRole("button", { name: "Changer de statut" }).closest('[data-testid="decision-suggestion"]'),
    ).toBe(box);
  });

  it("mounts the status-change trigger inside the suggestion box for a scale suggestion", async () => {
    await renderPanel({
      decision: decision({ suggestion: { kind: "thresholdReached", decision: "scale" }, badge: "scale" }),
      product,
      metrics,
      thresholds,
    });
    expect(screen.getByRole("button", { name: "Changer de statut" })).toBeTruthy();
  });

  it("does not mount the status-change trigger when the suggestion has no badge (not enough visits)", async () => {
    await renderPanel({
      decision: decision({ suggestion: { kind: "notEnoughVisits", visits: "500", minVisits: "1 000" }, badge: null }),
      product,
      metrics,
      thresholds,
    });
    expect(screen.queryByRole("button", { name: "Changer de statut" })).toBeNull();
  });

  it("does not mount the status-change trigger when there is no suggestion at all", async () => {
    await renderPanel({ decision: decision({ suggestion: null }), product, metrics, thresholds });
    expect(screen.queryByRole("button", { name: "Changer de statut" })).toBeNull();
  });
});
