// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { UsageWarning } from "./usage-warning";

afterEach(cleanup);

describe("UsageWarning", () => {
  it("shows 'Aucun produit' with no status role for a theme used by nobody", () => {
    render(<UsageWarning productNames={[]} />);
    expect(screen.getByText("Aucun produit")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a status-role warning for a theme used by one product", () => {
    render(<UsageWarning productNames={["LettrePro"]} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Utilisé par 1 produit · LettrePro. Les modifications s'appliquent immédiatement.");
  });

  it("shows a status-role warning for a theme used by several products", () => {
    render(<UsageWarning productNames={["DescriPro", "LettrePro"]} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(
      "Utilisé par 2 produits · DescriPro, LettrePro. Les modifications s'appliquent immédiatement.",
    );
  });
});
