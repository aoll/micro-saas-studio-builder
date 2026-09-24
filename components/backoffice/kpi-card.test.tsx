// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { KpiCard } from "./kpi-card";

afterEach(cleanup);

describe("KpiCard", () => {
  it("renders the label and value", () => {
    render(<KpiCard label="Revenu" value="1 234 €" />);
    expect(screen.getByText("Revenu")).toBeTruthy();
    expect(screen.getByText("1 234 €")).toBeTruthy();
  });

  it("colours a 'down' trend as destructive", () => {
    render(<KpiCard label="Conversion" value="1 %" delta={{ text: "-2 %", trend: "down" }} />);
    const delta = screen.getByText("-2 %");
    expect(delta.className).toContain("destructive");
  });

  it("does not use the destructive colour for an 'up' trend", () => {
    render(<KpiCard label="Conversion" value="6 %" delta={{ text: "+2 %", trend: "up" }} />);
    const delta = screen.getByText("+2 %");
    expect(delta.className).not.toContain("destructive");
  });

  it("renders a sparkline polyline with 3 normalised points for 3 points", () => {
    const { container } = render(<KpiCard label="Visites" value="120" points={[1, 3, 2]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    const points = polyline!.getAttribute("points")!.trim().split(/\s+/);
    expect(points).toHaveLength(3);
  });

  it("renders no sparkline for 0 or 1 point", () => {
    const { container: zero } = render(<KpiCard label="Visites" value="0" points={[]} />);
    expect(zero.querySelector("polyline")).toBeNull();

    const { container: one } = render(<KpiCard label="Visites" value="5" points={[4]} />);
    expect(one.querySelector("polyline")).toBeNull();
  });
});
