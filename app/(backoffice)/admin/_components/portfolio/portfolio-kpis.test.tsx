// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import { PortfolioKpis } from "./portfolio-kpis";

afterEach(cleanup);

function totals(overrides: Partial<PortfolioMetrics["totals"]> = {}): PortfolioMetrics["totals"] {
  return { visits: 4200, revenueCents: 29640, aiCostMicros: 11_600_000, marginMicros: 284_800_000, ...overrides };
}

// getByText's default normalizer collapses every Unicode space (narrow
// no-break, no-break…) to a plain " " on the DOM side, but does not touch
// the string passed in: the query itself must already use a plain space
// (@testing-library/dom's `matches()`, checked directly).
describe("PortfolioKpis", () => {
  it("shows the 4 labels with their values", () => {
    render(<PortfolioKpis totals={totals()} />);
    expect(screen.getByText("Visites · 30 j")).toBeTruthy();
    expect(screen.getByText("Revenu · 30 j")).toBeTruthy();
    expect(screen.getByText("Coût IA · 30 j")).toBeTruthy();
    expect(screen.getByText("Marge brute")).toBeTruthy();
  });

  it("formats visits with a thousands separator", () => {
    render(<PortfolioKpis totals={totals({ visits: 4200 })} />);
    expect(screen.getByText("4 200")).toBeTruthy();
  });

  it("shows an em dash for gross margin when there is no revenue", () => {
    render(<PortfolioKpis totals={totals({ revenueCents: 0, aiCostMicros: 0, marginMicros: 0 })} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("formats revenue in euros", () => {
    render(<PortfolioKpis totals={totals({ revenueCents: 2470 })} />);
    expect(screen.getByText("24,70 €")).toBeTruthy();
  });
});
