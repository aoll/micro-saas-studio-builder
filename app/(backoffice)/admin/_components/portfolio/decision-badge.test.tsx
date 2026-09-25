// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { DecisionBadge } from "./decision-badge";

afterEach(cleanup);

describe("DecisionBadge", () => {
  it('renders "à couper" for a kill decision, in a destructive colour', () => {
    render(<DecisionBadge decision="kill" />);
    const badge = screen.getByText("à couper");
    expect(badge.className).toContain("destructive");
  });

  it('renders "à scaler" for a scale decision', () => {
    render(<DecisionBadge decision="scale" />);
    expect(screen.getByText("à scaler")).toBeTruthy();
  });

  it("renders nothing for no decision", () => {
    const { container } = render(<DecisionBadge decision={null} />);
    expect(container.textContent).toBe("");
  });
});
