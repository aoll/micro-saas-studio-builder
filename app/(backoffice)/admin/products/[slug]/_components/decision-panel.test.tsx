// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DecisionCopy } from "./decision-copy";
import { DecisionPanel } from "./decision-panel";

// `DecisionPanel` statically imports `StatusChange`, which statically
// imports `setProductStatus` from `../_actions` (CLAUDE.md: every other
// `_actions.ts` consumer does the same). `_actions.ts` transitively imports
// the DAL (session → lib/auth → lib/db, products, product-status), which
// eagerly touches `env.DATABASE_URL` at module load: mocked at this
// boundary so this render-only test never needs a real database.
vi.mock("@/lib/dal/session", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/dal/products", () => ({ getProduct: vi.fn() }));
vi.mock("@/lib/dal/product-status", () => ({ updateStatus: vi.fn() }));

afterEach(cleanup);

function decision(overrides: Partial<DecisionCopy> = {}): DecisionCopy {
  return {
    thresholds: [
      { label: "Visites minimales", value: "1 000" },
      { label: "Conversion « à couper » sous", value: "2 %" },
      { label: "Conversion « à scaler » à partir de", value: "5 %" },
      { label: "Marge positive exigée", value: "Oui" },
    ],
    current: { visits: "1 200", conversion: "7 %", margin: "0,50 €" },
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

describe("DecisionPanel", () => {
  it("shows every threshold line and the current values", () => {
    render(<DecisionPanel decision={decision()} product={product} metrics={metrics} thresholds={thresholds} />);
    expect(screen.getByText("Visites minimales")).toBeTruthy();
    expect(screen.getByText("1 000")).toBeTruthy();
    expect(screen.getByText("1 200")).toBeTruthy();
    expect(screen.getByText("0,50 €")).toBeTruthy();
  });

  it("renders the threshold gauge with a marker for the current conversion rate", () => {
    render(<DecisionPanel decision={decision()} product={product} metrics={metrics} thresholds={thresholds} />);
    expect(screen.getByTestId("gauge-marker")).toBeTruthy();
  });

  it("shows the visits-gate note instead of a marker note when below minVisits", () => {
    render(
      <DecisionPanel
        decision={decision()}
        product={product}
        metrics={{ ...metrics, visits: 400 }}
        thresholds={thresholds}
      />,
    );
    expect(screen.getByText(/Seuil de visites non atteint/)).toBeTruthy();
  });

  it("shows the suggestion headline and detail when there is one", () => {
    render(
      <DecisionPanel
        decision={decision({
          suggestion: { headline: "Seuil de décision atteint", detail: "Statut suggéré : Killed (à couper)" },
          badge: "kill",
        })}
        product={product}
        metrics={metrics}
        thresholds={thresholds}
      />,
    );
    expect(screen.getByText("Seuil de décision atteint")).toBeTruthy();
    expect(screen.getByText("Statut suggéré : Killed (à couper)")).toBeTruthy();
  });

  it("shows nothing where the suggestion goes when there isn't one", () => {
    render(
      <DecisionPanel
        decision={decision({ suggestion: null })}
        product={product}
        metrics={metrics}
        thresholds={thresholds}
      />,
    );
    expect(screen.queryByTestId("decision-suggestion")).toBeNull();
  });

  // specs/mockups/BO-06.png · task item 2: StatusChange also mounts inside the
  // "Seuil de décision atteint" box, so the admin can act right where the
  // suggestion is justified.
  it("mounts the status-change trigger inside the suggestion box for a kill suggestion", () => {
    render(
      <DecisionPanel
        decision={decision({
          suggestion: { headline: "Seuil de décision atteint", detail: "Statut suggéré : Killed (à couper)" },
          badge: "kill",
        })}
        product={product}
        metrics={metrics}
        thresholds={thresholds}
      />,
    );
    const box = screen.getByTestId("decision-suggestion");
    expect(
      screen.getByRole("button", { name: "Changer de statut" }).closest('[data-testid="decision-suggestion"]'),
    ).toBe(box);
  });

  it("mounts the status-change trigger inside the suggestion box for a scale suggestion", () => {
    render(
      <DecisionPanel
        decision={decision({
          suggestion: { headline: "Seuil de décision atteint", detail: "Statut suggéré : Scale (à scaler)" },
          badge: "scale",
        })}
        product={product}
        metrics={metrics}
        thresholds={thresholds}
      />,
    );
    expect(screen.getByRole("button", { name: "Changer de statut" })).toBeTruthy();
  });

  it("does not mount the status-change trigger when the suggestion has no badge (not enough visits)", () => {
    render(
      <DecisionPanel
        decision={decision({
          suggestion: { headline: "Pas assez de visites pour décider", detail: "500 / 1 000" },
          badge: null,
        })}
        product={product}
        metrics={metrics}
        thresholds={thresholds}
      />,
    );
    expect(screen.queryByRole("button", { name: "Changer de statut" })).toBeNull();
  });

  it("does not mount the status-change trigger when there is no suggestion at all", () => {
    render(
      <DecisionPanel
        decision={decision({ suggestion: null })}
        product={product}
        metrics={metrics}
        thresholds={thresholds}
      />,
    );
    expect(screen.queryByRole("button", { name: "Changer de statut" })).toBeNull();
  });
});
