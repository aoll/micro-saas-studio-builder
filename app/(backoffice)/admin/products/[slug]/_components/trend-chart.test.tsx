// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TrendPoint } from "./sheet";
import { TrendChart } from "./trend-chart";

// Recharts' <ResponsiveContainer> measures itself with ResizeObserver, which jsdom does not
// implement (plan's risk table: "Recharts in jsdom").
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

const points: TrendPoint[] = [
  { date: "01/09", visits: 10, purchases: 1 },
  { date: "02/09", visits: 20, purchases: 2 },
];

describe("TrendChart", () => {
  it("shows an HTML legend naming the two series", () => {
    render(<TrendChart points={points} />);
    expect(screen.getByText("Visites")).toBeTruthy();
    expect(screen.getByText("Achats")).toBeTruthy();
  });

  it("draws the two series in distinct colours, purchases dashed, like the BO-03 mockup", () => {
    render(<TrendChart points={points} />);
    const visits = screen.getByTestId("legend-visits");
    const purchases = screen.getByTestId("legend-purchases");
    expect(visits.style.borderColor).not.toBe(purchases.style.borderColor);
    expect(visits.style.borderStyle).toBe("solid");
    expect(purchases.style.borderStyle).toBe("dashed");
  });
});
