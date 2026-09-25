// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { FunnelRow } from "./sheet";
import { FunnelCard } from "./funnel-card";

afterEach(cleanup);

function row(overrides: Partial<FunnelRow> = {}): FunnelRow {
  return { type: "visit", label: "Visites landing", count: "1 200", rate: "—", widthPercent: 100, ...overrides };
}

describe("FunnelCard", () => {
  it("shows each row's label, count and pass rate", () => {
    render(
      <FunnelCard
        rows={[
          row(),
          row({ type: "first_generation", label: "1re génération", count: "400", rate: "33,3 %", widthPercent: 33 }),
        ]}
      />,
    );
    expect(screen.getByText("Visites landing")).toBeTruthy();
    expect(screen.getByText("1 200")).toBeTruthy();
    expect(screen.getByText("1re génération")).toBeTruthy();
    expect(screen.getByText("400")).toBeTruthy();
    expect(screen.getByText("33,3 %")).toBeTruthy();
  });

  it("sets each bar's width from widthPercent", () => {
    render(<FunnelCard rows={[row({ widthPercent: 42 })]} />);
    const bar = screen.getByTestId("funnel-bar-visit");
    expect(bar.style.width).toBe("42%");
  });
});
