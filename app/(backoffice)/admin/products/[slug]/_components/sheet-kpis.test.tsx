// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { SheetKpis } from "./sheet-kpis";

afterEach(cleanup);

describe("SheetKpis", () => {
  it("renders one card per KPI, with its label and value", () => {
    render(
      <SheetKpis
        kpis={[
          { label: "Revenu · 30 j", value: "24,70 €" },
          { label: "ARPU", value: "—" },
        ]}
      />,
    );
    expect(screen.getByText("Revenu · 30 j")).toBeTruthy();
    expect(screen.getByText("24,70 €")).toBeTruthy();
    expect(screen.getByText("ARPU")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });
});
