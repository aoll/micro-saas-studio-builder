// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { DecisionCopy } from "./decision-copy";
import { DecisionPanel } from "./decision-panel";

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

describe("DecisionPanel", () => {
  it("shows every threshold line and the current values", () => {
    render(<DecisionPanel decision={decision()} />);
    expect(screen.getByText("Visites minimales")).toBeTruthy();
    expect(screen.getByText("1 000")).toBeTruthy();
    expect(screen.getByText("1 200")).toBeTruthy();
    expect(screen.getByText("0,50 €")).toBeTruthy();
  });

  it("shows the suggestion headline and detail when there is one", () => {
    render(
      <DecisionPanel
        decision={decision({
          suggestion: { headline: "Seuil de décision atteint", detail: "Statut suggéré : Killed (à couper)" },
        })}
      />,
    );
    expect(screen.getByText("Seuil de décision atteint")).toBeTruthy();
    expect(screen.getByText("Statut suggéré : Killed (à couper)")).toBeTruthy();
  });

  it("shows nothing where the suggestion goes when there isn't one", () => {
    render(<DecisionPanel decision={decision({ suggestion: null })} />);
    expect(screen.queryByTestId("decision-suggestion")).toBeNull();
  });
});
